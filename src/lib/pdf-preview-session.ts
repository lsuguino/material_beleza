import { randomUUID } from 'crypto';

type Entry = { json: string; exp: number };

const store = new Map<string, Entry>();
const TTL_MS = 25 * 60 * 1000;

function prune(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.exp < now) store.delete(k);
  }
}

/** Armazena JSON grande no servidor para injeção no Puppeteer (evita limite de body / localStorage no headless). */
export function stashPreviewJsonForPdf(json: string): string {
  prune();
  const id = randomUUID();
  store.set(id, { json, exp: Date.now() + TTL_MS });
  return id;
}

export function takePreviewJsonForPdf(id: string): string | null {
  prune();
  const e = store.get(id);
  if (!e || Date.now() > e.exp) return null;
  store.delete(id);
  return e.json;
}
