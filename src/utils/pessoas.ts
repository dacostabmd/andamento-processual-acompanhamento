import { EQUIPES_ATENDIMENTO, type EquipeAtendimento } from '../types/domain'

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

/** `true` se o usuário for o administrador Caio Marques (acesso total às equipes). */
export function ehCaioMarques(nome: string | null | undefined): boolean {
  if (!nome) return false
  const alvo = normalizar(nome)
  return alvo.includes('caio marques') || alvo.includes('caio')
}

