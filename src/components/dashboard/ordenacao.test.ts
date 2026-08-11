import { describe, expect, it } from 'vitest'
import { compararData, compararNumero, compararTexto, type DirecaoOrdem } from './ordenacao'

function ordenar<T>(itens: T[], comparar: (a: T, b: T) => number): T[] {
  return [...itens].sort(comparar)
}

describe('compararNumero', () => {
  it('ordena crescente e decrescente', () => {
    expect(ordenar([3, 1, 2], (a, b) => compararNumero(a, b, 'asc'))).toEqual([1, 2, 3])
    expect(ordenar([3, 1, 2], (a, b) => compararNumero(a, b, 'desc'))).toEqual([3, 2, 1])
  })

  it('mantém ausentes no fim nas DUAS direções', () => {
    const valores: Array<number | null> = [5, null, 1]
    expect(ordenar(valores, (a, b) => compararNumero(a, b, 'asc'))).toEqual([1, 5, null])
    expect(ordenar(valores, (a, b) => compararNumero(a, b, 'desc'))).toEqual([5, 1, null])
  })

  it('trata NaN/Infinity como ausente, não como extremo da escala', () => {
    expect(compararNumero(Number.NaN, 10, 'asc')).toBeGreaterThan(0)
    expect(compararNumero(Number.POSITIVE_INFINITY, 10, 'desc')).toBeGreaterThan(0)
  })

  it('empate devolve 0 para o desempate do chamador assumir', () => {
    expect(compararNumero(7, 7, 'asc')).toBe(0)
    expect(compararNumero(null, null, 'desc')).toBe(0)
  })
})

describe('compararTexto', () => {
  it('ignora acento e caixa', () => {
    expect(compararTexto('José', 'jose', 'asc')).toBe(0)
    expect(ordenar(['Ática', 'abel', 'Zeca'], (a, b) => compararTexto(a, b, 'asc'))).toEqual([
      'abel',
      'Ática',
      'Zeca',
    ])
  })

  it('ordena número dentro do texto por valor, não por dígito', () => {
    expect(ordenar(['Sala 10', 'Sala 2'], (a, b) => compararTexto(a, b, 'asc'))).toEqual([
      'Sala 2',
      'Sala 10',
    ])
  })

  it('trata nulo e string vazia/em branco como ausente, sempre no fim', () => {
    const valores: Array<string | null> = ['Ana', null, '   ', 'Bruno']
    expect(ordenar(valores, (a, b) => compararTexto(a, b, 'asc')).slice(0, 2)).toEqual([
      'Ana',
      'Bruno',
    ])
    expect(ordenar(valores, (a, b) => compararTexto(a, b, 'desc')).slice(0, 2)).toEqual([
      'Bruno',
      'Ana',
    ])
  })
})

describe('compararData', () => {
  const cedo = '2026-08-10T09:29:00+03:00'
  const tarde = '2026-08-10T10:54:00+03:00'

  it('ordena pelo instante', () => {
    expect(compararData(cedo, tarde, 'asc')).toBeLessThan(0)
    expect(compararData(cedo, tarde, 'desc')).toBeGreaterThan(0)
  })

  it('compara instantes, não texto — fusos diferentes na mesma hora local', () => {
    // 12:00 em -03:00 é DEPOIS de 12:00 em +03:00, mas o texto diria o contrário.
    const brasilia = '2026-08-10T12:00:00-03:00'
    const moscou = '2026-08-10T12:00:00+03:00'
    expect(compararData(moscou, brasilia, 'asc')).toBeLessThan(0)
  })

  it('tarefa sem prazo/sem finalização fica no fim nas duas direções', () => {
    const valores: Array<string | null> = [tarde, null, cedo]
    for (const direcao of ['asc', 'desc'] as DirecaoOrdem[]) {
      expect(ordenar(valores, (a, b) => compararData(a, b, direcao)).at(-1)).toBeNull()
    }
  })

  it('data inválida conta como ausente', () => {
    expect(compararData('nao-e-data', cedo, 'asc')).toBeGreaterThan(0)
  })
})
