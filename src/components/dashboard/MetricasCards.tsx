import { Group, Skeleton, Text, Tooltip } from '@mantine/core'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { MetricasPorEquipe, MetricasTarefas, Tarefa } from '../../types/domain'
import { classificarUrgenciaTarefa, tarefaEstaAtrasada } from '../../utils/tarefasMetrics'
import type { MetricaSelecionada } from './MetricaTarefasModal'
import classes from './MetricasCards.module.css'

interface MetricasCardsProps {
  titulo: string
  metricas: MetricasTarefas | null
  metricasPorEquipe: MetricasPorEquipe[]
  tarefasFiltradas?: Tarefa[]
  onSelecionarMetrica?: (metrica: MetricaSelecionada) => void
}

function montarStats(metricas: MetricasTarefas) {
  const ehApenasConcluidas = metricas.total > 0 && metricas.concluidas === metricas.total

  if (ehApenasConcluidas) {
    return [
      {
        label: 'No Prazo',
        valor: String(metricas.emAndamento),
        descricao: 'Concluídas estritamente no prazo',
      },
      {
        label: 'Risco de Atraso',
        valor: '0',
        descricao: 'N/A (Apenas Concluídas)',
      },
      {
        label: 'Com Atraso',
        valor: String(metricas.atrasadas),
        descricao: 'Concluídas entregues após o prazo',
      },
      {
        label: 'Taxa de Atraso',
        valor: `${metricas.taxaAtraso.toFixed(1)}%`,
        descricao: `${metricas.atrasadas} de ${metricas.baseTaxaAtraso} entrega(s) concluída(s) com atraso`,
      },
      {
        label: 'Concluídas',
        valor: String(metricas.concluidas),
        descricao: 'Total de entregas concluídas',
      },
    ]
  }

  return [
    {
      label: 'Em Andamento',
      valor: String(metricas.emAndamento),
      descricao: 'Tarefas ativas dentro do prazo',
    },
    {
      label: 'Risco de Atraso',
      valor: String(metricas.vencemEmBreve),
      descricao: 'Vencem nos próximos 3 dias',
    },
    {
      label: 'Atrasadas',
      valor: String(metricas.atrasadas),
      descricao: 'Não concluídas com prazo já vencido',
    },
    {
      label: 'Taxa de Atraso',
      valor: `${metricas.taxaAtraso.toFixed(1)}%`,
      descricao: `${metricas.atrasadas} de ${metricas.baseTaxaAtraso} tarefa(s) consideradas`,
    },
    {
      label: 'Concluídas',
      valor: String(metricas.concluidas),
      descricao: 'Tarefas com status "Concluído"',
    },
  ]
}

export function MetricasCards({
  titulo,
  metricas,
  metricasPorEquipe,
  tarefasFiltradas = [],
  onSelecionarMetrica,
}: MetricasCardsProps) {
  const [grupoAtivo, setGrupoAtivo] = useState(0)
  const [direcao, setDirecao] = useState(1)

  const totalGrupos = 1 + metricasPorEquipe.length
  const grupo = Math.min(grupoAtivo, totalGrupos - 1)

  const tituloGrupo =
    grupo === 0 ? titulo : `Métricas — Equipe ${metricasPorEquipe[grupo - 1].equipe}`
  const metricasDoGrupo = grupo === 0 ? metricas : metricasPorEquipe[grupo - 1].metricas
  const stats = metricasDoGrupo ? montarStats(metricasDoGrupo) : []

  function irParaAnterior() {
    setDirecao(-1)
    setGrupoAtivo((atual) => (atual - 1 + totalGrupos) % totalGrupos)
  }

  function irParaProximo() {
    setDirecao(1)
    setGrupoAtivo((atual) => (atual + 1) % totalGrupos)
  }

  function aoClicarMetrica(statLabel: string) {
    if (!onSelecionarMetrica || tarefasFiltradas.length === 0) return
    const agora = new Date()

    const tarefasDoGrupo =
      grupo === 0
        ? tarefasFiltradas
        : tarefasFiltradas.filter(
            (t) => t.equipeAtendimento === metricasPorEquipe[grupo - 1].equipe,
          )

    let selecionadas: Tarefa[] = []
    let tituloModal = statLabel
    let subtituloModal = ''

    if (statLabel === 'Em Andamento' || statLabel === 'No Prazo') {
      selecionadas = tarefasDoGrupo.filter((t) => t.status !== 5 && !tarefaEstaAtrasada(t, agora))
      subtituloModal = `${selecionadas.length} tarefa(s) em andamento no prazo`
    } else if (statLabel === 'Risco de Atraso') {
      selecionadas = tarefasDoGrupo.filter(
        (t) => t.status !== 5 && classificarUrgenciaTarefa(t, agora) === 'ateTresDias',
      )
      subtituloModal = `${selecionadas.length} tarefa(s) vencendo nos próximos 3 dias`
    } else if (statLabel === 'Atrasadas' || statLabel === 'Com Atraso') {
      selecionadas = tarefasDoGrupo.filter((t) => t.status !== 5 && tarefaEstaAtrasada(t, agora))
      subtituloModal = `${selecionadas.length} tarefa(s) ativas com prazo vencido`
    } else if (statLabel === 'Taxa de Atraso') {
      selecionadas = tarefasDoGrupo.filter((t) => t.status !== 5 && tarefaEstaAtrasada(t, agora))
      subtituloModal = `${selecionadas.length} tarefa(s) atrasadas que compõem a taxa de atraso`
    } else if (statLabel === 'Concluídas') {
      selecionadas = tarefasDoGrupo.filter((t) => t.status === 5)
      subtituloModal = `${selecionadas.length} tarefa(s) concluídas`
    } else {
      selecionadas = tarefasDoGrupo
    }

    if (grupo > 0) {
      tituloModal += ` — Equipe ${metricasPorEquipe[grupo - 1].equipe}`
    }

    onSelecionarMetrica({
      titulo: tituloModal,
      subtitulo: subtituloModal,
      tarefas: selecionadas,
    })
  }

  return (
    <div>
      <Group justify="space-between" mb="xs">
        <Text fw={600} className={classes.tituloGrupo}>
          {tituloGrupo}
        </Text>
      </Group>

      <div className={classes.carrossel}>
        {totalGrupos > 1 && (
          <>
            <button
              type="button"
              className={`${classes.navControl} ${classes.navAnterior}`}
              aria-label="Grupo de métricas anterior"
              onClick={irParaAnterior}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${classes.navControl} ${classes.navProximo}`}
              aria-label="Próximo grupo de métricas"
              onClick={irParaProximo}
            >
              ›
            </button>
          </>
        )}

        {metricasDoGrupo === null ? (
          <Skeleton height={150} radius="md" />
        ) : (
          <div className={classes.root}>
            <AnimatePresence mode="wait" initial={false} custom={direcao}>
              <motion.div
                key={grupo}
                custom={direcao}
                initial={{ x: direcao > 0 ? 60 : -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direcao > 0 ? -60 : 60, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', width: '100%' }}
              >
                {stats.map((stat) => (
                  <Tooltip
                    key={stat.label}
                    label={`Clique para ver a lista de tarefas: ${stat.label}`}
                    withArrow
                  >
                    <div
                      className={classes.stat}
                      onClick={() => aoClicarMetrica(stat.label)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && aoClicarMetrica(stat.label)}
                    >
                      <Text className={classes.count}>{stat.valor}</Text>
                      <Text className={classes.title}>{stat.label}</Text>
                      <Text className={classes.description}>{stat.descricao}</Text>
                    </div>
                  </Tooltip>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
