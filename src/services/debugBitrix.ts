/**
 * Captura de diagnóstico das chamadas ao Bitrix24 — SOMENTE em desenvolvimento
 * (import.meta.env.DEV). Serve ao painel de debug no canto inferior direito, que
 * mostra o "caminho da request" (método + params) e os dados brutos paginados.
 *
 * Em produção nada disso é registrado: `registrar*` viram no-ops e o histórico
 * fica sempre vazio, então nenhum dado sensível é retido.
 */
import type { Tarefa } from '../types/domain'

const ATIVO = import.meta.env.DEV

export interface PaginaCapturada {
  /** Offset (`start`) da página no Bitrix, ou null para a primeira página. */
  start: number | null
  /** Quantidade de itens retornados nessa página. */
  quantidade: number
  /** Amostra dos itens brutos dessa página (limitada para não pesar na UI). */
  amostra: unknown[]
}

export interface ChamadaCapturada {
  id: number
  method: string
  params: Record<string, unknown>
  /** Total de registros reportado pelo Bitrix (quando disponível). */
  total: number | null
  paginas: PaginaCapturada[]
  concluidaEm: string | null
}

export interface SnapshotDebug {
  chamadas: ChamadaCapturada[]
  /** Amostra do resultado final já mapeado para o domínio (tarefas). */
  tarefas: Tarefa[]
}

const MAX_ITENS_AMOSTRA_POR_PAGINA = 5

let proximoId = 1
let chamadas: ChamadaCapturada[] = []
let tarefas: Tarefa[] = []
// Snapshot recomputado só quando algo muda — identidade estável entre leituras é
// requisito do useSyncExternalStore (senão entra em loop de render).
let snapshot: SnapshotDebug = { chamadas, tarefas }
const ouvintes = new Set<() => void>()

function notificar(): void {
  snapshot = { chamadas, tarefas }
  ouvintes.forEach((ouvinte) => ouvinte())
}

/** Zera o histórico (chamado no início de cada nova carga/sincronização). */
export function reiniciarCapturaBitrix(): void {
  if (!ATIVO) return
  chamadas = []
  tarefas = []
  notificar()
}

/** Registra uma chamada de listagem e devolve seu id para anexar páginas depois. */
export function registrarChamada(method: string, params: Record<string, unknown>): number {
  if (!ATIVO) return -1
  const id = proximoId++
  chamadas = [...chamadas, { id, method, params, total: null, paginas: [], concluidaEm: null }]
  notificar()
  return id
}

export function registrarPagina(
  id: number,
  start: number | null,
  itens: unknown[],
  total?: number | null,
): void {
  if (!ATIVO || id < 0) return
  chamadas = chamadas.map((chamada) => {
    if (chamada.id !== id) return chamada
    const pagina: PaginaCapturada = {
      start,
      quantidade: itens.length,
      amostra: itens.slice(0, MAX_ITENS_AMOSTRA_POR_PAGINA),
    }
    return {
      ...chamada,
      total: total ?? chamada.total,
      paginas: [...chamada.paginas, pagina],
    }
  })
  notificar()
}

export function finalizarChamada(id: number, quandoIso: string): void {
  if (!ATIVO || id < 0) return
  chamadas = chamadas.map((chamada) =>
    chamada.id === id ? { ...chamada, concluidaEm: quandoIso } : chamada,
  )
  notificar()
}

/** Guarda o resultado final já convertido para o domínio (para conferência). */
export function registrarTarefasResolvidas(resolvidas: Tarefa[]): void {
  if (!ATIVO) return
  tarefas = resolvidas
  notificar()
}

export function lerSnapshotDebug(): SnapshotDebug {
  return snapshot
}

export function assinarDebug(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export const debugBitrixAtivo = ATIVO
