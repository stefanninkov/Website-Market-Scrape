/**
 * URL safety gate for `fetch_page` and `screenshot_page` (AGENTS.md §10.5).
 *
 * A model choosing its own URLs is an SSRF surface: "fetch this page" with a
 * link-local or private address turns the worker into a probe of whatever it
 * can reach. This refuses non-http schemes and private ranges *after* DNS
 * resolution, because a public hostname can resolve to 127.0.0.1.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** RFC1918, loopback, link-local, CGNAT, unique-local and unspecified ranges. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split('.').map(Number);
    const [a = 0, b = 0] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    // IPv4-mapped, e.g. ::ffff:127.0.0.1
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }
  return false;
}

export async function checkUrl(raw: string): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `Not a valid URL: ${raw}` };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `Only http and https are allowed, got ${url.protocol}` };
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isPrivateAddress(host)) {
    return { ok: false, reason: 'Refusing a private or loopback address.' };
  }
  if (!isIP(host)) {
    try {
      const addrs = await lookup(host, { all: true });
      if (addrs.length === 0) return { ok: false, reason: `Could not resolve ${host}` };
      if (addrs.some((a) => isPrivateAddress(a.address))) {
        return { ok: false, reason: `${host} resolves to a private address.` };
      }
    } catch (err) {
      return { ok: false, reason: `DNS lookup failed for ${host}: ${String(err)}` };
    }
  }
  return { ok: true, url };
}
