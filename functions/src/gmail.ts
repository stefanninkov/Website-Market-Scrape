/**
 * Gmail helpers (SPEC §7). The MIME building and tracking-pixel injection are
 * pure and unit-testable; the OAuth client + API calls use googleapis and are
 * exercised only against a live Gmail account.
 */

import { google } from 'googleapis';

// Derive the client type from googleapis itself — importing OAuth2Client from
// google-auth-library can resolve to a different hoisted copy and fail to
// typecheck against gmail({auth}).
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

/** 1x1 transparent GIF for the open-tracking pixel. */
export const TRACKING_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain-text body → minimal HTML with the tracking pixel appended. */
export function bodyToHtml(body: string, pixelUrl: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
  return `<div>${paragraphs}<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none"/></div>`;
}

export interface MimeParams {
  from: string;
  to: string;
  subject: string;
  body: string; // plain text
  pixelUrl: string;
}

/**
 * Build a base64url-encoded RFC 2822 message with a multipart/alternative body
 * (plain text + tracking-pixel HTML), ready for gmail.users.messages.send.
 */
export function buildRawMessage({ from, to, subject, body, pixelUrl }: MimeParams): string {
  const boundary = `wms_${Date.now().toString(36)}`;
  // RFC 2047 encode the subject so non-ASCII (Serbian latinica) survives.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  const html = bodyToHtml(body, pixelUrl);

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ];

  return Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Construct an OAuth2 client from env config. */
export function createOAuthClient(redirectUri: string): OAuth2Client {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET are not configured.');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
