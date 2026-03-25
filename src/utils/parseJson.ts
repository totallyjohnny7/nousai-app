export function parseJsonArray(response: string): unknown[] | null {
  try {
    let s = response.trim();
    const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) s = codeBlock[1].trim();
    const arrMatch = s.match(/\[[\s\S]*\]/);
    if (arrMatch) s = arrMatch[0];
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
}
