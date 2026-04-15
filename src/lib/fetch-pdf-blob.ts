import type { PreviewData } from '@/components/MaterialPreviewBlocks';
import { PREVIEW_STORAGE_KEY } from '@/lib/preview-storage';

/** Abaixo disso enviamos o JSON inline no POST /api/pdf; acima usamos sessão no servidor (imagens base64). */
const PDF_INLINE_JSON_MAX_CHARS = 3_200_000;

/**
 * Gera o PDF no servidor e devolve o Blob (para download ou object URL).
 */
export async function fetchPdfBlobFromPreviewData(previewUrl: string, data: PreviewData): Promise<Blob> {
  const json = JSON.stringify(data);

  let res: Response;
  if (json.length > PDF_INLINE_JSON_MAX_CHARS) {
    const sessionRes = await fetch('/api/pdf-preview-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: json }),
    });
    if (!sessionRes.ok) {
      const err = await sessionRes.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Erro ao preparar sessão para o PDF.');
    }
    const { id } = (await sessionRes.json()) as { id: string };
    res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: previewUrl, previewSessionId: id }),
    });
  } else {
    res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: previewUrl,
        data: {
          [PREVIEW_STORAGE_KEY]: json,
          'rtg-pdf-mode': '1',
        },
      }),
    });
  }

  if (!res.ok) {
    let errMsg = 'Erro ao gerar PDF.';
    try {
      const errBody = await res.text();
      if (errBody.startsWith('{')) {
        const parsed = JSON.parse(errBody) as { error?: string };
        errMsg = parsed.error || errMsg;
      } else {
        errMsg = `Erro ${res.status}: ${errBody.slice(0, 200)}`;
      }
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }

  return res.blob();
}
