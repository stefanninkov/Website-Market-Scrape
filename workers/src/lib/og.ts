/**
 * OG image generation (SPEC §8): renders the 1200x630 OG card HTML in
 * headless Chromium and screenshots it to PNG. Reuses the Playwright dep the
 * analyzer already needs — no extra native image libraries.
 */

import { chromium, type Browser } from 'playwright';

export interface OgRenderer {
  renderPng(html: string): Promise<Buffer>;
  close(): Promise<void>;
}

export function createOgRenderer(): OgRenderer {
  let browserPromise: Promise<Browser> | null = null;

  function getBrowser(): Promise<Browser> {
    if (!browserPromise) {
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
      browserPromise = chromium.launch({ headless: true, executablePath });
    }
    return browserPromise;
  }

  return {
    async renderPng(html: string): Promise<Buffer> {
      const browser = await getBrowser();
      const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
      try {
        await page.setContent(html, { waitUntil: 'load' });
        return await page.screenshot({ type: 'png' });
      } finally {
        await page.close();
      }
    },
    async close(): Promise<void> {
      if (browserPromise) {
        const b = await browserPromise;
        await b.close();
        browserPromise = null;
      }
    },
  };
}
