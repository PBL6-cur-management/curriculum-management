import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { type Browser } from 'puppeteer';
import type { Env } from '../../../shared/config/env.validation.js';
import { PDF_RENDER_TIMEOUT_MS } from '../publication.constants.js';

// One headless browser, launched on first use. The page runs no script and may load nothing:
// the HTML is escaped text with embedded fonts, so every network request is aborted.
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Promise<Browser> | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private launch(): Promise<Browser> {
    this.browser ??= puppeteer
      .launch({
        headless: true,
        executablePath:
          this.config.get('PDF_BROWSER_PATH', { infer: true }) || undefined,
        args: ['--disable-gpu', '--no-first-run', '--disable-extensions'],
      })
      .catch((error: unknown) => {
        this.browser = null;
        throw error;
      });
    return this.browser;
  }

  async render(html: string): Promise<Uint8Array> {
    const browser = await this.launch();
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().startsWith('data:')) void request.continue();
        else void request.abort();
      });
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: PDF_RENDER_TIMEOUT_MS,
      });
      await page.evaluateHandle('document.fonts.ready').catch(() => undefined);
      return await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="font-size:8px;width:100%;text-align:center;color:#64748b"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
        timeout: PDF_RENDER_TIMEOUT_MS,
      });
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const browser = await this.browser?.catch(() => null);
    await browser?.close().catch((error: unknown) => {
      this.logger.warn(`Closing the PDF browser failed: ${String(error)}`);
    });
  }
}
