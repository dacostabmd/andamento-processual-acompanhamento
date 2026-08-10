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
 * Caminho (sem domínio) de uma tarefa específica no Bitrix24, ou null se
 * VITE_BITRIX_PORTAL_URL não estiver configurada. O Bitrix não tem uma rota
 * curta universal por ID — tarefas de grupo de trabalho (GROUP_ID, aqui
 * `projetoId`) usam `/workgroups/group/{id}/tasks/task/view/{id}/`, e tarefas
 * pessoais (sem grupo) usam `/company/personal/user/{RESPONSIBLE_ID}/tasks/task/view/{id}/`.
 * Usar `user/0` como placeholder ou a rota curta sozinha resulta em
 * ERROR_METHOD_NOT_FOUND — confirmado com URLs reais do portal do usuário.
 */
export function montarCaminhoTarefaBitrix(
  tarefaId: number,
  projetoId: number | null,
  responsavelId: number | null,
): string | null {
  if (projetoId) return `/workgroups/group/${projetoId}/tasks/task/view/${tarefaId}/`
  if (responsavelId) return `/company/personal/user/${responsavelId}/tasks/task/view/${tarefaId}/`
  return null
}

/** Caminho (sem domínio) da página de perfil do usuário no Bitrix24, ou null se não houver ID. */
export function montarCaminhoPerfilBitrix(usuarioId: number | null): string | null {
  if (!usuarioId) return null
  return `/company/personal/user/${usuarioId}/`
}

/**
 * Deep-link absoluto (com domínio) para uma tarefa específica, ou null se
 * VITE_BITRIX_PORTAL_URL não estiver configurada. Usado como `href` do link —
 * funciona ao copiar/colar ou abrir fora do iframe do Bitrix24. DENTRO do
 * iframe, prefira abrir via BX24.openPath (ver bitrixSdk.ts abrirNoPortal),
 * que usa o caminho relativo e evita o BX24 reescrever a URL para passar pela
 * rota REST autenticada.
 */
export function montarUrlTarefaBitrix(
  tarefaId: number,
  projetoId: number | null,
  responsavelId: number | null,
): string | null {
  const base = basePortalUrl()
  const caminho = montarCaminhoTarefaBitrix(tarefaId, projetoId, responsavelId)
  if (!base || !caminho) return null
  return `${base}${caminho}`
}

/** Link absoluto para a página de perfil do usuário no Bitrix24, ou null se a env var não estiver configurada ou não houver ID. */
export function montarUrlPerfilBitrix(usuarioId: number | null): string | null {
  const base = basePortalUrl()
  const caminho = montarCaminhoPerfilBitrix(usuarioId)
  if (!base || !caminho) return null
  return `${base}${caminho}`
}
