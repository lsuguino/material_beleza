/**
 * Mensagens amigáveis para erros de APIs de LLM (OpenRouter, Anthropic, etc.).
 */

function getMessageFromBody(obj: unknown): string | null {
  if (obj && typeof obj === 'object') {
    const body = obj as Record<string, unknown>;
    const err = body.error as { message?: string } | undefined;
    const msg = err?.message ?? (body.message as string | undefined);
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return null;
}

function tryParseJsonMessage(str: string): string | null {
  const trimmed = str.trim();
  if (
    (trimmed.startsWith('{') && trimmed.includes('"error"')) ||
    trimmed.startsWith('400 ')
  ) {
    try {
      const json = trimmed.replace(/^\d+\s*/, '');
      const obj = JSON.parse(json) as { error?: { message?: string } };
      return obj?.error?.message ?? null;
    } catch {
      // ignore
    }
  }
  return null;
}

function toFriendlyMessage(englishMessage: string): string {
  const lower = englishMessage.toLowerCase();
  if (
    lower.includes('credit balance') ||
    lower.includes('too low') ||
    lower.includes('insufficient') ||
    lower.includes('insufficient credits') ||
    lower.includes('payment required') ||
    lower.includes('402')
  ) {
    return 'Saldo ou créditos insuficientes no provedor de IA (OpenRouter). Acesse openrouter.ai → Credits / Billing e adicione créditos.';
  }
  if (lower.includes('user not found')) {
    return 'OpenRouter não reconheceu esta chave (401). Confira em openrouter.ai/keys se a chave está ativa, se há créditos e crie uma chave nova se necessário. Em .env use só o valor da chave (sem a palavra Bearer) e sem espaços ou quebras de linha.';
  }
  if (
    lower.includes('invalid_api_key') ||
    lower.includes('authentication') ||
    lower.includes('api key') ||
    lower.includes('401') ||
    lower.includes('unauthorized')
  ) {
    return 'Chave da API inválida ou expirada. Verifique OPENROUTER_API_KEY (openrouter.ai/keys) e créditos na conta.';
  }
  if (lower.includes('rate limit') || lower.includes('overloaded')) {
    return 'Muitas requisições no momento. Aguarde alguns segundos e tente novamente.';
  }
  if (lower.includes('context_length') || lower.includes('token')) {
    return 'O conteúdo do VTT é muito longo. Tente um arquivo menor ou use o modo Resumido.';
  }
  return englishMessage;
}

/**
 * Retorna uma mensagem em português para exibir ao usuário.
 */
export function getFriendlyErrorMessage(err: unknown): string {
  const fallback = 'Erro ao gerar material. Tente novamente.';

  if (err instanceof Error) {
    const msg = err.message;
    const fromJson = tryParseJsonMessage(msg);
    const fromBody = getMessageFromBody((err as Error & { body?: unknown }).body);
    const raw = fromJson ?? fromBody ?? msg;
    if (
      raw.includes('credit balance') ||
      raw.includes('too low') ||
      raw.includes('invalid_request_error') ||
      raw.includes('OpenRouter') ||
      fromJson
    ) {
      return toFriendlyMessage(raw);
    }
    if (raw.length > 0 && raw.length < 500) return raw;
  }

  const body =
    typeof err === 'object' && err !== null
      ? (err as Record<string, unknown>).body
      : undefined;
  const fromBody = getMessageFromBody(body);
  if (fromBody) return toFriendlyMessage(fromBody);

  return fallback;
}
