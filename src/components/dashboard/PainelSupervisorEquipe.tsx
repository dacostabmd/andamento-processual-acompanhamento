import { Badge, Card, Group, Modal, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import { useSupervisorIdPorEquipe } from '../../hooks/useSupervisorIdPorEquipe'
import type {
  EquipeAtendimento,
  MetricasPorEquipe,
  PacoteAtendimento,
  Tarefa,
} from '../../types/domain'
import { idsColaboradoresDasTarefas } from '../../utils/pessoas'
import { calcularRankingFechadores, tarefaFoiConcluidaComAtraso } from '../../utils/tarefasMetrics'
import { UserAvatar } from '../UserAvatar'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { GraficosInteligencia } from './GraficosInteligencia'
import { MetricaTarefasModal, type MetricaSelecionada } from './MetricaTarefasModal'
import { MetricasCards } from './MetricasCards'
import { RankingFechadores } from './RankingFechadores'
import { ResumoCalculistaEquipe } from './ResumoCalculistaEquipe'
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
  const [equipeExibida, setEquipeExibida] = useState<EquipeAtendimento | null>(equipe)
  if (equipe !== null && equipe !== equipeExibida) {
    setEquipeExibida(equipe)
  }
  const supervisorIds = useSupervisorIdPorEquipe()
  const supervisoraId = equipeExibida ? supervisorIds[equipeExibida] : undefined
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
  const idsColaboradores = useMemo(() => {
    const ids = idsColaboradoresDasTarefas(tarefasDaEquipe)
    if (supervisoraId) ids.push(supervisoraId)
    return ids
  }, [tarefasDaEquipe, supervisoraId])
  const fotos = useFotosColaboradores(idsColaboradores)
  const fotoSupervisora = supervisoraId ? fotos.get(supervisoraId) : undefined
  const metricasDaEquipe =
    metricasPorEquipe.find((m) => m.equipe === equipeExibida)?.metricas ?? null

  const rankingDaEquipe = useMemo(
    () => calcularRankingFechadores(tarefasDaEquipe),
    [tarefasDaEquipe],
  )

  // Cálculo de Métricas Pertinentes Operacionais do Time
  const destaquesPerformance = useMemo(() => {
    const totalMembros = rankingDaEquipe.linhas.length
    const totalConcluidas = metricasDaEquipe?.concluidas ?? 0
    const totalAtivas = metricasDaEquipe?.emAndamento ?? 0

    const concluidasNoPrazo = tarefasDaEquipe.filter(
      (t) => t.status === 5 && !tarefaFoiConcluidaComAtraso(t),
    ).length

    const taxaPontualidade =
      totalConcluidas > 0 ? (concluidasNoPrazo / totalConcluidas) * 100 : 100

    const mediaConclusoesMembro =
      totalMembros > 0 ? (totalConcluidas / totalMembros).toFixed(1) : '0'

    const cargaMediaPendente =
      totalMembros > 0 ? (totalAtivas / totalMembros).toFixed(1) : '0'

    const mvp = rankingDaEquipe.linhas.length > 0 ? rankingDaEquipe.linhas[0] : null

    return {
      totalMembros,
      taxaPontualidade: taxaPontualidade.toFixed(1),
      mediaConclusoesMembro,
      cargaMediaPendente,
      mvp,
    }
  }, [rankingDaEquipe, metricasDaEquipe, tarefasDaEquipe])

  return (
    <>
      <Modal
        opened={equipe !== null}
        onClose={onFechar}
        fullScreen
        zIndex={200}
        title={
          equipeExibida && (
            <Group gap="sm" wrap="nowrap" align="center">
              <UserAvatar nome={equipeExibida} fotoUrl={fotoSupervisora} size={40} />
              <Title order={3} className={classes.titulo}>
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

              {/* Resumos Analíticos e Calculistas (Dia, Semana, Mês) */}
              <ResumoCalculistaEquipe equipe={equipeExibida} tarefas={tarefasDaEquipe} />

              <MetricasCards
                titulo={`Métricas — ${equipeExibida}`}
                metricas={metricasDaEquipe}
                metricasPorEquipe={[]}
              />

              {/* Seção de Métricas Pertinentes de Desempenho da Equipe */}
              <div>
                <Title order={3} mb="md">
                  Desempenho & Saúde da Equipe
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                  <Card padding="md" radius="md" withBorder>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Líder de Fechamentos (MVP)
                    </Text>
                    <Group justify="space-between" mt="xs" align="flex-end">
                      <div>
                        <Text size="lg" fw={700}>
                          {destaquesPerformance.mvp?.nome ?? 'Nenhum'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {destaquesPerformance.mvp
                            ? `${destaquesPerformance.mvp.total} tarefas (${destaquesPerformance.mvp.percentual.toFixed(1)}% do time)`
                            : 'Sem dados no período'}
                        </Text>
                      </div>
                      <Badge color="yellow" variant="light">
                        ★ Destaque
                      </Badge>
                    </Group>
                  </Card>

                  <Card padding="md" radius="md" withBorder>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Média de Fechamento / Membro
                    </Text>
                    <Text size="xl" fw={700} mt="xs" c="blue.4">
                      {destaquesPerformance.mediaConclusoesMembro}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Entregas médias por colaborador ({destaquesPerformance.totalMembros} membros)
                    </Text>
                  </Card>

                  <Card padding="md" radius="md" withBorder>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Pontualidade do Time
                    </Text>
                    <Text size="xl" fw={700} mt="xs" c="teal.4">
                      {destaquesPerformance.taxaPontualidade}%
                    </Text>
                    <Text size="xs" c="dimmed">
                      Conclusões realizadas estritamente no prazo
                    </Text>
                  </Card>

                  <Card padding="md" radius="md" withBorder>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Carga Pendente / Membro
                    </Text>
                    <Text size="xl" fw={700} mt="xs" c="orange.4">
                      {destaquesPerformance.cargaMediaPendente}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Cards ativas em andamento por pessoa
                    </Text>
                  </Card>
                </SimpleGrid>
              </div>

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

