import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? '',
});

export type DalleSize = '1024x1024' | '1792x1024' | '1024x1792';
export type DalleQuality = 'standard' | 'hd';

/**
 * Gera uma imagem com DALL-E 3 a partir de um prompt (ex.: IMAGE_PROMPT do material).
 * @param prompt - Descrição em inglês (Corporate Photography ou Abstract 3D Renders)
 * @param options - size, quality, style
 * @returns URL da imagem gerada (temporária) ou null em caso de erro
 */
export async function generateImageDalle3(
  prompt: string,
  options?: {
    size?: DalleSize;
    quality?: DalleQuality;
    style?: 'vivid' | 'natural';
  }
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY não definida. Configure em .env.local');
    return null;
  }

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: options?.size ?? '1792x1024',
      quality: options?.quality ?? 'standard',
      style: options?.style ?? 'vivid',
      response_format: 'url',
    });

    const url = response.data?.[0]?.url ?? null;
    return url;
  } catch (err) {
    console.error('Erro ao gerar imagem com DALL-E 3:', err);
    return null;
  }
}

/**
 * Gera imagem e retorna em base64 (útil para salvar ou embed no PDF).
 * Requer response_format: 'b64_json'.
 */
export async function generateImageDalle3Base64(
  prompt: string,
  options?: {
    size?: DalleSize;
    quality?: DalleQuality;
    style?: 'vivid' | 'natural';
  }
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: options?.size ?? '1792x1024',
      quality: options?.quality ?? 'standard',
      style: options?.style ?? 'vivid',
      response_format: 'b64_json',
    });

    const b64 = response.data?.[0]?.b64_json ?? null;
    return b64 ? `data:image/png;base64,${b64}` : null;
  } catch (err) {
    console.error('Erro ao gerar imagem com DALL-E 3:', err);
    return null;
  }
}
