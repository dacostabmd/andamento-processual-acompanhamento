/**
 * Roteador de transporte do Bitrix24. Uma única API pública que os serviços
 * consomem sem saber a fonte concreta:
 *
 *   1. BX24  — quando o app roda embutido no iframe do Bitrix (window.BX24).
 *   2. Webhook REST (api_url) — fora do iframe, se VITE_BITRIX_API_URL.
 *   3. nenhuma — nem uma nem outra: não há mais mock; o app mostra erro.
 *
 * `fonteAtiva()` diz qual está em uso (também exibido no painel de diagnóstico).
 */
import { bx24Disponivel, callMethod, callMethodTodasPaginas } from './bitrixSdk'
import { callMethodRest, callMethodTodasPaginasRest, webhookDisponivel } from './bitrixRest'

export type FonteBitrix = 'bx24' | 'webhook' | 'nenhuma'

export function fonteAtiva(): FonteBitrix {
  if (bx24Disponivel()) return 'bx24'
  if (webhookDisponivel()) return 'webhook'
  return 'nenhuma'
}

/**
 * Lista todas as páginas de um método pela fonte real ativa. Sem fonte real
 * (`nenhuma`), lança — o chamador propaga para o estado de erro da UI.
 */
export function listarTodasPaginas<T>(
  method: string,
  params: Record<string, unknown> = {},
  extrairLista: (payload: unknown) => T[] = (payload) => payload as T[],
): Promise<T[]> {
  const fonte = fonteAtiva()
  if (fonte === 'bx24') return callMethodTodasPaginas<T>(method, params, extrairLista)
  if (fonte === 'webhook') return callMethodTodasPaginasRest<T>(method, params, extrairLista)
  throw new Error(
    'Fonte de dados do Bitrix não configurada. Rode embutido no Bitrix24 ou defina VITE_BITRIX_API_URL.',
  )
}

/**
 * Chama um método não paginado (devolve um único registro/array pequeno já
 * completo) pela fonte real ativa. Preferível a `listarTodasPaginas` quando o
 * pedido já é filtrado para poucos registros (ex.: `FILTER: { ID: [...] }`) —
 * evita depender da paginação (BX24.callBatch/`next()`) para algo que cabe
 * numa chamada só.
 */
export function chamarMetodo<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const fonte = fonteAtiva()
  if (fonte === 'bx24') return callMethod<T>(method, params)
  if (fonte === 'webhook') return callMethodRest<T>(method, params)
  throw new Error(
    'Fonte de dados do Bitrix não configurada. Rode embutido no Bitrix24 ou defina VITE_BITRIX_API_URL.',
  )
}
