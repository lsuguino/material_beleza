/**
 * Store em memória para PDFs pré-gerados.
 * Cada entrada expira em 20 minutos e é removida após ser servida.
 * Funciona em deploys single-process (dev, VPS, Docker).
 */

interface PdfEntry {
  buffer: Buffer | null;
  error: string | null;
  ready: boolean;
  createdAt: number;
}

const store = new Map<string, PdfEntry>();
const TTL_MS = 20 * 60 * 1000; // 20 minutos

// Limpeza periódica de entradas expiradas
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (now - entry.createdAt > TTL_MS) store.delete(id);
  }
}, 5 * 60 * 1000);

export function pdfCreate(id: string): void {
  store.set(id, { buffer: null, error: null, ready: false, createdAt: Date.now() });
}

export function pdfSetReady(id: string, buffer: Buffer): void {
  const e = store.get(id);
  if (e) { e.buffer = buffer; e.ready = true; }
}

export function pdfSetError(id: string, error: string): void {
  const e = store.get(id);
  if (e) { e.error = error; e.ready = true; }
}

export function pdfGet(id: string): PdfEntry | undefined {
  return store.get(id);
}

export function pdfDelete(id: string): void {
  store.delete(id);
}
