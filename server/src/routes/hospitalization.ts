/**
 * Hospitalization / Inpatient management routes.
 *
 * Covers the full inpatient lifecycle:
 *   - Kennel (bed) management: create, list with occupancy
 *   - Admission: assign patient to kennel, set estimated cost
 *   - Clinical rounds: flowsheet entries, SOAP notes, prescriptions
 *   - Discharge: auto-generates an invoice from flowsheet billables
 *
 * @module hospitalization
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';
import { logStockMovement } from '../utils/stockMovementLogger.js';
import { z } from 'zod';
import { sanitizeObject } from '../utils/sanitize.js';

const admitSchema = z.object({
    patientId: z.string(),
    kennelId: z.string(),
    reason: z.string().optional(),
    estimatedCost: z.number().optional(),
});

const kennelCreateSchema = z.object({
    name: z.string().min(1),
    type: z.string().optional(),
    size: z.string().optional(),
    chargePerNight: z.number().optional(),
    category: z.string().optional(),
});

const hospitalizationUpdateSchema = z.object({
    criticalAlert: z.string().optional(),
    nursingInstructions: z.string().optional(),
    treatmentPlan: z.string().optional(),
    doctorInChargeId: z.string().optional(),
});

const flowsheetSchema = z.object({
    temperature: z.number().optional(),
    heartRate: z.number().optional(),
    respiratoryRate: z.number().optional(),
    notes: z.string().optional(),
    medicationsGiven: z.string().optional(),
    deductInventoryItems: z.array(z.object({
        id: z.string(),
        quantity: z.number().optional(),
    })).optional(),
});

const soapNoteSchema = z.object({
    subjective: z.string().optional(),
    objective: z.string().optional(),
    assessment: z.string().optional(),
    plan: z.string().optional(),
    date: z.string().optional(),
});

const prescriptionCreateSchema = z.object({
    drugName: z.string().min(1),
    dose: z.string(),
    route: z.string(),
    frequency: z.string(),
    inventoryItemId: z.string().optional(),
});

const prescriptionUpdateSchema = z.object({
    status: z.string(),
});

const router = Router();

// ===========================================================================
// KENNELS
// ===========================================================================

/** GET /kennels  —  List all kennels with current occupancy. */
router.get('/kennels', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId } = req.user!;
        const kennels = await prisma.kennel.findMany({
            where: { clinicId },
            include: {
                hospitalizations: {
                    where: { status: 'Admitted' },
                    include: {
                        patient: true,
                        vet: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
        res.json(kennels);
    } catch (error) {
        console.error('Error fetching kennels:', error);
        res.status(500).json({ error: 'Failed to fetch kennels' });
    }
});

/** POST /kennels  —  Create a new kennel (bed). */
router.post('/kennels', authenticate, async (req: AuthRequest, res) => {
    req.body = sanitizeObject(req.body);
    const parsed = kennelCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { name, type, size, chargePerNight, category } = parsed.data;
    try {
        const { clinicId } = req.user!;
        const kennel = await prisma.kennel.create({
            data: {
                clinicId: clinicId!,
                name,
                type: type || 'General Ward',
                size: size || null,
                chargePerNight: chargePerNight || 0,
                category: category || 'General',
            },
        });
        res.status(201).json(kennel);
    } catch (error) {
        console.error('Error creating kennel:', error);
        res.status(500).json({ error: 'Failed to create kennel' });
    }
});

// ===========================================================================
// HOSPITALIZATIONS — ADMIT, ROUNDS, DISCHARGE
// ===========================================================================

/**
 * POST /admit  —  Admit a patient to a kennel.
 *
 * Validates kennel availability, creates the hospitalization record,
 * and marks the kennel as Occupied — all inside a transaction.
 */
router.post('/admit', authenticate, async (req: AuthRequest, res) => {
    req.body = sanitizeObject(req.body);
    const parsed = admitSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { patientId, kennelId, reason, estimatedCost } = parsed.data;
    try {
        const { clinicId, id: vetId } = req.user!;

        const kennel = await prisma.kennel.findUnique({ where: { id: kennelId } });
        if (!kennel || kennel.status !== 'Available') {
            return res.status(400).json({ error: 'Kennel is not available' });
        }

        const hospitalization = await prisma.$transaction(async (tx: any) => {
            const hosp = await tx.hospitalization.create({
                data: {
                    clinicId,
                    patientId,
                    vetId,
                    kennelId,
                    reason,
                    estimatedCost: Number(estimatedCost || 0),
                },
                include: { patient: true, kennel: true },
            });
            await tx.kennel.update({
                where: { id: kennelId },
                data: { status: 'Occupied' },
            });
            return hosp;
        });

        if (req.user?.id) {
            await logAudit(
                req.user.id,
                'HOSPITALIZATION',
                'ADMIT',
                `Admitted patient ${patientId} to kennel ${kennelId}`,
                clinicId!,
                req.user.name,
            );
        }

        res.status(201).json(hospitalization);
    } catch (error) {
        console.error('Error admitting patient:', error);
        res.status(500).json({ error: 'Failed to admit patient' });
    }
});

/** GET /rounds  —  List all currently admitted patients for rounds. */
router.get('/rounds', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId } = req.user!;
        const hospitalizations = await prisma.hospitalization.findMany({
            where: { clinicId, status: 'Admitted' },
            include: {
                patient: true,
                kennel: true,
                vet: { select: { id: true, name: true } },
                doctorInCharge: { select: { id: true, name: true } },
            },
            orderBy: { admissionDate: 'desc' },
        });
        res.json(hospitalizations);
    } catch (error) {
        console.error('Error fetching rounds summary:', error);
        res.status(500).json({ error: 'Failed to fetch rounds summary' });
    }
});

