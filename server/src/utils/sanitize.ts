import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes user input to prevent XSS attacks.
 *
 * Strips all HTML tags and attributes, keeping only text content.
 * Use this for plain-text fields like names, invoice numbers, etc.
 *
 * @param input - Raw user input (may be null/undefined)
 * @returns Sanitized plain text string
 */
export const sanitizeInput = (input: string | null | undefined): string => {
    if (!input) return '';
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
    });
};

/**
 * Sanitizes HTML while preserving safe formatting tags.
 *
 * Allows basic rich text (bold, italic, lists, paragraphs) but strips
 * all attributes including class names and event handlers.
 * Use this for description or notes fields that may contain formatting.
 *
 * @param html - Raw HTML input
 * @returns Sanitized HTML safe for rendering
 */
export const sanitizeHtml = (html: string | null | undefined): string => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: [],
    });
};

/**
 * Recursively sanitizes all string properties of an object.
 *
 * Useful for bulk sanitization of request bodies before storage.
 * Nested objects are processed recursively; arrays and non-string
 * values are left unchanged.
 *
 * @param obj - The object whose string properties should be sanitized
 * @returns A new object with all strings sanitized
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
    const sanitized: any = {};
    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
            sanitized[key] = sanitizeInput(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};
