import { describe, expect, it } from 'vitest'
import type { PerfilVisibilidadeMetricas } from '../types/domain'

describe('VisibilidadeMetricas Logic', () => {
  const perfisExemplo: PerfilVisibilidadeMetricas[] = [
    {
      id: 1,
      cargoRole: 'ceo',
      descricao: 'CEO',
      updatedAt: '2026-08-20',
      atualizadoPor: 'sistema',
      permissoes: {
        faturamentoVigente: true,
        detalhamentoAsaas: true,
        rankingFechadores: true,
        desempenhoIndividual: true,
        projecaoMonteCarlo: true,
        projecaoRegressaoLinear: true,
        projecaoMediaMovel: true,
        gestaoEquipes: true,
        auditoriaAlteracoes: true,
      },
    },
    {
      id: 2,
      cargoRole: 'operacional',
      descricao: 'Operacional',
      updatedAt: '2026-08-20',
      atualizadoPor: 'sistema',
      permissoes: {
        faturamentoVigente: false,
        detalhamentoAsaas: false,
        rankingFechadores: true,
        desempenhoIndividual: false,
        projecaoMonteCarlo: false,
        projecaoRegressaoLinear: false,
        projecaoMediaMovel: true,
        gestaoEquipes: false,
        auditoriaAlteracoes: false,
      },
    },
  ]

  it('CEO possui visibilidade total de métricas financeiras e individuais', () => {
    const ceo = perfisExemplo.find((p) => p.cargoRole === 'ceo')
    expect(ceo).toBeDefined()
    expect(ceo?.permissoes.faturamentoVigente).toBe(true)
    expect(ceo?.permissoes.desempenhoIndividual).toBe(true)
  })

  it('Operacional possui faturamento desativado por padrão', () => {
    const op = perfisExemplo.find((p) => p.cargoRole === 'operacional')
    expect(op).toBeDefined()
    expect(op?.permissoes.faturamentoVigente).toBe(false)
    expect(op?.permissoes.desempenhoIndividual).toBe(false)
    expect(op?.permissoes.rankingFechadores).toBe(true)
  })
})
