import puppeteer from 'puppeteer';
import { stashPreviewJsonForPdf } from '@/lib/pdf-preview-session';

export interface PageOverflowInfo {
  pageIndex: number;
  hasOverflow: boolean;
  overflowPx: number;
}

export interface ValidationResult {
  pages: PageOverflowInfo[];
  sessionId: string;
}

function getBaseUrl(): string {
  const explicit = process.env.PDF_PREVIEW_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const port = process.env.PORT?.trim() || '3000';
  return `http://127.0.0.1:${port}`;
}

/**
 * Renderiza o material no Puppeteer e mede overflow real de cada página A4.
 * Tolerância padrão 8px — ignora ruído sub-pixel de renderização de fonte.
 */
export async function validatePagesOverflow(
  conteudo: unknown,
  baseUrl?: string,
  tolerancePx: number = 8,
): Promise<ValidationResult> {
  const previewPayload = JSON.stringify({ conteudo, design: conteudo });
  const sessionId = stashPreviewJsonForPdf(previewPayload);
  const root = (baseUrl ?? getBaseUrl()).replace(/\/$/, '');
  const previewUrl = `${root}/preview?session=${sessionId}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1697, deviceScaleFactor: 1 });
    await page.goto(previewUrl, { waitUntil: 'networkidle0', timeout: 90000 });

    try {
      await page.waitForSelector('.page-a4', { timeout: 15000 });
    } catch {
      console.warn('[validate-page-overflow] .page-a4 não encontrado em 15s — retornando sem overflow');
      return { pages: [], sessionId };
    }

    try {
      await page.evaluate(async () => {
        await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
      });
    } catch {
      /* ignore */
    }

    try {
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
        await Promise.allSettled(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((r) => {
                  img.onload = () => r();
                  img.onerror = () => r();
                }),
          ),
        );
      });
    } catch {
      /* ignore */
    }

    await new Promise((r) => setTimeout(r, 1500));

    const pagesOverflow = await page.evaluate((tol: number) => {
      const out: Array<{ pageIndex: number; hasOverflow: boolean; overflowPx: number }> = [];
      const nodes = Array.from(document.querySelectorAll('.page-a4'));
      nodes.forEach((el, idx) => {
        const h = el as HTMLElement;
        let maxOverflow = Math.max(0, h.scrollHeight - h.clientHeight);

        const descendants = Array.from(h.querySelectorAll('*')) as HTMLElement[];
        for (const d of descendants) {
          const cs = window.getComputedStyle(d);
          if (cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflowX === 'hidden') {
            const vertical = d.scrollHeight - d.clientHeight;
            const horizontal = d.scrollWidth - d.clientWidth;
            const o = Math.max(vertical, horizontal);
            if (o > maxOverflow) maxOverflow = o;
          }
        }

        out.push({
          pageIndex: idx,
          hasOverflow: maxOverflow > tol,
          overflowPx: maxOverflow,
        });
      });
      return out;
    }, tolerancePx);

    return { pages: pagesOverflow, sessionId };
  } finally {
    await browser.close();
  }
}
