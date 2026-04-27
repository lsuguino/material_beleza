'use client';

/**
 * Renderizadores baseados nos templates do Figma (Material Beleza).
 * Cada função corresponde a um frame A4 do Figma, usando tokens exatos.
 *
 * O PageConteudo usa o LAYOUT_MAP para cair nestes renderizadores
 * quando o layout_tipo corresponde a um template do Figma.
 */

import { FIGMA_CSS, FIGMA_COLORS } from '@/lib/figma-design-tokens';
import { isRenderableImageUrl } from '@/lib/image-url';
import { getIconById } from '@/lib/icons-map';

/**
 * Extrai um rótulo embutido no início de um destaque (ex.: "Dica do Autor: …" → label "DICA DO AUTOR" + body sem o prefixo).
 * Aceita separadores `:`, `—`, `–`, `-`. Se não detectar prefixo plausível (≤5 palavras), retorna o fallback.
 */
function extractCalloutLabel(text: string | undefined, fallback: string): { label: string; body: string } {
  const t = (text ?? '').trim();
  if (!t) return { label: fallback, body: '' };
  const match = t.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{2,40})\s*[:—–]\s+(.+)$/s);
  if (!match) return { label: fallback, body: t };
  const rawLabel = match[1].trim();
  const wordCount = rawLabel.split(/\s+/).length;
  if (wordCount > 5) return { label: fallback, body: t };
  return { label: rawLabel.toUpperCase(), body: match[2].trim() };
}

/** Renderiza ícone SVG pelo ID */
function IconSvg({ iconId, size = 18 }: { iconId?: string; size?: number }) {
  if (!iconId) return null;
  const icon = getIconById(iconId);
  if (!icon) return null;
  return (
    <img src={icon.path} alt={icon.name} width={size} height={size}
      className="inline-block flex-shrink-0"
      style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }}
      aria-hidden />
  );
}

export interface TemplateProps {
  titulo: string;
  subtitulo?: string;
  paragrafos: string[];
  destaques: string[];
  citacao?: string;
  itens: string[];
  numeroPagina: number;
  imagemUrl?: string;
  capituloNumero?: number;
  iconId?: string;
  /** Sugestões de visuais estruturados — usadas pelos templates de tabela/comparativo/etapas */
  sugestaoTabela?: { titulo?: string; colunas?: string[]; linhas?: string[][] };
  sugestaoGrafico?: { tipo?: string; titulo?: string; labels?: string[]; valores?: number[] };
  sugestaoFluxograma?: { titulo?: string; etapas?: string[] };
  /** Tamanho da imagem em % da largura da coluna de conteúdo (default 50). Usado pelo layout flutuante. */
  imageWidthPct?: number;
  /** Lado do float da imagem no layout flutuante (default 'right'). */
  floatSide?: 'left' | 'right';
  /** Retângulo livre (em % da página A4) onde a imagem deve ser renderizada. Usado pelo layout `A4_imagem_livre`. */
  imagemBox?: { xPct: number; yPct: number; wPct: number; hPct: number };
}

/** Badge de página — arredondado no topo, colado no fundo */
function Badge({ numero }: { numero: number }) {
  return (
    <div style={FIGMA_CSS.badge} aria-hidden>
      {numero}
    </div>
  );
}

/** Barra teal fina horizontal */
function TealBar() {
  return <div style={FIGMA_CSS.tealBarThin} aria-hidden />;
}

// ============================================================
// TEMPLATE: Texto com Citação (header teal + corpo + citação)
// Figma: "Miolo - Texto com Citação"
// ============================================================
export function TemplateTealHeaderBody({
  titulo, subtitulo, paragrafos, citacao, numeroPagina, iconId
}: TemplateProps) {
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {/* Header teal */}
      <div style={FIGMA_CSS.headerTeal} className="flex-shrink-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <IconSvg iconId={iconId} size={18} />
          {subtitulo && <p style={{ ...FIGMA_CSS.labelCyan, margin: 0 }}>{subtitulo}</p>}
        </div>
        <h1 style={FIGMA_CSS.h1White}>{titulo}</h1>
      </div>
      {/* Body */}
      <div style={FIGMA_CSS.bodyBlock} className="flex flex-col overflow-hidden">
        {paragrafos.map((p, i) => (
          <p key={i} style={{ ...FIGMA_CSS.bodyGray, marginBottom: 12 }}>{p}</p>
        ))}
        {citacao && <blockquote style={FIGMA_CSS.quoteBlock}>{citacao}</blockquote>}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Texto com Dica e Exercício (dica teal + body + exercício teal)
// Figma: "Miolo - Texto com Dica e Exercício"
// ============================================================
export function TemplateDicaExercicio({
  titulo, paragrafos, destaques, citacao, itens, numeroPagina
}: TemplateProps) {
  const dicaCallout = destaques[0] ? extractCalloutLabel(destaques[0], '✦ DICA DO AUTOR') : null;
  const exercicioRaw = (destaques[1] || itens[0] || '').trim();
  const exercicioCallout = exercicioRaw ? extractCalloutLabel(exercicioRaw, 'EXERCÍCIO PRÁTICO') : null;
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {dicaCallout && dicaCallout.body && (
        <div style={FIGMA_CSS.footerTeal} className="flex-shrink-0">
          <p style={FIGMA_CSS.labelCyan}>{dicaCallout.label}</p>
          <p style={{ ...FIGMA_CSS.bodyGray, color: '#ffffff', marginTop: 8 }}>{dicaCallout.body}</p>
        </div>
      )}
      <div style={{ ...FIGMA_CSS.bodyBlock, gap: '12px' }} className="flex flex-col overflow-hidden">
        {titulo && !dicaCallout && (
          <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark }}>{titulo}</h1>
        )}
        {paragrafos.map((p, i) => (
          <p key={i} style={{ ...FIGMA_CSS.bodyGray, marginBottom: 12 }}>{p}</p>
        ))}
        {citacao && <blockquote style={FIGMA_CSS.quoteBlock}>{citacao}</blockquote>}
      </div>
      {exercicioCallout && exercicioCallout.body && (
        <div style={FIGMA_CSS.footerTeal} className="flex-shrink-0">
          <p style={FIGMA_CSS.labelCyan}>{exercicioCallout.label}</p>
          <p style={{ ...FIGMA_CSS.bodyGray, color: '#ffffff', marginTop: 8 }}>{exercicioCallout.body}</p>
        </div>
      )}
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Texto Corrido com Sidebar fina (60px teal + conteúdo)
// Figma: "Miolo - Texto Corrido com Sidebar"
// ============================================================
export function TemplateSidebarFina({
  titulo, subtitulo, paragrafos, citacao, itens, numeroPagina, capituloNumero
}: TemplateProps) {
  return (
    <div className="page-a4 relative overflow-hidden flex flex-row" style={FIGMA_CSS.page}>
      {/* Sidebar fina */}
      <div style={FIGMA_CSS.sidebar60} className="flex flex-col justify-end items-center pb-[30px]">
        <Badge numero={numeroPagina} />
      </div>
      {/* Conteúdo */}
      <div style={{ ...FIGMA_CSS.content370, width: '535px', padding: '50px 50px 50px 30px' }}
        className="flex flex-col overflow-hidden">
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark, marginTop: 8, marginBottom: 16 }}>{titulo}</h1>
        {subtitulo && <p style={{ ...FIGMA_CSS.bodyGray, marginBottom: 16 }}>{subtitulo}</p>}
        <div style={{ width: 60, height: 4, backgroundColor: FIGMA_COLORS.tealAccent, marginBottom: 20 }} />
        {paragrafos.map((p, i) => (
          <p key={i} style={{ ...FIGMA_CSS.bodyGray, marginBottom: 12 }}>{p}</p>
        ))}
        {citacao && <blockquote style={FIGMA_CSS.quoteBlock}>{citacao}</blockquote>}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE: Texto Corrido (sem header, título teal + parágrafos)
