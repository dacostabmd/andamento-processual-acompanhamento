/**
 * URL do portal Bitrix24 (ex.: https://seuportal.bitrix24.com.br), usada só
 * para montar links diretos de tarefa ("abrir no Bitrix"). Independente de
 * VITE_BITRIX_API_URL (webhook REST com token) — opcional, sem ela os links
 * simplesmente não aparecem.
 */
function basePortalUrl(): string | null {
  const bruta = import.meta.env.VITE_BITRIX_PORTAL_URL?.trim()
  if (!bruta) return null
  return bruta.endsWith('/') ? bruta.slice(0, -1) : bruta
}

/** Deep-link nativo do Bitrix24 para abrir uma tarefa específica, ou null se VITE_BITRIX_PORTAL_URL não estiver configurada. */
export function montarUrlTarefaBitrix(tarefaId: number): string | null {
  const base = basePortalUrl()
  if (!base) return null
  return `${base}/company/personal/user/0/tasks/task/view/${tarefaId}/`
}
