/**
 * Transporte REST do Bitrix24 via webhook de entrada (api_url), usado como
 * fallback quando o app NÃO roda embutido no iframe do Bitrix (dev/servidor),
 * onde window.BX24 não existe. Espelha a assinatura de bitrixSdk para que os
 * serviços (dashboardService/acessoService) não precisem saber a fonte.
 *
 * A api_url vem de VITE_BITRIX_API_URL e já contém o token — ver a nota de
 * segurança em .env.example / vite-env.d.ts.
 */
import { finalizarChamada, registrarChamada, registrarPagina } from './debugBitrix'

const MAX_TENTATIVAS_RATE_LIMIT = 5
const TAMANHO_PAGINA_BITRIX = 50
// O método `batch` do REST aceita até 50 comandos por requisição.
const MAX_COMANDOS_POR_BATCH = 50

/** Base normalizada (sempre com barra final) ou null se não configurada. */
function baseApiUrl(): string | null {
  const bruta = import.meta.env.VITE_BITRIX_API_URL?.trim()
  if (!bruta) return null
  return bruta.endsWith('/') ? bruta : `${bruta}/`
}

export function webhookDisponivel(): boolean {
  return baseApiUrl() !== null
}

/** URL base com o token mascarado, só para exibição no painel de diagnóstico. */
export function apiUrlMascarada(): string | null {
  const base = baseApiUrl()
  if (!base) return null
  // .../rest/<user>/<token>/ → mascara o token (o segmento após o id do usuário).
  return base.replace(/(\/rest\/\d+\/)([^/]+)(\/)/, (_todo, antes, token, depois) => {
    const visivel = token.slice(0, 3)
    return `${antes}${visivel}${'•'.repeat(Math.max(0, token.length - 3))}${depois}`
  })
}

interface RespostaRest {
  result?: unknown
  total?: number
  next?: number
  error?: string
  error_description?: string
}

interface RespostaBatch {
  result?: {
    result?: Record<string, unknown>
    result_error?: Record<string, unknown>
    result_total?: Record<string, number>
    result_next?: Record<string, number>
  }
  error?: string
  error_description?: string
}

function esperarMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ehRateLimit(erro: string | undefined): boolean {
  return erro === 'QUERY_LIMIT_EXCEEDED'
}

