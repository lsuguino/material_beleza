import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FEEDBACK_FILE = path.join(DATA_DIR, 'training-feedback.jsonl');

export type TrainingVerdict = 'approve' | 'reject';

export type TrainingFormat = 'scribo' | 'teaching';

export interface TrainingFeedbackRecord {
  id: string;
  createdAt: string;
  verdict: TrainingVerdict;
  format: TrainingFormat;
  /** Snapshot Scribo (preview) — já sanitizado */
  previewData?: unknown;
  /** Snapshot apostila API (sections) — já sanitizado */
  teachingMaterial?: unknown;
  note?: string;
  meta?: Record<string, string | undefined>;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function appendTrainingFeedback(
  record: Omit<TrainingFeedbackRecord, 'id' | 'createdAt'> & { id?: string }
): Promise<TrainingFeedbackRecord> {
  await ensureDataDir();
  const full: TrainingFeedbackRecord = {
    id: record.id ?? crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    verdict: record.verdict,
    format: record.format,
    previewData: record.previewData,
    teachingMaterial: record.teachingMaterial,
    note: record.note,
    meta: record.meta,
  };
  await fs.appendFile(FEEDBACK_FILE, `${JSON.stringify(full)}\n`, 'utf8');
  return full;
}

export async function readTrainingFeedbackRecords(): Promise<TrainingFeedbackRecord[]> {
  try {
    const raw = await fs.readFile(FEEDBACK_FILE, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const out: TrainingFeedbackRecord[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line) as TrainingFeedbackRecord);
      } catch {
        /* ignora linha corrompida */
      }
    }
    return out;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw e;
  }
}

export async function getTrainingStats(): Promise<{
  approved: number;
  rejected: number;
  total: number;
}> {
  const all = await readTrainingFeedbackRecords();
  let approved = 0;
  let rejected = 0;
  for (const r of all) {
    if (r.verdict === 'approve') approved += 1;
    else rejected += 1;
  }
  return { approved, rejected, total: all.length };
}
