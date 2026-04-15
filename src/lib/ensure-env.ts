import { readFile } from 'fs/promises';
import path from 'path';
import {
  isPlausibleOpenRouterKeyShape,
  normalizeOpenRouterApiKey,
  syncOpenRouterKeyFromEnvAliases,
} from '@/lib/openrouter-key';

function stripBom(raw: string): string {
  return raw.replace(/^\uFEFF/, '');
}

/** Lê KEY=value de um .env (linha a linha; ignora comentários e chaves vazias). */
function parseEnvVar(raw: string, varName: string): string | null {
  const prefix = `${varName}=`;
  const exportPrefix = `export ${varName}=`;
  for (const line of stripBom(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    let rest: string | null = null;
    if (trimmed.startsWith(prefix)) rest = trimmed.slice(prefix.length);
    else if (trimmed.startsWith(exportPrefix)) rest = trimmed.slice(exportPrefix.length);
    else continue;
    let v = rest.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else {
      const hashIdx = v.indexOf('#');
      if (hashIdx >= 0) v = v.slice(0, hashIdx).trim();
    }
    const out = v.trim();
    if (out) return out;
  }
  return null;
}

async function loadEnvVarFromFiles(varName: string): Promise<string | null> {
  const cwd = process.cwd();
  // `.ev.local` é typo comum de `.env.local`; Next.js não carrega esse nome — lemos aqui para não perder a chave.
  for (const file of ['.env.local', '.ev.local', '.env'] as const) {
    try {
      const raw = await readFile(path.join(cwd, file), 'utf-8');
      const v = parseEnvVar(raw, varName);
      if (v) return v;
    } catch {
      /* arquivo ausente ou inacessível */
    }
  }
  return null;
}

function commitOpenRouterKey(k: string): string {
  const n = normalizeOpenRouterApiKey(k);
  process.env.OPENROUTER_API_KEY = n;
  return n;
}

function isPlausibleGeminiKey(s: string | undefined | null): boolean {
  if (!s) return false;
  return s.trim().length >= 15;
}

/**
 * Garante que OPENROUTER_API_KEY está disponível em process.env.
 *
 * Ordem (importante no Windows / Vercel):
 * 1) Chave plausível em `.env.local` / `.env` (leitura explícita) — corrige o caso em que uma
 *    `OPENROUTER_API_KEY` antiga/errada já está em variável de sistema; o Next.js não sobrescreve
 *    variáveis já definidas no ambiente, então o .env seria ignorado se confiássemos só em process.env.
 * 2) Chave plausível em process.env (ex.: só variável de ambiente no deploy).
 * 3) Qualquer valor não vazio do arquivo, depois do env.
 */
export async function ensureOpenRouterKey(): Promise<string | null> {
  const fromFile = await loadEnvVarFromFiles('OPENROUTER_API_KEY');
  const fromFileAlias = await loadEnvVarFromFiles('OPENROUTER');
  const fileNorm = normalizeOpenRouterApiKey(fromFile);
  const fileAliasNorm = normalizeOpenRouterApiKey(fromFileAlias);

  syncOpenRouterKeyFromEnvAliases();
  const keyRaw = process.env.OPENROUTER_API_KEY;
  const key = normalizeOpenRouterApiKey(keyRaw);

  if (isPlausibleOpenRouterKeyShape(fileNorm)) return commitOpenRouterKey(fileNorm);
  if (isPlausibleOpenRouterKeyShape(fileAliasNorm)) return commitOpenRouterKey(fileAliasNorm);
  if (isPlausibleOpenRouterKeyShape(key)) return commitOpenRouterKey(key);
  if (fileNorm) return commitOpenRouterKey(fileNorm);
  if (fileAliasNorm) return commitOpenRouterKey(fileAliasNorm);
  if (key) return commitOpenRouterKey(key);
  return null;
}

function isPlausibleAnthropicKey(s: string | undefined | null): boolean {
  if (!s) return false;
  return s.trim().length >= 20 && s.trim().startsWith('sk-ant-');
}

/**
 * Garante que ANTHROPIC_API_KEY está disponível em process.env.
 * Ordem: chave plausível em process.env → chave plausível em .env.local / .env → qualquer valor não vazio.
 */
export async function ensureAnthropicKey(): Promise<string | null> {
  const fromFile = await loadEnvVarFromFiles('ANTHROPIC_API_KEY');
  const fromFileAlias = await loadEnvVarFromFiles('ANTHROPIC');
  const keyRaw = process.env.ANTHROPIC_API_KEY?.trim();
  const aliasEnv = process.env.ANTHROPIC?.trim() ?? process.env.ANTHROPIC_KEY?.trim();

  if (isPlausibleAnthropicKey(fromFile)) {
    process.env.ANTHROPIC_API_KEY = fromFile!;
    return fromFile!;
  }
  if (isPlausibleAnthropicKey(fromFileAlias)) {
    process.env.ANTHROPIC_API_KEY = fromFileAlias!;
    return fromFileAlias!;
  }
  if (isPlausibleAnthropicKey(keyRaw)) {
    process.env.ANTHROPIC_API_KEY = keyRaw!;
    return keyRaw!;
  }
  if (isPlausibleAnthropicKey(aliasEnv)) {
    process.env.ANTHROPIC_API_KEY = aliasEnv!;
    return aliasEnv!;
  }
  if (fromFile) {
    process.env.ANTHROPIC_API_KEY = fromFile;
    return fromFile;
  }
  if (fromFileAlias) {
    process.env.ANTHROPIC_API_KEY = fromFileAlias;
    return fromFileAlias;
  }
  if (keyRaw) return keyRaw;
  if (aliasEnv) {
    process.env.ANTHROPIC_API_KEY = aliasEnv;
    return aliasEnv;
  }
  return null;
}

/** Chave Google AI (Gemini) para geração de imagens (Nano Banana). Opcional. */
export async function ensureGeminiApiKey(): Promise<string | null> {
  const fromFile = await loadEnvVarFromFiles('GEMINI_API_KEY');
  const fromFileAlias = await loadEnvVarFromFiles('GEMINI');
  const key = process.env.GEMINI_API_KEY?.trim();
  const aliasEnv = process.env.GEMINI?.trim() ?? process.env.GEMINI_KEY?.trim();
  const fileNorm = fromFile?.trim();
  const fileAliasNorm = fromFileAlias?.trim();

  if (isPlausibleGeminiKey(fileNorm)) {
    const k = fileNorm as string;
    process.env.GEMINI_API_KEY = k;
    return k;
  }
  if (isPlausibleGeminiKey(fileAliasNorm)) {
    process.env.GEMINI_API_KEY = fileAliasNorm!;
    return fileAliasNorm!;
  }
  if (isPlausibleGeminiKey(key)) return key!;
  if (isPlausibleGeminiKey(aliasEnv)) {
    process.env.GEMINI_API_KEY = aliasEnv!;
    return aliasEnv!;
  }
  if (fileNorm) {
    process.env.GEMINI_API_KEY = fileNorm;
    return fileNorm;
  }
  if (fileAliasNorm) {
    process.env.GEMINI_API_KEY = fileAliasNorm;
    return fileAliasNorm;
  }
  if (key) return key;
  if (aliasEnv) {
    process.env.GEMINI_API_KEY = aliasEnv;
    return aliasEnv;
  }
  return null;
}
