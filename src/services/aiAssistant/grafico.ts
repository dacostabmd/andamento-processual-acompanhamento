/**
 * Dados prontos para desenhar um gráfico de barras a partir de uma resposta do
 * assistente.
 *
 * Definido aqui (módulo de base, sem dependências) para poder ser importado
 * tanto por composicao.ts (que o produz, no fallback offline) quanto por
 * aiAssistantService.ts (que o produz a partir do worker E reexporta o tipo
 * para o componente de chat) sem criar import circular entre os dois.
 */
export interface DadosGrafico {
  categorias: string[]
  valores: number[]
  /** Rótulo curto da série (eixo/tooltip) — ex.: "tarefas concluídas". */
  rotuloValor?: string
  /** Legenda curta acima do gráfico. */
  titulo?: string
}

/** Retorno de uma função de composição que PODE render gráfico junto do texto. */
export interface RespostaComposta {
  texto: string
  grafico?: DadosGrafico
}
