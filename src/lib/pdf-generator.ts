import puppeteer from 'puppeteer';

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

    // Viewport igual ao papel para que 1px = 1px no PDF
    await page.setViewport({ width: 595, height: 842 });

    // Injeta localStorage antes de qualquer script da página ser executado
    if (localStorageData && Object.keys(localStorageData).length > 0) {
      await page.evaluateOnNewDocument((entries: Record<string, string>) => {
        for (const [key, value] of Object.entries(entries)) {
          localStorage.setItem(key, value);
        }
      }, localStorageData);
    }

    await page.goto(previewUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      width: '595px',
      height: '842px',
      printBackground: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
