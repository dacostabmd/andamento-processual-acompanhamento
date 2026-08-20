import { chamarMetodo, listarTodasPaginas } from './bitrixTransport'
import {
  DEPARTAMENTO_ID_POR_EQUIPE,
  SUPERVISOR_ID_POR_EQUIPE_FALLBACK,
  type EquipeAtendimento,
} from '../types/domain'

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
 * memória (`fotosPorId`/`cacheSupervisorIdPorEquipe`) já dedupa chamadas
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
    localStorage.setItem(
      chave,
      JSON.stringify({ salvoEm: Date.now(), dados } satisfies CachePersistido<T>),
    )
  } catch {
    // Ignorado de propósito — ver comentário da função.
  }
}

const CHAVE_CACHE_FOTOS = 'dashboard_fotos_colaboradores_v3'

/**
 * Cache POR ID individual (v3) — substitui o v2, que cacheava pela CHAVE do
 * conjunto de IDs pedido. Com ~9 componentes na mesma tela chamando
 * `useFotosColaboradores`, cada um derivando seu próprio subconjunto de IDs
 * (fechador only, responsável only, supervisores, etc.), o cache por conjunto
 * quase nunca batia entre eles — mesmo com 90% de sobreposição de pessoas, um
 * subconjunto diferente já é uma chave de cache diferente, disparando uma nova
 * chamada `user.get` própria. Era isso que causava o cold start relatado pelo
 * usuário: várias buscas de foto concorrentes e redundantes no carregamento
 * inicial, cada uma pagando sua própria latência de rede.
 *
 * `fotosPorId` guarda o que já se sabe (`string` = tem foto, `null` = não tem
 * ou já veio ausente do Bitrix) — nunca refaz a busca de um ID já resolvido.
 * `emVooPromise` agrupa, numa janela de 1 microtask, todos os IDs pedidos por
 * chamadores diferentes no mesmo instante (ex.: 7 componentes montando juntos
 * no primeiro render) numa ÚNICA chamada `user.get` em lote.
 */
const fotosPorId = new Map<number, string | null>()
let idsPendentes = new Set<number>()
let resolucoesPendentes: Array<() => void> = []
let vooEmAndamento: Promise<void> | null = null

import { basePortalUrl } from './bitrixPortal'

export function formatarUrlFoto(urlBruta: string | null | undefined): string | null {
  if (!urlBruta) return null
  const url = String(urlBruta).trim()
  if (!url || url === '0' || url === 'null' || url === 'undefined') return null

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  const base = basePortalUrl()
  const caminho = url.startsWith('/') ? url : `/${url}`
  return `${base}${caminho}`
}

function carregarDoStoragePersistido(): void {
  const doStorage = lerCachePersistido<Record<string, string | null>>(CHAVE_CACHE_FOTOS)
  if (!doStorage) return
  Object.entries(doStorage).forEach(([id, url]) => {
    if (!fotosPorId.has(Number(id))) fotosPorId.set(Number(id), formatarUrlFoto(url))
  })
}

function persistirStorage(): void {
  salvarCachePersistido(CHAVE_CACHE_FOTOS, Object.fromEntries(fotosPorId))
}

/**
 * Busca em lote os IDs ainda não resolvidos em `idsPendentes`. Reentra em si
 * mesma enquanto novos IDs chegarem durante a busca (chamador que apareceu
 * depois do lote já ter partido), garantindo que nenhum pedido concorrente
 * fique esperando por uma rodada seguinte que nunca seria disparada sozinha.
 */
async function resolverPendentes(): Promise<void> {
  while (idsPendentes.size > 0) {
    const lote = Array.from(idsPendentes)
    idsPendentes = new Set()
    const resolucoesDesteLote = resolucoesPendentes
    resolucoesPendentes = []

    try {
      const usuarios = await listarTodasPaginas<UsuarioBitrixApi>('user.get', {
        FILTER: { ID: lote },
      })
      const encontrados = new Set<number>()
      usuarios.forEach((u) => {
        const id = Number(u.ID)
        if (!Number.isFinite(id)) return
        encontrados.add(id)
        fotosPorId.set(id, formatarUrlFoto(u.PERSONAL_PHOTO))
      })
      // IDs pedidos mas ausentes na resposta (usuário inativo/excluído): marca
      // como "sem foto" para não tentar de novo a cada render.
      lote.forEach((id) => {
        if (!encontrados.has(id)) fotosPorId.set(id, null)
      })
      persistirStorage()
    } catch {
      // Falha passageira (rede, fonte indisponível): não marca nada como
      // resolvido, para que uma nova chamada tente de novo depois — mas
      // libera quem está esperando, com o que já se sabia até aqui.
    }

    resolucoesDesteLote.forEach((resolve) => resolve())
  }
  vooEmAndamento = null
}

