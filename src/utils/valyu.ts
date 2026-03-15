/**
 * Valyu search integration for enriching AI tools with verified sources.
 *
 * Requires VITE_VALYU_API_KEY in .env
 * Get your API key at https://valyu.network
 *
 * If the API key is missing or the request fails, returns isVerified=false
 * so callers can show a degradation banner rather than silently failing.
 */

const VALYU_BASE = 'https://api.valyu.network/v1';

export interface VerifiedContext {
  sources: Array<{ title: string; url: string; snippet: string }>;
  isVerified: boolean; // false → show "Citations Unavailable" banner
}

function getApiKey(): string {
  return (import.meta.env.VITE_VALYU_API_KEY as string) || '';
}

async function valyuSearch(
  query: string,
  searchType: 'web' | 'academic',
  sources?: string[],
): Promise<VerifiedContext> {
  const apiKey = getApiKey();
  if (!apiKey) return { sources: [], isVerified: false };

  try {
    const body: Record<string, unknown> = {
      query,
      max_results: 5,
      search_type: searchType,
    };
    if (sources?.length) body.sources = sources;

    const res = await fetch(`${VALYU_BASE}/search`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return { sources: [], isVerified: false };

    const data = await res.json() as {
      results?: Array<{ title?: string; url?: string; snippet?: string; content?: string }>;
    };

    const results = (data.results || []).slice(0, 3).map(r => ({
      title: r.title || 'Untitled',
      url: r.url || '',
      snippet: r.snippet || r.content || '',
    }));

    return { sources: results, isVerified: results.length > 0 };
  } catch {
    return { sources: [], isVerified: false };
  }
}

/** Search the web for relevant sources. Used by FactCheckTool. */
export function searchWeb(query: string): Promise<VerifiedContext> {
  return valyuSearch(query, 'web');
}

/**
 * Search academic databases for relevant papers/abstracts.
 * Used by CourseGenTool.
 * @param sources Optional list of academic source IDs (e.g. ['arxiv', 'pubmed'])
 */
export function searchAcademic(query: string, sources?: string[]): Promise<VerifiedContext> {
  return valyuSearch(query, 'academic', sources);
}
