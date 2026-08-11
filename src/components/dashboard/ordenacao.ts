import { useCallback, useState } from 'react'

export type DirecaoOrdem = 'asc' | 'desc'

export interface EstadoOrdem<C extends string> {
  chave: C
  direcao: DirecaoOrdem
}

/**
 * Comparadores e estado de ordenação compartilhados pelas tabelas do painel
 * (ranking de fechamento e modal de tarefas da pessoa).
 *
 * Regra que vale para todos: valor AUSENTE fica no fim em qualquer direção.
 * "sem prazo", "sem setor" e "não cadastrado" são falta de dado, não um extremo
 * da escala — se fossem tratados como zero, ordenar por prazo crescente encheria
 * a primeira tela justamente com as linhas que não têm prazo.
 */

// `sensitivity: 'base'` ignora acento e caixa (José ~ jose); `numeric` faz
// "Sala 2" vir antes de "Sala 10".
const COLADOR = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

export function compararNumero(
  a: number | null | undefined,
  b: number | null | undefined,
  direcao: DirecaoOrdem,
): number {
  const na = typeof a === 'number' && Number.isFinite(a) ? a : null
  const nb = typeof b === 'number' && Number.isFinite(b) ? b : null
  if (na === null || nb === null) {
    if (na === nb) return 0
    return na === null ? 1 : -1
  }
  return direcao === 'asc' ? na - nb : nb - na
}

export function compararTexto(
  a: string | null | undefined,
  b: string | null | undefined,
  direcao: DirecaoOrdem,
): number {
  const ta = typeof a === 'string' && a.trim() !== '' ? a : null
  const tb = typeof b === 'string' && b.trim() !== '' ? b : null
  if (ta === null || tb === null) {
    if (ta === tb) return 0
    return ta === null ? 1 : -1
  }
  const resultado = COLADOR.compare(ta, tb)
  return direcao === 'asc' ? resultado : -resultado
}

function paraInstante(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

/** Datas ISO do Bitrix. Compara pelo instante, não pelo texto — o fuso varia. */
export function compararData(
  a: string | null | undefined,
  b: string | null | undefined,
  direcao: DirecaoOrdem,
): number {
  return compararNumero(paraInstante(a), paraInstante(b), direcao)
}

/**
 * Estado de ordenação de uma tabela.
 *
 * `alternar` inverte a direção quando a coluna já está ativa e, ao trocar de
 * coluna, começa pela direção mais útil daquela coluna — quem clica em
 * "Fechados" quer o maior primeiro, quem clica em "Pessoa" quer A–Z.
 */
export function useOrdenacaoTabela<C extends string>(inicial: EstadoOrdem<C>) {
  const [ordem, setOrdem] = useState<EstadoOrdem<C>>(inicial)

  const alternar = useCallback((chave: C, direcaoInicial: DirecaoOrdem = 'asc') => {
    setOrdem((atual) =>
      atual.chave === chave
        ? { chave, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { chave, direcao: direcaoInicial },
    )
  }, [])

  return { ordem, setOrdem, alternar }
}
