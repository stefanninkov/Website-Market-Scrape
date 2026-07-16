/**
 * Google Places API (New) client (SPEC §2, §5).
 *
 * Two-step, cost-optimized:
 *  1. Text Search with an ID-only field mask → cheap page of place IDs.
 *  2. Place Details (strict field mask, SPEC §5) for NEW place IDs only.
 *
 * Pure HTTP + zod validation. The budget guard lives in the sweep handler
 * (it owns the Firestore transaction); this client only makes calls. Exposed
 * as an interface so the worker can be verified against a fake (no live key).
 */

import { z } from 'zod';

export interface TextSearchPage {
  placeIds: string[];
  nextPageToken: string | null;
}

/** Normalized Place Details — maps straight onto Lead fields. */
export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  phone: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  primaryType: string | null;
}

export interface PlacesClient {
  /** One page (≤20) of place IDs for a text query. */
  textSearch(query: string, regionCode: string, pageToken?: string): Promise<TextSearchPage>;
  /** Strict-field-mask Details for a single place. */
  placeDetails(placeId: string): Promise<PlaceDetails>;
}

// Politeness / honesty: identify ourselves (CLAUDE.md).
const USER_AGENT = 'FlowDev-WebsiteMarketScrape/0.1 (+https://flowdev.example)';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DETAILS_BASE_URL = 'https://places.googleapis.com/v1/places';

// Strict field masks — only what SPEC §5 allows.
const TEXT_SEARCH_MASK = 'places.id,nextPageToken';
const DETAILS_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'rating',
  'userRatingCount',
  'primaryTypeDisplayName',
].join(',');

// ---------------------------------------------------------------------------
// Response schemas (external data — validated before use)
// ---------------------------------------------------------------------------

const textSearchResponseSchema = z.object({
  places: z.array(z.object({ id: z.string() })).optional(),
  nextPageToken: z.string().optional(),
});

const detailsResponseSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  primaryTypeDisplayName: z.object({ text: z.string() }).optional(),
});

export class PlacesApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'PlacesApiError';
  }
}

export function createPlacesClient(apiKey: string): PlacesClient {
  // Don't throw at construction — that would crash the worker loop at startup.
  // Missing-key failures surface per-job (CLAUDE.md: never crash the loop).
  function requireKey(): void {
    if (!apiKey) throw new PlacesApiError('GOOGLE_PLACES_API_KEY is not set (workers/.env).');
  }

  async function textSearch(
    query: string,
    regionCode: string,
    pageToken?: string,
  ): Promise<TextSearchPage> {
    requireKey();
    let res: Response;
    try {
      res = await fetch(TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': TEXT_SEARCH_MASK,
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: 20,
          regionCode: regionCode.toLowerCase(),
          ...(pageToken ? { pageToken } : {}),
        }),
      });
    } catch (err) {
      throw new PlacesApiError(`Text Search network error: ${String(err)}`);
    }
    if (!res.ok) {
      throw new PlacesApiError(`Text Search HTTP ${res.status}: ${await res.text()}`, res.status);
    }
    const parsed = textSearchResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new PlacesApiError(`Text Search invalid response: ${parsed.error.message}`);
    }
    return {
      placeIds: (parsed.data.places ?? []).map((p) => p.id),
      nextPageToken: parsed.data.nextPageToken ?? null,
    };
  }

  async function placeDetails(placeId: string): Promise<PlaceDetails> {
    requireKey();
    let res: Response;
    try {
      res = await fetch(`${DETAILS_BASE_URL}/${encodeURIComponent(placeId)}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': DETAILS_MASK,
          'User-Agent': USER_AGENT,
        },
      });
    } catch (err) {
      throw new PlacesApiError(`Details network error: ${String(err)}`);
    }
    if (!res.ok) {
      throw new PlacesApiError(`Details HTTP ${res.status}: ${await res.text()}`, res.status);
    }
    const parsed = detailsResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new PlacesApiError(`Details invalid response: ${parsed.error.message}`);
    }
    const d = parsed.data;
    return {
      placeId: d.id,
      name: d.displayName?.text ?? '(unnamed)',
      address: d.formattedAddress ?? '',
      phone: d.nationalPhoneNumber ?? d.internationalPhoneNumber ?? null,
      websiteUrl: d.websiteUri ?? null,
      rating: d.rating ?? null,
      reviewCount: d.userRatingCount ?? null,
      primaryType: d.primaryTypeDisplayName?.text ?? null,
    };
  }

  return { textSearch, placeDetails };
}
