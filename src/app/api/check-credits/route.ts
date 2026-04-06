import { NextResponse } from 'next/server';
import { ensureOpenRouterKey } from '@/lib/ensure-env';
import { verifyOpenRouterApiKeyForCompletions } from '@/lib/openrouter';

/**
 * GET /api/check-credits
 * Usa GET /api/v1/key (OpenRouter) para validar a chave sem gastar tokens em chat.
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

  const verified = await verifyOpenRouterApiKeyForCompletions(apiKey);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.message }, { status: 200 });
  }

  const extra =
    verified.limitRemaining != null
      ? ` Limite restante (USD): ~${verified.limitRemaining}.`
      : '';
  return NextResponse.json({
    ok: true,
    message: `Chave aceita pelo OpenRouter.${extra} Você pode usar a Geração Inteligente.`,
    label: verified.label,
    limitRemaining: verified.limitRemaining,
  });
}
