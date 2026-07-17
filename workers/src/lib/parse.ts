/**
 * Defensive JSON parsing for Claude output (CLAUDE.md AI rules): strip code
 * fences, extract the first {...} object, JSON.parse in a try/catch. The
 * caller zod-validates the result and retries once on failure.
 */

export function parseJsonLenient(raw: string): unknown {
  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence && fence[1]) text = fence[1].trim();

  // If there's leading/trailing prose, grab the outermost object.
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  return JSON.parse(text);
}
