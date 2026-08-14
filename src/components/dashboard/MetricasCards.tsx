import { Group, Skeleton, Text } from '@mantine/core'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { MetricasPorEquipe, MetricasTarefas } from '../../types/domain'
import classes from './MetricasCards.module.css'

interface MetricasCardsProps {
  titulo: string
  metricas: MetricasTarefas | null
  metricasPorEquipe: MetricasPorEquipe[]
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

export function MetricasCards({ titulo, metricas, metricasPorEquipe }: MetricasCardsProps) {
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
                  <div key={stat.label} className={classes.stat}>
                    <Text className={classes.count}>{stat.valor}</Text>
                    <Text className={classes.title}>{stat.label}</Text>
                    <Text className={classes.description}>{stat.descricao}</Text>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
