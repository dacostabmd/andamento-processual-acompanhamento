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
      // Mostra o denominador junto: uma taxa de 100% sobre 1 tarefa é bem
      // diferente de 100% sobre 500 — sem o "de quantas", a primeira parece
      // um erro de cálculo em vez de uma base pequena. Frase neutra porque a
      // base muda conforme o modo (fila ativa ou volume total).
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
}: MetricasCardsProps) {
  const [grupoAtivo, setGrupoAtivo] = useState(0)
  const [direcao, setDirecao] = useState(1)

  const totalGrupos = 1 + metricasPorEquipe.length
  const grupo = Math.min(grupoAtivo, totalGrupos - 1)

  const tituloGrupo = grupo === 0 ? titulo : `Métricas — Equipe ${metricasPorEquipe[grupo - 1].equipe}`
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
