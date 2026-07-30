import { GRUPOS_MONITORADOS } from './bitrixConfig'
import { bx24Disponivel } from './bitrixSdk'
import { fonteAtiva, listarTodasPaginas } from './bitrixTransport'
import { modoMockDevAtivo, projetosMonitoradosMock } from './modoMockDev'
import type { Projeto, SessaoUsuario } from '../types/domain'

interface GrupoBitrix {
  GROUP_ID?: string
  GROUP_NAME?: string
  // sonet_group.get devolve ID/NAME (maiúsculas diferentes de user.groups).
  ID?: string
  NAME?: string
}

/**
 * Resolve o colaborador logado + os projetos monitorados, sempre ao vivo do
 * Bitrix (não há mock nem backend próprio). A tela de inteligência trabalha
 * sobre TODOS os GRUPOS_MONITORADOS (não só os grupos de trabalho do usuário
 * logado) — os grupos do usuário servem apenas para decidir se ele tem acesso:
 *
 *  - Embutido no Bitrix (BX24): busca os grupos do usuário atual via
 *    `sonet_group.user.groups` (chamada como o próprio usuário). Se nenhum
 *    deles está em GRUPOS_MONITORADOS, retorna `null` ("sem acesso" — não é
 *    erro fatal; ver useSessaoUsuario / EstadoVazio). Caso contrário, os
 *    `projetosPermitidos` retornados são TODOS os GRUPOS_MONITORADOS.
 *  - Via webhook REST (fora do iframe): não há sessão de usuário, então assume
 *    acesso liberado a todos os GRUPOS_MONITORADOS fixos.
 *  - Sem fonte real: lança, e o chamador mostra o estado de erro.
 */
export async function resolverAcesso(
  idBitrix: number,
  nome: string,
): Promise<SessaoUsuario | null> {
  const syncApiUrl = import.meta.env.VITE_SYNC_API_URL?.trim()

  // Somente DEV/mock curto-circuita o controle de acesso.
  //
  // A condição anterior era `DEV || mock || Boolean(syncApiUrl)`. Como
  // VITE_SYNC_API_URL está SEMPRE definida em produção (é assim que o dashboard
  // obtém os dados), esse terceiro termo tornava o atalho permanente: a checagem
  // de grupos abaixo nunca executava, e todo usuário do portal recebia acesso a
  // todos os grupos monitorados. O worker também não revalidava nada, então não
  // havia nenhuma verificação de acesso em nenhuma camada.
  if (import.meta.env.DEV || modoMockDevAtivo()) {
    return {
      colaborador: { id: idBitrix || 0, nome: nome || 'Painel de Inteligência (Modo Mock)', ativo: true },
      projetosPermitidos: projetosMonitoradosMock(),
    }
  }

  // Embutido no Bitrix24: valida os grupos do usuário. A chamada é feita pelo
  // SDK do BX24 (mesma origem do iframe), então não sofre o CORS que atingiria um
  // fetch direto ao webhook — vale mesmo com o worker configurado.
  if (bx24Disponivel()) {
    const grupos = await listarTodasPaginas<GrupoBitrix>('sonet_group.user.groups')
    const temAcessoAMonitorado = grupos.some((g) => GRUPOS_MONITORADOS.includes(Number(g.GROUP_ID)))

    if (!temAcessoAMonitorado) {
      return null
    }
    // Com acesso confirmado, o painel opera sobre todos os grupos monitorados.
    return {
      colaborador: { id: idBitrix, nome, ativo: true },
      projetosPermitidos: gruposMonitoradosFixos(),
    }
  }

  // Fora do iframe, mas com o worker configurado: não há sessão de usuário do
  // Bitrix para checar. O acesso passa a ser garantido pelo token da API do
  // worker (X-API-Token), não por grupo — quem não tem o token não lê nada.
  if (syncApiUrl) {
    console.info(
      '[ACESSO] Sem SDK do Bitrix24: acesso controlado pelo token da API do worker, não por grupo.',
    )
    return {
      colaborador: { id: idBitrix || 0, nome: nome || 'Painel de Inteligência', ativo: true },
      projetosPermitidos: gruposMonitoradosFixos(),
    }
  }

  if (fonteAtiva() === 'webhook') {
    const projetosPermitidos = await gruposMonitoradosViaWebhook()
    return {
      colaborador: { id: idBitrix, nome, ativo: true },
      projetosPermitidos,
    }
  }

  throw new Error(
    'Fonte de dados do Bitrix não configurada. Rode embutido no Bitrix24 ou defina VITE_BITRIX_API_URL.',
  )
}

/**
 * Grupos monitorados sem consultar o Bitrix. Usado quando o worker é a fonte de
 * dados: os nomes reais chegam no próprio snapshot (`projetoNome`), então buscar
 * `sonet_group.get` do navegador só adicionaria uma chamada que costuma falhar
 * por CORS e cair no mesmo resultado.
 */
function gruposMonitoradosFixos(): Projeto[] {
  return GRUPOS_MONITORADOS.map((id) => ({ id, nome: `Grupo ${id}` }))
}

/** Nomes de todos os grupos monitorados (via `sonet_group.get`, sem depender de sessão). */
async function gruposMonitoradosViaWebhook(): Promise<Projeto[]> {
  try {
    const grupos = await listarTodasPaginas<GrupoBitrix>('sonet_group.get', {
      FILTER: { ID: GRUPOS_MONITORADOS },
    })
    const nomePorId = new Map<number, string>()
    grupos.forEach((g) => {
      const id = Number(g.ID ?? g.GROUP_ID)
      const nome = g.NAME ?? g.GROUP_NAME
      if (Number.isFinite(id) && nome) nomePorId.set(id, nome)
    })

    return GRUPOS_MONITORADOS.map((id) => ({ id, nome: nomePorId.get(id) ?? `Grupo ${id}` }))
  } catch (err) {
    console.warn('Busca de grupos no Bitrix via navegador ignorada (CORS/rede), utilizando grupos monitorados nativos:', err)
    return GRUPOS_MONITORADOS.map((id) => ({ id, nome: `Grupo ${id}` }))
  }
}