/** PATCH /:id  —  Update clinical parameters (critical alerts, nursing notes, etc.). */
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
    req.body = sanitizeObject(req.body);
    const parsed = hospitalizationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { criticalAlert, nursingInstructions, treatmentPlan, doctorInChargeId } = parsed.data;
    try {
        const id = req.params.id as string;

        const updated = await prisma.hospitalization.update({
            where: { id, clinicId: req.user!.clinicId! },
            data: { criticalAlert, nursingInstructions, treatmentPlan, doctorInChargeId },
            include: {
                patient: true,
                kennel: true,
                doctorInCharge: { select: { id: true, name: true } },
            },
        });

        if (req.user?.id) {
            await logAudit(
                req.user.id,
                'HOSPITALIZATION',
                'UPDATE',
                `Updated clinical parameters for hospitalization ${id}`,
                req.user.clinicId!,
                req.user.name,
            );
        }

        res.json(updated);
    } catch (error) {
        console.error('Error updating hospitalization:', error);
        res.status(500).json({ error: 'Failed to update hospitalization' });
    }
});

/**
 * PUT /:id/discharge  —  Discharge a patient and generate invoice.
 *
 * Aggregates billed items from:
 *   1. Flowsheet entries (administered medications, procedures)
 *   2. Prescription drugs not yet billed via flowsheet
 *
 * Creates an INVOICE sale with all items, then marks the hospitalization
 * as Discharged and the kennel as Available.
 */
