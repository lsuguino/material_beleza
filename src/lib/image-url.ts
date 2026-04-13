/** URL de imagem gerada ou hospedada (preview aceita data:image/* ou http(s)). */
export function isRenderableImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const t = url.trim();
  return (
    t.startsWith('data:image/') ||
    t.startsWith('http://') ||
    t.startsWith('https://')
  );
}