async function postRest<T = RespostaRest>(
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const base = baseApiUrl()
  if (!base) {
    throw new Error('VITE_BITRIX_API_URL não configurada — webhook REST indisponível.')
  }
  const resposta = await fetch(`${base}${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!resposta.ok) {
    throw new Error(`Erro HTTP ${resposta.status} ao chamar ${method} no Bitrix24 (webhook).`)
  }
  return (await resposta.json()) as T
}

/** Chama um método REST único (não paginado), com retry em rate limit. */
export async function callMethodRest<T>(
  method: string,
  params: Record<string, unknown> = {},
  tentativa = 0,
): Promise<T> {
  const resposta = await postRest(method, params)
  if (resposta.error) {
    if (ehRateLimit(resposta.error) && tentativa < MAX_TENTATIVAS_RATE_LIMIT) {
      await esperarMs(1000 * (tentativa + 1))
      return callMethodRest<T>(method, params, tentativa + 1)
    }
    throw new Error(resposta.error_description ?? `Erro ao chamar ${method} no Bitrix24.`)
  }
  return resposta.result as T
}

/**
 * Lista todos os registros de um método REST paginado. A primeira página revela
 * o `total`; as demais são buscadas em lote via o método `batch` do REST (até 50
 * comandos por requisição), evitando N idas sequenciais ao servidor. Mesma
 * estratégia de bitrixSdk.callMethodTodasPaginas, mas sobre fetch.
 */
export async function callMethodTodasPaginasRest<T>(
  method: string,
  params: Record<string, unknown> = {},
  extrairLista: (payload: unknown) => T[] = (payload) => payload as T[],
): Promise<T[]> {
  const debugId = registrarChamada(method, params)

  const primeira = await postRestComRetry(method, params)
  const itensPrimeira = extrairLista(primeira.result)
  const total = Number(primeira.total ?? itensPrimeira.length) || itensPrimeira.length
  registrarPagina(debugId, null, itensPrimeira, total)

  const acumulado = [...itensPrimeira]
  const primeiraCompleta = primeira.next === undefined || itensPrimeira.length >= total
  if (primeiraCompleta) {
    finalizarChamada(debugId, agoraIso())
    return acumulado
  }

  const offsets: number[] = []
  for (let start = TAMANHO_PAGINA_BITRIX; start < total; start += TAMANHO_PAGINA_BITRIX) {
    offsets.push(start)
  }

  for (let i = 0; i < offsets.length; i += MAX_COMANDOS_POR_BATCH) {
    const lote = offsets.slice(i, i + MAX_COMANDOS_POR_BATCH)
    const cmd: Record<string, string> = {}
    lote.forEach((start, idx) => {
      cmd[String(idx)] = montarComandoBatch(method, { ...params, start })
    })

    const batch = await postRestBatchComRetry(cmd)
    const resultados = batch.result?.result ?? {}
    const erros = batch.result?.result_error ?? {}

    for (let idx = 0; idx < lote.length; idx++) {
      const chave = String(idx)
      if (erros[chave]) {
        // Sub-comando falhou (ex.: rate limit no meio do lote): refaz só ele.
        const refeito = await postRestComRetry(method, { ...params, start: lote[idx] })
        const itens = extrairLista(refeito.result)
        registrarPagina(debugId, lote[idx], itens)
        acumulado.push(...itens)
      } else {
        const itens = extrairLista(resultados[chave])
        registrarPagina(debugId, lote[idx], itens)
        acumulado.push(...itens)
      }
    }
  }

  finalizarChamada(debugId, agoraIso())
  return acumulado
}

async function postRestComRetry(
  method: string,
  params: Record<string, unknown>,
  tentativa = 0,
): Promise<RespostaRest> {
  const resposta = await postRest(method, params)
  if (resposta.error) {
    if (ehRateLimit(resposta.error) && tentativa < MAX_TENTATIVAS_RATE_LIMIT) {
      await esperarMs(1000 * (tentativa + 1))
      return postRestComRetry(method, params, tentativa + 1)
    }
    throw new Error(resposta.error_description ?? `Erro ao chamar ${method} no Bitrix24.`)
  }
  return resposta
}

async function postRestBatchComRetry(
  cmd: Record<string, string>,
  tentativa = 0,
): Promise<RespostaBatch> {
  const resposta = await postRest<RespostaBatch>('batch', { halt: 0, cmd })
  if (resposta.error) {
    if (ehRateLimit(resposta.error) && tentativa < MAX_TENTATIVAS_RATE_LIMIT) {
      await esperarMs(1000 * (tentativa + 1))
      return postRestBatchComRetry(cmd, tentativa + 1)
    }
    throw new Error(resposta.error_description ?? 'Erro ao chamar batch no Bitrix24.')
  }
  return resposta
}

/**
 * Monta um comando do método `batch`: "metodo?a=1&b[]=2". Serializa objetos/arrays
 * no formato de query aninhada que o REST do Bitrix espera (a[b][c]=v).
 */
function montarComandoBatch(method: string, params: Record<string, unknown>): string {
  const query = queryAninhada(params)
  return query ? `${method}?${query}` : method
}

function queryAninhada(valor: unknown, prefixo = ''): string {
  if (valor === null || valor === undefined) return ''
  if (Array.isArray(valor)) {
    return valor
      .map((item, i) => queryAninhada(item, `${prefixo}[${i}]`))
      .filter(Boolean)
      .join('&')
  }
  if (typeof valor === 'object') {
    return Object.entries(valor as Record<string, unknown>)
      .map(([chave, v]) => queryAninhada(v, prefixo ? `${prefixo}[${chave}]` : chave))
      .filter(Boolean)
      .join('&')
  }
  return `${encodeURIComponent(prefixo)}=${encodeURIComponent(String(valor))}`
}

/** `new Date()` isolado aqui para manter o resto puro/testável. */
function agoraIso(): string {
  return new Date().toISOString()
}
