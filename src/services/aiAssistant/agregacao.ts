import {
  EQUIPES_ATENDIMENTO,
  STATUS_CONCLUIDO,
  type EquipeAtendimento,
  type StatusTarefa,
  type Tarefa,
} from '../../types/domain'
import {
  equipeExecutoraDaTarefa,
  tarefaEstaAtrasada,
  tarefaEstaConcluida,
  tarefaNoPrazo,
} from '../../utils/tarefasMetrics'
import { normalizar, type Entidade, type Periodo, type TipoMetrica } from './intencao'

/**
 * Motor de agregação em memória sobre os cards (Tarefa[]) já filtrados pelo
 * dashboard. Reusa os predicados canônicos de tarefasMetrics.ts para garantir
 * paridade numérica com os gráficos e cards do dashboard.
 */

const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000

/** Predicados de métrica por card. Espelham exatamente calcularMetricas. */
export const PREDICADOS: Record<string, (t: Tarefa, agora: Date) => boolean> = {
  total: () => true,
  concluidas: (t) => tarefaEstaConcluida(t),
  ativas: (t) => t.status < STATUS_CONCLUIDO && t.status !== 6,
  atrasadas: (t, a) => tarefaEstaAtrasada(t, a),
  emAndamentoNoPrazo: (t, a) => tarefaNoPrazo(t, a),
  aguardandoControle: (t) => t.status === 4,
  riscoAtraso: (t, a) => {
    if (t.status >= STATUS_CONCLUIDO || !t.prazoFinal) return false
    const diff = new Date(t.prazoFinal).getTime() - a.getTime()
    return diff >= 0 && diff <= TRES_DIAS_MS
  },
}

/** Rótulo legível de cada métrica escalar (para composição de resposta). */
export const ROTULO_METRICA: Record<string, string> = {
  total: 'tarefas no total',
  concluidas: 'tarefas concluídas',
  ativas: 'tarefas em aberto',
  atrasadas: 'tarefas atrasadas',
  emAndamentoNoPrazo: 'tarefas em andamento dentro do prazo',
  riscoAtraso: 'tarefas em risco de atraso (vencem nos próximos 3 dias)',
  aguardandoControle: 'tarefas aguardando controle',
  rendimento: 'tarefas concluídas no período',
}

// ---------------------------------------------------------------------------
// Filtro por entidade
// ---------------------------------------------------------------------------

function eqNome(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return normalizar(a) === normalizar(b)
}

/** Aplica a dimensão entidade sobre o pool de cards. */
export function filtrarPorEntidade(cards: Tarefa[], e: Entidade): Tarefa[] {
  if (e.valorCanonico === null) return cards
  const alvo = e.valorCanonico
  switch (e.tipo) {
    case 'equipe':
      return cards.filter((c) => c.equipeAtendimento === alvo)
    case 'pessoa':
      return cards.filter(
        (c) =>
          eqNome(c.responsavelAtendimentoNome, alvo) ||
          eqNome(c.responsavelNome, alvo) ||
          eqNome(c.fechadoPorNome, alvo),
      )
    case 'setor':
      return cards.filter((c) =>
        c.fechadoPorDepartamentos.some((d) => normalizar(d).includes(normalizar(alvo))),
      )
    case 'uf':
      return cards.filter((c) => c.estadoUf === alvo)
    case 'projeto':
      return cards.filter((c) => normalizar(c.projetoNome ?? '').includes(normalizar(alvo)))
    default:
      return cards
  }
}

// ---------------------------------------------------------------------------
// Contagens escalares
// ---------------------------------------------------------------------------

export function contar(cards: Tarefa[], metrica: TipoMetrica, agora: Date): number {
  const pred = PREDICADOS[metrica]
  if (!pred) return cards.length
  return cards.filter((c) => pred(c, agora)).length
}

/** Rendimento: status=5 com finalizadoEm dentro da janela do período. */
export function rendimento(cards: Tarefa[], periodo: Periodo): number {
  return cardsDoRendimento(cards, periodo).length
}

