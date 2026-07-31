/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** IDs dos grupos do Bitrix24 monitorados, separados por vírgula. Ex.: "86,92,94". */
  readonly VITE_BITRIX_GRUPOS_ALVO?: string
  /**
   * URL de webhook REST de entrada do Bitrix24, com token embutido. Ex.:
   * "https://SEU_PORTAL.bitrix24.com/rest/1/xxxxxxxxxxxx/". Usada como fallback
   * quando o app roda FORA do iframe do Bitrix (dev/servidor), onde window.BX24
   * não existe. ATENÇÃO: variável VITE_ vai embutida no bundle do front — o token
   * fica visível a quem abrir o app. Não versione o valor real nem publique o
   * build para fora da empresa com o token dentro.
   */
  readonly VITE_BITRIX_API_URL?: string
  /**
   * URL base do microsserviço de sincronização (FastAPI, hospedado numa VPS
   * própria) que mantém um snapshot pré-processado das tarefas do Bitrix.
   * Sem token/segredo embutido — é só leitura de dados já resolvidos, então
   * não há o mesmo cuidado de segurança da VITE_BITRIX_API_URL. Ex.:
   * "https://sync.seudominio.com.br".
   */
  readonly VITE_SYNC_API_URL?: string
  /**
   * Token enviado como header `X-API-Token` em toda chamada ao worker
   * (`/snapshot`, `/query-ia`). Deve ser igual a `API_TOKEN_LEITURA` no `.env`
   * do worker — sem ele, o worker responde 401. Como toda VITE_*, fica
   * embutido no bundle e é legível via DevTools; ver syncApi.ts.
   */
  readonly VITE_API_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
