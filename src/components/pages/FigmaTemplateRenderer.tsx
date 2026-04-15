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
      {/* Imagem */}
      <div style={{ width: '100%', height: 420, backgroundColor: FIGMA_COLORS.lightBg, flexShrink: 0, overflow: 'hidden' }}>
        {hasImage && <img src={imagemUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      {/* Legenda */}
      <div style={{ ...FIGMA_CSS.footerTeal, padding: '10px 50px' }} className="flex-shrink-0">
        <p style={{ ...FIGMA_CSS.labelCyan, fontSize: 11 }}>Legenda da imagem ilustrativa</p>
      </div>
      {/* Corpo */}
      <div style={FIGMA_CSS.bodyBlock} className="flex flex-col overflow-hidden">
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

/**
 * Mapa de layout_tipo → componente renderizador do Figma.
 * Retorna null se o layout não tem renderizador específico (cai no PageConteudo existente).
 */
export function renderFigmaTemplate(
  layoutTipo: string,
  props: TemplateProps
): React.ReactNode | null {
  switch (layoutTipo) {
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
    default:
      return null; // Cai no PageConteudo existente
  }
}
