/**
 * General AI integration routes.
 * @module ai
 */
import { Router } from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../db.js';

const router = Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.GOOGLE_GEMINI_MODEL || "gemini-2.5-flash";

const scanProductSchema = z.object({
    imageBase64: z.string().min(1, 'Image data is required'),
});

const suggestDiagnosisSchema = z.object({
    complaint: z.string().optional(),
    assessment: z.string().optional(),
    patientContext: z.object({
        name: z.string().optional(),
        species: z.string().optional(),
        breed: z.string().optional(),
        gender: z.string().optional(),
        weight: z.union([z.string(), z.number()]).optional(),
        vitals: z.record(z.any()).optional(),
    }).optional(),
});

// Startup verification - log once when module loads
if (process.env.GEMINI_API_KEY) {
    console.log('âœ… AI Service: GEMINI_API_KEY configured');
} else {
    console.warn('âš ï¸  AI Service: GEMINI_API_KEY not found - AI features will not work');
}

router.post('/scan-product', authenticate, async (req, res) => {
    try {
        const body = scanProductSchema.safeParse(req.body);
        if (!body.success) return res.status(400).json({ error: 'Invalid request', details: body.error.issues });

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('âŒ AI Scan Error: GEMINI_API_KEY is not configured in .env file');
            return res.status(500).json({
                error: 'Server AI configuration missing',
                detail: 'GEMINI_API_KEY not found in server environment variables.'
            });
        }

        const { imageBase64 } = body.data;

        console.log('ðŸ” AI Product Scan initiated');

        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: { responseMimeType: "application/json" }
        });

        // Robust MIME and Data extraction
        let mimeType = 'image/jpeg';
        let cleanBase64 = imageBase64;

        if (imageBase64.includes(';base64,')) {
            const parts = imageBase64.split(';base64,');
            mimeType = parts[0].split(':')[1] || 'image/jpeg';
            cleanBase64 = parts[1];
        }

        const prompt = `Extract product details for veterinary inventory.
            Return ONLY a JSON object with these fields:
            name, sku (barcode), batchNumber (serial/batch number), nafdacNumber, description, expiryDate (YYYY-MM-DD), category, packaging, manufacturer, composition.
            
            Guidelines:
            - DO NOT return any price or financial information.
            - "composition": List active ingredients if visible.
            - "description": Write a professional, concise veterinary product description based on the name, manufacturer, and composition discovered on the label. Include usage or storage warnings if visible.
            
            Valid category values: Medicine, Vaccine, Supplement, Supplies, Consumables, Food, Equipment, Toys, Other.
            Valid packaging types: Bottle, Box, Blister Pack, Vial, Tube, Sachet, Tabs, Plate, Bag, Other.
            Use exactly one of the valid category values and exactly one of the valid packaging types. If unsure, use Other.
            
            Scan the product label in this image accurately.`;

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: cleanBase64
                }
            },
            {
                text: prompt
            }
        ]);

        const response = await result.response;
        const text = response.text();

        console.log('âœ… AI Scan Response received, length:', text.length);

        // Robust JSON parsing helper
        const extractJSON = (text: string) => {
            try {
                // 1. Try direct parse
                return JSON.parse(text);
            } catch (e) {
                // 2. Remove markdown code blocks
                let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '').trim();
                try {
                    return JSON.parse(clean);
                } catch (e2) {
                    // 3. Find first { and last }
                    const start = clean.indexOf('{');
                    const end = clean.lastIndexOf('}');
                    if (start !== -1 && end !== -1) {
                        return JSON.parse(clean.substring(start, end + 1));
                    }
                    throw new Error('No JSON found in response');
                }
            }
        };

        let parsedData;
        try {
            parsedData = extractJSON(text);
        } catch (parseError) {
            console.error('âŒ AI JSON Parse Failed. Raw text:', text);
            return res.status(500).json({ error: 'Failed to parse AI response', raw: text });
        }

        console.log('âœ… AI Scan successful:', parsedData.name || 'Unknown product');
        res.json(parsedData);

    } catch (error: any) {
        console.error('âŒ AI Scan Error:', {
            message: error.message,
            status: error.status || error.statusCode,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        // Provide more specific error messages
        let errorMessage = 'Failed to scan product';
        if (error.message?.includes('fetch failed')) {
            errorMessage = 'Network error connecting to AI service';
        } else if (error.message?.includes('404')) {
            errorMessage = 'AI model not available';
        } else if (error.message?.includes('API key')) {
            errorMessage = 'AI service authentication failed';
        }

        res.status(500).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/suggest-diagnosis', authenticate, async (req, res) => {
    try {
        const body = suggestDiagnosisSchema.safeParse(req.body);
        if (!body.success) return res.status(400).json({ error: 'Invalid request', details: body.error.issues });

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('âŒ AI Diagnosis Error: GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'Server AI config missing' });
        }

        const { complaint, assessment, patientContext } = body.data;

        console.log('ðŸ©º AI Diagnosis Suggestion initiated');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: { responseMimeType: "application/json" }
        });

        const patientInfo = patientContext
            ? `Patient: ${patientContext.name || 'Unknown'}
Species: ${patientContext.species || 'Unknown'}
Breed: ${patientContext.breed || 'Unknown'}
Gender: ${patientContext.gender || 'Unknown'}
Weight: ${patientContext.weight || 'Unknown'}
Vitals: ${JSON.stringify(patientContext.vitals || {})}`
            : '';

        const prompt = `
          Analyze this veterinary case:
          ${patientInfo ? `\n--- Patient Information ---\n${patientInfo}\n` : ''}
          --- Clinical Details ---
          Complaint: ${complaint}
          Assessment: ${assessment}
          
          Based on the patient's species, breed, and clinical signs, suggest 3 most likely diagnoses with confidence %.
          Return JSON array: [{ "diagnosis": string, "confidence": number }]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('âœ… AI Diagnosis Response received, length:', text.length);

        // Robust JSON parsing helper
        const extractJSON = (text: string) => {
            try {
                return JSON.parse(text);
            } catch (e) {
                let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '').trim();
                try {
                    return JSON.parse(clean);
                } catch (e2) {
                    const start = clean.indexOf('[');
                    const end = clean.lastIndexOf(']');
                    if (start !== -1 && end !== -1) {
                        return JSON.parse(clean.substring(start, end + 1));
                    }
                    throw new Error('No JSON array found in response');
                }
            }
        };

        let suggestions;
        try {
            suggestions = extractJSON(text);
        } catch (parseError) {
            console.error('âŒ AI Diagnosis Parse Failed. Raw text:', text);
            // Return empty array fallback instead of erroring out completely for diagnosis
            suggestions = [];
        }

        console.log('âœ… AI Diagnosis successful, suggestions:', suggestions.length);
        res.json(suggestions);

    } catch (error: any) {
        console.error('âŒ AI Diagnosis Error:', {
            message: error.message,
            status: error.status || error.statusCode,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        // Provide more specific error messages
        let errorMessage = 'Failed to generate suggestions';
        if (error.message?.includes('fetch failed')) {
            errorMessage = 'Network error connecting to AI service';
        } else if (error.message?.includes('404')) {
            errorMessage = 'AI model not available';
        } else if (error.message?.includes('API key')) {
            errorMessage = 'AI service authentication failed';
        }

        res.status(500).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/transcribe', authenticate, upload.single('audio'), async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('âŒ AI Transcription Error: GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'Server AI config missing' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log(`ðŸŽ™ï¸ AI Transcription initiated. File size: ${req.file.size} bytes. MIME: ${req.file.mimetype}`);

        const genAI = new GoogleGenerativeAI(apiKey);
        // Note: Gemini 1.5 Flash supports audio inputs natively!
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL, 
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are an expert veterinary transcriptionist. Analyze the following audio recording of a veterinarian dictating clinical notes. 
        Format the findings into a strict veterinary SOAP note structure.
        Return ONLY a JSON object with these exact keys: "subjective", "objective", "assessment", "plan". 
        Write professionally and clinically based on the recording. If a section is not mentioned, output an empty string for that key.`;

        // Pass the audio buffer directly as inlineData
        const base64Audio = req.file.buffer.toString("base64");
        let mimeType = req.file.mimetype;
        if (mimeType === 'audio/octet-stream' || !mimeType) {
            mimeType = 'audio/webm';
        }
        
        // Wait for generation
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Audio
                }
            },
            { text: prompt }
        ]);

        const response = await result.response;
        const text = response.text();

        console.log('âœ… AI Transcription Response received, length:', text.length);

        // Robust JSON parsing logic
        const extractJSON = (text: string) => {
            try { return JSON.parse(text); } catch (e) {
                let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '').trim();
                try { return JSON.parse(clean); } catch (e2) {
                    const start = clean.indexOf('{');
                    const end = clean.lastIndexOf('}');
                    if (start !== -1 && end !== -1) {
                        return JSON.parse(clean.substring(start, end + 1));
                    }
                    throw new Error('No JSON found in response');
                }
            }
        };

        const parsedData = extractJSON(text);
        
        // (Optional) We could save this to ai_transcripts and ai_soap_notes in the DB here,
        // but for now, we return it to the frontend to populate the form fields directly.

        res.json(parsedData);

    } catch (error: any) {
        console.error('âŒ AI Transcription Error:', {
            message: error.message,
            status: error.status || error.statusCode
        });
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

// POST /api/ai/dictate — voice dictation of clinical notes.
// Same pipeline as /transcribe, but persists the transcript (and a draft SOAP note
// when a patientId is supplied) so dictation history survives page refreshes.
router.post('/dictate', authenticate, upload.single('audio'), async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('âŒ AI Dictation Error: GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'Server AI config missing' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const authUser = (req as any).user;
        const patientId = typeof req.body?.patientId === 'string' && req.body.patientId.trim()
            ? req.body.patientId.trim()
            : null;

        console.log(`ðŸŽ™ï¸ AI Dictation initiated. File size: ${req.file.size} bytes. MIME: ${req.file.mimetype}`);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are an expert veterinary transcriptionist. Analyze the following audio recording of a veterinarian dictating clinical notes. 
        Format the findings into a strict veterinary SOAP note structure.
        Return ONLY a JSON object with these exact keys: "subjective", "objective", "assessment", "plan". 
        Write professionally and clinically based on the recording. If a section is not mentioned, output an empty string for that key.`;

        const base64Audio = req.file.buffer.toString("base64");
        let mimeType = req.file.mimetype;
        if (mimeType === 'audio/octet-stream' || !mimeType) {
            mimeType = 'audio/webm';
        }

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Audio
                }
            },
            { text: prompt }
        ]);

        const response = await result.response;
        const text = response.text();

        const extractJSON = (raw: string) => {
            try { return JSON.parse(raw); } catch (e) {
                let clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '').trim();
                try { return JSON.parse(clean); } catch (e2) {
                    const start = clean.indexOf('{');
                    const end = clean.lastIndexOf('}');
                    if (start !== -1 && end !== -1) {
                        return JSON.parse(clean.substring(start, end + 1));
                    }
                    throw new Error('No JSON found in response');
                }
            }
        };

        let parsedData;
        try {
            parsedData = extractJSON(text);
        } catch (parseError) {
            console.error('âŒ AI Dictation Parse Failed. Raw text:', text);
            return res.status(500).json({ error: 'Failed to parse dictation response', raw: text });
        }

        // Persist the transcript for history/auditability.
        const transcript = await prisma.aITranscript.create({
            data: {
                clinicId: authUser.clinicId,
                patientId,
                audioSize: req.file.size,
                transcript: JSON.stringify(parsedData),
                language: 'en',
            },
        });

        // Optionally attach a draft SOAP note when the dictation targets a patient.
        let soapNoteId: string | null = null;
        if (patientId) {
            const patient = await prisma.patient.findFirst({
                where: { id: patientId, owner: { clinicId: authUser.clinicId } },
                select: { id: true },
            });

            if (patient) {
                const soapNote = await prisma.aISoapNote.create({
                    data: {
                        transcriptId: transcript.id,
                        patientId,
                        subjective: parsedData.subjective || '',
                        objective: parsedData.objective || '',
                        assessment: parsedData.assessment || '',
                        plan: parsedData.plan || '',
                        status: 'DRAFT',
                    },
                });
                soapNoteId = soapNote.id;
            }
        }

        await prisma.aIActivity.create({
            data: {
                clinicId: authUser.clinicId,
                userId: authUser.id,
                agentType: 'DICTATION',
                action: 'TRANSCRIBE',
                status: 'SUCCESS',
                metadata: { transcriptId: transcript.id, soapNoteId },
            },
        });

        res.json({ ...parsedData, transcriptId: transcript.id, soapNoteId });
    } catch (error: any) {
        console.error('âŒ AI Dictation Error:', {
            message: error.message,
            status: error.status || error.statusCode
        });
        res.status(500).json({ error: 'Failed to process dictation' });
    }
});

export default router;
