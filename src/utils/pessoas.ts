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
 * `true` se o usuário for o administrador Caio Marques ou um dos IDs em
 * IDS_SUPERUSUARIOS (acesso total às 4 equipes). Reconhecimento por ID é
 * preferido por ser estável a variações de nome/acento; nome fica como
 * fallback para o próprio Caio Marques (sem ID cadastrado aqui).
 */
export function ehCaioMarques(
  nome: string | null | undefined,
  id?: number | null,
): boolean {
  if (id != null && IDS_SUPERUSUARIOS.has(id)) return true
  if (!nome) return false
  const alvo = normalizar(nome)
  return alvo.includes('caio marques') || alvo.includes('caio')
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

