import { EQUIPES_ATENDIMENTO, type EquipeAtendimento, type Tarefa } from '../types/domain'

/**
 * Quem é, e quem NÃO é, uma pessoa nos dados de tarefa.
 *
 * O worker grava `responsavelAtendimentoNome = 'Responsável Indefinido'` (com
 * `responsavelAtendimentoId = null`) quando nenhum atendente real pode ser
 * identificado no card — é um RÓTULO DE AUSÊNCIA para os gráficos, não um nome.
 * Ver worker-nodejs-andamento/src/triagem.ts.
 *
 * O problema medido em produção: como o rótulo é uma string igual a qualquer
 * outra, ele entrava nos agrupamentos por pessoa como se fosse uma. E como a
 * maioria dos cards abertos não tem atendente identificável, esse balde GANHAVA
 * de todo mundo — o assistente respondeu "o responsável com mais tarefas
 * vencendo hoje é 'Responsável Indefinido', com 4.375 tarefas".
 *
 * Uma ausência não pode vencer um ranking de pessoas. Toda contagem "por
 * pessoa" tem de passar por aqui antes de agrupar, ranquear ou citar um nome.
 */

/** O rótulo exato que o worker grava. Mantido em sincronia com a triagem. */
export const ROTULO_SEM_RESPONSAVEL = 'Responsável Indefinido'

/** Como exibir a ausência quando ela precisa aparecer (nunca como nome). */
export const ROTULO_AUSENCIA_LEGIVEL = 'sem responsável identificado'

/**
 * Valores que NÃO são nome de pessoa: o rótulo do worker, os placeholders que
 * já circulam no código ("Não informado") e os vazamentos clássicos de variável
 * ausente ("undefined", "null") — se um dia um deles chegar do backend, é bug,
 * e virar linha de ranking esconderia o bug atrás de um número plausível.
 */
const NAO_SAO_PESSOAS = new Set([
  'responsavel indefinido',
  'indefinido',
  'nao informado',
  'nao atribuido',
  'nao atribuida',
  'sem responsavel',
  'bmd automacoes',
  'bmd automacões',
  'bmd automaçoes',
  'bmd automacoes ',
  'undefined',
  'null',
  'n/a',
  '-',
])

