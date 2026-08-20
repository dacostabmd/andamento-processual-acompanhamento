import { useCallback, useEffect, useState } from 'react'
import { listarPermissoesMetricas } from '../services/permissoesApi'
import type { CargoRole, Colaborador, PerfilVisibilidadeMetricas, PermissoesMetricas } from '../types/domain'

const CHAVE_STORAGE_PERMISSOES = 'dashboard_visibilidade_metricas_v1'

const PERFIS_PADRAO: PerfilVisibilidadeMetricas[] = [
  {
    id: 1,
    cargoRole: 'ceo',
    descricao: 'CEO / Alta Gestão',
    updatedAt: new Date().toISOString(),
    atualizadoPor: 'Sistema',
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
    cargoRole: 'diretor',
    descricao: 'Diretoria Executiva',
    updatedAt: new Date().toISOString(),
    atualizadoPor: 'Sistema',
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
    id: 3,
    cargoRole: 'coordenador',
    descricao: 'Coordenação de Equipes',
    updatedAt: new Date().toISOString(),
    atualizadoPor: 'Sistema',
    permissoes: {
      faturamentoVigente: false,
      detalhamentoAsaas: false,
      rankingFechadores: true,
      desempenhoIndividual: true,
      projecaoMonteCarlo: true,
      projecaoRegressaoLinear: true,
      projecaoMediaMovel: true,
      gestaoEquipes: true,
      auditoriaAlteracoes: false,
    },
  },
  {
    id: 4,
    cargoRole: 'operacional',
    descricao: 'Operacional / Analistas',
    updatedAt: new Date().toISOString(),
    atualizadoPor: 'Sistema',
    permissoes: {
      faturamentoVigente: false,
      detalhamentoAsaas: false,
      rankingFechadores: true,
      desempenhoIndividual: true,
      projecaoMonteCarlo: false,
      projecaoRegressaoLinear: false,
      projecaoMediaMovel: false,
      gestaoEquipes: false,
      auditoriaAlteracoes: false,
    },
  },
]

function carregarDoStorage(): PerfilVisibilidadeMetricas[] {
  try {
    const salvo = localStorage.getItem(CHAVE_STORAGE_PERMISSOES)
    if (salvo) {
      const parsed = JSON.parse(salvo)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // Ignorado
  }
  return PERFIS_PADRAO
}

export function useVisibilidadeMetricas(_colaborador: Colaborador | null, cargoRoleSelecionado?: CargoRole) {
  const [perfis, setPerfis] = useState<PerfilVisibilidadeMetricas[]>(() => carregarDoStorage())
  const [carregando, setCarregando] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const dados = await listarPermissoesMetricas()
      setPerfis(dados.perfis)
      try {
        localStorage.setItem(CHAVE_STORAGE_PERMISSOES, JSON.stringify(dados.perfis))
      } catch {
        // Ignorado
      }
    } catch {
      // Em caso de erro de rede, mantem perfis padrao sem quebrar a UI
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const roleEfetivo: CargoRole = cargoRoleSelecionado ?? 'ceo'
  const perfilAtual = perfis.find((p) => p.cargoRole === roleEfetivo)
  const permissoes: PermissoesMetricas = perfilAtual?.permissoes ?? PERFIS_PADRAO[0].permissoes

  return {
    perfis,
    permissoes,
    carregando,
    recarregar,
    podeVerFaturamento: permissoes.faturamentoVigente,
    podeVerDetalhamentoAsaas: permissoes.detalhamentoAsaas,
    podeVerRankingFechadores: permissoes.rankingFechadores,
    podeVerDesempenhoIndividual: permissoes.desempenhoIndividual,
    podeVerProjecaoMonteCarlo: permissoes.projecaoMonteCarlo,
    podeVerProjecaoRegressaoLinear: permissoes.projecaoRegressaoLinear,
    podeVerProjecaoMediaMovel: permissoes.projecaoMediaMovel,
    podeVerGestaoEquipes: permissoes.gestaoEquipes,
    podeVerAuditoriaAlteracoes: permissoes.auditoriaAlteracoes,
  }
}
