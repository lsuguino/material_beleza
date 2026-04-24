import puppeteer from 'puppeteer';

/**
 * Gera um PDF a partir da URL da página de prévia usando Puppeteer em modo headless.
 * A URL já contém o session ID (?session=xxx) — os dados são buscados via fetch pelo preview.
 * Não depende de localStorage.
 *
 * @param previewUrl - URL completa (ex.: http://localhost:3000/preview?session=abc123)
 * @returns Buffer do PDF gerado
 */
export async function generatePDF(previewUrl: string): Promise<Buffer> {
  console.log('[pdf-generator] Launching Puppeteer for:', previewUrl);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 1697, deviceScaleFactor: 1 });

    // Navega para a URL do preview
    const response = await page.goto(previewUrl, {
      waitUntil: 'networkidle0',
      timeout: 90000,
    });

    console.log('[pdf-generator] Page loaded, status:', response?.status());

    // Espera fontes carregarem
    try {
      await page.evaluate(async () => {
        await document.fonts?.ready;
      });
    } catch {
      /* ignore */
    }

    // Espera imagens carregarem
    try {
      await page.evaluate(async () => {
        const images = document.querySelectorAll('img');
        await Promise.allSettled(
          Array.from(images).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((r) => {
                  img.onload = r;
                  img.onerror = r;
                })
          )
        );
      });
    } catch {
      /* ignore */
    }

    // Aguarda o conteúdo do material aparecer (não apenas "Carregando...")
    try {
      await page.waitForSelector('.page-a4, .preview-page-wrap', { timeout: 15000 });
      console.log('[pdf-generator] Material content detected');
    } catch {
      console.warn('[pdf-generator] Warning: .page-a4 not found after 15s, capturing anyway');
      // Log page content for debugging
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
      console.warn('[pdf-generator] Page body preview:', bodyText);
    }

    // Espera renderização completar
    await new Promise((r) => setTimeout(r, 2000));

    // Garante @media print
    await page.emulateMediaType('print');

    // Papel A4: 595×842 px @ 96 DPI
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

    console.log('[pdf-generator] PDF generated, size:', pdfBuffer.length, 'bytes');

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
