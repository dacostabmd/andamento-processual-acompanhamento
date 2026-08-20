import { describe, expect, it } from 'vitest'
import {
  projetarMediaMovel,
  projetarMonteCarlo,
  projetarRegressaoLinear,
  type PontoSerieNumerica,
} from './projecaoEstatistica'

describe('projecaoEstatistica', () => {
  const serieExemplo: PontoSerieNumerica[] = [
    { dia: '2026-08-01', valor: 10 },
    { dia: '2026-08-02', valor: 12 },
    { dia: '2026-08-03', valor: 14 },
    { dia: '2026-08-04', valor: 16 },
    { dia: '2026-08-05', valor: 18 },
    { dia: '2026-08-06', valor: 20 },
    { dia: '2026-08-07', valor: 22 },
    { dia: '2026-08-08', valor: 24 },
  ]

  it('projetarRegressaoLinear calcula a tendência linear corretamente', () => {
    const res = projetarRegressaoLinear(serieExemplo, 30)

    expect(res.meta.metodo).toBe('regressao-linear')
    expect(res.meta.amostraDias).toBe(8)
    expect(res.meta.alertaHistoricoCurto).toBe(true) // < 14 dias
    expect(res.projecaoDiaria).toHaveLength(30)
    expect(res.projecaoDiaria[0].dia).toBe('2026-08-09')
    // Com inclinação +2/dia, próximo dia deve ser cerca de 26
    expect(res.projecaoDiaria[0].valorProjetado).toBeGreaterThanOrEqual(25)
    expect(res.projecaoSemanal.length).toBeGreaterThan(0)
  })

  it('projetarMediaMovel mantém a média constante', () => {
    const res = projetarMediaMovel(serieExemplo, 30, 7)

    expect(res.meta.metodo).toBe('media-movel')
    expect(res.meta.amostraDias).toBe(8)
    expect(res.projecaoDiaria).toHaveLength(30)
    // Média dos últimos 7 dias: (12+14+16+18+20+22+24)/7 = 18
    expect(res.projecaoDiaria[0].valorProjetado).toBe(18)
    expect(res.projecaoDiaria[29].valorProjetado).toBe(18)
  })

  it('projetarMonteCarlo calcula cenários P10, P50 e P90', () => {
    const res = projetarMonteCarlo(serieExemplo, 30, 500)

    expect(res.meta.metodo).toBe('monte-carlo')
    expect(res.meta.amostraDias).toBe(8)
    expect(res.projecaoDiaria).toHaveLength(30)
    expect(res.meta.p10Total30Dias).toBeDefined()
    expect(res.meta.p50Total30Dias).toBeDefined()
    expect(res.meta.p90Total30Dias).toBeDefined()

    // Otimista (P90) deve ser >= Conservador (P10)
    expect(res.meta.p90Total30Dias!).toBeGreaterThanOrEqual(res.meta.p10Total30Dias!)
  })
})
