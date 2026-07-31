import { Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import { EstadoVazio } from '../components/EstadoVazio'
import { ThemeToggle } from '../components/ThemeToggle'
import { AiAssistantChat } from '../components/dashboard/AiAssistantChat'
import { DebugBitrixPanel } from '../components/dashboard/DebugBitrixPanel'
import { FiltrosPainel } from '../components/dashboard/FiltrosPainel'
import { GraficosInteligencia } from '../components/dashboard/GraficosInteligencia'
import { MetricasCards } from '../components/dashboard/MetricasCards'
import { NavbarVisualizacoes } from '../components/dashboard/NavbarVisualizacoes'
import { RankingFechadores } from '../components/dashboard/RankingFechadores'
import { VERSAO_ATUAL, VersaoModal } from '../components/dashboard/VersaoModal'
import { useSessaoUsuario } from '../hooks/useSessaoUsuario'
import {
  obterMetricasFiltradas,
  obterMetricasPorEquipeFiltradas,
  obterPacotesAtendimento,
  obterRankingFechadores,
} from '../services/dashboardService'
import {
  filtrosVazios,
  type FiltrosDashboard,
  type MetricasPorEquipe,
  type MetricasTarefas,
  type PacoteAtendimento,
  type RankingFechadores as DadosRankingFechadores,
  type VisaoDashboard,
} from '../types/domain'
import classes from './DashboardPage.module.css'

export function DashboardPage() {
  const { estado, projetosPermitidos, mensagemErro } = useSessaoUsuario()

  const [filtros, setFiltros] = useState<FiltrosDashboard>(() => filtrosVazios(new Date()))
  const [visao, setVisao] = useState<VisaoDashboard>('atendimento')
  const [metricas, setMetricas] = useState<MetricasTarefas | null>(null)
  const [metricasPorEquipe, setMetricasPorEquipe] = useState<MetricasPorEquipe[]>([])
  const [pacotes, setPacotes] = useState<PacoteAtendimento[] | null>(null)
  const [rankingFechadores, setRankingFechadores] = useState<DadosRankingFechadores | null>(null)
  const [erroDados, setErroDados] = useState<string | null>(null)
  const [carregandoFiltro, setCarregandoFiltro] = useState(false)
  const [modalVersaoAberto, setModalVersaoAberto] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (estado !== 'ok') return
    let cancelado = false
    setCarregandoFiltro(true)
    Promise.all([
      obterMetricasFiltradas(filtros, projetosPermitidos),
      obterMetricasPorEquipeFiltradas(filtros, projetosPermitidos, visao),
      obterPacotesAtendimento(filtros, projetosPermitidos, visao),
      obterRankingFechadores(filtros, projetosPermitidos),
    ])
      .then(([novasMetricas, novasMetricasPorEquipe, novosPacotes, novoRanking]) => {
        if (cancelado) return
        setErroDados(null)
        setMetricas(novasMetricas)
        setMetricasPorEquipe(novasMetricasPorEquipe)
        setPacotes(novosPacotes)
        setRankingFechadores(novoRanking)
      })
      .catch((erro) => {
        if (cancelado) return
        setErroDados(erro instanceof Error ? erro.message : 'Erro ao carregar dados do Bitrix.')
      })
      .finally(() => {
        if (!cancelado) setCarregandoFiltro(false)
      })
    return () => {
      cancelado = true
    }
  }, [estado, filtros, projetosPermitidos, visao])

  function aoMudarFiltros(novosFiltros: FiltrosDashboard) {
    setFiltros(novosFiltros)
  }

  let conteudo: ReactNode

  if (estado === 'carregando') {
    conteudo = (
      <Center mih="60vh">
        <Loader />
      </Center>
    )
  } else if (estado === 'sem_acesso') {
    conteudo = (
      <div className={classes.conteudo}>
        <EstadoVazio
          titulo="Nenhum projeto vinculado"
          descricao="Seu usuário não foi encontrado ou não está vinculado a nenhum projeto monitorado. Fale com o administrador do sistema."
        />
      </div>
    )
  } else if (estado === 'erro') {
    conteudo = (
      <div className={classes.conteudo}>
        <EstadoVazio
          titulo="Não foi possível identificar o usuário"
          descricao={mensagemErro ?? 'Ocorreu um erro inesperado.'}
        />
      </div>
    )
  } else {
    conteudo = (
      <div className={classes.conteudo}>
        <Stack gap="xl">
          <Group justify="flex-end" align="center">
            <Button
              variant="subtle"
              color="yellow"
              size="xs"
              style={{
                borderRadius: '16px',
                border: '1px solid rgba(203, 165, 86, 0.4)',
                backgroundColor: 'rgba(203, 165, 86, 0.1)',
                color: '#cba556',
                fontWeight: 600,
              }}
              onClick={() => setModalVersaoAberto(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              Novidades v{VERSAO_ATUAL}
            </Button>

          </Group>

          {erroDados ? (
            <EstadoVazio titulo="Não foi possível carregar os dados" descricao={erroDados} />
          ) : (
            <>
              <NavbarVisualizacoes visao={visao} onChange={setVisao} />

              <FiltrosPainel
                filtros={filtros}
                onChange={aoMudarFiltros}
                projetosPermitidos={projetosPermitidos}
              />

              <MetricasCards
                titulo="Métricas Gerais"
                metricas={metricas}
                metricasPorEquipe={metricasPorEquipe}
              />

              <div>
                <Title order={3} mb="xs">
                  Quem está fechando mais tarefas
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                  Ranking por <code>closedBy</code> — quem efetivamente concluiu o card. É a
                  atribuição de pessoa mais confiável do snapshot, e independe da visão
                  selecionada acima.
                </Text>
                {rankingFechadores && <RankingFechadores dados={rankingFechadores} />}
              </div>

              <div>
                <Title order={3} mb="md">
                  {visao === 'executora'
                    ? 'Inteligência — visão por equipe executora (quem fechou)'
                    : 'Inteligência — visão por equipe de atendimento'}
                </Title>
                <Stack gap="md">
                  {pacotes && <GraficosInteligencia pacotes={pacotes} visao={visao} />}
                </Stack>
              </div>
            </>
          )}
        </Stack>
      </div>
    )
  }

  return (
    <div className={classes.page}>
      {carregandoFiltro && <div className={classes.loadingBar} />}
      <ThemeToggle />
      {conteudo}
      <VersaoModal
        abertoManual={modalVersaoAberto}
        onCloseManual={() => setModalVersaoAberto(false)}
      />
      <AiAssistantChat metricas={metricas} pacotes={pacotes} filtros={filtros} visao={visao} />
      <DebugBitrixPanel />
    </div>
  )
}
