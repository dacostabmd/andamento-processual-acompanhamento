import { useCallback, useEffect, useState } from 'react'
import { listarPermissoesMetricas } from '../services/permissoesApi'
import type { CargoRole, Colaborador, PerfilVisibilidadeMetricas, PermissoesMetricas } from '../types/domain'

const PERMISSOES_PADRAO_TOTAL: PermissoesMetricas = {
  faturamentoVigente: true,
  detalhamentoAsaas: true,
  rankingFechadores: true,
  desempenhoIndividual: true,
  projecaoMonteCarlo: true,
  projecaoRegressaoLinear: true,
  projecaoMediaMovel: true,
  gestaoEquipes: true,
  auditoriaAlteracoes: true,
}

export function useVisibilidadeMetricas(colaborador: Colaborador | null, cargoRoleSelecionado?: CargoRole) {
  const [perfis, setPerfis] = useState<PerfilVisibilidadeMetricas[]>([])
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    try {
      const dados = await listarPermissoesMetricas()
      setPerfis(dados.perfis)
    } catch {
      // Em caso de erro de rede, assume permissões totais para não bloquear UI
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Infere o cargo/role do usuário caso não informado
  const roleEfetivo: CargoRole = cargoRoleSelecionado ?? 'ceo'

  const perfilAtual = perfis.find((p) => p.cargoRole === roleEfetivo)
  const permissoes: PermissoesMetricas = perfilAtual?.permissoes ?? PERMISSOES_PADRAO_TOTAL

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
