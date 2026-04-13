import puppeteer from 'puppeteer';
import { packPreviewJsonForLocalStorageInjection, PREVIEW_STORAGE_KEY } from '@/lib/preview-storage';

function flattenLocalStorageForPdf(entries: Record<string, string>): Record<string, string> {
  const main = entries[PREVIEW_STORAGE_KEY];
  if (!main || main.length <= 3_000_000) {
    return { ...entries };
  }
  const rest = { ...entries };
  delete rest[PREVIEW_STORAGE_KEY];
  return { ...rest, ...packPreviewJsonForLocalStorageInjection(main) };
}

/**
 * Gera um PDF a partir da URL da página de prévia usando Puppeteer em modo headless.
 * @param previewUrl - URL completa da página de prévia (ex.: http://localhost:3000/preview)
 * @param localStorageData - Dados a injetar no localStorage antes de carregar a página
 * @returns Buffer do PDF gerado
 */
export async function generatePDF(
  previewUrl: string,
  localStorageData?: Record<string, string>
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    const flat =
      localStorageData && Object.keys(localStorageData).length > 0
        ? flattenLocalStorageForPdf(localStorageData)
        : undefined;

    // Injeta localStorage antes de qualquer script da página ser executado
    if (flat && Object.keys(flat).length > 0) {
      await page.evaluateOnNewDocument((entries: Record<string, string>) => {
        for (const [key, value] of Object.entries(entries)) {
          try {
            localStorage.setItem(key, value);
          } catch {
            // Quota exceeded — ignorar silenciosamente
            console.warn('[pdf] localStorage quota exceeded for key:', key, 'size:', value.length);
          }
        }
      }, flat);
    }

    await page.setViewport({ width: 1200, height: 1697, deviceScaleFactor: 1 });

    await page.goto(previewUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    try {
      await page.evaluate(async () => {
        await document.fonts?.ready;
      });
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 800));

    // Garante @media print (mesma cascata que Ctrl+P) antes do printToPDF
    await page.emulateMediaType('print');

    // Papel = 595×842 px em 96 CSS px/in — coincide com @page em globals (sem zoom, header/rodapé alinhados)
    const paperWidthIn = 595 / 96;
    const paperHeightIn = 842 / 96;

    const pdfBuffer = await page.pdf({
      width: `${paperWidthIn}in`,
      height: `${paperHeightIn}in`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
