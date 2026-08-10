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

/**
 * Deep-link nativo do Bitrix24 para abrir uma tarefa específica, ou null se
 * VITE_BITRIX_PORTAL_URL não estiver configurada. O Bitrix não tem uma rota
 * curta universal por ID — tarefas de grupo de trabalho (GROUP_ID, aqui
 * `projetoId`) usam `/workgroups/group/{id}/tasks/task/view/{id}/`, e tarefas
 * pessoais (sem grupo) usam `/company/personal/user/{RESPONSIBLE_ID}/tasks/task/view/{id}/`.
 * Usar `user/0` como placeholder ou a rota curta sozinha resulta em
 * ERROR_METHOD_NOT_FOUND — confirmado com URLs reais do portal do usuário.
 */
export function montarUrlTarefaBitrix(
  tarefaId: number,
  projetoId: number | null,
  responsavelId: number | null,
): string | null {
  const base = basePortalUrl()
  if (!base) return null
  if (projetoId) return `${base}/workgroups/group/${projetoId}/tasks/task/view/${tarefaId}/`
  if (responsavelId) return `${base}/company/personal/user/${responsavelId}/tasks/task/view/${tarefaId}/`
  return null
}
