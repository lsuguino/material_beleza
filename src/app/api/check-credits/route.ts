import { NextResponse } from 'next/server';
import { getFriendlyErrorMessage } from '@/lib/anthropic-error';
import { ensureOpenRouterKey } from '@/lib/ensure-env';
import { openRouterChatByTask } from '@/lib/openrouter';

/**
 * GET /api/check-credits
 * Faz uma chamada mínima ao OpenRouter para verificar se a chave está válida e há créditos.
 */
export async function GET() {
  const apiKey = await ensureOpenRouterKey();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'OPENROUTER_API_KEY não está configurada no .env.local' },
      { status: 200 }
    );
  }

  process.env.OPENROUTER_API_KEY = apiKey;

  try {
    await openRouterChatByTask('text_material', {
      user: 'Responda só: OK',
      max_tokens: 10,
    });
    return NextResponse.json({
      ok: true,
      message: 'Chave válida e créditos disponíveis. Você pode usar a Geração Inteligente.',
    });
  } catch (err) {
    const message = getFriendlyErrorMessage(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 200 }
    );
  }
}
