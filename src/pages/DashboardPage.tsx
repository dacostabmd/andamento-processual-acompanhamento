import { Center, Group, Loader, Stack, Title, Button } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import { EstadoVazio } from '../components/EstadoVazio'
import { ThemeToggle } from '../components/ThemeToggle'
import { AvisoSincronizacao } from '../components/dashboard/AvisoSincronizacao'
import {
  ColaboradorTarefasModal,
  type ColaboradorSelecionado,
} from '../components/dashboard/ColaboradorTarefasModal'
import { ComentariosForum } from '../components/dashboard/ComentariosForum'
import { AuditoriaCadastroBotao } from '../components/dashboard/AuditoriaCadastroBotao'
import { AuditoriaCadastroPanel } from '../components/dashboard/AuditoriaCadastroPanel'
import { ConfiguracoesCadastroBotao } from '../components/dashboard/ConfiguracoesCadastroBotao'
import { EquipesCadastroPanel } from '../components/dashboard/EquipesCadastroPanel'
import { DebugBitrixPanel } from '../components/dashboard/DebugBitrixPanel'
import { DesempenhoEquipesRipple } from '../components/dashboard/DesempenhoEquipesRipple'
import { DesempenhoIndividualConclusao } from '../components/dashboard/DesempenhoIndividualConclusao'
import { FechamentoEquipesTabs } from '../components/dashboard/FechamentoEquipesTabs'
import { InfograficoAtrasoTarefas } from '../components/dashboard/InfograficoAtrasoTarefas'
import {
  MetricaTarefasModal,
  type MetricaSelecionada,
} from '../components/dashboard/MetricaTarefasModal'
import { MetricasCards } from '../components/dashboard/MetricasCards'
import { MediasEquipeIndividualTabs } from '../components/dashboard/MediasEquipeIndividualTabs'
import { NavegacaoSecoesDashboard } from '../components/dashboard/NavegacaoSecoesDashboard'
import { PainelSupervisorEquipe } from '../components/dashboard/PainelSupervisorEquipe'
import { ProjecaoTabs } from '../components/dashboard/ProjecaoTabs'
import { RankingRapidezConclusao } from '../components/dashboard/RankingRapidezConclusao'
import { FechamentosSemComentariosSection } from '../components/dashboard/FechamentosSemComentariosSection'
import { FaturamentoVigenteSection } from '../components/dashboard/FaturamentoVigenteSection'
import { SupervisorAcessoBotoes } from '../components/dashboard/SupervisorAcessoBotoes'
import { TendenciaDiariaTarefas } from '../components/dashboard/TendenciaDiariaTarefas'
import { UltimasTarefasBox } from '../components/dashboard/UltimasTarefasBox'
import { VERSAO_ATUAL, VersaoModal } from '../components/dashboard/VersaoModal'
import { useSessaoUsuario } from '../hooks/useSessaoUsuario'
import {
  comNomesReais,
  obterMetricasFiltradas,
  obterMetricasPorEquipeFiltradas,
  obterPacotesAtendimento,
  obterTarefasFiltradas,
} from '../services/dashboardService'
import {
  filtrosVazios,
  type FiltrosDashboard,
  type MetricasPorEquipe,
  type MetricasTarefas,
  type PacoteAtendimento,
  type Tarefa,
} from '../types/domain'
import type { SlotSupervisor } from '../utils/pessoas'
import classes from './DashboardPage.module.css'

// Grupo "Acompanhamento Mensal" — marcado por padrão na segmentação de
// grupos, os demais grupos monitorados começam desmarcados.
const GRUPO_PADRAO_ACOMPANHAMENTO_MENSAL = 86

