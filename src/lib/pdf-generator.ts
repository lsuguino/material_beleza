import puppeteer from 'puppeteer';

/**
 * Gera um PDF a partir da URL da página de prévia usando Puppeteer em modo headless.
 * @param previewUrl - URL completa da página de prévia (ex.: http://localhost:3000/preview)
 * @returns Buffer do PDF gerado
 */
export async function generatePDF(previewUrl: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.goto(previewUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
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