export function cardsDoRendimento(cards: Tarefa[], periodo: Periodo): Tarefa[] {
  return cards.filter((c) => {
    if (!tarefaEstaConcluida(c) || !c.finalizadoEm) return false
    const f = new Date(c.finalizadoEm)
    if (periodo.inicio && f < periodo.inicio) return false
    if (periodo.fim && f > periodo.fim) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// Taxa de atraso por slice (espelha calcularMetricas)
// ---------------------------------------------------------------------------

export interface TaxaAtraso {
  atrasadas: number
  denominador: number
  percentual: number
  modo: 'ativas' | 'total'
}

export function taxaAtraso(cards: Tarefa[], modo: 'ativas' | 'total', agora: Date): TaxaAtraso {
  const total = cards.length
  const concluidas = cards.filter((c) => tarefaEstaConcluida(c)).length
  const adiadas = cards.filter((c) => c.status === 6).length
  const atrasadas = cards.filter((c) => tarefaEstaAtrasada(c, agora)).length
  const ativas = total - concluidas - adiadas

  const denominador = modo === 'total' ? total : ativas
  const percentual = denominador === 0 ? 0 : (atrasadas / denominador) * 100
  return { atrasadas, denominador, percentual, modo }
}

// ---------------------------------------------------------------------------
// Agrupamento por dimensão (para ranking / comparação)
// ---------------------------------------------------------------------------

export type TipoDimensaoGrupo = 'equipe' | 'pessoa' | 'setor' | 'uf' | 'projeto'

/** Retorna as chaves de grupo de um card para a dimensão pedida. */
function chavesDoGrupo(card: Tarefa, dimensao: TipoDimensaoGrupo): string[] {
  switch (dimensao) {
    case 'equipe':
      return [card.equipeAtendimento]
    case 'pessoa':
      // Pessoa relevante para ranking de volume é o responsável pelo atendimento.
      return card.responsavelAtendimentoNome ? [card.responsavelAtendimentoNome] : []
    case 'setor':
      return card.fechadoPorDepartamentos
    case 'uf':
      return card.estadoUf ? [card.estadoUf] : []
    case 'projeto':
      return card.projetoNome ? [card.projetoNome] : []
    default:
      return []
  }
}

/** Pessoa relevante para RENDIMENTO é quem fechou (fechadoPorNome). */
function chavesDoGrupoRendimento(card: Tarefa, dimensao: TipoDimensaoGrupo): string[] {
  if (dimensao === 'pessoa') {
    return card.fechadoPorNome ? [card.fechadoPorNome] : []
  }
  return chavesDoGrupo(card, dimensao)
}

export interface ItemRanking {
  chave: string
  valor: number
}

/**
 * Agrupa os cards pela dimensão e aplica a métrica em cada grupo, retornando o
 * ranking ordenado (desc por padrão). Suporta métricas de contagem, rendimento
 * e taxa de atraso.
 */
export function ranquear(
  cards: Tarefa[],
  dimensao: TipoDimensaoGrupo,
  metrica: TipoMetrica,
  periodo: Periodo,
  agora: Date,
  ordem: 'desc' | 'asc' = 'desc',
): ItemRanking[] {
  const grupos = new Map<string, Tarefa[]>()
  const usaRendimento = metrica === 'rendimento'
  for (const card of cards) {
    const chaves = usaRendimento
      ? chavesDoGrupoRendimento(card, dimensao)
      : chavesDoGrupo(card, dimensao)
    for (const chave of chaves) {
      const lista = grupos.get(chave) ?? []
      lista.push(card)
      grupos.set(chave, lista)
    }
  }

  const itens: ItemRanking[] = []
  for (const [chave, lista] of grupos.entries()) {
    let valor: number
    if (metrica === 'rendimento') valor = rendimento(lista, periodo)
    else if (metrica === 'taxaAtrasoAtiva') valor = taxaAtraso(lista, 'ativas', agora).percentual
    else if (metrica === 'taxaAtrasoTotal') valor = taxaAtraso(lista, 'total', agora).percentual
    else valor = contar(lista, metrica, agora)
    itens.push({ chave, valor })
  }

  itens.sort((a, b) => (ordem === 'desc' ? b.valor - a.valor : a.valor - b.valor) || a.chave.localeCompare(b.chave))
  return itens
}

// ---------------------------------------------------------------------------
// Resumo multi-métrica de um slice
// ---------------------------------------------------------------------------

export interface ResumoSlice {
  total: number
  concluidas: number
  ativas: number
  atrasadas: number
  emAndamentoNoPrazo: number
  riscoAtraso: number
  aguardandoControle: number
  taxaAtrasoAtiva: number
}

export function resumoSlice(cards: Tarefa[], agora: Date): ResumoSlice {
  return {
    total: contar(cards, 'total', agora),
    concluidas: contar(cards, 'concluidas', agora),
    ativas: contar(cards, 'ativas', agora),
    atrasadas: contar(cards, 'atrasadas', agora),
    emAndamentoNoPrazo: contar(cards, 'emAndamentoNoPrazo', agora),
    riscoAtraso: contar(cards, 'riscoAtraso', agora),
    aguardandoControle: contar(cards, 'aguardandoControle', agora),
    taxaAtrasoAtiva: taxaAtraso(cards, 'ativas', agora).percentual,
  }
}

// ---------------------------------------------------------------------------
// Contagens por equipe (fechamento via closedBy; atendimento via equipe do
// supervisor de quem fechou, com fallback para o supervisor do responsável)
// ---------------------------------------------------------------------------

/** Contagem por status de um conjunto de cards, na ordem de STATUS_LABELS. */
export type ContagemPorStatus = Record<StatusTarefa, number>

function contarPorStatus(cards: Tarefa[]): ContagemPorStatus {
  const base = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as ContagemPorStatus
  for (const c of cards) base[c.status] += 1
  return base
}

/** Linha de contagem de UMA equipe: quantas fechou, quantas atende, e por status. */
export interface ContagemEquipe {
  equipe: EquipeAtendimento
  /** Cards FECHADOS por alguém desta equipe (closedBy → departamento do fechador). */
  fechadas: number
  /** Cards cuja equipe de atendimento (supervisor do fechador, ou do responsável) é esta — cobre abertos e fechados. */
  comResponsavelNoTime: number
  /** Status das fechadas por esta equipe. */
  statusFechadas: ContagemPorStatus
  /** Status de todas com responsável nesta equipe (fechadas ou não). */
  statusResponsavel: ContagemPorStatus
}

/**
 * Contagens por equipe pedidas explicitamente: quantas tarefas cada uma das 4
 * equipes (Cinthia Filgueiras, Simone Freitas, Quézia Karen, Lorena Pontes)
 * FECHOU (`closedBy`, resolvido para equipe por `equipeExecutoraDaTarefa`) e
 * quantas tem como equipe de ATENDIMENTO (`equipeAtendimento`, que sai da
 * equipe do supervisor de quem fechou o card, com fallback para a equipe do
 * supervisor do responsável pelo atendimento) — com o detalhamento por status
 * em cada uma das duas visões.
 */
export function contarPorEquipe(cards: Tarefa[]): ContagemEquipe[] {
  return EQUIPES_ATENDIMENTO.map((equipe) => {
    const fechadasCards = cards.filter((c) => equipeExecutoraDaTarefa(c) === equipe)
    const responsavelCards = cards.filter((c) => c.equipeAtendimento === equipe)
    return {
      equipe,
      fechadas: fechadasCards.length,
      comResponsavelNoTime: responsavelCards.length,
      statusFechadas: contarPorStatus(fechadasCards),
      statusResponsavel: contarPorStatus(responsavelCards),
    }
  })
}

// ---------------------------------------------------------------------------
// Guarda de viabilidade temporal (a limitação honesta)
// ---------------------------------------------------------------------------

export interface Viabilidade {
  ok: boolean
  motivo?: 'sem-finalizadas-em-memoria' | 'janela-excede-dados-em-memoria'
}

/**
 * Verifica se um recorte por período pode ser respondido com confiança a partir
 * dos cards em memória. A janela do dashboard filtra por prazoFinal, não por
 * finalizadoEm; então uma pergunta de rendimento cuja janela começa antes da
 * conclusão mais antiga em memória não tem cobertura garantida.
 */
export function periodoAtendivel(cards: Tarefa[], periodo: Periodo): Viabilidade {
  if (periodo.tipo === 'nenhum') return { ok: true }

  const comFinalizacao = cards.filter((c) => c.finalizadoEm)
  if (comFinalizacao.length === 0) return { ok: false, motivo: 'sem-finalizadas-em-memoria' }

  if (periodo.inicio) {
    let maisAntiga = Infinity
    for (const c of comFinalizacao) {
      const t = new Date(c.finalizadoEm as string).getTime()
      if (t < maisAntiga) maisAntiga = t
    }
    if (periodo.inicio.getTime() < maisAntiga) {
      return { ok: false, motivo: 'janela-excede-dados-em-memoria' }
    }
  }

  return { ok: true }
}
