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

interface TemplateProps {
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
  const dica = destaques[0] || '';
  const exercicio = destaques[1] || itens[0] || '';
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {/* Dica do Autor */}
      <div style={FIGMA_CSS.footerTeal} className="flex-shrink-0">
        <p style={FIGMA_CSS.labelCyan}>✦ Dica do Autor</p>
        <p style={{ ...FIGMA_CSS.bodyGray, color: '#ffffff', marginTop: 8 }}>{dica || titulo}</p>
      </div>
      {/* Body */}
      <div style={{ ...FIGMA_CSS.bodyBlock, gap: '12px' }} className="flex flex-col overflow-hidden">
        {paragrafos.map((p, i) => (
          <p key={i} style={{ ...FIGMA_CSS.bodyGray, marginBottom: 12 }}>{p}</p>
        ))}
        {citacao && <blockquote style={FIGMA_CSS.quoteBlock}>{citacao}</blockquote>}
      </div>
      {/* Exercício */}
      <div style={FIGMA_CSS.footerTeal} className="flex-shrink-0">
        <p style={FIGMA_CSS.labelCyan}>Exercício Prático</p>
        <p style={{ ...FIGMA_CSS.bodyGray, color: '#ffffff', marginTop: 8 }}>{exercicio || 'Aplique o conceito acima na prática.'}</p>
      </div>
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
        {capituloNumero && (
          <p style={FIGMA_CSS.labelTeal}>Capítulo {capituloNumero}</p>
        )}
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
// TEMPLATE: Abertura de Capítulo (header teal + imagem + texto intro)
// Figma: "Início de Capítulo" (A4_1_abertura)
// ============================================================
export function TemplateAberturaCapitulo({
  titulo, subtitulo, paragrafos, imagemUrl, numeroPagina, capituloNumero
}: TemplateProps) {
  const hasImage = isRenderableImageUrl(imagemUrl);
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {/* Header teal */}
      <div style={FIGMA_CSS.headerTeal} className="flex-shrink-0">
        {capituloNumero !== undefined && (
          <p style={{ ...FIGMA_CSS.labelCyan, margin: 0, marginBottom: 8 }}>Capítulo {capituloNumero}</p>
        )}
        <h1 style={FIGMA_CSS.h1White}>{titulo}</h1>
        {subtitulo && (
          <p style={{ ...FIGMA_CSS.labelCyan, marginTop: 12 }}>{subtitulo}</p>
        )}
      </div>
      {/* Body */}
      <div style={FIGMA_CSS.bodyBlock} className="flex flex-col overflow-hidden">
        {hasImage && (
          <div style={{
            width: '100%', height: 260, backgroundColor: FIGMA_COLORS.lightBg,
            borderRadius: 4, overflow: 'hidden', marginBottom: 20, flexShrink: 0,
          }}>
            <img src={imagemUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        {paragrafos.map((p, i) => (
          <p key={i} style={{ ...FIGMA_CSS.bodyGray, marginBottom: 12 }}>{p}</p>
        ))}
      </div>
      <Badge numero={numeroPagina} />
    </div>
  );
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
        {capituloNumero !== undefined && (
          <p style={{ ...FIGMA_CSS.labelCyan, margin: 0, marginBottom: 12 }}>
            Capítulo {capituloNumero}
          </p>
        )}
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
  const conceitoChave = destaques[0];
  return (
    <div className="page-a4 relative overflow-hidden flex flex-col" style={FIGMA_CSS.page}>
      {/* Header */}
      <div style={{ padding: '50px 50px 20px 50px' }} className="flex-shrink-0">
        <h1 style={FIGMA_CSS.h1Teal}>{titulo}</h1>
      </div>
      {/* Body */}
      <div style={{
        padding: '0 50px 20px 50px', flex: '1 1 0',
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
        {conceitoChave && (
          <div style={{
            backgroundColor: FIGMA_COLORS.tealDark,
            padding: '16px 20px', borderRadius: 4, marginTop: 'auto',
          }}>
            <p style={{ ...FIGMA_CSS.labelCyan, marginBottom: 6 }}>CONCEITO-CHAVE</p>
            <p style={{ ...FIGMA_CSS.bodyGray, color: FIGMA_COLORS.white }}>{conceitoChave}</p>
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
// ============================================================
export function TemplateSidebarConteudo({
  titulo, paragrafos, destaques, citacao, itens, numeroPagina, capituloNumero
}: TemplateProps) {
  return (
    <div className="page-a4 relative overflow-hidden flex flex-row" style={FIGMA_CSS.page}>
      {/* Sidebar larga teal */}
      <div style={FIGMA_CSS.sidebar225} className="flex flex-col">
        {capituloNumero !== undefined && (
          <p style={{ ...FIGMA_CSS.labelCyan, margin: 0 }}>Capítulo {capituloNumero}</p>
        )}
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
    case 'A4_2_continuacao':
      return <TemplateContinuacao {...props} />;

    // --- Sem renderer: B1 (warn em dev + badge visual, inerte em prod) ---
    default:
      warnLayoutNotImplemented(layoutTipo);
      return <TemplateInertFallback {...props} layoutTipo={layoutTipo} />;
  }
}
