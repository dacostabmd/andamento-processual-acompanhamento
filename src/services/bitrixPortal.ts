/**
 * URL do portal Bitrix24 (ex.: https://seuportal.bitrix24.com.br), usada só
 * para montar links diretos de tarefa ("abrir no Bitrix"). Independente de
 * VITE_BITRIX_API_URL (webhook REST com token) — opcional, sem ela os links
 * simplesmente não aparecem.
 */
export function basePortalUrl(): string {
  const portalBruta = import.meta.env.VITE_BITRIX_PORTAL_URL?.trim()
  if (portalBruta) return portalBruta.endsWith('/') ? portalBruta.slice(0, -1) : portalBruta

  const apiBruta = import.meta.env.VITE_BITRIX_API_URL?.trim()
  if (apiBruta) {
    try {
      const url = new URL(apiBruta)
      return `${url.protocol}//${url.host}`
    } catch {
      // ignora se URL inválida
    }
  }

  return 'https://bitrix.dapadvocacia.com.br'
}

/**
 * Caminho (sem domínio) de uma tarefa específica no Bitrix24. O Bitrix usa
 * `/workgroups/group/{id}/tasks/task/view/{id}/` para tarefas de grupo e
 * `/company/personal/user/{RESPONSIBLE_ID}/tasks/task/view/{id}/` para pessoais.
 */
export function montarCaminhoTarefaBitrix(
  tarefaId: number,
  projetoId?: number | null,
  responsavelId?: number | null,
  fechadoPorId?: number | null,
  responsavelAtendimentoId?: number | null,
): string {
  if (projetoId) return `/workgroups/group/${projetoId}/tasks/task/view/${tarefaId}/`
  const userId = responsavelId || responsavelAtendimentoId || fechadoPorId || 1
  return `/company/personal/user/${userId}/tasks/task/view/${tarefaId}/`
}

/** Caminho (sem domínio) da página de perfil do usuário no Bitrix24. */
export function montarCaminhoPerfilBitrix(usuarioId: number | null): string | null {
  if (!usuarioId) return null
  return `/company/personal/user/${usuarioId}/`
}

/** Deep-link absoluto (com domínio) para uma tarefa específica. */
export function montarUrlTarefaBitrix(
  tarefaId: number,
  projetoId?: number | null,
  responsavelId?: number | null,
  fechadoPorId?: number | null,
  responsavelAtendimentoId?: number | null,
): string {
  const base = basePortalUrl()
  const caminho = montarCaminhoTarefaBitrix(
    tarefaId,
    projetoId,
    responsavelId,
    fechadoPorId,
    responsavelAtendimentoId,
  )
  return `${base}${caminho}`
}

/** Link absoluto para a página de perfil do usuário no Bitrix24, ou null se a env var não estiver configurada ou não houver ID. */
export function montarUrlPerfilBitrix(usuarioId: number | null): string | null {
  const base = basePortalUrl()
  const caminho = montarCaminhoPerfilBitrix(usuarioId)
  if (!base || !caminho) return null
  return `${base}${caminho}`
}
