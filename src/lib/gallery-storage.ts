/**
 * Galeria local de materiais gerados — IndexedDB separado do preview atual.
 * Cap rígido de MAX_GALLERY_ITEMS; quando estoura, remove o mais antigo (FIFO).
 *
 * Não usa localStorage porque materiais com imagens base64 facilmente estouram 5MB.
 */

const IDB_NAME = 'scribo-gallery-v1';
const IDB_STORE = 'items';
const IDB_VERSION = 1;

export const MAX_GALLERY_ITEMS = 20;

export interface GalleryItemMeta {
  id: string;
  titulo: string;
  subtituloCurso?: string;
  createdAt: number;
  cursoId?: string;
  modo?: string;
  pageCount?: number;
}

export interface GalleryItem extends GalleryItemMeta {
  /** Dados completos pra renderizar a página de preview (conteudo + design + tema). */
  previewData: unknown;
  /** VTT original da geração — usado pra regerar. Pode ser undefined se o material veio de outro fluxo. */
  originalVtt?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        const store = req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(IDB_STORE, mode).objectStore(IDB_STORE);
}

/** Lista todos os itens da galeria, ordenados do mais recente ao mais antigo. */
export async function listGallery(): Promise<GalleryItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return [];
  }
  try {
    return await new Promise<GalleryItem[]>((resolve, reject) => {
      const store = tx(db, 'readonly');
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as GalleryItem[]) ?? [];
        items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Retorna um item por id, ou null. */
export async function getFromGallery(id: string): Promise<GalleryItem | null> {
  if (typeof indexedDB === 'undefined') return null;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  try {
    return await new Promise<GalleryItem | null>((resolve, reject) => {
      const store = tx(db, 'readonly');
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as GalleryItem | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Salva um novo material na galeria. Retorna o item salvo (com id gerado).
 * Se exceder MAX_GALLERY_ITEMS, remove o mais antigo antes de salvar.
 */
export async function saveToGallery(
  input: Omit<GalleryItem, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
): Promise<GalleryItem | null> {
  if (typeof indexedDB === 'undefined') return null;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch (err) {
    console.error('[gallery] falha ao abrir IndexedDB:', err);
    return null;
  }

  const item: GalleryItem = {
    ...input,
    id: input.id ?? newId(),
    createdAt: input.createdAt ?? Date.now(),
  };

  try {
    // Verifica cap e remove o mais antigo se necessário
    const all = await new Promise<GalleryItem[]>((resolve, reject) => {
      const store = tx(db, 'readonly');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as GalleryItem[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    if (all.length >= MAX_GALLERY_ITEMS) {
      const sorted = [...all].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      const toRemove = sorted.slice(0, all.length - MAX_GALLERY_ITEMS + 1);
      await new Promise<void>((resolve, reject) => {
        const store = tx(db, 'readwrite');
        toRemove.forEach((r) => store.delete(r.id));
        store.transaction.oncomplete = () => resolve();
        store.transaction.onerror = () => reject(store.transaction.error);
      });
    }

    // Adiciona o novo
    await new Promise<void>((resolve, reject) => {
      const store = tx(db, 'readwrite');
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return item;
  } catch (err) {
    console.error('[gallery] falha ao salvar:', err);
    return null;
  } finally {
    db.close();
  }
}

/** Remove um item específico da galeria. */
export async function deleteFromGallery(id: string): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return false;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const store = tx(db, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch (err) {
    console.error('[gallery] falha ao deletar:', err);
    return false;
  } finally {
    db.close();
  }
}

/**
 * Extrai metadados da `previewData` (estrutura típica: { conteudo, design, tema, ... })
 * e salva na galeria com título/contagem/etc. derivados.
 */
export async function saveMaterialToGallery(opts: {
  previewData: unknown;
  originalVtt?: string;
  cursoId?: string;
  modo?: string;
}): Promise<GalleryItem | null> {
  const root = opts.previewData as Record<string, unknown> | null;
  if (!root || typeof root !== 'object') return null;

  const conteudo = (root.conteudo as Record<string, unknown> | undefined) ?? root;
  const design = (root.design as Record<string, unknown> | undefined) ?? conteudo;

  const titulo = String(
    conteudo?.titulo ?? (design as Record<string, unknown>)?.titulo ?? 'Sem título',
  );
  const subtituloCursoRaw = String(
    conteudo?.subtitulo_curso ?? (design as Record<string, unknown>)?.subtitulo_curso ?? '',
  ).trim();
  const subtituloCurso = subtituloCursoRaw.length > 0 ? subtituloCursoRaw : undefined;

  const paginas = (conteudo?.paginas ??
    (design as Record<string, unknown>)?.paginas) as unknown[] | undefined;
  const pageCount = Array.isArray(paginas) ? paginas.length : undefined;

  return saveToGallery({
    titulo,
    subtituloCurso,
    previewData: opts.previewData,
    originalVtt: opts.originalVtt,
    cursoId: opts.cursoId,
    modo: opts.modo,
    pageCount,
  });
}

/** Apaga TODOS os itens da galeria (botão "limpar tudo"). */
export async function clearGallery(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const store = tx(db, 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
