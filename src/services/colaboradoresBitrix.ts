import { chamarMetodo, listarTodasPaginas } from './bitrixTransport'
import { DEPARTAMENTO_ID_POR_EQUIPE, type EquipeAtendimento } from '../types/domain'

interface UsuarioBitrixApi {
  ID: string
  PERSONAL_PHOTO?: string
}

interface DepartamentoBitrixApi {
  ID: string
  UF_HEAD?: string
}

/**
 * Foto de perfil e chefia de departamento mudam raramente (cadastro de
 * pessoa no Bitrix) — persistir em localStorage por algumas horas evita
 * repetir `user.get`/`department.get` (paginados, sobre o portal inteiro) a
 * cada F5/nova aba, que era o que fazia os avatares "aparecerem muito tempo
 * depois" do resto da tela já pronta. Dentro da MESMA aba, o cache em
 * memória (`cacheFotos`/`cacheSupervisorIdPorEquipe`) já dedupa chamadas
 * concorrentes; este é o que sobrevive a um reload.
 */
const TTL_MS = 12 * 60 * 60 * 1000

interface CachePersistido<T> {
  salvoEm: number
  dados: T
}

function lerCachePersistido<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave)
    if (!bruto) return null
    const parsed = JSON.parse(bruto) as CachePersistido<T>
    if (Date.now() - parsed.salvoEm > TTL_MS) return null
    return parsed.dados
  } catch {
    return null
  }
}

/** Nunca lança: cache é otimização, não requisito — quota excedida ou localStorage indisponível segue sem ele. */
function salvarCachePersistido<T>(chave: string, dados: T): void {
  try {
    localStorage.setItem(chave, JSON.stringify({ salvoEm: Date.now(), dados } satisfies CachePersistido<T>))
  } catch {
    // Ignorado de propósito — ver comentário da função.
  }
}

const CHAVE_CACHE_FOTOS = 'dashboard_fotos_colaboradores_v1'

let cacheFotos: Promise<Map<number, string>> | null = null

/**
 * Foto de perfil (PERSONAL_PHOTO) de cada usuário do Bitrix24, por ID.
 *
 * Uma única chamada `user.get` (paginada, mesma fonte ativa — BX24 ou
 * webhook — que o resto do app já usa para identificar o usuário logado),
 * cacheada em memória (sessão) E em localStorage (entre sessões, TTL acima):
 * os avatares de colaboradores e supervisores consultam este mapa em vez de
 * repetir a chamada por card renderizado. Vazio (nunca rejeita) quando a
 * fonte Bitrix não está disponível — os avatares caem no fallback de
 * iniciais do `UserAvatar`, não quebram a tela.
 */
export function obterFotosColaboradores(): Promise<Map<number, string>> {
  if (cacheFotos) return cacheFotos

  const doStorage = lerCachePersistido<Record<string, string>>(CHAVE_CACHE_FOTOS)
  if (doStorage) {
    cacheFotos = Promise.resolve(
      new Map(Object.entries(doStorage).map(([id, url]) => [Number(id), url])),
    )
    return cacheFotos
  }

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
      // Só persiste no SUCESSO: uma falha passageira (rede, rate limit) não
      // pode travar 12h de "sem foto nenhuma" para todo mundo.
      salvarCachePersistido(CHAVE_CACHE_FOTOS, Object.fromEntries(mapa))
      return mapa
    } catch {
      return new Map<number, string>()
    }
  })()
  return cacheFotos
}

// v2: v1 podia ter ficado gravado incompleto (paginação truncada antes da
// correção acima) — a troca de chave invalida esse cache antigo de uma vez.
const CHAVE_CACHE_SUPERVISOR_ID = 'dashboard_supervisor_id_por_equipe_v2'

let cacheSupervisorIdPorEquipe: Promise<Partial<Record<EquipeAtendimento, number>>> | null = null

/**
 * ID do usuário chefe (UF_HEAD) de cada uma das 4 equipes de atendimento,
 * pelo departamento cadastrado em DEPARTAMENTO_ID_POR_EQUIPE.
 *
 * Busca só os 4 departamentos conhecidos (`FILTER: { ID: [...] }`), NÃO uma
 * listagem paginada do portal inteiro (~230 departamentos): medido em
 * produção, a paginação via BX24 (dentro do iframe) estava perdendo os
 * departamentos de Quézia Karen e Lorena Pontes — o head vinha certo para as
 * outras duas equipes, então não era falta de UF_HEAD cadastrado, era a
 * paginação truncando antes de alcançá-los. Filtrar pelos 4 IDs exatos
 * elimina a paginação dessa chamada por completo.
 *
 * Resolvido via `department.get` (não a partir das tarefas carregadas):
 * assim a supervisora aparece mesmo quando a equipe dela não tem nenhuma
 * tarefa no recorte de filtros atual. Mesmo cache em duas camadas (memória +
 * localStorage) de `obterFotosColaboradores`.
 */
export function obterSupervisorIdPorEquipe(): Promise<Partial<Record<EquipeAtendimento, number>>> {
  if (cacheSupervisorIdPorEquipe) return cacheSupervisorIdPorEquipe

  const doStorage = lerCachePersistido<Partial<Record<EquipeAtendimento, number>>>(
    CHAVE_CACHE_SUPERVISOR_ID,
  )
  if (doStorage) {
    cacheSupervisorIdPorEquipe = Promise.resolve(doStorage)
    return cacheSupervisorIdPorEquipe
  }

  // Mesmo motivo do try/catch em `obterFotosColaboradores`: `chamarMetodo`
  // lança de forma síncrona sem fonte Bitrix configurada, e só a IIFE `async`
  // converte isso numa rejeição capturável.
  cacheSupervisorIdPorEquipe = (async () => {
    try {
      const idsConhecidos = Object.values(DEPARTAMENTO_ID_POR_EQUIPE)
      const departamentos = await chamarMetodo<DepartamentoBitrixApi[]>('department.get', {
        FILTER: { ID: idsConhecidos },
      })
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
      salvarCachePersistido(CHAVE_CACHE_SUPERVISOR_ID, resultado)
      return resultado
    } catch {
      return {}
    }
  })()
  return cacheSupervisorIdPorEquipe
}