// Figma: "Miolo - Texto Corrido"
// ============================================================
export function TemplateTextoCorrido({
  titulo, paragrafos, citacao, numeroPagina
}: TemplateProps) {
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <div style={{ padding: '50px 50px 20px 50px', flex: '1 1 0', overflow: 'hidden', boxSizing: 'border-box' as const }}
        className="flex flex-col">
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealAccent, marginBottom: 8 }}>{titulo}</h1>
        <div style={{ width: 60, height: 4, backgroundColor: FIGMA_COLORS.tealAccent, marginBottom: 20 }} />
        {paragrafos.map((p, i) => (
          <p key={i} style={{ ...FIGMA_CSS.bodyGray, marginBottom: 12 }}>{p}</p>
        ))}
        {citacao && <blockquote style={{ ...FIGMA_CSS.quoteBlock, marginTop: 12 }}>{citacao}</blockquote>}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Citação Destaque (teal full, citação 36px)
// Figma: "Citação Destaque"
// ============================================================
export function TemplateCitacaoDestaque({
  citacao, paragrafos, numeroPagina
}: TemplateProps) {
  const text = citacao || paragrafos[0] || '';
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col items-center justify-center"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.tealDark, padding: '80px 50px 50px 50px' }}>
      {/* Aspas abertura */}
      <span style={{ fontFamily: "'Sora'", fontSize: 96, color: FIGMA_COLORS.tealAccent, lineHeight: 1 }}>"</span>
      {/* Citação */}
      <p style={{ ...FIGMA_CSS.citeText, marginTop: 20, marginBottom: 20 }}>{text}</p>
      {/* Aspas fechamento */}
      <span style={{ fontFamily: "'Sora'", fontSize: 96, color: FIGMA_COLORS.tealAccent, lineHeight: 1 }}>"</span>
      {/* Divider + autor */}
      <div style={{ width: 80, height: 3, backgroundColor: FIGMA_COLORS.cyanLight, marginTop: 20, marginBottom: 16 }} />
      <p style={{ ...FIGMA_CSS.bodyGray, color: FIGMA_COLORS.cyanLight, textAlign: 'center' }}>— Autor</p>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Frase de Impacto (branco, frase 48px)
// Figma: "Destaque - Frase de Impacto"
// ============================================================
export function TemplateFraseImpacto({
  citacao, paragrafos, numeroPagina
}: TemplateProps) {
  const text = citacao || paragrafos[0] || '';
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <TealBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '50px', boxSizing: 'border-box' as const }}>
        <p style={FIGMA_CSS.impactPhrase}>{text}</p>
        <div style={{ width: 80, height: 4, backgroundColor: FIGMA_COLORS.tealAccent, marginTop: 24, marginBottom: 16 }} />
        <p style={FIGMA_CSS.bodyGray}>— Nome do Método</p>
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Imagem com Texto (imagem topo + legenda + corpo)
// Figma: "Miolo - Imagem com Texto"
// ============================================================
export function TemplateImagemTexto({
  titulo, paragrafos, imagemUrl, numeroPagina
}: TemplateProps) {
  const hasImage = isRenderableImageUrl(imagemUrl);
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {/* Imagem + legenda só quando houver mídia, evitando área vazia grande */}
      {hasImage && (
        <>
          <div style={{ width: '100%', height: 420, backgroundColor: FIGMA_COLORS.lightBg, flexShrink: 0, overflow: 'hidden' }}>
            <img src={imagemUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ ...FIGMA_CSS.footerTeal, padding: '10px 50px' }} className="flex-shrink-0">
            <p style={{ ...FIGMA_CSS.labelCyan, fontSize: 11 }}>Legenda da imagem ilustrativa</p>
          </div>
        </>
      )}
      {/* Corpo */}
      <div
        style={hasImage ? FIGMA_CSS.bodyBlock : { ...FIGMA_CSS.bodyBlock, padding: '50px 50px 56px 50px' }}
        className="flex flex-col overflow-hidden"
      >
        <h2 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealAccent, fontSize: 22, marginBottom: 16 }}>{titulo}</h2>
        {paragrafos.map((p, i) => (
          <p key={i} style={{ ...FIGMA_CSS.bodyGray, marginBottom: 12 }}>{p}</p>
        ))}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Destaque Numérico (grid 2x2 com números grandes)
// Figma: "Miolo - Destaque Numérico"
// ============================================================
export function TemplateDestaqueNumerico({
  titulo, itens, numeroPagina
}: TemplateProps) {
  // Itens viram cards com número + descrição
  const cards = itens.slice(0, 4).map((item, i) => {
    const parts = item.split(/[:\-–]/);
    return { num: parts[0]?.trim() || `${i + 1}`, desc: parts[1]?.trim() || item };
  });
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <div style={{ padding: '40px 50px 20px 50px' }}>
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealAccent }}>{titulo}</h1>
      </div>
      <div style={{ flex: 1, padding: '20px 50px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {cards.map((card, i) => (
          <div key={i} style={{ backgroundColor: FIGMA_COLORS.lightBg, borderRadius: 8, padding: '24px 20px' }}>
            <p style={FIGMA_CSS.statNumber}>{card.num}</p>
            <p style={{ ...FIGMA_CSS.bodyGray, marginTop: 8 }}>{card.desc}</p>
          </div>
        ))}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Abertura de Tópico — 4 variações editoriais que rotacionam
// por tópico pra evitar monotonia. Todas full-bleed, mesma família visual,
// mas com tratamentos distintos de número+título (inspirado em refs
// editoriais: About Us / People / Helvetica).
// ============================================================

/**
 * Número de página minimalista pros openers — sem moldura teal, apenas o dígito.
 * Cor se adapta ao background da variação.
 */
function OpenerPageNumber({ numero, color }: { numero: number; color: string }) {
  return (
    <p
      aria-hidden
      style={{
        position: 'absolute' as const, bottom: 24, left: 0, right: 0,
        textAlign: 'center' as const,
        fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 500,
        color, margin: 0, letterSpacing: '1.5px',
      }}
    >
      {numero}
    </p>
  );
}

/** Variação 0 — número monumental no topo, título abaixo, full-bleed teal escuro. */
function OpenerTopNumber({ titulo, subtitulo, numeroPagina, capituloNumero }: TemplateProps) {
  const n = String(capituloNumero ?? numeroPagina).padStart(2, '0');
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.tealDark }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '80px 60px 100px 60px',
        boxSizing: 'border-box' as const,
      }}>
        <p style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '220px',
          lineHeight: 0.85, color: FIGMA_COLORS.white, margin: 0,
          letterSpacing: '-0.04em',
        }}>
          {n}
        </p>
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '48px',
          lineHeight: 1.1, color: FIGMA_COLORS.white, margin: 0,
          marginTop: 36, letterSpacing: '-0.01em',
        }}>
          {titulo}
        </h1>
        <div style={{ width: 64, height: 4, backgroundColor: FIGMA_COLORS.cyanLight,
          marginTop: 24, marginBottom: 20 }} />
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '14px',
            lineHeight: 1.5, color: FIGMA_COLORS.cyanLight, margin: 0, maxWidth: 380,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <OpenerPageNumber numero={numeroPagina} color={FIGMA_COLORS.cyanLight} />
    </div>
  );
}

