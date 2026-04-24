import { randomUUID } from 'crypto';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SESSION_DIR = join(tmpdir(), 'scribo-pdf-sessions');
const TTL_MS = 25 * 60 * 1000;

/** Garante que o diretório de sessões existe. */
function ensureDir(): void {
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function sessionPath(id: string): string {
  // Sanitiza o id para evitar path traversal
  const safe = id.replace(/[^a-zA-Z0-9\-]/g, '');
  return join(SESSION_DIR, `${safe}.json`);
}

/** Armazena JSON grande no servidor para injeção no Puppeteer (evita limite de body / localStorage no headless). */
export function stashPreviewJsonForPdf(json: string): string {
  ensureDir();
  const id = randomUUID();
  const meta = JSON.stringify({ exp: Date.now() + TTL_MS, json });
  writeFileSync(sessionPath(id), meta, 'utf-8');
  return id;
}

/** Consome a sessão (remove após leitura — uso único pelo Puppeteer). */
export function takePreviewJsonForPdf(id: string): string | null {
  const fp = sessionPath(id);
  try {
    if (!existsSync(fp)) return null;
    const raw = readFileSync(fp, 'utf-8');
    const entry = JSON.parse(raw) as { exp: number; json: string };
    unlinkSync(fp);
    if (Date.now() > entry.exp) return null;
    return entry.json;
  } catch {
    return null;
  }
}

/** Lê a sessão SEM consumir (para o preview page buscar via fetch). */
export function peekPreviewJsonForPdf(id: string): string | null {
  const fp = sessionPath(id);
  try {
    if (!existsSync(fp)) return null;
    const raw = readFileSync(fp, 'utf-8');
    const entry = JSON.parse(raw) as { exp: number; json: string };
    if (Date.now() > entry.exp) {
      try { unlinkSync(fp); } catch { /* ignore */ }
      return null;
    }
    return entry.json;
  } catch {
    return null;
  }
}
