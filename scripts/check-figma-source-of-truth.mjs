#!/usr/bin/env node
/**
 * Validação de build: roda o schema TS contra docs/figma-source-of-truth.json.
 * Exit 0 se válido, exit 1 com lista de erros.
 *
 * Uso:
 *   node scripts/check-figma-source-of-truth.mjs
 *   node scripts/check-figma-source-of-truth.mjs --strict   # trata warnings como erros
 *
 * Integração em package.json:
 *   "scripts": { "check:figma": "node scripts/check-figma-source-of-truth.mjs" }
 *
 * Espelha figma-a4-schema.ts em JS plano (sem tsc/tsx). Mantenha em sincronia.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(__dirname, '..', 'docs', 'figma-source-of-truth.json');
const strict = process.argv.includes('--strict');

const ALLOWED_LAYOUTS = [
  'A4_0_sumario','A4_1_abertura','A4_1_abertura_split','A4_1_abertura_imagem','A4_1_abertura_invertida','A4_1_abertura_full',
  'A4_2_conteudo_misto','A4_2_texto_corrido','A4_2_texto_citacao','A4_2_texto_imagem','A4_2_texto_sidebar',
  'A4_2_duas_colunas','A4_2_duas_colunas_num','A4_2_imagem_texto','A4_2_continuacao',
  'A4_3_sidebar_steps','A4_3_processo_etapas',
  'A4_4_magazine','A4_4_cards_grid','A4_4_destaque_numerico','A4_4_comparativo','A4_4_pros_contras',
  'A4_5_tabela','A4_5_organograma','A4_5_mapa_mental','A4_5_timeline','A4_5_infografico','A4_5_grafico_analise',
  'A4_6_faq','A4_6_lista_icones','A4_6_texto_completo',
  'A4_7_sidebar_conteudo',
  'A4_8_citacao_destaque','A4_8_nota_importante','A4_8_testemunho','A4_8_frase_impacto','A4_8_imagem_overlay','A4_8_imagem_sidebar',
  'A4_9_checklist','A4_9_exercicio','A4_9_resumo_capitulo','A4_9_conceitos_chave',
];
const ALLOWED_SET = new Set(ALLOWED_LAYOUTS);

const LAYOUT_ID_PATTERN = /^A4_\d+_[a-z_]+$/;
const FIGMA_NODE_ID_PATTERN = /^(?:\d+:\d+|no_figma_frame|pipeline_only|unresolved)$/;

/** @param {unknown} input */
export function validate(input) {
  const errors = [];
  const warnings = [];
  const push = (path, msg, level = 'error') =>
    (level === 'error' ? errors : warnings).push({ path, message: msg });

  if (!input || typeof input !== 'object') {
    return { ok: false, errors: [{ path: '$', message: 'root must be an object' }], warnings: [], stats: {} };
  }

  const allowed = input.allowedLayouts;
  if (!Array.isArray(allowed)) push('allowedLayouts', 'missing or not an array');
  else {
    const dup = new Set();
    allowed.forEach((v, i) => {
      const p = `allowedLayouts[${i}]`;
      if (typeof v !== 'string') return push(p, 'not a string');
      if (!LAYOUT_ID_PATTERN.test(v)) push(p, `does not match /^A4_\\d+_[a-z_]+$/: "${v}"`);
      if (!ALLOWED_SET.has(v)) push(p, `not in ALLOWED_LAYOUTS const: "${v}"`);
      if (dup.has(v)) push(p, `duplicate: "${v}"`);
      dup.add(v);
    });
    const asSet = new Set(allowed);
    for (const want of ALLOWED_LAYOUTS) {
      if (!asSet.has(want)) push('allowedLayouts', `missing canonical id: "${want}"`);
    }
  }

  const templates = input.templates;
  const knownTemplateIds = new Set();
  if (!Array.isArray(templates)) push('templates', 'missing or not an array');
  else {
    templates.forEach((t, i) => {
      const p = `templates[${i}]`;
      if (!t || typeof t !== 'object') return push(p, 'not an object');
      if (typeof t.id !== 'string') return push(`${p}.id`, 'not a string');
      if (!ALLOWED_SET.has(t.id)) push(`${p}.id`, `not in ALLOWED_LAYOUTS: "${t.id}"`);
      if (knownTemplateIds.has(t.id)) push(`${p}.id`, `duplicate template id: "${t.id}"`);
      knownTemplateIds.add(t.id);
      if (typeof t.name !== 'string') push(`${p}.name`, 'not a string');
      if (typeof t.section !== 'string') push(`${p}.section`, 'not a string');
      const s = t.structure;
      if (!s || typeof s !== 'object') push(`${p}.structure`, 'missing or not an object');
      else if (!s.body) push(`${p}.structure.body`, 'missing required block');
      if (!Array.isArray(t.bestFor)) push(`${p}.bestFor`, 'missing or not an array');
    });
    for (const id of ALLOWED_LAYOUTS) {
      if (!knownTemplateIds.has(id)) push('templates', `missing template for canonical id: "${id}"`);
    }
  }

  const fm = input.frameMapping;
  const seenFrameIds = new Set();
  let framesWithNodeId = 0, framesReviewNeeded = 0, pipelineOnly = 0, noFigmaFrame = 0;
  if (!Array.isArray(fm)) push('frameMapping', 'missing or not an array');
  else {
    fm.forEach((m, i) => {
      const p = `frameMapping[${i}]`;
      if (!m || typeof m !== 'object') return push(p, 'not an object');
      if (typeof m.layoutIdCanonical !== 'string') return push(`${p}.layoutIdCanonical`, 'not a string');
      if (m.layoutIdCanonical !== 'unmapped' && !ALLOWED_SET.has(m.layoutIdCanonical)) {
        push(`${p}.layoutIdCanonical`, `not in ALLOWED_LAYOUTS: "${m.layoutIdCanonical}"`);
      }
      if (typeof m.figmaNodeId !== 'string' || !FIGMA_NODE_ID_PATTERN.test(m.figmaNodeId)) {
        push(`${p}.figmaNodeId`, `invalid figmaNodeId format: "${m.figmaNodeId}"`);
      } else {
        if (m.figmaNodeId === 'pipeline_only') pipelineOnly++;
        else if (m.figmaNodeId === 'no_figma_frame') noFigmaFrame++;
        else if (m.figmaNodeId === 'unresolved') push(`${p}.figmaNodeId`, 'still "unresolved" — extraction incomplete', 'warn');
        else {
          framesWithNodeId++;
          if (seenFrameIds.has(m.figmaNodeId)) push(`${p}.figmaNodeId`, `duplicate node id: "${m.figmaNodeId}"`);
          seenFrameIds.add(m.figmaNodeId);
        }
      }
      const c = m.mappingConfidence;
      if (typeof c !== 'number' || c < 0 || c > 1) push(`${p}.mappingConfidence`, `not a number in [0,1]: "${c}"`);
      if (m.reviewNeeded === true) framesReviewNeeded++;
      const reviewed = m.reviewNeeded === true || typeof m.reviewDecision === 'string';
      if (typeof c === 'number' && c > 0 && c < 0.9 && !reviewed &&
          m.figmaNodeId !== 'pipeline_only' && m.figmaNodeId !== 'no_figma_frame') {
        push(p, `confidence ${c} < 0.9 sem reviewNeeded nem reviewDecision`, 'warn');
      }
    });
    const covered = new Set();
    for (const m of fm) if (m && typeof m.layoutIdCanonical === 'string') covered.add(m.layoutIdCanonical);
    for (const id of ALLOWED_LAYOUTS) if (!covered.has(id)) push('frameMapping', `no entry covers canonical id: "${id}"`);
  }

  return {
    ok: errors.length === 0,
    errors, warnings,
    stats: {
      allowedLayouts: Array.isArray(allowed) ? allowed.length : 0,
      templates: Array.isArray(templates) ? templates.length : 0,
      frameMapping: Array.isArray(fm) ? fm.length : 0,
      framesWithNodeId, framesReviewNeeded, pipelineOnly, noFigmaFrame,
    },
  };
}

// CLI
const invokedAs = process.argv[1] || '';
if (import.meta.url === `file://${invokedAs}` || invokedAs.endsWith('check-figma-source-of-truth.mjs')) {
  const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const r = validate(json);
  console.log(`figma-source-of-truth.json: ${r.ok ? 'OK' : 'FAIL'}`);
  console.log(`  stats:`, JSON.stringify(r.stats));
  if (r.errors.length) {
    console.log(`  errors (${r.errors.length}):`);
    for (const e of r.errors) console.log(`    [err] ${e.path}: ${e.message}`);
  }
  if (r.warnings.length) {
    console.log(`  warnings (${r.warnings.length}):`);
    for (const w of r.warnings) console.log(`    [warn] ${w.path}: ${w.message}`);
  }
  const failed = !r.ok || (strict && r.warnings.length > 0);
  process.exit(failed ? 1 : 0);
}