/** Variação 1 — título vertical na lateral (spine), número médio na direita. */
function OpenerVerticalSpine({ titulo, subtitulo, numeroPagina, capituloNumero }: TemplateProps) {
  const n = String(capituloNumero ?? numeroPagina).padStart(2, '0');
  return (
    <div className="page-a4 relative overflow-hidden flex flex-row"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.tealDark }}>
      <div style={{
        width: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRight: `1px solid ${FIGMA_COLORS.tealAccent}`, flexShrink: 0,
      }}>
        <p style={{
          writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)',
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '64px',
          lineHeight: 1, color: FIGMA_COLORS.white, margin: 0,
          letterSpacing: '-0.02em',
        }}>
          {titulo}
        </p>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '80px 60px 100px 48px', boxSizing: 'border-box' as const,
      }}>
        <p style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '180px',
          lineHeight: 0.9, color: FIGMA_COLORS.cyanLight, margin: 0,
          letterSpacing: '-0.04em',
        }}>
          {n}
        </p>
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '14px',
            lineHeight: 1.5, color: FIGMA_COLORS.white, margin: 0,
            marginTop: 32, maxWidth: 280,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <OpenerPageNumber numero={numeroPagina} color={FIGMA_COLORS.cyanLight} />
    </div>
  );
}

/** Variação 2 — número fantasma (watermark) + conteúdo em camada superior. */
function OpenerGhostNumber({ titulo, subtitulo, numeroPagina, capituloNumero }: TemplateProps) {
  const n = String(capituloNumero ?? numeroPagina).padStart(2, '0');
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.tealDark }}>
      <p style={{
        position: 'absolute' as const, right: -60, bottom: -120,
        fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '560px',
        lineHeight: 0.85, color: FIGMA_COLORS.white, opacity: 0.08,
        margin: 0, letterSpacing: '-0.05em', pointerEvents: 'none' as const,
      }}>
        {n}
      </p>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '80px 60px 100px 60px', boxSizing: 'border-box' as const,
        position: 'relative' as const, zIndex: 1,
      }}>
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '64px',
          lineHeight: 1.05, color: FIGMA_COLORS.white, margin: 0,
          letterSpacing: '-0.02em', maxWidth: 420,
        }}>
          {titulo}
        </h1>
        <div style={{ width: 64, height: 4, backgroundColor: FIGMA_COLORS.cyanLight,
          marginTop: 28, marginBottom: 20 }} />
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '14px',
            lineHeight: 1.5, color: FIGMA_COLORS.cyanLight, margin: 0, maxWidth: 380,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <OpenerPageNumber numero={numeroPagina} color={FIGMA_COLORS.cyanLight} />
    </div>
  );
}

/** Variação 3 — inversão de cor: fundo claro, texto escuro, número gigante no canto. */
function OpenerInverted({ titulo, subtitulo, numeroPagina, capituloNumero }: TemplateProps) {
  const n = String(capituloNumero ?? numeroPagina).padStart(2, '0');
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.white }}>
      <div style={{
        padding: '80px 60px 0 60px', boxSizing: 'border-box' as const,
      }}>
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '56px',
          lineHeight: 1.1, color: FIGMA_COLORS.tealDark, margin: 0,
          letterSpacing: '-0.02em', maxWidth: 420,
        }}>
          {titulo}
        </h1>
        <div style={{ width: 64, height: 4, backgroundColor: FIGMA_COLORS.tealAccent,
          marginTop: 24, marginBottom: 20 }} />
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '14px',
            lineHeight: 1.5, color: FIGMA_COLORS.tealDark, margin: 0,
            maxWidth: 380, opacity: 0.7,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        padding: '0 50px 80px 60px', boxSizing: 'border-box' as const,
        overflow: 'hidden' as const,
      }}>
        <p style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '240px',
          lineHeight: 0.85, color: FIGMA_COLORS.tealDark, margin: 0,
          letterSpacing: '-0.05em',
        }}>
          {n}
        </p>
      </div>
      <OpenerPageNumber numero={numeroPagina} color={FIGMA_COLORS.tealDark} />
    </div>
  );
}

/** Variação 4 — composição centralizada, simétrica e contida. */
function OpenerCenterStack({ titulo, subtitulo, numeroPagina, capituloNumero }: TemplateProps) {
  const n = String(capituloNumero ?? numeroPagina).padStart(2, '0');
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.tealDark }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '80px 60px 100px 60px', boxSizing: 'border-box' as const,
        textAlign: 'center' as const,
      }}>
        <p style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '64px',
          lineHeight: 1, color: FIGMA_COLORS.cyanLight, margin: 0,
          letterSpacing: '-0.02em',
        }}>
          {n}
        </p>
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '56px',
          lineHeight: 1.1, color: FIGMA_COLORS.white, margin: 0,
          marginTop: 40, letterSpacing: '-0.02em', maxWidth: 440,
        }}>
          {titulo}
        </h1>
        <div style={{ width: 64, height: 4, backgroundColor: FIGMA_COLORS.cyanLight,
          marginTop: 28, marginBottom: 24 }} />
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '14px',
            lineHeight: 1.5, color: FIGMA_COLORS.cyanLight, margin: 0, maxWidth: 380,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <OpenerPageNumber numero={numeroPagina} color={FIGMA_COLORS.cyanLight} />
    </div>
  );
}

/** Variação 5 — split vertical: metade teal com número, metade branca com título. */
function OpenerSplit({ titulo, subtitulo, numeroPagina, capituloNumero }: TemplateProps) {
  const n = String(capituloNumero ?? numeroPagina).padStart(2, '0');
  return (
    <div className="page-a4 relative overflow-hidden flex flex-row"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.white }}>
      <div style={{
        flex: 0.85, backgroundColor: FIGMA_COLORS.tealDark,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px', boxSizing: 'border-box' as const,
      }}>
        <p style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '200px',
          lineHeight: 1, color: FIGMA_COLORS.white, margin: 0,
          letterSpacing: '-0.04em',
        }}>
          {n}
        </p>
      </div>
      <div style={{
        flex: 1.15, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '80px 36px 100px 36px',
        boxSizing: 'border-box' as const, overflow: 'hidden' as const,
      }}>
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '26px',
          lineHeight: 1.2, color: FIGMA_COLORS.tealDark, margin: 0,
          letterSpacing: '-0.01em',
        }}>
          {titulo}
        </h1>
        <div style={{ width: 48, height: 3, backgroundColor: FIGMA_COLORS.tealAccent,
          marginTop: 18, marginBottom: 14 }} />
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px',
            lineHeight: 1.5, color: FIGMA_COLORS.tealDark, margin: 0,
            opacity: 0.7,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <OpenerPageNumber numero={numeroPagina} color={FIGMA_COLORS.tealDark} />
    </div>
  );
}

