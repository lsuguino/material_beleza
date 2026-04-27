/**
 * Persistência do preview no cliente: localStorage + IndexedDB para payloads com imagens base64
 * (localStorage ~5MB costuma falhar e o fallback anterior removia as imagens).
 *
 * Emite evento via BroadcastChannel após cada save, pra UI captar quando
 * uma fetch terminou em componente remontado (Fast Refresh / unmount race).
 */

export const PREVIEW_STORAGE_KEY = 'rtg-preview-data';

/** Nome do canal pra notificar a UI quando o preview é atualizado no storage. */
export const PREVIEW_BROADCAST_CHANNEL = 'scribo-preview-data';

/** Tipo da mensagem propagada no canal — UI pode discriminar saved vs cleared. */
export type PreviewBroadcastEvent = { type: 'saved' | 'cleared'; ts: number };

function broadcastPreviewEvent(type: PreviewBroadcastEvent['type']): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(PREVIEW_BROADCAST_CHANNEL);
    ch.postMessage({ type, ts: Date.now() } satisfies PreviewBroadcastEvent);
    ch.close();
  } catch {
    /* navegador antigo ou contexto sem BroadcastChannel — ignora */
  }
}

/** Valor em localStorage quando o JSON completo está só no IndexedDB. */
export const PREVIEW_IN_IDB_MARKER = '__SCRIBO_PREVIEW_IN_IDB__';

/** JSON grande fatiado em várias chaves (Puppeteer / limite por chave no localStorage). */
export const PREVIEW_MULTIPART_MARKER = '__SCRIBO_PREVIEW_MULTIPART__';

export const PREVIEW_NPARTS_KEY = 'rtg-preview-data-nparts';

const LS_CHUNK_CHARS = 3_000_000;

const IDB_NAME = 'scribo-preview-v1';
const IDB_STORE = 'kv';
const IDB_KEY = 'main';

const LS_SOFT_LIMIT_CHARS = 4_200_000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function idbPut(value: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(IDB_STORE).put(value, IDB_KEY);
    });
  } finally {
    db.close();
  }
}

async function idbClear(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
    });
  } finally {
    db.close();
  }
}

function previewPartKey(i: number): string {
  return `rtg-preview-data-p${i}`;
}

/**
 * Quebra um JSON grande em várias chaves de localStorage (para injeção no Puppeteer).
 */
export function packPreviewJsonForLocalStorageInjection(fullJson: string): Record<string, string> {
  if (fullJson.length <= LS_CHUNK_CHARS) {
    return { [PREVIEW_STORAGE_KEY]: fullJson };
  }
  const parts: string[] = [];
  for (let i = 0; i < fullJson.length; i += LS_CHUNK_CHARS) {
    parts.push(fullJson.slice(i, i + LS_CHUNK_CHARS));
  }
  const out: Record<string, string> = {
    [PREVIEW_STORAGE_KEY]: PREVIEW_MULTIPART_MARKER,
    [PREVIEW_NPARTS_KEY]: String(parts.length),
  };
  parts.forEach((p, i) => {
    out[previewPartKey(i)] = p;
  });
  return out;
}

function reassembleMultipartPreviewJson(): string | null {
  const n = parseInt(
    typeof localStorage !== 'undefined' ? localStorage.getItem(PREVIEW_NPARTS_KEY) || '0' : '0',
    10
  );
  if (n < 1 || typeof localStorage === 'undefined') return null;
  let acc = '';
  for (let i = 0; i < n; i++) {
    const p = localStorage.getItem(previewPartKey(i));
    if (p == null) return null;
    acc += p;
  }
  return acc;
}

export async function idbGetPreviewJson(): Promise<string | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openDb();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const r = tx.objectStore(IDB_STORE).get(IDB_KEY);
      r.onsuccess = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Grava o preview completo (incl. data URLs de imagens). Usa IndexedDB se não couber no localStorage.
 */
export async function savePreviewDataToClient(data: unknown): Promise<void> {
  if (typeof window === 'undefined') return;
  const json = JSON.stringify(data);

  const useIdbFirst = json.length > LS_SOFT_LIMIT_CHARS || typeof localStorage === 'undefined';

  if (useIdbFirst && typeof indexedDB !== 'undefined') {
    await idbPut(json);
    try {
      localStorage.setItem(PREVIEW_STORAGE_KEY, PREVIEW_IN_IDB_MARKER);
    } catch {
      /* marker falhou — preview ainda acessível via IDB se load usar idb */
    }
    broadcastPreviewEvent('saved');
    return;
  }

  try {
    localStorage.setItem(PREVIEW_STORAGE_KEY, json);
    await idbClear().catch(() => {});
    broadcastPreviewEvent('saved');
  } catch {
    if (typeof indexedDB === 'undefined') {
      console.warn('[preview-storage] Sem IndexedDB; não foi possível persistir o preview completo.');
      return;
    }
    await idbPut(json);
    try {
      localStorage.setItem(PREVIEW_STORAGE_KEY, PREVIEW_IN_IDB_MARKER);
    } catch {
      /* último recurso: sem LS o loadPreviewDataFromClient ainda pode ler só IDB se expormos getRaw */
    }
    broadcastPreviewEvent('saved');
  }
}

/**
 * Lê o preview (mesmo formato salvo por savePreviewDataToClient).
 */
export async function loadPreviewDataFromClient(): Promise<unknown | null> {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
  if (raw === null) {
    const fallback = await idbGetPreviewJson();
    if (!fallback) return null;
    try {
      return JSON.parse(fallback) as unknown;
    } catch {
      return null;
    }
  }

  if (raw === PREVIEW_IN_IDB_MARKER) {
    const fromIdb = await idbGetPreviewJson();
    if (!fromIdb) return null;
    try {
      return JSON.parse(fromIdb) as unknown;
    } catch {
      return null;
    }
  }

  if (raw === PREVIEW_MULTIPART_MARKER) {
    const s = reassembleMultipartPreviewJson();
    if (!s) return null;
    try {
      return JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function clearPreviewDataFromClient(): void {
  if (typeof window === 'undefined') return;
  try {
    const n = parseInt(localStorage.getItem(PREVIEW_NPARTS_KEY) || '0', 10);
    for (let i = 0; i < n; i++) {
      localStorage.removeItem(previewPartKey(i));
    }
    localStorage.removeItem(PREVIEW_NPARTS_KEY);
    localStorage.removeItem(PREVIEW_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  void idbClear().catch(() => {});
  broadcastPreviewEvent('cleared');
}