function normalizar(nome: string): string {
  return nome.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** `true` só quando o valor identifica uma pessoa de verdade. */
export function ehNomeDePessoa(nome: string | null | undefined): boolean {
  if (typeof nome !== 'string') return false
  const limpo = normalizar(nome)
  return limpo !== '' && !NAO_SAO_PESSOAS.has(limpo)
}

/** O nome, ou `null` se for rótulo de ausência — pronto para `?? fallback`. */
export function nomeDePessoaOuNulo(nome: string | null | undefined): string | null {
  return ehNomeDePessoa(nome) ? (nome as string) : null
}

/**
 * Equipe cujo nome de supervisora (ver EQUIPES_ATENDIMENTO) bate com o nome
 * informado, ignorando acento/caixa. As 4 equipes são batizadas com o nome da
 * própria supervisora, então reconhecer o usuário logado no Bitrix como
 * supervisor(a) é comparar o nome dele contra essa lista — não depende de
 * UF_HEAD, que não está cadastrado para Lorena e Quézia no Bitrix.
 */
export function equipeSupervisionadaPeloNome(
  nome: string | null | undefined,
): EquipeAtendimento | null {
  if (!nome) return null
  const alvo = normalizar(nome)
  return EQUIPES_ATENDIMENTO.find((equipe) => normalizar(equipe) === alvo) ?? null
}

/**
 * IDs de usuário Bitrix com acesso de superusuário (veem as 4 equipes, igual
 * ao Caio Marques): Handerson (9129) e Hellen Gomes (26471), liberados a
 * pedido do usuário em 2026-08-14.
 */
const IDS_SUPERUSUARIOS = new Set([9129, 26471])

/**
 * Um "slot" de supervisor exibido nos ícones do canto superior esquerdo —
 * camada de APRESENTAÇÃO sobre EQUIPES_ATENDIMENTO, não um dado novo.
 *
 * Cinthia Filgueiras e Simone Freitas foram desligadas em 2026-08-18; Handerson
 * Salles assume o setor delas até segunda ordem. Por pedido explícito do
 * usuário, isso NÃO mexe em departamento/UF_HEAD/equipe_atendimento — os dados
 * e o histórico de cada uma das duas equipes continuam exatamente como são
 * hoje (cada colaborador com o mesmo departamento). O que muda é só a vitrine:
 * um slot "Handerson Salles" que reúne visualmente as duas equipes antigas num
 * ícone e painel só, ao lado dos slots (inalterados) de Quézia Karen e Lorena
 * Pontes.
 */
export interface SlotSupervisor {
  chave: string
  rotulo: string
  equipes: readonly EquipeAtendimento[]
  /** ID Bitrix fixo para a foto do ícone — só o slot do Handerson precisa, pois
   * ele não é o UF_HEAD de nenhuma das duas equipes (ver useSupervisorIdPorEquipe). */
  fotoUsuarioId?: number
}

export const SLOTS_SUPERVISOR: readonly SlotSupervisor[] = [
  {
    chave: 'handerson',
    rotulo: 'Handerson Salles',
    equipes: ['Cinthia Filgueiras', 'Simone Freitas'],
    fotoUsuarioId: 9129,
  },
  { chave: 'quezia-karen', rotulo: 'Quézia Karen', equipes: ['Quézia Karen'] },
  { chave: 'lorena-pontes', rotulo: 'Lorena Pontes', equipes: ['Lorena Pontes'] },
]

/**
 * Slot cujo rótulo bate com o nome informado — reconhecimento por nome do
 * usuário logado, equivalente a `equipeSupervisionadaPeloNome` mas para a
 * vitrine dos 3 slots (inclui "Handerson" sozinho, já que o rótulo completo é
 * "Handerson Salles" e o Bitrix pode devolver o nome de formas diferentes).
 *
 * Não reaproveita `equipeSupervisionadaPeloNome`: aquela função também resolve
 * a equipe de uma tarefa em `equipeExecutoraDaTarefa` (tarefasMetrics.ts) — é
 * lógica de métrica ativa que o pedido do usuário foi explícito em não tocar.
 */
export function identificarSlotSupervisorPeloNome(
  nome: string | null | undefined,
): SlotSupervisor | null {
  if (!nome) return null
  const alvo = normalizar(nome)
  if (alvo.includes('handerson')) return SLOTS_SUPERVISOR[0]
  return SLOTS_SUPERVISOR.find((slot) => normalizar(slot.rotulo) === alvo) ?? null
}

/**
 * `true` se o usuário for o administrador Caio Marques ou um dos IDs em
 * IDS_SUPERUSUARIOS (acesso total às 4 equipes). Reconhecimento por ID é
 * preferido por ser estável a variações de nome/acento; nome fica como
 * fallback para o próprio Caio Marques (sem ID cadastrado aqui).
 */
export function ehCaioMarques(nome: string | null | undefined, id?: number | null): boolean {
  if (id != null && IDS_SUPERUSUARIOS.has(id)) return true
  if (!nome) return false
  const alvo = normalizar(nome)
  return alvo.includes('caio marques') || alvo.includes('caio')
}

/**
 * Quem pode abrir a tela de configurações e editar o cadastro de pessoas:
 * Caio Marques, Handerson, Hellen, e as 4 supervisoras (Lorena Pontes, Simone
 * Freitas, Quézia Karen, Cinthia Filgueiras).
 *
 * Esta lista serve APENAS para decidir se o ícone de engrenagem aparece. A
 * permissão de verdade é conferida no worker (IDS_GESTAO_CADASTRO /
 * NOMES_GESTAO_CADASTRO em config.ts, aplicada por `exigirGestaoCadastro`):
 * esconder o botão impede o clique acidental, não a requisição. O worker também
 * responde `POST /pessoas/permissao`, que é o que a tela usa para não oferecer
 * edição a quem levaria 403 ao salvar.
 *
 * Por ID quando conhecido, por nome como retaguarda — mesma estratégia de
 * `ehCaioMarques`, e pelo mesmo motivo: nem todos os IDs estão confirmados.
 */
const IDS_GESTAO_CADASTRO = new Set([
  178968, // Caio Marques (lido de user.current contra o portal em 2026-08-14)
  9129, // Handerson
  26471, // Hellen Gomes
  1205, // Quézia Karen
  999, // Lorena Pontes
])

/**
 * Quem pode ABRIR o log de auditoria: só Caio Marques (ID 178968), por pedido do
 * usuário.
 *
 * Lista separada da de gestão de propósito, e mais restrita: o log registra quem
 * mexeu no quê, e quem é auditado não é a mesma população de quem audita. Como no
 * caso da engrenagem, isto decide apenas se o ícone aparece — a permissão de
 * verdade está em IDS_AUDITORIA_CADASTRO no worker, aplicada por `exigirAuditoria`,
 * e a tela reconfere via `POST /pessoas/permissao`.
 */
const ID_AUDITORIA = 178968

export function podeAuditarCadastro(nome: string | null | undefined, id?: number | null): boolean {
  if (id != null) return id === ID_AUDITORIA
  if (!nome) return false
  // Sem ID, exige o nome completo: 'caio' sozinho casaria com outros colaboradores
  // (há um Caio Araujo nos dados), e o log de auditoria é justamente o que não
  // deve abrir por semelhança de nome.
  return normalizar(nome).includes('caio marques')
}

const NOMES_GESTAO_CADASTRO = [
  'caio marques',
  'handerson',
  'hellen',
  'lorena pontes',
  'simone freitas',
  'quezia karen',
  'cinthia filgueiras',
]

export function podeGerenciarCadastro(
  nome: string | null | undefined,
  id?: number | null,
): boolean {
  if (id != null && IDS_GESTAO_CADASTRO.has(id)) return true
  if (!nome) return false
  const alvo = normalizar(nome)
  return NOMES_GESTAO_CADASTRO.some((permitido) => alvo === permitido || alvo.includes(permitido))
}

/**
 * IDs de usuário do Bitrix que aparecem em algum papel de pessoa nas tarefas
 * informadas (fechador, responsável, atendimento, gestor de cada um). É o
 * conjunto que os avatares de colaborador precisam resolver — usado para
 * restringir `user.get` a essas pessoas em vez de paginar o portal inteiro
 * (ver `obterFotosColaboradores` em colaboradoresBitrix.ts).
 */
export function idsColaboradoresDasTarefas(tarefas: Tarefa[]): number[] {
  const ids = new Set<number>()
  tarefas.forEach((t) => {
    ;[
      t.fechadoPorId,
      t.responsavelId,
      t.responsavelAtendimentoId,
      t.gestorFechadorId,
      t.gestorAtendimentoId,
    ].forEach((id) => {
      if (id !== null) ids.add(id)
    })
  })
  return Array.from(ids)
}

/**
 * Permissão para visualizar/gerenciar observações e comentários do perfil avançado do colaborador.
 * Permitidos:
 *  - Bruno Durão (ID: 1)
 *  - Caio Marques
 *  - Handerson Salles (ID: 9129)
 *  - Hellen / Helen Gomes (ID: 26471)
 *  - Supervisores de Equipe (Quézia Karen, Lorena Pontes, Simone Freitas, Cinthia Filgueiras)
 */
export function podeVerComentariosPerfilColaborador(
  nome: string | null | undefined,
  id?: number | null,
): boolean {
  if (id === 1) return true
  if (id != null && (IDS_SUPERUSUARIOS.has(id) || IDS_GESTAO_CADASTRO.has(id))) return true
  if (!nome) return false
  const alvo = normalizar(nome)
  if (
    alvo.includes('bruno durao') ||
    alvo.includes('caio marques') ||
    alvo.includes('handerson') ||
    alvo.includes('helen') ||
    alvo.includes('hellen') ||
    alvo.includes('quezia') ||
    alvo.includes('lorena') ||
    alvo.includes('simone') ||
    alvo.includes('cinthia')
  ) {
    return true
  }
  return (
    equipeSupervisionadaPeloNome(nome) !== null || identificarSlotSupervisorPeloNome(nome) !== null
  )
}

/**
 * IDs Bitrix confirmados dos 6 administradores que podem configurar o Perfil
 * de Colaborador (select de equipe, multiselect de departamentos de estado):
 * Handerson (9129), Caio Marques (178968), Helen/Hellen Gomes (26471) e Lorena
 * Pontes (999) — os mesmos de IDS_GESTAO_CADASTRO. Caio Araujo e Bruno Durão
 * não têm ID confirmado no código e entram só por nome, abaixo.
 */
const IDS_CONFIG_PERFIL_COLABORADOR = new Set([9129, 178968, 26471, 999])

const NOMES_CONFIG_PERFIL_COLABORADOR = [
  'handerson',
  'caio marques',
  'helen gomes',
  'hellen gomes',
  'caio araujo',
  'bruno durao',
  'lorena pontes',
]

/**
 * Quem pode configurar o Perfil de Colaborador: Handerson, Caio Marques, Helen
 * Gomes, Caio Araujo, Bruno Durão e Lorena Pontes — lista PRÓPRIA dada pelo
 * usuário, parecida com `podeGerenciarCadastro` mas não igual (inclui Caio
 * Araujo e Bruno Durão, que não gerem equipes completas; não inclui Quézia,
 * Simone e Cinthia). Só decide se os dois controles aparecem — a permissão de
 * verdade é conferida no worker por `exigirGestaoCadastroOuConfigPerfil`
 * (IDS_CONFIG_PERFIL_COLABORADOR / NOMES_CONFIG_PERFIL_COLABORADOR em
 * config.ts), e a tela reconfere via `POST /pessoas/permissao`
 * (`podeConfigurarPerfil`).
 *
 * Exige o nome completo ("caio araujo", não só "caio"): sem isso, "caio"
 * sozinho casaria com Caio Marques também, e os dois administradores têm
 * permissões diferentes em outras telas.
 */
export function podeConfigurarPerfilColaborador(
  nome: string | null | undefined,
  id?: number | null,
): boolean {
  if (id != null && IDS_CONFIG_PERFIL_COLABORADOR.has(id)) return true
  if (!nome) return false
  const alvo = normalizar(nome)
  return NOMES_CONFIG_PERFIL_COLABORADOR.some(
    (permitido) => alvo === permitido || alvo.includes(permitido),
  )
}