router.put('/:id/discharge', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const result = await prisma.$transaction(async (tx: any) => {
            const hosp = await tx.hospitalization.findUnique({
                where: { id, clinicId: req.user!.clinicId! },
                include: {
                    patient: true,
                    clinic: true,
                    flowsheetEntries: true,
                    prescriptions: {
                        where: { status: 'Active' },
                        include: { inventoryItem: true },
                    },
                },
            });

            if (!hosp) throw new Error('Hospitalization not found or access denied');

            // Aggregate billed items from flowsheet entries
            const itemsToBill: Record<
                string,
                { itemId: string; name: string; quantity: number; price: number }
            > = {};
            const flowsheetBilledItemIds = new Set<string>();

            hosp.flowsheetEntries.forEach((entry: any) => {
                if (entry.billedItems && Array.isArray(entry.billedItems)) {
                    entry.billedItems.forEach((item: any) => {
                        const key = item.itemId;
                        flowsheetBilledItemIds.add(key);
                        if (!itemsToBill[key]) {
                            itemsToBill[key] = { ...item };
                        } else {
                            itemsToBill[key].quantity += item.quantity;
                        }
                    });
                }
            });

            // Include prescription drugs not yet billed via flowsheet
            hosp.prescriptions.forEach((rx: any) => {
                if (
                    rx.inventoryItemId &&
                    !flowsheetBilledItemIds.has(rx.inventoryItemId) &&
                    rx.inventoryItem
                ) {
                    const key = `rx_${rx.id}`;
                    itemsToBill[key] = {
                        itemId: rx.inventoryItemId,
                        name: `${rx.drugName} (Rx - not administered)`,
                        quantity: 0,
                        price: Number(rx.inventoryItem.retailPrice || 0),
                    };
                }
            });

            const billableItemsData = Object.values(itemsToBill).filter((i) => i.quantity > 0);

            // Generate invoice number (HOSP-prefixed with gap-filling collision check)
            const acronym = hosp.clinic.acronym || 'VET';
            const count = await tx.sale.count({ where: { clinicId: hosp.clinicId } });
            let invoiceNumber = '';
            for (let offset = 1; offset <= 1000; offset++) {
                const candidate = `HOSP-${(count + offset).toString().padStart(4, '0')}/${acronym}`;
                const existing = await tx.sale.findFirst({
                    where: { clinicId: hosp.clinicId, invoiceNumber: candidate },
                });
                if (!existing) {
                    invoiceNumber = candidate;
                    break;
                }
            }
            if (!invoiceNumber) {
                throw new Error('Could not generate unique invoice number');
            }

            let subtotal = Number(hosp.estimatedCost || 0);
            const saleItems: any[] = [
                {
                    name: `Base Hospitalization Fee (${hosp.reason || 'Medical Care'})`,
                    quantity: 1,
                    pricePerUnit: Number(hosp.estimatedCost || 0),
                },
            ];

            billableItemsData.forEach((item) => {
                const totalItemPrice = item.price * item.quantity;
                subtotal += totalItemPrice;
                saleItems.push({
                    itemId: item.itemId,
                    name: item.name,
                    quantity: item.quantity,
                    pricePerUnit: item.price,
                });
            });

            const sale = await tx.sale.create({
                data: {
                    clinicId: hosp.clinicId,
                    clientId: hosp.patient.ownerId,
                    invoiceNumber,
                    type: 'INVOICE',
                    status: 'Pending',
                    subtotal: subtotal,
                    total: subtotal,
                    balanceDue: subtotal,
                    amountPaid: 0,
                    issuerName: 'System (Auto-Hosp)',
                    items: {
                        create: saleItems.map((si) => ({
                            itemId: si.itemId || null,
                            name: si.name,
                            quantity: si.quantity,
                            pricePerUnit: si.pricePerUnit,
                        })),
                    },
                },
            });

            const updatedHosp = await tx.hospitalization.update({
                where: { id },
                data: {
                    status: 'Discharged',
                    dischargeDate: new Date(),
                    saleId: sale.id,
                },
            });

            await tx.kennel.update({
                where: { id: hosp.kennelId },
                data: { status: 'Available' },
            });

            if (req.user?.id) {
                await logAudit(
                    req.user.id,
                    'HOSPITALIZATION',
                    'DISCHARGE',
                    `Discharged patient ${hosp.patientId} from hospitalization ${id}`,
                    hosp.clinicId,
                    req.user.name,
                );
            }

            return { hospitalization: updatedHosp, saleId: sale.id };
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error discharging patient:', error);
        res.status(500).json({ error: error.message || 'Failed to discharge patient' });
    }
});

// ===========================================================================
// FLOWSHEET
// ===========================================================================

/**
 * POST /:id/flowsheet  —  Add a flowsheet entry (clinical observation + inventory deduction).
 *
 * Records vitals, medications given, and deducts inventory items used
 * during the round. Stock validation prevents negative inventory.
 * Each deduction is logged as a stock movement.
 */
router.post('/:id/flowsheet', authenticate, async (req: AuthRequest, res) => {
    req.body = sanitizeObject(req.body);
    const parsed = flowsheetSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { temperature, heartRate, respiratoryRate, notes, medicationsGiven, deductInventoryItems } = parsed.data;
    try {
        const id = req.params.id as string;
        const { id: staffId } = req.user!;

        const entry = await prisma.$transaction(async (tx: any) => {
            const billedItems: any[] = [];

            if (deductInventoryItems && Array.isArray(deductInventoryItems)) {
                for (const item of deductInventoryItems) {
                    if (item.id) {
                        const invItem = await tx.inventoryItem.findUnique({
                            where: { id: item.id },
                        });
                        if (!invItem) continue;

                        const deductQty = Number(item.quantity || 1);

                        if (invItem.quantity < deductQty) {
                            throw new Error(
                                `Insufficient stock for ${invItem.name}. Available: ${invItem.quantity}, Requested: ${deductQty}`,
                            );
                        }

                        billedItems.push({
                            itemId: invItem.id,
                            name: invItem.name,
                            quantity: deductQty,
                            price: Number(invItem.retailPrice || 0),
                        });

                        await tx.inventoryItem.update({
                            where: { id: item.id },
                            data: { quantity: { decrement: deductQty } },
                        });

                        await logStockMovement({
                            clinicId: req.user!.clinicId!,
                            itemId: invItem.id,
                            type: 'adjustment',
                            quantity: -deductQty,
                            balanceAfter: invItem.quantity - deductQty,
                            reference: `flowsheet-${id}`,
                            note: `Flowsheet inventory deduction for hospitalization ${id}`,
                            userId: req.user?.id,
                        });
                    }
                }
            }

            const newEntry = await tx.flowsheetEntry.create({
                data: {
                    hospitalizationId: id,
                    staffId,
                    temperature,
                    heartRate,
                    respiratoryRate,
                    notes,
                    medicationsGiven,
                    billedItems: billedItems.length > 0 ? billedItems : undefined,
                },
                include: { staff: { select: { id: true, name: true } } },
            });

            return newEntry;
        });

        if (req.user?.id) {
            await logAudit(
                req.user.id,
                'HOSPITALIZATION',
                'FLOWSHEET_ENTRY',
                `Added flowsheet entry for hospitalization ${id}`,
                req.user.clinicId!,
                req.user.name,
            );
        }

        res.status(201).json(entry);
    } catch (error: any) {
        console.error('Error creating flowsheet entry:', error);
        res.status(500).json({ error: error.message || 'Failed to add flowsheet entry' });
    }
});

