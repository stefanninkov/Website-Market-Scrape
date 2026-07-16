/**
 * Minimal robots.txt gate (SPEC §11, CLAUDE.md: never bypass robots.txt beyond
 * the homepage visit). The homepage is always fetched as a normal browser
 * visit; secondary pages (/kontakt, /contact, …) are only visited when robots
 * allows them. Best-effort: on any fetch error we conservatively allow, since
 * a missing/unreachable robots.txt conventionally means "no restrictions".
 */

export interface RobotsRules {
  isAllowed(pathname: string): boolean;
}

const ALLOW_ALL: RobotsRules = { isAllowed: () => true };

/** Fetch and parse robots.txt for the origin. Groups matching `*` or our UA. */
export async function fetchRobots(origin: string, userAgent: string): Promise<RobotsRules> {
  let text: string;
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return ALLOW_ALL;
    text = await res.text();
  } catch {
    return ALLOW_ALL;
  }

  const uaLower = userAgent.toLowerCase();
  const disallows: string[] = [];
  let inMatchingGroup = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawField, ...rest] = line.split(':');
    if (!rawField) continue;
    const field = rawField.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (field === 'user-agent') {
      const ua = value.toLowerCase();
      inMatchingGroup = ua === '*' || uaLower.includes(ua);
    } else if (field === 'disallow' && inMatchingGroup) {
      if (value) disallows.push(value);
    }
  }

  return {
    isAllowed(pathname: string): boolean {
      return !disallows.some((d) => pathname.startsWith(d));
    },
  };
}
