const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const htmlPath = process.argv[2] || path.join(__dirname, '..', 'index.html');
const outputPath = process.argv[3] || path.join(__dirname, '..', 'material-didatico.pdf');

(async () => {
  if (!fs.existsSync(htmlPath)) {
    console.error('Arquivo HTML não encontrado:', htmlPath);
    console.log('Uso: node scripts/generate-pdf.js [caminho/index.html] [saida.pdf]');
    process.exit(1);
  }

  const absolutePath = path.resolve(htmlPath);
  const fileUrl = 'file:///' + absolutePath.replace(/\\/g, '/');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true, /* Essencial: captura cores e imagens de fundo no PDF */
      displayHeaderFooter: false,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    });

    console.log('PDF gerado com sucesso:', outputPath);
  } finally {
    await browser.close();
  }
})();
