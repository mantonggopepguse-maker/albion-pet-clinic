/**
 * Safely extracts and parses JSON from raw LLM output, handling markdown fences,
 * leading/trailing conversational text, and formatting variances.
 */
export function extractJson<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('No text content provided to extract JSON');
  }

  // 1. First attempt direct parse
  try {
    return JSON.parse(rawText) as T;
  } catch {
    // Continue to extraction
  }

  // 2. Remove markdown code fences: ```json ... ``` or ``` ... ```
  const cleaned = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue to boundary matching
  }

  // 3. Find outer object {...} or array [...]
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  let candidate: string | null = null;

  if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    candidate = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    candidate = cleaned.substring(firstBracket, lastBracket + 1);
  }

  if (candidate) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Fall through to error
    }
  }

  throw new Error(`Failed to parse valid JSON from AI response: ${rawText.slice(0, 100)}...`);
}
