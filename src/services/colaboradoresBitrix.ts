import { listarTodasPaginas } from './bitrixTransport'
import { DEPARTAMENTO_ID_POR_EQUIPE, type EquipeAtendimento } from '../types/domain'

interface UsuarioBitrixApi {
  ID: string
  PERSONAL_PHOTO?: string
}

interface DepartamentoBitrixApi {
  ID: string
  UF_HEAD?: string
}

let cacheFotos: Promise<Map<number, string>> | null = null

/**
 * Foto de perfil (PERSONAL_PHOTO) de cada usuário do Bitrix24, por ID.
 *
 * Uma única chamada `user.get` (paginada, mesma fonte ativa — BX24 ou
 * webhook — que o resto do app já usa para identificar o usuário logado),
 * cacheada para a sessão inteira: os avatares de colaboradores e supervisores
 * consultam este mapa em vez de repetir a chamada por card renderizado.
 * Vazio (nunca rejeita) quando a fonte Bitrix não está disponível — os
 * avatares caem no fallback de iniciais do `UserAvatar`, não quebram a tela.
 */
export function obterFotosColaboradores(): Promise<Map<number, string>> {
  if (!cacheFotos) {
    // `listarTodasPaginas` LANÇA de forma síncrona (não rejeita a Promise)
    // quando não há BX24 nem webhook configurados — encadear só `.catch()`
    // nunca chegaria a rodar, porque o erro escapa antes do `.then` ser
    // registrado. O `try` dentro da IIFE `async` é o que converte esse throw
    // síncrono numa rejeição de fato capturável.
    cacheFotos = (async () => {
      try {
        const usuarios = await listarTodasPaginas<UsuarioBitrixApi>('user.get')
        const mapa = new Map<number, string>()
        usuarios.forEach((u) => {
          const id = Number(u.ID)
          if (Number.isFinite(id) && u.PERSONAL_PHOTO) mapa.set(id, u.PERSONAL_PHOTO)
        })
        return mapa
      } catch {
        return new Map<number, string>()
      }
    })()
  }
  return cacheFotos
}

let cacheSupervisorIdPorEquipe: Promise<Partial<Record<EquipeAtendimento, number>>> | null = null

/**
 * ID do usuário chefe (UF_HEAD) de cada uma das 4 equipes de atendimento,
 * pelo departamento cadastrado em DEPARTAMENTO_ID_POR_EQUIPE.
 *
 * Resolvido via `department.get` (não a partir das tarefas carregadas):
 * assim a supervisora aparece mesmo quando a equipe dela não tem nenhuma
 * tarefa no recorte de filtros atual.
 */
export function obterSupervisorIdPorEquipe(): Promise<Partial<Record<EquipeAtendimento, number>>> {
  if (!cacheSupervisorIdPorEquipe) {
    // Mesmo motivo do try/catch em `obterFotosColaboradores`: `listarTodasPaginas`
    // lança de forma síncrona sem fonte Bitrix configurada, e só a IIFE `async`
    // converte isso numa rejeição capturável.
    cacheSupervisorIdPorEquipe = (async () => {
      try {
        const departamentos = await listarTodasPaginas<DepartamentoBitrixApi>('department.get')
        const headPorDepartamentoId = new Map<number, number>()
        departamentos.forEach((d) => {
          const id = Number(d.ID)
          const head = d.UF_HEAD ? Number(d.UF_HEAD) : NaN
          if (Number.isFinite(id) && Number.isFinite(head)) headPorDepartamentoId.set(id, head)
        })

        const resultado: Partial<Record<EquipeAtendimento, number>> = {}
        Object.entries(DEPARTAMENTO_ID_POR_EQUIPE).forEach(([equipe, departamentoId]) => {
          const head = headPorDepartamentoId.get(departamentoId)
          if (head !== undefined) resultado[equipe as EquipeAtendimento] = head
        })
        return resultado
      } catch {
        return {}
      }
    })()
  }
  return cacheSupervisorIdPorEquipe
}