export function DashboardPage() {
  const { estado, colaborador, projetosPermitidos, mensagemErro } = useSessaoUsuario()

  const [filtros, setFiltros] = useState<FiltrosDashboard>(() => filtrosVazios(new Date()))
  const [gruposSelecionados, setGruposSelecionados] = useState<number[]>([
    GRUPO_PADRAO_ACOMPANHAMENTO_MENSAL,
  ])
  const [metricas, setMetricas] = useState<MetricasTarefas | null>(null)
  const [metricasPorEquipe, setMetricasPorEquipe] = useState<MetricasPorEquipe[]>([])
  const [pacotes, setPacotes] = useState<PacoteAtendimento[] | null>(null)
  const [tarefasFiltradas, setTarefasFiltradas] = useState<Tarefa[]>([])
  const [colaboradorSelecionado, setColaboradorSelecionado] =
    useState<ColaboradorSelecionado | null>(null)
  const [erroDados, setErroDados] = useState<string | null>(null)
  const [carregandoFiltro, setCarregandoFiltro] = useState(false)
  const [modalVersaoAberto, setModalVersaoAberto] = useState<boolean | undefined>(undefined)
  const [slotSupervisorAberto, setSlotSupervisorAberto] = useState<SlotSupervisor | null>(null)
  const [metricaSelecionada, setMetricaSelecionada] = useState<MetricaSelecionada | null>(null)
  const [configuracoesAbertas, setConfiguracoesAbertas] = useState(false)
  const [auditoriaAberta, setAuditoriaAberta] = useState(false)
  // Incrementado quando o cadastro de pessoas muda: reexecuta o efeito de carga
  // para os números refletirem os vínculos novos sem depender de F5. O cache do
  // snapshot já foi descartado pelo painel de configurações.
  const [recargaCadastro, setRecargaCadastro] = useState(0)
  // projetosPermitidos resolvido no login não tem nome real quando a fonte é o
  // worker (acessoService devolve "Grupo {id}" — o nome real só existe no
  // metadata.groups do snapshot). Reaplicado a cada carga para refletir assim
  // que o primeiro snapshot chega.
  const [projetosComNomes, setProjetosComNomes] = useState(projetosPermitidos)

  useEffect(() => {
    if (estado !== 'ok') return
    let cancelado = false
    setCarregandoFiltro(true)
    Promise.all([
      obterMetricasFiltradas(filtros, projetosPermitidos, gruposSelecionados),
      obterMetricasPorEquipeFiltradas(filtros, projetosPermitidos, gruposSelecionados),
      obterPacotesAtendimento(filtros, projetosPermitidos, gruposSelecionados),
      obterTarefasFiltradas(filtros, projetosPermitidos, gruposSelecionados),
    ])
      .then(([novasMetricas, novasMetricasPorEquipe, novosPacotes, novasTarefas]) => {
        if (cancelado) return
        setErroDados(null)
        setMetricas(novasMetricas)
        setMetricasPorEquipe(novasMetricasPorEquipe)
        setPacotes(novosPacotes)
        setTarefasFiltradas(novasTarefas)
        setProjetosComNomes(comNomesReais(projetosPermitidos))
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
  }, [estado, filtros, projetosPermitidos, gruposSelecionados, recargaCadastro])

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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ marginRight: '6px' }}
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              Novidades v{VERSAO_ATUAL}
            </Button>
          </Group>

          <AvisoSincronizacao />

          {erroDados ? (
            <EstadoVazio titulo="Não foi possível carregar os dados" descricao={erroDados} />
          ) : (
            <>
              <MetricasCards
                titulo="Métricas Gerais"
                metricas={metricas}
                metricasPorEquipe={metricasPorEquipe}
                tarefasFiltradas={tarefasFiltradas}
                onSelecionarMetrica={setMetricaSelecionada}
              />

              <div id="secao-tendencia-diaria">
                {pacotes && (
                  <TendenciaDiariaTarefas
                    pacotes={pacotes}
                    onSelecionarMetrica={setMetricaSelecionada}
                  />
                )}
              </div>

              <div id="secao-ultimas-tarefas">
                <Title order={3} mb="md">
                  Últimas tarefas — últimos 30 dias
                </Title>
                <UltimasTarefasBox
                  tarefasFiltradas={tarefasFiltradas}
                  metricas={metricas}
                  pacotes={pacotes}
                  filtros={filtros}
                  onChangeFiltros={aoMudarFiltros}
                  projetosPermitidos={projetosComNomes}
                  gruposSelecionados={gruposSelecionados}
                  onMudarGrupos={setGruposSelecionados}
                />
              </div>

              <div id="secao-projecao-ia">
                {pacotes && (
                  <ProjecaoTabs pacotes={pacotes} tarefasFiltradas={tarefasFiltradas} />
                )}
              </div>

              <FaturamentoVigenteSection
                tarefas={tarefasFiltradas}
                visao="executora"
                aoSelecionarColaborador={setColaboradorSelecionado}
              />

              <div id="secao-fechamento-equipes">
                <Title order={3} mb="md">
                  Fechamento e responsabilidade por colaborador
                </Title>
                <FechamentoEquipesTabs
                  tarefasFiltradas={tarefasFiltradas}
                  pacotes={pacotes ?? []}
                  onSelecionarColaborador={setColaboradorSelecionado}
                />
              </div>

              <div id="secao-atraso">
                <Title order={3} mb="md">
                  Métricas de atraso
                </Title>
                {pacotes && (
                  <InfograficoAtrasoTarefas
                    pacotes={pacotes}
                    onSelecionarMetrica={setMetricaSelecionada}
                  />
                )}
              </div>

              <div id="secao-desempenho-individual">
                <Title order={3} mb="md">
                  Desempenho individual de conclusão
                </Title>
                <DesempenhoIndividualConclusao
                  tarefasFiltradas={tarefasFiltradas}
                  onSelecionarColaborador={setColaboradorSelecionado}
                />
              </div>

              <div id="secao-rapidez-conclusao">
                <RankingRapidezConclusao
                  tarefasFiltradas={tarefasFiltradas}
                  onSelecionarColaborador={setColaboradorSelecionado}
                />
              </div>

              <div id="secao-sem-comentarios">
                <FechamentosSemComentariosSection tarefasFiltradas={tarefasFiltradas} />
              </div>

              <div id="secao-desempenho-equipes">
                <Title order={3} mb="md">
                  Desempenho de equipes
                </Title>
                {pacotes && (
                  <DesempenhoEquipesRipple
                    pacotes={pacotes}
                    tarefasFiltradas={tarefasFiltradas}
                    onSelecionarColaborador={setColaboradorSelecionado}
                  />
                )}
              </div>

              <div id="secao-medias-equipes">
                <Title order={3} mb="md">
                  Desempenho individual por pessoa
                </Title>
                {pacotes && (
                  <MediasEquipeIndividualTabs
                    pacotes={pacotes}
                    tarefasFiltradas={tarefasFiltradas}
                    onSelecionarColaborador={setColaboradorSelecionado}
                  />
                )}
              </div>

              <ComentariosForum colaborador={colaborador} />
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
      <SupervisorAcessoBotoes
        nomeUsuario={colaborador?.nome}
        idUsuario={colaborador?.id}
        onAbrirSlot={setSlotSupervisorAberto}
      />
      <ConfiguracoesCadastroBotao
        nomeUsuario={colaborador?.nome}
        idUsuario={colaborador?.id}
        onAbrir={() => setConfiguracoesAbertas(true)}
      />
      <AuditoriaCadastroBotao
        nomeUsuario={colaborador?.nome}
        idUsuario={colaborador?.id}
        onAbrir={() => setAuditoriaAberta(true)}
      />
      {conteudo}
      {estado === 'ok' && !erroDados && (
        <NavegacaoSecoesDashboard
          secoes={[
            { id: 'secao-tendencia-diaria', rotulo: 'Tarefas por dia' },
            { id: 'secao-ultimas-tarefas', rotulo: 'Últimas tarefas' },
            { id: 'secao-projecao-ia', rotulo: 'Projeção IA' },
            { id: 'secao-faturamento-vigente', rotulo: 'Faturamento' },
            { id: 'secao-fechamento-equipes', rotulo: 'Fechamento' },
            { id: 'secao-atraso', rotulo: 'Atraso' },
            { id: 'secao-desempenho-individual', rotulo: 'Desempenho individual' },
            { id: 'secao-rapidez-conclusao', rotulo: 'Rapidez' },
            { id: 'secao-sem-comentarios', rotulo: 'Sem comentário' },
            { id: 'secao-desempenho-equipes', rotulo: 'Desempenho de equipes' },
            { id: 'secao-medias-equipes', rotulo: 'Médias de equipes' },
          ]}
        />
      )}
      <VersaoModal
        abertoManual={modalVersaoAberto}
        onCloseManual={() => setModalVersaoAberto(false)}
      />
      <ColaboradorTarefasModal
        colaborador={colaboradorSelecionado}
        aoFechar={() => setColaboradorSelecionado(null)}
        usuarioLogadoNome={colaborador?.nome}
        usuarioLogadoId={colaborador?.id}
      />
      <MetricaTarefasModal
        metrica={metricaSelecionada}
        aoFechar={() => setMetricaSelecionada(null)}
      />
      <PainelSupervisorEquipe
        slot={slotSupervisorAberto}
        pacotes={pacotes ?? []}
        tarefasFiltradas={tarefasFiltradas}
        metricasPorEquipe={metricasPorEquipe}
        onFechar={() => setSlotSupervisorAberto(null)}
        onSelecionarColaborador={setColaboradorSelecionado}
      />
      <EquipesCadastroPanel
        aberto={configuracoesAbertas}
        colaborador={colaborador}
        onFechar={() => setConfiguracoesAbertas(false)}
        onCadastroAlterado={() => setRecargaCadastro((n) => n + 1)}
      />
      <AuditoriaCadastroPanel
        aberto={auditoriaAberta}
        colaborador={colaborador}
        onFechar={() => setAuditoriaAberta(false)}
      />
      <DebugBitrixPanel />
    </div>
  )
}
