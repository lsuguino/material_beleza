/**
 * Spike: compara paginação ANTES (chars) vs DEPOIS (altura).
 *
 * Uso:
 *   node --experimental-strip-types scripts/pagination-before-after.mts
 */
import {
  paginateLongContentPages,
  budgetCharsForLayout,
} from '../src/lib/paginate-content-pages.ts';
import {
  bodyBudgetPxForLayout,
  bodyWidthForLayout,
  estimateParagraphsHeightPx,
  type PageLike,
} from '../src/lib/page-layout-metrics.ts';

const CURTO = [
  'Este é um parágrafo de exemplo que descreve a venda consultiva. O vendedor investiga antes de propor, escuta antes de falar, posiciona antes de fechar.',
].join('\n\n');

const MEDIO = [
  'A venda consultiva parte da premissa de que o cliente não busca um produto isolado, mas uma solução para um problema concreto. O vendedor consultivo investiga antes de propor, escuta antes de falar e posiciona antes de fechar.',
  'Três pilares sustentam essa prática: diagnóstico preciso da dor, apresentação de valor quantificado e acompanhamento pós-venda que gera recorrência. Sem os três, a venda degenera em transação.',
  'Um ciclo consultivo bem executado produz receita de maior qualidade — menos desconto, maior LTV, menos churn. Times que adotam o método relatam aumento médio de 18 por cento no ticket.',
].join('\n\n');

const LONGO = [
  MEDIO,
  'Além disso, consultores com baixa tolerância a desconforto tendem a antecipar objeções que o cliente não tinha — isso sinaliza insegurança e corrói a percepção de expertise ao longo de toda a conversa.',
  'A métrica que melhor correlaciona com performance não é número de reuniões, mas taxa de conversão por estágio, com foco especial no ponto de passagem entre qualificação e proposta.',
  'Empresas que investem em sales enablement estruturado reportam aumento significativo na produtividade dos times, principalmente quando combinam tooling com revisões sistemáticas de chamadas gravadas.',
  'Do ponto de vista de gestão, há dois indicadores que capturam saúde de pipeline melhor do que ticket médio: tempo de ciclo de vendas por segmento, e razão de oportunidades que avançam versus as que estacionam no mesmo estágio por mais de duas semanas seguidas.',
  'Por fim, a cultura do time importa mais do que a metodologia específica. Dois times podem adotar a mesma estrutura e obter resultados muito diferentes dependendo de rituais de feedback, clareza de ICP e disciplina de CRM.',
].join('\n\n');

const LAYOUTS = [
  'A4_2_conteudo_misto',
  'A4_2_continuacao',
  'A4_2_texto_corrido',
  'A4_7_sidebar_conteudo',
  'A4_4_magazine',
];

const CASES = [
  { label: 'curto  ', text: CURTO },
  { label: 'médio  ', text: MEDIO },
  { label: 'longo  ', text: LONGO },
];

function makePageProto(layoutTipo: string, blocoPrincipal: string) {
  return {
    tipo: 'conteudo' as const,
    titulo: 'Princípios da Venda Consultiva',
    subtitulo: 'Fundamentos',
    layout_tipo: layoutTipo,
    bloco_principal: blocoPrincipal,
    destaques: ['Diagnóstico claro da dor do cliente antecede qualquer proposta.', 'Exemplo prático: mapeie 3 perguntas abertas antes de toda reunião.'],
    citacao: '',
    itens: [],
  };
}

function run(flag: string, label: string, layoutTipo: string, text: string): {
  label: string;
  flag: string;
  layoutTipo: string;
  pages: number;
  avgChars: number;
  avgFillRatio: number;
} {
  process.env.PAGINATION_BY_HEIGHT = flag;
  const conteudo = { paginas: [makePageProto(layoutTipo, text)] };
  const out = paginateLongContentPages(conteudo as any) as any;
  const pages = out.paginas as any[];

  // chars médios por página de conteúdo
  const chars = pages.map((p) => String(p.bloco_principal ?? '').length);
  const totalChars = chars.reduce((a, b) => a + b, 0);
  const avgChars = pages.length ? Math.round(totalChars / pages.length) : 0;

  // fill ratio estimado (altura usada / budget do layout da página)
  const ratios = pages.map((p) => {
    const layout = String(p.layout_tipo);
    const widthPx = bodyWidthForLayout(layout);
    const budgetPx = bodyBudgetPxForLayout(layout, p as PageLike);
    const paras = String(p.bloco_principal ?? '')
      .split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    const usedPx = estimateParagraphsHeightPx(paras, widthPx, 'body', 12);
    return budgetPx > 0 ? usedPx / budgetPx : 0;
  });
  const avgFillRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;

  return {
    label,
    flag,
    layoutTipo,
    pages: pages.length,
    avgChars,
    avgFillRatio: Math.round(avgFillRatio * 100) / 100,
  };
}

console.log('');
console.log('Spike: paginação antes (chars) vs depois (altura)');
console.log('');
console.log(
  'layout'.padEnd(26),
  'case    '.padEnd(8),
  'mode     '.padEnd(10),
  'páginas'.padStart(7),
  'avgChars'.padStart(9),
  'avgFillRatio'.padStart(13),
);
console.log(''.padEnd(26 + 8 + 10 + 7 + 9 + 13 + 5, '—'));

for (const layout of LAYOUTS) {
  for (const c of CASES) {
    const before = run('0', c.label, layout, c.text);
    const after  = run('1', c.label, layout, c.text);
    console.log(
      layout.padEnd(26),
      c.label.padEnd(8),
      'ANTES    '.padEnd(10),
      String(before.pages).padStart(7),
      String(before.avgChars).padStart(9),
      String(before.avgFillRatio).padStart(13),
    );
    console.log(
      ''.padEnd(26),
      ''.padEnd(8),
      'DEPOIS   '.padEnd(10),
      String(after.pages).padStart(7),
      String(after.avgChars).padStart(9),
      String(after.avgFillRatio).padStart(13),
    );
  }
  console.log('');
}

// budget px por layout (referência)
console.log('Budget px (alvo de corpo por layout):');
for (const layout of LAYOUTS) {
  const bx = bodyBudgetPxForLayout(layout, {});
  const chars = budgetCharsForLayout(layout);
  console.log('  ', layout.padEnd(26), 'budgetPx=', String(bx).padStart(4), ' | legacy budgetChars=', String(chars).padStart(4));
}