/** GET /:id/flowsheet  —  Get all flowsheet entries for a hospitalization. */
router.get('/:id/flowsheet', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const entries = await prisma.flowsheetEntry.findMany({
            where: { hospitalizationId: id as string },
            include: { staff: { select: { id: true, name: true } } },
            orderBy: { time: 'desc' },
        });
        res.json(entries);
    } catch (error) {
        console.error('Error fetching flowsheet:', error);
        res.status(500).json({ error: 'Failed to fetch flowsheet' });
    }
});

// ===========================================================================
// DAILY NOTES (SOAP)
// ===========================================================================

/** POST /:id/notes  —  Add a SOAP note for clinical rounds. */
router.post('/:id/notes', authenticate, async (req: AuthRequest, res) => {
    req.body = sanitizeObject(req.body);
    const parsed = soapNoteSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { subjective, objective, assessment, plan, date } = parsed.data;
    try {
        const { id } = req.params;
        const { id: vetId } = req.user!;

        const note = await prisma.hospitalizationNote.create({
            data: {
                hospitalizationId: id as string,
                vetId: vetId as string,
                date: date ? new Date(date) : new Date(),
                subjective,
                objective,
                assessment,
                plan,
            },
            include: { vet: { select: { id: true, name: true } } },
        });

        if (req.user?.id) {
            await logAudit(
                req.user.id,
                'HOSPITALIZATION',
                'SOAP_NOTE',
                `Added clinical SOAP note for hospitalization ${id}`,
                req.user.clinicId!,
                req.user.name,
            );
        }

        res.status(201).json(note);
    } catch (error) {
        console.error('Error adding daily note:', error);
        res.status(500).json({ error: 'Failed to add daily note' });
    }
});

/** GET /:id/notes  —  Get all SOAP notes for a hospitalization. */
router.get('/:id/notes', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const notes = await prisma.hospitalizationNote.findMany({
            where: { hospitalizationId: id as string },
            include: { vet: { select: { id: true, name: true } } },
            orderBy: { date: 'desc' },
        });
        res.json(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// ===========================================================================
// PRESCRIPTIONS
// ===========================================================================

/** POST /:id/prescriptions  —  Add a prescription to a hospitalization. */
router.post('/:id/prescriptions', authenticate, async (req: AuthRequest, res) => {
    req.body = sanitizeObject(req.body);
    const parsed = prescriptionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { drugName, dose, route, frequency, inventoryItemId } = parsed.data;
    try {
        const { id } = req.params;
        const { id: vetId } = req.user!;

        const prescription = await prisma.hospitalizationPrescription.create({
            data: {
                hospitalizationId: id as string,
                vetId: vetId as string,
                drugName,
                dose,
                route,
                frequency,
                inventoryItemId,
            },
            include: { vet: { select: { id: true, name: true } } },
        });
        res.status(201).json(prescription);
    } catch (error) {
        console.error('Error adding prescription:', error);
        res.status(500).json({ error: 'Failed to add prescription' });
    }
});

/** GET /:id/prescriptions  —  List prescriptions for a hospitalization. */
router.get('/:id/prescriptions', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const prescriptions = await prisma.hospitalizationPrescription.findMany({
            where: { hospitalizationId: id as string },
            include: { vet: { select: { id: true, name: true } } },
            orderBy: { datePrescribed: 'desc' },
        });
        res.json(prescriptions);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        res.status(500).json({ error: 'Failed to fetch prescriptions' });
    }
});

/** PUT /:id/prescriptions/:prescriptionId  —  Update a prescription (e.g. status). */
router.put('/:id/prescriptions/:prescriptionId', authenticate, async (req: AuthRequest, res) => {
    req.body = sanitizeObject(req.body);
    const parsed = prescriptionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { status } = parsed.data;
    try {
        const { prescriptionId } = req.params;

        const prescription = await prisma.hospitalizationPrescription.update({
            where: { id: prescriptionId as string },
            data: { status },
        });
        res.json(prescription);
    } catch (error) {
        console.error('Error updating prescription:', error);
        res.status(500).json({ error: 'Failed to update prescription' });
    }
});

export default router;
