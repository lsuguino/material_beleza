import Anthropic, { APIError } from '@anthropic-ai/sdk';

/** Retorna o modelo Anthropic para a tarefa dada. Configurável por env. */
export function getAnthropicModelForTask(task: 'text_material' | 'design'): string {
  if (task === 'text_material') {
    return process.env.ANTHROPIC_MODEL_TEXT_MATERIAL?.trim() || 'claude-3-5-sonnet-20241022';
  }
  return process.env.ANTHROPIC_MODEL_DESIGN?.trim() || 'claude-3-5-sonnet-20241022';
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada');
  return new Anthropic({ apiKey });
}

/**
 * Chamada ao Claude via SDK da Anthropic.
 * Interface equivalente ao openRouterChat() para facilitar migração.
 */
export async function anthropicChat(params: {
  system?: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
  model?: string;
}): Promise<string> {
  const client = getAnthropicClient();
  const model = params.model ?? getAnthropicModelForTask('text_material');

  try {
    const response = await client.messages.create({
      model,
      max_tokens: params.max_tokens ?? 4096,
      ...(params.system?.trim() ? { system: params.system } : {}),
      messages: [{ role: 'user', content: params.user }],
      temperature: params.temperature ?? 0.2,
    });

    const block = response.content[0];
    if (block && block.type === 'text' && block.text.trim()) return block.text;
    throw new Error('Resposta vazia do Claude');
  } catch (err) {
    // Propaga erros do SDK Anthropic preservando .status e .error para o handler de erros
    if (err instanceof APIError) {
      const apiErr = new Error(`${err.status} ${err.message}`) as Error & {
        status?: number;
        error?: unknown;
      };
      apiErr.status = err.status;
      apiErr.error = err.error;
      throw apiErr;
    }
    throw err;
  }
}

/**
 * Chamada ao Claude por tarefa (text_material ou design).
 * Interface equivalente ao openRouterChatByTask() para facilitar migração.
 */
export async function anthropicChatByTask(
  task: 'text_material' | 'design',
  params: {
    system?: string;
    user: string;
    max_tokens?: number;
    temperature?: number;
  }
): Promise<string> {
  return anthropicChat({ ...params, model: getAnthropicModelForTask(task) });
}
