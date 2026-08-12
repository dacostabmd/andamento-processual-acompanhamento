import { Group, Modal, Stack, Text, Title } from '@mantine/core'
import { useMemo, useState } from 'react'
import type {
  EquipeAtendimento,
  MetricasPorEquipe,
  PacoteAtendimento,
  Tarefa,
} from '../../types/domain'
import { calcularRankingFechadores } from '../../utils/tarefasMetrics'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { GraficosInteligencia } from './GraficosInteligencia'
import { MetricaTarefasModal, type MetricaSelecionada } from './MetricaTarefasModal'
import { MetricasCards } from './MetricasCards'
import { RankingFechadores } from './RankingFechadores'
import { COR_POR_EQUIPE } from './tarefaApresentacao'
import classes from './PainelSupervisorEquipe.module.css'

interface PainelSupervisorEquipeProps {
  /** Equipe a exibir; `null` fecha o painel. */
  equipe: EquipeAtendimento | null
  /** Mesmos dados já carregados por DashboardPage — este painel não faz fetch próprio. */
  pacotes: PacoteAtendimento[]
  tarefasFiltradas: Tarefa[]
  metricasPorEquipe: MetricasPorEquipe[]
  onFechar: () => void
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
}

/**
 * Painel de gestão de UMA equipe só, aberto pelos ícones de
 * `SupervisorAcessoBotoes`. Reaproveita os dados já carregados por
 * `DashboardPage` (pacotes/tarefasFiltradas/metricasPorEquipe) filtrando-os
 * para a equipe aberta — sem fetch próprio, e respeitando os mesmos filtros
 * globais (período, status etc.) já selecionados no topo do dashboard.
 */
export function PainelSupervisorEquipe({
  equipe,
  pacotes,
  tarefasFiltradas,
  metricasPorEquipe,
  onFechar,
  onSelecionarColaborador,
}: PainelSupervisorEquipeProps) {
  // Mantém a última equipe não-nula para o título/corpo não "sumirem" durante
  // a transição de saída do Modal (que já recebe `equipe=null` de imediato).
  // Ajuste de estado durante o render (não em efeito) — ver
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders.
  const [equipeExibida, setEquipeExibida] = useState<EquipeAtendimento | null>(equipe)
  if (equipe !== null && equipe !== equipeExibida) {
    setEquipeExibida(equipe)
  }
  const [metricaSelecionada, setMetricaSelecionada] = useState<MetricaSelecionada | null>(null)

  const pacotesDaEquipe = useMemo(
    () => (equipeExibida ? pacotes.filter((p) => p.equipe === equipeExibida) : []),
    [pacotes, equipeExibida],
  )
  const tarefasDaEquipe = useMemo(
    () =>
      equipeExibida ? tarefasFiltradas.filter((t) => t.equipeAtendimento === equipeExibida) : [],
    [tarefasFiltradas, equipeExibida],
  )
  const metricasDaEquipe =
    metricasPorEquipe.find((m) => m.equipe === equipeExibida)?.metricas ?? null

  // Recalculado a partir das tarefas já filtradas para a equipe — não filtra o
  // ranking GLOBAL (cujos totais/percentuais são da empresa toda). Assim "% do
  // total" e "não concluídas" ficam relativos ao recorte da própria equipe,
  // igual ao resto do painel.
  const rankingDaEquipe = useMemo(
    () => calcularRankingFechadores(tarefasDaEquipe),
    [tarefasDaEquipe],
  )

  return (
    <>
      <Modal
        opened={equipe !== null}
        onClose={onFechar}
        fullScreen
        title={
          equipeExibida && (
            <Group gap="xs" wrap="nowrap">
              <span
                className={classes.corEquipe}
                style={{ ['--cor-equipe' as string]: COR_POR_EQUIPE[equipeExibida] }}
              />
              <Title order={4} className={classes.titulo}>
                Painel da equipe — {equipeExibida}
              </Title>
            </Group>
          )
        }
        transitionProps={{ transition: 'slide-up', duration: 250 }}
      >
        {equipeExibida && (
          <div className={classes.conteudo} key={equipeExibida}>
            <Stack gap="xl">
              <Text size="sm" c="dimmed">
                Métricas e gráficos restritos às tarefas de atendimento da equipe de {equipeExibida}
                , no mesmo recorte de filtros selecionado no dashboard.
              </Text>

              <MetricasCards
                titulo={`Métricas — ${equipeExibida}`}
                metricas={metricasDaEquipe}
                metricasPorEquipe={[]}
              />

              <div>
                <Title order={3} mb="md">
                  Quem está fechando mais tarefas na equipe
                </Title>
                <RankingFechadores
                  dados={rankingDaEquipe}
                  tarefas={tarefasDaEquipe}
                  onSelecionarColaborador={onSelecionarColaborador}
                />
              </div>

              <div>
                <Title order={3} mb="md">
                  Inteligência da equipe
                </Title>
                <GraficosInteligencia
                  pacotes={pacotesDaEquipe}
                  tarefasFiltradas={tarefasDaEquipe}
                  onSelecionarColaborador={onSelecionarColaborador}
                  onSelecionarMetrica={setMetricaSelecionada}
                  ocultarComparativoEquipes
                />
              </div>
            </Stack>
          </div>
        )}
      </Modal>

      <MetricaTarefasModal
        metrica={metricaSelecionada}
        aoFechar={() => setMetricaSelecionada(null)}
      />
    </>
  )
}