/** Variação 6 — fundo tealAccent (brilhante), muda temperatura visual. */
function OpenerAccentBand({ titulo, subtitulo, numeroPagina, capituloNumero }: TemplateProps) {
  const n = String(capituloNumero ?? numeroPagina).padStart(2, '0');
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.tealAccent }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '80px 60px 100px 60px',
        boxSizing: 'border-box' as const,
      }}>
        <p style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '160px',
          lineHeight: 0.9, color: FIGMA_COLORS.tealDark, margin: 0,
          letterSpacing: '-0.04em',
        }}>
          {n}
        </p>
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '52px',
          lineHeight: 1.1, color: FIGMA_COLORS.white, margin: 0,
          marginTop: 28, letterSpacing: '-0.02em', maxWidth: 440,
        }}>
          {titulo}
        </h1>
        <div style={{ width: 64, height: 4, backgroundColor: FIGMA_COLORS.tealDark,
          marginTop: 24, marginBottom: 20 }} />
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '14px',
            lineHeight: 1.5, color: FIGMA_COLORS.tealDark, margin: 0,
            maxWidth: 380, opacity: 0.85,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <OpenerPageNumber numero={numeroPagina} color={FIGMA_COLORS.white} />
    </div>
  );
}

/** Variação 7 — número gigante outlined (stroke), título sobreposto. */
function OpenerOutlineNumber({ titulo, subtitulo, numeroPagina, capituloNumero }: TemplateProps) {
  const n = String(capituloNumero ?? numeroPagina).padStart(2, '0');
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.tealDark }}>
      <p style={{
        position: 'absolute' as const, left: 40, top: 80,
        fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '440px',
        lineHeight: 0.85, margin: 0, letterSpacing: '-0.05em',
        color: 'transparent', WebkitTextStroke: `3px ${FIGMA_COLORS.cyanLight}`,
        pointerEvents: 'none' as const,
      }}>
        {n}
      </p>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '80px 60px 100px 60px',
        boxSizing: 'border-box' as const, position: 'relative' as const, zIndex: 1,
      }}>
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '56px',
          lineHeight: 1.05, color: FIGMA_COLORS.white, margin: 0,
          letterSpacing: '-0.02em', maxWidth: 420,
        }}>
          {titulo}
        </h1>
        <div style={{ width: 64, height: 4, backgroundColor: FIGMA_COLORS.cyanLight,
          marginTop: 24, marginBottom: 20 }} />
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '14px',
            lineHeight: 1.5, color: FIGMA_COLORS.cyanLight, margin: 0, maxWidth: 380,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <OpenerPageNumber numero={numeroPagina} color={FIGMA_COLORS.cyanLight} />
    </div>
  );
}

/**
 * Dispatcher: escolhe 1 das 8 variações com base no número do tópico.
 * Rotaciona (0→1→…→7→0…) pra garantir que materiais com até 8 tópicos nunca repetem opener;
 * materiais mais longos repetem só depois do 8º tópico, o que é raro.
 */
export function TemplateAberturaCapitulo(props: TemplateProps) {
  const key = props.capituloNumero ?? props.numeroPagina ?? 1;
  const variationIndex = ((key - 1) % 8 + 8) % 8;
  switch (variationIndex) {
    case 1: return <OpenerVerticalSpine {...props} />;
    case 2: return <OpenerGhostNumber {...props} />;
    case 3: return <OpenerInverted {...props} />;
    case 4: return <OpenerCenterStack {...props} />;
    case 5: return <OpenerSplit {...props} />;
    case 6: return <OpenerAccentBand {...props} />;
    case 7: return <OpenerOutlineNumber {...props} />;
    default: return <OpenerTopNumber {...props} />;
  }
}

// ============================================================
// TEMPLATE: Sidebar larga + passos numerados
// Figma: "Miolo - Processo em Etapas" (A4_3_sidebar_steps legado VTSD)
// ============================================================
export function TemplateSidebarSteps({
  titulo, subtitulo, itens, paragrafos, destaques, citacao, numeroPagina, capituloNumero
}: TemplateProps) {
  const steps = itens.slice(0, 6);
  const fallbackParagraphs = paragrafos
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4);
  const fallbackHighlights = destaques
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 2);
  const fallbackQuote = citacao?.trim();
  const hasFallbackContent = fallbackParagraphs.length > 0 || fallbackHighlights.length > 0 || Boolean(fallbackQuote);
  return (
    <div className="page-a4 relative overflow-hidden flex flex-row" style={FIGMA_CSS.page}>
      {/* Sidebar larga teal */}
      <div style={FIGMA_CSS.sidebar225} className="flex flex-col">
        <h2 style={FIGMA_CSS.h2White}>{titulo}</h2>
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.bodyGray, color: FIGMA_COLORS.cyanLight, marginTop: 16 }}>
            {subtitulo}
          </p>
        )}
        <div style={{ flex: 1 }} />
        {capituloNumero !== undefined && (
          <p style={{ ...FIGMA_CSS.displayNumber, marginTop: 'auto' }}>
            {String(capituloNumero).padStart(2, '0')}
          </p>
        )}
      </div>
      {/* Coluna de etapas */}
      <div style={{
        flex: 1, padding: '50px 50px 30px 20px',
        display: 'flex', flexDirection: 'column', gap: 16,
        overflow: 'hidden', boxSizing: 'border-box',
      }}>
        {steps.length > 0
          ? steps.map((item, i) => {
              const sep = item.search(/[:\-–]/);
              const head = sep > 0 ? item.slice(0, sep).trim() : item;
              const body = sep > 0 ? item.slice(sep + 1).trim() : '';
              return (
                <div key={i} style={{
                  borderBottom: `1px solid ${FIGMA_COLORS.lightBg}`, paddingBottom: 12,
                }}>
                  <p style={{ ...FIGMA_CSS.statNumber, fontSize: 20 }}>
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 style={{ ...FIGMA_CSS.h3Dark, marginTop: 4 }}>{head}</h3>
                  {body && <p style={{ ...FIGMA_CSS.bodyGray, marginTop: 4 }}>{body}</p>}
                </div>
              );
            })
          : (
            <>
              {hasFallbackContent ? (
                <>
                  {fallbackParagraphs.map((p, i) => (
                    <p key={`fp-${i}`} style={{ ...FIGMA_CSS.bodyGray }}>
                      {p}
                    </p>
                  ))}
                  {fallbackHighlights.map((h, i) => (
                    <p key={`fh-${i}`} style={{ ...FIGMA_CSS.bodyGray, fontWeight: 600, color: FIGMA_COLORS.tealDark }}>
                      {h}
                    </p>
                  ))}
                  {fallbackQuote ? (
                    <blockquote style={FIGMA_CSS.quoteBlock}>{fallbackQuote}</blockquote>
                  ) : null}
                </>
              ) : (
                <p style={FIGMA_CSS.bodyGray}>
                  Conteúdo em preparação para esta página.
                </p>
              )}
            </>
          )}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Magazine (título + imagem/gráfico + texto + conceito-chave)
