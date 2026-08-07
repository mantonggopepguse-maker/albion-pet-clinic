import { prisma } from '../db.js';

/**
 * Creates an audit log entry tracking user actions across the system.
 *
 * Used for compliance, security monitoring, and debugging. Falls back to
 * querying the database for missing clinic/user info when optional params
 * are omitted. Errors are logged to console but never thrown — audit
 * failures must never block the primary operation.
 *
 * @param userId   - The actor's user ID
 * @param module   - Module name (e.g. 'SALES', 'FINANCE', 'INVENTORY')
 * @param action   - Short action description (e.g. 'CREATE', 'Payment Verified')
 * @param details  - Human-readable detail string describing what happened
 * @param clinicId - Optional clinic scope; fetched from user record if omitted
 * @param userName - Optional display name; fetched from user record if omitted
 */
export const logAudit = async (
    userId: string,
    module: string,
    action: string,
    details: string,
    clinicId?: string,
    userName?: string,
) => {
    try {
        let finalClinicId = clinicId;
        let finalUserName = userName;

        if (!finalClinicId || !finalUserName) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { clinicId: true, name: true },
            });
            if (user) {
                finalClinicId = finalClinicId || user.clinicId || undefined;
                finalUserName = finalUserName || user.name;
            }
        }

        await prisma.auditLog.create({
            data: {
                userId,
                userName: finalUserName || 'Unknown',
                clinicId: finalClinicId,
                module,
                action,
                details,
                timestamp: new Date(),
            },
        });
    } catch (error) {
        console.error('Failed to log audit:', error);
    }
};
