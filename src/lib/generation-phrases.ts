/** Frases exibidas em rotação durante a geração do material (tom leve e dinâmico). */
export const GENERATION_PHRASES: string[] = [
  'Lendo seu arquivo…',
  'Essa aula parece bem interessante…',
  'Pensando no melhor jeito de organizar tudo…',
  'Gerando o material didático…',
  'Diagramando seu conteúdo com carinho…',
  'Meu design agora está diagramando seu material…',
  'Aplicando design editorial…',
  'Criando imagens e destaques…',
  'Conectando ideias em capítulos…',
  'Quase lá — revisando a leitura…',
  'Transformando texto em páginas bonitas…',
  'Escolhendo cores que combinam com o tema…',
  'Seu futuro PDF está tomando forma…',
  'Tipografia entrando em cena…',
  'Respiro fundo e continuo gerando…',
  'Isso vai ficar ótimo para estudar…',
  'Sincronizando sumário e páginas…',
  'Adicionando o toque final…',
  'Alinhando parágrafos como estrelas no céu…',
  'Convidando margens generosas para o texto respirar…',
  'Modo foco: só você e esse material agora…',
  'Quase desenhando um abraço em cada página…',
];

export function pickPhraseIndex(prev: number, len: number): number {
  if (len <= 1) return 0;
  let next = Math.floor(Math.random() * len);
  if (next === prev) next = (next + 1) % len;
  return next;
}