// Figma: "Miolo - Texto com Gráfico" (A4_4_magazine)
// ============================================================
export function TemplateMagazine({
  titulo, paragrafos, destaques, imagemUrl, numeroPagina
}: TemplateProps) {
  const hasImage = isRenderableImageUrl(imagemUrl);
  const callout = destaques[0] ? extractCalloutLabel(destaques[0], 'CONCEITO-CHAVE') : null;
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {/* Header */}
      <div style={{ padding: '50px 50px 20px 50px' }} className="flex-shrink-0">
        <h1 style={FIGMA_CSS.h1Teal}>{titulo}</h1>
      </div>
      {/* Body — padding inferior aumentado pra não invadir o badge (36px) */}
      <div style={{
        padding: '0 50px 56px 50px', flex: '1 1 0',
        display: 'flex', flexDirection: 'column', gap: 20,
        overflow: 'hidden', boxSizing: 'border-box',
      }}>
        {hasImage && (
          <div style={{
            width: '100%', height: 220, backgroundColor: FIGMA_COLORS.lightBg,
            borderRadius: 4, overflow: 'hidden', flexShrink: 0,
          }}>
            <img src={imagemUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        {paragrafos.map((p, i) => (
          <p key={i} style={FIGMA_CSS.bodyGray}>{p}</p>
        ))}
        {callout && callout.body && (
          <div style={{
            backgroundColor: FIGMA_COLORS.tealDark,
            padding: '16px 20px', borderRadius: 4,
          }}>
            <p style={{ ...FIGMA_CSS.labelCyan, marginBottom: 6 }}>{callout.label}</p>
            <p style={{ ...FIGMA_CSS.bodyGray, color: FIGMA_COLORS.white }}>{callout.body}</p>
          </div>
        )}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Sidebar + conteúdo rico (pullquote + steps + callout)
// Figma: "Miolo - Sidebar com Conteúdo" (A4_7_sidebar_conteudo)
// Aceita imagem opcional no topo da coluna direita.
// ============================================================
export function TemplateSidebarConteudo({
  titulo, paragrafos, destaques, citacao, itens, numeroPagina, capituloNumero, imagemUrl,
}: TemplateProps) {
  const hasImage = isRenderableImageUrl(imagemUrl);
  return (
    <div className="page-a4 relative overflow-hidden flex flex-row" style={FIGMA_CSS.page}>
      {/* Sidebar larga teal */}
      <div style={FIGMA_CSS.sidebar225} className="flex flex-col">
        <h2 style={{ ...FIGMA_CSS.h2White, marginTop: 12 }}>{titulo}</h2>
        <div style={{ flex: 1 }} />
        {capituloNumero !== undefined && (
          <p style={FIGMA_CSS.displayNumber}>
            {String(capituloNumero).padStart(2, '0')}
          </p>
        )}
      </div>
      {/* Conteúdo rico */}
      <div style={{
        flex: 1, padding: '50px 50px 30px 20px',
        display: 'flex', flexDirection: 'column', gap: 20,
        overflow: 'hidden', boxSizing: 'border-box',
      }}>
        {hasImage && (
          <div style={{
            width: '100%', height: 180, backgroundColor: FIGMA_COLORS.lightBg,
            borderRadius: 4, overflow: 'hidden', flexShrink: 0,
          }}>
            <img src={imagemUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        {paragrafos.map((p, i) => (
          <p key={i} style={FIGMA_CSS.bodyGray}>{p}</p>
        ))}
        {citacao && <blockquote style={FIGMA_CSS.quoteBlock}>{citacao}</blockquote>}
        {itens.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {itens.slice(0, 4).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <p style={{ ...FIGMA_CSS.labelTeal, minWidth: 24, margin: 0 }}>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p style={{ ...FIGMA_CSS.bodyGray, margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>
        )}
        {destaques.length > 0 && (
          <div style={{
            backgroundColor: FIGMA_COLORS.tealDark,
            padding: '12px 16px', borderRadius: 4,
          }}>
            <p style={{ ...FIGMA_CSS.bodyGray, color: FIGMA_COLORS.white, margin: 0 }}>
              {destaques[0]}
            </p>
          </div>
        )}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Processo em Etapas (cards horizontais numerados com setas)
// layout_tipo: A4_3_processo_etapas
// Lê: titulo, subtitulo, itens (steps), paragrafos (texto de apoio)
// ============================================================
export function TemplateProcessoEtapas({
  titulo, subtitulo, itens, paragrafos, numeroPagina,
}: TemplateProps) {
  const steps = itens.slice(0, 6);
  const hasSupport = paragrafos.length > 0;
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <div style={{ padding: '50px 50px 16px 50px', flexShrink: 0 }}>
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark }}>{titulo}</h1>
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.bodyGray, marginTop: 8, opacity: 0.85 }}>{subtitulo}</p>
        )}
        <div style={{ width: 60, height: 4, backgroundColor: FIGMA_COLORS.tealAccent, marginTop: 14 }} />
      </div>
      <div style={{
        flex: 1, padding: '24px 50px 56px 50px',
        display: 'flex', flexDirection: 'column', gap: 28,
        boxSizing: 'border-box' as const, overflow: 'hidden' as const,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(steps.length, 4)}, 1fr)`,
          gap: 12,
          alignItems: 'stretch',
        }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              backgroundColor: FIGMA_COLORS.tealDark,
              borderRadius: 8,
              padding: '16px 14px',
              display: 'flex', flexDirection: 'column', gap: 10,
              position: 'relative' as const,
            }}>
              <span style={{
                fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 28,
                lineHeight: 1, color: FIGMA_COLORS.cyanLight, letterSpacing: '-0.02em',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <p style={{
                fontFamily: "'Inter', sans-serif", fontSize: 12, lineHeight: 1.4,
                color: '#FFFFFF', margin: 0,
              }}>
                {step}
              </p>
              {i < steps.length - 1 && (i + 1) % 4 !== 0 && (
                <span aria-hidden style={{
                  position: 'absolute' as const,
                  right: -12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 18, color: FIGMA_COLORS.tealAccent, fontWeight: 700,
                }}>
                  →
                </span>
              )}
            </div>
          ))}
        </div>
        {hasSupport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paragrafos.slice(0, 3).map((p, i) => (
              <p key={i} style={{ ...FIGMA_CSS.bodyGray }}>{p}</p>
            ))}
          </div>
        )}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Prós / Contras (2 colunas: verde × vermelho)
// layout_tipo: A4_4_pros_contras
// Lê: titulo, sugestaoTabela (2 cols) OU itens (split na metade)
// ============================================================
export function TemplateProsContras({
  titulo, subtitulo, sugestaoTabela, itens, numeroPagina,
}: TemplateProps) {
  // Se vier sugestaoTabela com 2 colunas, usa labels + linhas[][0] e [1]
  let labelLeft = 'Prós';
  let labelRight = 'Contras';
  let leftItems: string[] = [];
  let rightItems: string[] = [];

  if (sugestaoTabela?.colunas && sugestaoTabela.colunas.length >= 2 && Array.isArray(sugestaoTabela.linhas)) {
    labelLeft = String(sugestaoTabela.colunas[0] ?? labelLeft);
    labelRight = String(sugestaoTabela.colunas[1] ?? labelRight);
    leftItems = sugestaoTabela.linhas.map((row) => String(row?.[0] ?? '')).filter(Boolean);
    rightItems = sugestaoTabela.linhas.map((row) => String(row?.[1] ?? '')).filter(Boolean);
  } else {
    const half = Math.ceil(itens.length / 2);
    leftItems = itens.slice(0, half);
    rightItems = itens.slice(half);
  }

  const renderColumn = (label: string, items: string[], color: string, icon: string) => (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 12,
      backgroundColor: '#FFFFFF',
      border: `2px solid ${color}`,
      borderRadius: 8, padding: '18px 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingBottom: 10, borderBottom: `1px solid ${color}33`,
      }}>
        <span style={{ fontSize: 18, color, fontWeight: 700 }}>{icon}</span>
        <h3 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16,
          color, margin: 0, textTransform: 'uppercase' as const, letterSpacing: '1px',
        }}>
          {label}
        </h3>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.slice(0, 6).map((item, i) => (
          <li key={i} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            fontFamily: "'Inter', sans-serif", fontSize: 12, lineHeight: 1.5,
            color: FIGMA_COLORS.darkText,
          }}>
            <span style={{ color, marginTop: 2 }}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <div style={{ padding: '50px 50px 16px 50px', flexShrink: 0 }}>
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark }}>{titulo}</h1>
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.bodyGray, marginTop: 8, opacity: 0.85 }}>{subtitulo}</p>
        )}
      </div>
      <div style={{
        flex: 1, padding: '20px 50px 56px 50px',
        display: 'flex', gap: 16, alignItems: 'stretch',
        boxSizing: 'border-box' as const, overflow: 'hidden' as const,
      }}>
        {renderColumn(labelLeft, leftItems, '#16a34a', '✓')}
        {renderColumn(labelRight, rightItems, '#dc2626', '✗')}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Comparativo (Antes/Depois ou A vs B — split duas colunas)
// layout_tipo: A4_4_comparativo
// Lê: titulo, sugestaoTabela (2 cols) OU itens[0]/itens[1] OU paragrafos[0]/paragrafos[1]
// ============================================================
export function TemplateComparativo({
  titulo, subtitulo, sugestaoTabela, itens, paragrafos, numeroPagina,
}: TemplateProps) {
  let labelLeft = 'Antes';
  let labelRight = 'Depois';
  let textLeft = '';
  let textRight = '';

  if (sugestaoTabela?.colunas && sugestaoTabela.colunas.length >= 2) {
    labelLeft = String(sugestaoTabela.colunas[0] ?? labelLeft);
    labelRight = String(sugestaoTabela.colunas[1] ?? labelRight);
    if (Array.isArray(sugestaoTabela.linhas) && sugestaoTabela.linhas.length > 0) {
      textLeft = sugestaoTabela.linhas.map((r) => String(r?.[0] ?? '')).filter(Boolean).join('\n\n');
      textRight = sugestaoTabela.linhas.map((r) => String(r?.[1] ?? '')).filter(Boolean).join('\n\n');
    }
  }

  if (!textLeft && itens[0]) textLeft = itens[0];
  if (!textRight && itens[1]) textRight = itens[1];
  if (!textLeft && paragrafos[0]) textLeft = paragrafos[0];
  if (!textRight && paragrafos[1]) textRight = paragrafos[1];

  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <div style={{ padding: '50px 50px 16px 50px', flexShrink: 0 }}>
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark }}>{titulo}</h1>
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.bodyGray, marginTop: 8, opacity: 0.85 }}>{subtitulo}</p>
        )}
      </div>
      <div style={{
        flex: 1, padding: '24px 50px 56px 50px',
        display: 'flex', gap: 0, alignItems: 'stretch',
        boxSizing: 'border-box' as const, overflow: 'hidden' as const,
      }}>
        <div style={{
          flex: 1, padding: '24px 20px',
          backgroundColor: FIGMA_COLORS.lightBg,
          borderRadius: '8px 0 0 8px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11,
            letterSpacing: '2px', textTransform: 'uppercase' as const,
            color: FIGMA_COLORS.grayText, margin: 0,
          }}>
            {labelLeft}
          </p>
          <p style={{ ...FIGMA_CSS.bodyGray, margin: 0 }}>{textLeft || 'Situação atual'}</p>
        </div>
        <div style={{
          flex: 1, padding: '24px 20px',
          backgroundColor: FIGMA_COLORS.tealDark,
          borderRadius: '0 8px 8px 0',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11,
            letterSpacing: '2px', textTransform: 'uppercase' as const,
            color: FIGMA_COLORS.cyanLight, margin: 0,
          }}>
            {labelRight}
          </p>
          <p style={{
            fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.6,
            color: '#FFFFFF', margin: 0,
          }}>
            {textRight || 'Resultado proposto'}
          </p>
        </div>
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Tabela de Critérios / Matriz
// layout_tipo: A4_5_tabela
// Lê: titulo, sugestaoTabela (colunas + linhas)
// ============================================================
export function TemplateTabelaCriterios({
  titulo, subtitulo, sugestaoTabela, numeroPagina,
}: TemplateProps) {
  const colunas = Array.isArray(sugestaoTabela?.colunas) ? sugestaoTabela!.colunas : [];
  const linhas = Array.isArray(sugestaoTabela?.linhas) ? sugestaoTabela!.linhas : [];
  const tableTitle = sugestaoTabela?.titulo;

  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <div style={{ padding: '50px 50px 16px 50px', flexShrink: 0 }}>
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark }}>{titulo}</h1>
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.bodyGray, marginTop: 8, opacity: 0.85 }}>{subtitulo}</p>
        )}
      </div>
      <div style={{
        flex: 1, padding: '20px 50px 56px 50px',
        boxSizing: 'border-box' as const, overflow: 'hidden' as const,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {tableTitle && (
          <p style={{ ...FIGMA_CSS.labelTeal, margin: 0 }}>{tableTitle}</p>
        )}
        <table style={{
          width: '100%', borderCollapse: 'collapse' as const,
          fontFamily: "'Inter', sans-serif", fontSize: 12,
          borderRadius: 6, overflow: 'hidden' as const,
        }}>
          <thead>
            <tr style={{ backgroundColor: FIGMA_COLORS.tealDark }}>
              {colunas.map((col, i) => (
                <th key={i} style={{
                  padding: '12px 14px', textAlign: 'left' as const,
                  color: '#FFFFFF', fontFamily: "'Sora', sans-serif",
                  fontWeight: 700, fontSize: 12, letterSpacing: '0.5px',
                  textTransform: 'uppercase' as const,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, 8).map((row, ri) => (
              <tr key={ri} style={{
                backgroundColor: ri % 2 === 0 ? '#FFFFFF' : (FIGMA_COLORS.lightBg),
              }}>
                {row.slice(0, colunas.length).map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '12px 14px',
                    color: FIGMA_COLORS.darkText,
                    lineHeight: 1.4,
                    borderBottom: `1px solid ${FIGMA_COLORS.lightBg}`,
                    verticalAlign: 'top' as const,
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Imagem em destaque (full-width topo + título + body)
// layout_tipo: A4_4_imagem_destaque
// Imagem grande no topo (banner ~280px), título e texto embaixo
// ============================================================
export function TemplateImagemDestaque({
  titulo, subtitulo, paragrafos, citacao, imagemUrl, numeroPagina,
}: TemplateProps) {
  const hasImage = isRenderableImageUrl(imagemUrl);
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {/* Imagem banner full-width topo */}
      {hasImage ? (
        <div style={{
          width: '100%', height: 280, flexShrink: 0,
          backgroundColor: FIGMA_COLORS.lightBg, overflow: 'hidden' as const,
        }}>
          <img src={imagemUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <div style={{ width: '100%', height: 6, backgroundColor: FIGMA_COLORS.tealAccent, flexShrink: 0 }} />
      )}
      {/* Header + body */}
      <div style={{
        flex: 1, padding: '32px 50px 56px 50px',
        display: 'flex', flexDirection: 'column', gap: 16,
        boxSizing: 'border-box' as const, overflow: 'hidden' as const,
      }}>
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark, margin: 0 }}>{titulo}</h1>
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.bodyGray, opacity: 0.8, margin: 0 }}>{subtitulo}</p>
        )}
        <div style={{ width: 56, height: 3, backgroundColor: FIGMA_COLORS.tealAccent, marginTop: 4, marginBottom: 4 }} />
        {paragrafos.map((p, i) => (
          <p key={i} style={{ ...FIGMA_CSS.bodyGray, margin: 0 }}>{p}</p>
        ))}
        {citacao && (
          <blockquote style={{ ...FIGMA_CSS.quoteBlock, marginTop: 8 }}>{citacao}</blockquote>
        )}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Imagem com overlay editorial (full-page background)
// layout_tipo: A4_2_imagem_overlay
// Imagem cobre toda a página, overlay escuro semi-transparente,
// título grande + body curto em branco sobreposto. Visual dramático.
// ============================================================
export function TemplateImagemOverlay({
  titulo, subtitulo, paragrafos, citacao, imagemUrl, numeroPagina,
}: TemplateProps) {
  const hasImage = isRenderableImageUrl(imagemUrl);
  // Limita o body — esse layout é editorial, com pouca palavra
  const bodyParas = paragrafos.slice(0, 2);
  return (
    <div
      className="page-a4 relative overflow-hidden flex flex-col"
      style={{ ...FIGMA_CSS.page, backgroundColor: FIGMA_COLORS.tealDark }}
    >
      {/* Imagem de fundo */}
      {hasImage && (
        <img
          src={imagemUrl}
          alt=""
          style={{
            position: 'absolute' as const, inset: 0,
            width: '100%', height: '100%', objectFit: 'cover' as const,
            zIndex: 0,
          }}
        />
      )}
      {/* Overlay escuro pra legibilidade do texto */}
      <div
        style={{
          position: 'absolute' as const, inset: 0,
          background: 'linear-gradient(180deg, rgba(2,84,104,0.55) 0%, rgba(2,84,104,0.85) 100%)',
          zIndex: 1,
        }}
        aria-hidden
      />
      {/* Texto sobreposto, alinhado ao rodapé */}
      <div
        style={{
          position: 'relative' as const, zIndex: 2,
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '60px 50px 80px 50px', boxSizing: 'border-box' as const,
          gap: 16,
        }}
      >
        {subtitulo && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11,
            letterSpacing: '3px', textTransform: 'uppercase' as const,
            color: FIGMA_COLORS.cyanLight, margin: 0,
          }}>
            {subtitulo}
          </p>
        )}
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 44,
          lineHeight: 1.1, color: '#FFFFFF', margin: 0,
          letterSpacing: '-0.02em', maxWidth: 460,
        }}>
          {titulo}
        </h1>
        <div style={{ width: 56, height: 3, backgroundColor: FIGMA_COLORS.cyanLight }} />
        {bodyParas.map((p, i) => (
          <p key={i} style={{
            fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.55,
            color: 'rgba(255,255,255,0.95)', margin: 0, maxWidth: 480,
          }}>{p}</p>
        ))}
        {citacao && (
          <p style={{
            fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.55,
            fontStyle: 'italic' as const, color: FIGMA_COLORS.cyanLight, margin: 0, maxWidth: 480,
          }}>
            "{citacao}"
          </p>
        )}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Imagem flutuante com texto reflowing (CSS float)
// layout_tipo: A4_2_imagem_flutuante
// Imagem com float left/right, texto envolve naturalmente.
// Tamanho controlado por imageWidthPct (% da coluna), default 50%.
// ============================================================
export function TemplateImagemFlutuante({
  titulo, subtitulo, paragrafos, citacao, imagemUrl,
  imageWidthPct = 50, floatSide = 'right', numeroPagina,
}: TemplateProps) {
  const hasImage = isRenderableImageUrl(imagemUrl);
  // Limites razoáveis: 25% mínimo (legibilidade), 75% máximo (texto não some)
  const widthPct = Math.min(75, Math.max(25, imageWidthPct));
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {/* Header */}
      <div style={{ padding: '50px 50px 16px 50px', flexShrink: 0 }}>
        <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark, margin: 0 }}>{titulo}</h1>
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.bodyGray, marginTop: 8, opacity: 0.85 }}>{subtitulo}</p>
        )}
        <div style={{ width: 56, height: 3, backgroundColor: FIGMA_COLORS.tealAccent, marginTop: 12 }} />
      </div>
      {/* Body com float */}
      <div
        data-image-flutuante-body
        data-image-width-pct={widthPct}
        data-image-float-side={floatSide}
        style={{
          flex: 1,
          padding: '24px 50px 56px 50px',
          boxSizing: 'border-box' as const,
          overflow: 'hidden' as const,
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          lineHeight: 1.7,
          color: FIGMA_COLORS.darkText,
          textAlign: 'justify' as const,
          // hyphens helps wrap nicely around the float
          hyphens: 'auto' as const,
        }}
      >
        {hasImage && (
          <div
            data-image-flutuante-target
            style={{
              float: floatSide,
              width: `${widthPct}%`,
              [floatSide === 'left' ? 'marginRight' : 'marginLeft']: 16,
              marginBottom: 12,
              marginTop: 4,
              shapeOutside: 'margin-box',
              overflow: 'hidden' as const,
              borderRadius: 4,
              backgroundColor: FIGMA_COLORS.lightBg,
              position: 'relative' as const,
            }}
          >
            <img
              src={imagemUrl}
              alt=""
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                objectFit: 'cover' as const,
              }}
            />
          </div>
        )}
        {/* Texto que envolve a imagem */}
        {paragrafos.map((p, i) => (
          <p key={i} style={{ margin: '0 0 10px 0' }}>{p}</p>
        ))}
        {citacao && (
          <blockquote style={{
            ...FIGMA_CSS.quoteBlock,
            marginTop: 12,
            clear: 'both' as const,
          }}>
            {citacao}
          </blockquote>
        )}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Imagem Livre — usuário desenha o retângulo onde a imagem entra
// layout_tipo: A4_imagem_livre
// Posição/tamanho vêm de imagemBox (em % da página A4).
// ============================================================
export function TemplateImagemLivre({
  titulo, subtitulo, paragrafos, citacao, imagemUrl, imagemBox, numeroPagina,
}: TemplateProps) {
  const hasImage = isRenderableImageUrl(imagemUrl);
  const box = imagemBox || { xPct: 60, yPct: 20, wPct: 35, hPct: 35 };
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <div style={{ padding: '50px 50px 16px 50px', flexShrink: 0 }}>
        {titulo && (
          <h1 style={{ ...FIGMA_CSS.h1Teal, color: FIGMA_COLORS.tealDark, margin: 0 }}>{titulo}</h1>
        )}
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.bodyGray, marginTop: 8, opacity: 0.85 }}>{subtitulo}</p>
        )}
        {(titulo || subtitulo) && (
          <div style={{ width: 56, height: 3, backgroundColor: FIGMA_COLORS.tealAccent, marginTop: 12 }} />
        )}
      </div>
      <div
        style={{
          flex: 1,
          padding: '24px 50px 56px 50px',
          boxSizing: 'border-box' as const,
          overflow: 'hidden' as const,
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          lineHeight: 1.7,
          color: FIGMA_COLORS.darkText,
          textAlign: 'justify' as const,
          position: 'relative' as const,
        }}
      >
        {paragrafos.map((p, i) => (
          <p key={i} style={{ margin: '0 0 10px 0' }}>{p}</p>
        ))}
        {citacao && (
          <blockquote style={{ ...FIGMA_CSS.quoteBlock, marginTop: 12 }}>{citacao}</blockquote>
        )}
      </div>
      {/* Imagem (ou placeholder) posicionada absolutamente sobre a página inteira */}
      <div
        style={{
          position: 'absolute',
          left: `${box.xPct}%`,
          top: `${box.yPct}%`,
          width: `${box.wPct}%`,
          height: `${box.hPct}%`,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: FIGMA_COLORS.lightBg,
          border: hasImage ? 'none' : `2px dashed ${FIGMA_COLORS.tealAccent}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasImage ? (
          <img
            src={imagemUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600, color: FIGMA_COLORS.tealDark, opacity: 0.7 }}>
            Imagem
          </span>
        )}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// TEMPLATE: Continuação (barra teal topo + corpo + barra teal rodapé)
// Figma spec (sem frame): A4_2_continuacao — pipeline-only do paginador
// ============================================================
export function TemplateContinuacao({
  paragrafos, citacao, numeroPagina
}: TemplateProps) {
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <TealBar />
      <div style={{
        padding: '30px 50px 50px 50px', flex: '1 1 0',
        display: 'flex', flexDirection: 'column', gap: 20,
        overflow: 'hidden', boxSizing: 'border-box',
      }}>
        {paragrafos.map((p, i) => (
          <p key={i} style={FIGMA_CSS.bodyGray}>{p}</p>
        ))}
        {citacao && <blockquote style={FIGMA_CSS.quoteBlock}>{citacao}</blockquote>}
      </div>
      <TealBar />
      <Badge numero={numeroPagina} />
    </div>
  );
}

// ============================================================
// FALLBACK B1: layout sem renderer implementado (dev-warn + badge em dev,
// inerte em produção — nunca aproxima silenciosamente).
// ============================================================
export function LayoutNotImplementedBadge({ layoutTipo }: { layoutTipo: string }) {
  if (typeof process === 'undefined' || process.env.NODE_ENV !== 'development') return null;
  return (
    <div
      style={{
        position: 'absolute', top: 8, right: 8, zIndex: 9999,
        background: '#dc2626', color: '#ffffff',
        padding: '4px 8px', borderRadius: 4,
        fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      LAYOUT_NOT_IMPLEMENTED: {layoutTipo}
    </div>
  );
}

export function TemplateInertFallback(
  props: TemplateProps & { layoutTipo: string }
) {
  const { titulo, paragrafos, citacao, numeroPagina, layoutTipo } = props;
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      <LayoutNotImplementedBadge layoutTipo={layoutTipo} />
      <div style={{
        padding: '50px', flex: '1 1 0',
        display: 'flex', flexDirection: 'column', gap: 16,
        overflow: 'hidden', boxSizing: 'border-box',
      }}>
        {titulo && <h1 style={FIGMA_CSS.h1Teal}>{titulo}</h1>}
        {paragrafos.map((p, i) => (
          <p key={i} style={FIGMA_CSS.bodyGray}>{p}</p>
        ))}
        {citacao && <blockquote style={FIGMA_CSS.quoteBlock}>{citacao}</blockquote>}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
}

// Warn-once por layoutTipo em dev. Persistido em globalThis para sobreviver a
// HMR/Next.js StrictMode (que remontam módulos em dev e resetariam um Set
// module-level). Em produção o warn nem dispara.
const WARNED_KEY = '__figmaTemplateRendererWarnedLayouts__';
function warnLayoutNotImplemented(layoutTipo: string) {
  if (typeof process === 'undefined' || process.env.NODE_ENV !== 'development') return;
  const g = globalThis as unknown as Record<string, Set<string> | undefined>;
  let warned = g[WARNED_KEY];
  if (!warned) {
    warned = new Set<string>();
    g[WARNED_KEY] = warned;
  }
  if (warned.has(layoutTipo)) return;
  warned.add(layoutTipo);

  console.warn(
    `[FigmaTemplateRenderer] LAYOUT_NOT_IMPLEMENTED: "${layoutTipo}" — ` +
    `renderer fiel ao Figma não encontrado. Caindo em TemplateInertFallback. ` +
    `Adicione um case em renderFigmaTemplate ou documente em figma-source-of-truth.json.`
  );
}

/**
 * Mapa de layout_tipo → componente renderizador fiel ao Figma.
 *
 * Política de fidelidade (ver PR "Figma fiel no app"):
 * - Cada case usa tokens de FIGMA_CSS/FIGMA_COLORS (de figma-design-tokens.ts)
 *   e segue o spec em docs/figma-source-of-truth.json.
 * - Layouts sem case explícito caem em TemplateInertFallback com
 *   LayoutNotImplementedBadge em dev (warn-once no console). Nunca é feita
 *   aproximação silenciosa para outro layout.
 *
 * Cobertura atual (14 layouts): 8 originais + 5 novos do VTSD_ALTERNATION_POOL
 * + 1 infra (A4_2_continuacao). Layouts fora deste conjunto exibem B1.
 */
export function renderFigmaTemplate(
  layoutTipo: string,
  props: TemplateProps
): React.ReactNode {
  switch (layoutTipo) {
    // --- Originais (já cobertos antes deste PR) ---
    case 'A4_2_texto_corrido':
      return <TemplateTextoCorrido {...props} />;
    case 'A4_2_texto_citacao':
      return <TemplateTealHeaderBody {...props} />;
    case 'A4_2_texto_sidebar':
      return <TemplateSidebarFina {...props} />;
    case 'A4_2_imagem_texto':
    case 'A4_2_texto_imagem':
      return <TemplateImagemTexto {...props} />;
    case 'A4_4_destaque_numerico':
      return <TemplateDestaqueNumerico {...props} />;
    case 'A4_8_citacao_destaque':
      return <TemplateCitacaoDestaque {...props} />;
    case 'A4_8_frase_impacto':
      return <TemplateFraseImpacto {...props} />;

    // --- Novos (VTSD_ALTERNATION_POOL + infra) ---
    case 'A4_1_abertura':
      return <TemplateAberturaCapitulo {...props} />;
    case 'A4_2_conteudo_misto':
      return <TemplateDicaExercicio {...props} />;
    case 'A4_3_sidebar_steps':
      return <TemplateSidebarSteps {...props} />;
    case 'A4_4_magazine':
      return <TemplateMagazine {...props} />;
    case 'A4_7_sidebar_conteudo':
      return <TemplateSidebarConteudo {...props} />;

    // --- Visuais didáticos novos (turno 2) ---
    case 'A4_3_processo_etapas':
      return <TemplateProcessoEtapas {...props} />;
    case 'A4_4_pros_contras':
      return <TemplateProsContras {...props} />;
    case 'A4_4_comparativo':
      return <TemplateComparativo {...props} />;
    case 'A4_5_tabela':
      return <TemplateTabelaCriterios {...props} />;

    // --- Layouts com imagem (variantes além do magazine) ---
    case 'A4_4_imagem_destaque':
      return <TemplateImagemDestaque {...props} />;
    case 'A4_2_imagem_overlay':
      return <TemplateImagemOverlay {...props} />;
    case 'A4_2_imagem_flutuante':
      return <TemplateImagemFlutuante {...props} />;
    case 'A4_imagem_livre':
      return <TemplateImagemLivre {...props} />;

    case 'A4_2_continuacao':
      return <TemplateContinuacao {...props} />;

    // --- Sem renderer: B1 (warn em dev + badge visual, inerte em prod) ---
    default:
      warnLayoutNotImplemented(layoutTipo);
      return <TemplateInertFallback {...props} layoutTipo={layoutTipo} />;
  }
}