/**
 * Foto de perfil (PERSONAL_PHOTO) dos usuários do Bitrix24 informados em
 * `idsRelevantes`, por ID — devolve o mapa cumulativo de TODOS os IDs já
 * resolvidos nesta sessão (não só os pedidos agora), então um chamador que
 * pede um subconjunto pequeno já se beneficia do que outro maior resolveu
 * primeiro.
 *
 * IDs desconhecidos entram em `idsPendentes` e são buscados em lote (ver
 * `resolverPendentes`); IDs já em `fotosPorId` (com ou sem foto) nunca geram
 * nova chamada. Cacheado em memória (sessão) e em localStorage (entre
 * sessões, TTL acima). Nunca rejeita: sem fonte Bitrix disponível ou
 * `idsRelevantes` vazio, os avatares caem no fallback de iniciais do
 * `UserAvatar`, não quebram a tela.
 */
export async function obterFotosColaboradores(idsRelevantes: number[]): Promise<Map<number, string>> {
  if (fotosPorId.size === 0) carregarDoStoragePersistido()

  const idsUnicos = idsRelevantes.filter((id) => Number.isFinite(id) && id > 0)
  const idsFaltantes = idsUnicos.filter((id) => !fotosPorId.has(id))

  if (idsFaltantes.length > 0) {
    idsFaltantes.forEach((id) => idsPendentes.add(id))
    const espera = new Promise<void>((resolve) => resolucoesPendentes.push(resolve))
    // `listarTodasPaginas` LANÇA de forma síncrona (não rejeita a Promise)
    // quando não há BX24 nem webhook configurados — só dispara o voo se ainda
    // não houver um em andamento; chamadas concorrentes entram na mesma leva.
    if (!vooEmAndamento) vooEmAndamento = resolverPendentes()
    await espera
  }

  const mapa = new Map<number, string>()
  fotosPorId.forEach((url, id) => {
    if (url) mapa.set(id, url)
  })
  return mapa
}

// v3: v2 podia ter ficado gravado sem Quézia/Lorena (UF_HEAD vazio, sem o
// fallback abaixo) — a troca de chave invalida esse cache antigo de uma vez.
const CHAVE_CACHE_SUPERVISOR_ID = 'dashboard_supervisor_id_por_equipe_v3'

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
 *
 * Quézia Karen e Lorena Pontes nunca tiveram `UF_HEAD` cadastrado nos
 * respectivos departamentos (1418/1416) — não é truncamento de paginação,
 * o campo mesmo vem vazio. `SUPERVISOR_ID_POR_EQUIPE_FALLBACK` cobre os IDs
 * de usuário delas diretamente, aplicado por cima do resultado de
 * `department.get` para as equipes que ele não resolveu.
 */
export function obterSupervisorIdPorEquipe(): Promise<Partial<Record<EquipeAtendimento, number>>> {
  if (cacheSupervisorIdPorEquipe) return cacheSupervisorIdPorEquipe

  const doStorage =
    lerCachePersistido<Partial<Record<EquipeAtendimento, number>>>(CHAVE_CACHE_SUPERVISOR_ID)
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
        const fallback =
          SUPERVISOR_ID_POR_EQUIPE_FALLBACK[
            equipe as keyof typeof SUPERVISOR_ID_POR_EQUIPE_FALLBACK
          ]
        if (head !== undefined) resultado[equipe as EquipeAtendimento] = head
        else if (fallback !== undefined) resultado[equipe as EquipeAtendimento] = fallback
      })
      salvarCachePersistido(CHAVE_CACHE_SUPERVISOR_ID, resultado)
      return resultado
    } catch {
      return {}
    }
  })()
  return cacheSupervisorIdPorEquipe
}
