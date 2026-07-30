/**
 * Ponto único de acesso ao worker de sincronização.
 *
 * Existe para o token de API não ficar duplicado em cada `fetch` espalhado pelos
 * serviços — antes, `dashboardService` e `aiAssistantService` montavam a URL cada
 * um do seu jeito e nenhum dos dois mandava credencial (o worker aceitava
 * qualquer requisição).
 *
 * SOBRE O TOKEN: `VITE_API_TOKEN` é embutido no bundle pelo Vite, como toda
 * variável VITE_*, então é legível por quem abrir o DevTools. Isso é deliberado e
 * limitado: ele fecha varredura anônima, indexação por buscador e uso
 * automatizado da API — não é sigilo forte. A solução completa é o worker validar
 * a sessão do BX24; ver AUTENTICACAO.md no worker.
 */

/** Base do worker, sem barra no fim. Null quando não configurado. */
export function baseSyncApi(): string | null {
  const bruta = import.meta.env.VITE_SYNC_API_URL?.trim()
  if (!bruta) return null
  return bruta.endsWith('/') ? bruta.slice(0, -1) : bruta
}

function tokenApi(): string {
  return import.meta.env.VITE_API_TOKEN?.trim() ?? ''
}

/** Headers de autenticação; vazio quando não há token (worker em modo aberto). */
export function headersSyncApi(extras: Record<string, string> = {}): Record<string, string> {
  const token = tokenApi()
  return token ? { ...extras, 'X-API-Token': token } : { ...extras }
}

/**
 * `fetch` para o worker, com o token já aplicado. Resolve a URL relativa ao
 * worker (ex.: '/snapshot') e lança se o worker não estiver configurado.
 */
export async function fetchSyncApi(caminho: string, init: RequestInit = {}): Promise<Response> {
  const base = baseSyncApi()
  if (!base) throw new Error('VITE_SYNC_API_URL não configurada.')

  const headers = headersSyncApi(
    (init.headers as Record<string, string> | undefined) ?? {},
  )
  return fetch(`${base}${caminho}`, { ...init, headers })
}

/**
 * Mensagem de erro adequada ao status. 401/403 e 429 são situações que o usuário
 * pode resolver ou entender, então merecem texto próprio em vez do genérico.
 */
export function descreverErroHttp(status: number, base: string): string {
  if (status === 401 || status === 403) {
    return 'Acesso não autorizado ao servidor de dados. Verifique se VITE_API_TOKEN corresponde ao token configurado no worker.'
  }
  if (status === 429) {
    return 'Limite de uso por hora atingido no servidor. Aguarde alguns minutos.'
  }
  if (status === 503) {
    return 'Servidor de dados indisponível ou sem credenciais configuradas.'
  }
  return `Servidor de sincronização em ${base} respondeu com status HTTP ${status}.`
}
