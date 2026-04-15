/**
 * Mensagens amigáveis para erros da API Anthropic (Claude).
 */

/** Extrai mensagem de um objeto de erro estruturado. */
function getMessageFromBody(obj: unknown): string | null {
  if (obj && typeof obj === 'object') {
    const body = obj as Record<string, unknown>;
    const err = body.error as { message?: string } | undefined;
    const msg = err?.message ?? (body.message as string | undefined);
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return null;
}

/**
 * Tenta extrair a mensagem de erro de uma string JSON.
 * O SDK da Anthropic usa o formato: "STATUS_CODE {...json...}"
 */
function tryParseJsonMessage(str: string): string | null {
  const trimmed = str.trim();
  // Remove prefixo de status code: "401 {..." → "{..."
  const jsonPart = trimmed.replace(/^\d{3}\s+/, '');
  if (jsonPart.startsWith('{')) {
    try {
      const obj = JSON.parse(jsonPart) as {
        error?: { message?: string };
        message?: string;
      };
      return obj?.error?.message ?? obj?.message ?? null;
    } catch {
      // ignore
    }
  }
  return null;
}

function toFriendlyMessage(msg: string): string {
  const lower = msg.toLowerCase();

  if (
    lower.includes('credit balance') ||
    lower.includes('too low') ||
    lower.includes('insufficient') ||
    lower.includes('payment required') ||
    lower.includes('402')
  ) {
    return 'Saldo ou créditos insuficientes. Verifique seus créditos no OpenRouter (openrouter.ai/credits) ou no provedor do modelo utilizado.';
  }

  if (
    lower.includes('invalid x-api-key') ||
    lower.includes('invalid api key') ||
    lower.includes('authentication_error') ||
    lower.includes('user not found') ||
    lower.includes('401') ||
    lower.includes('unauthorized')
  ) {
    return 'Chave de API inválida ou expirada. Verifique a chave no .env.local e no painel do provedor (OpenRouter ou Anthropic).';
  }

  if (lower.includes('permission') || lower.includes('403')) {
    return 'Sem permissão para usar este modelo. Verifique os limites da sua conta no provedor.';
  }

  if (lower.includes('rate limit') || lower.includes('overloaded') || lower.includes('529')) {
    return 'Muitas requisições no momento. Aguarde alguns segundos e tente novamente.';
  }

  if (lower.includes('context_length') || lower.includes('too many tokens')) {
    return 'O conteúdo enviado é muito longo. Tente um arquivo menor ou use o modo Resumido.';
  }

  return msg;
}

/**
 * Retorna uma mensagem em português para exibir ao usuário.
 * Compatível com erros do SDK Anthropic (APIError com .status e .error).
 */
export function getFriendlyErrorMessage(err: unknown): string {
  const fallback = 'Erro ao gerar material. Tente novamente.';

  if (err instanceof Error) {
    const msg = err.message;

    // Tenta extrair do .error (propriedade do SDK Anthropic) ou .body
    const sdkError = (err as Error & { error?: unknown; body?: unknown }).error;
    const sdkBody = (err as Error & { body?: unknown }).body;
    const fromSdk = getMessageFromBody(sdkError) ?? getMessageFromBody(sdkBody);

    // Tenta parsear a string da mensagem (formato "STATUS {...json...}")
    const fromJson = tryParseJsonMessage(msg);

    const raw = fromSdk ?? fromJson ?? msg;

    if (raw && raw.length > 0 && raw.length < 600) {
      return toFriendlyMessage(raw);
    }
  }

  // Fallback: tenta extrair body do objeto de erro diretamente
  if (err && typeof err === 'object') {
    const body = (err as Record<string, unknown>).body ?? (err as Record<string, unknown>).error;
    const fromBody = getMessageFromBody(body);
    if (fromBody) return toFriendlyMessage(fromBody);
  }

  return fallback;
}
