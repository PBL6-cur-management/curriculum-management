import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../shared/config/env.validation.js';

const launch = vi.hoisted(() => vi.fn());
vi.mock('puppeteer', () => ({ default: { launch } }));

const { PdfRendererService } = await import('./pdf-renderer.service.js');

function fakeBrowser() {
  const page = {
    setJavaScriptEnabled: vi.fn(),
    setRequestInterception: vi.fn(),
    on: vi.fn(),
    setContent: vi.fn(),
    evaluateHandle: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(new Uint8Array([1])),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
}

function serviceWith(env: Partial<Env>) {
  const config = {
    get: (key: keyof Env) => env[key],
  } as unknown as ConfigService<Env, true>;
  return new PdfRendererService(config);
}

describe('PdfRendererService', () => {
  beforeEach(() => {
    launch.mockReset();
    launch.mockResolvedValue(fakeBrowser());
  });

  it('keeps the Chrome sandbox by default', async () => {
    await serviceWith({ PDF_BROWSER_NO_SANDBOX: 'false' }).render('<p></p>');

    const options = launch.mock.calls[0][0];
    expect(options.args).not.toContain('--no-sandbox');
    expect(options.executablePath).toBeUndefined();
  });

  it('drops the sandbox and uses the configured browser when the container asks for it', async () => {
    await serviceWith({
      PDF_BROWSER_NO_SANDBOX: 'true',
      PDF_BROWSER_PATH: '/usr/bin/chromium',
    }).render('<p></p>');

    const options = launch.mock.calls[0][0];
    expect(options.args).toContain('--no-sandbox');
    expect(options.executablePath).toBe('/usr/bin/chromium');
  });
});
