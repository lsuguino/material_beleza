/**
 * Gera imagens para o material via DALL-E 3 e atualiza o HTML.
 * 1. Lê o HTML em busca de <img src="pending" data-prompt="...">
 * 2. Envia cada prompt para o DALL-E 3 (estilo editorial corporativo)
 * 3. Baixa a imagem com axios e salva como images/img_aula_1.png, img_aula_2.png, ...
 * 4. Atualiza o HTML: src="pending" → src="images/img_aula_N.png"
 */

const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const htmlPath = process.argv[2] || path.join(__dirname, '..', 'index.html');
const imagesDir = path.join(path.dirname(path.resolve(htmlPath)), 'images');

const PROMPT_PREFIX = 'Professional corporate editorial style, clean lighting, high resolution, matching a book layout: ';

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)$/);
    if (m) process.env.OPENAI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
  });
}

function findPendingImages(html) {
  const results = [];
  const regex = /<img(?=[^>]*data-prompt="([^"]*)")(?=[^>]*src="pending")[^>]*>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const fullMatch = m[0];
    const prompt = (m[1] || '').replace(/&quot;/g, '"');
    if (prompt) {
      results.push({
        fullMatch,
        prompt,
      });
    }
  }
  return results;
}

function buildReplacement(fullMatch, imageRelPath) {
  return fullMatch.replace(/src="pending"/i, `src="${imageRelPath}"`);
}

async function downloadImage(url, filepath) {
  const response = await axios({ url, responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });
}

async function generateImageUrl(openai, prompt) {
  const fullPrompt = PROMPT_PREFIX + prompt.slice(0, 4000 - PROMPT_PREFIX.length);
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: fullPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid',
    response_format: 'url',
  });
  return response.data?.[0]?.url ?? null;
}

async function generateImagesForBook() {
  loadEnvLocal();

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY não definida. Defina em .env.local ou no ambiente.');
    process.exit(1);
  }

  if (!fs.existsSync(htmlPath)) {
    console.error('Arquivo HTML não encontrado:', htmlPath);
    console.log('Uso: node scripts/generate-images-for-book.js [caminho/index.html]');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const pending = findPendingImages(html);

  if (pending.length === 0) {
    console.log('Nenhum <img src="pending" data-prompt="..."> encontrado no HTML.');
    return;
  }

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const baseDir = path.dirname(path.resolve(htmlPath));
  const relImagesDir = path.relative(baseDir, imagesDir).replace(/\\/g, '/');

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const num = i + 1;
    const filename = `img_aula_${num}.png`;
    const imagePath = path.join(imagesDir, filename);
    const relPath = `${relImagesDir}/${filename}`;

    console.log(`[${num}/${pending.length}] Gerando imagem: ${item.prompt.slice(0, 50)}...`);
    try {
      const url = await generateImageUrl(openai, item.prompt);
      if (url) {
        await downloadImage(url, imagePath);
        html = html.replace(item.fullMatch, () => buildReplacement(item.fullMatch, relPath));
        console.log(`  Sucesso: ${filename} salva.`);
      } else {
        console.warn(`  Falha ao gerar imagem ${num}.`);
      }
    } catch (err) {
      console.error(`  Erro:`, err.message);
    }
  }

  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`HTML atualizado: ${htmlPath}`);
}

generateImagesForBook().catch((err) => {
  console.error(err);
  process.exit(1);
});
