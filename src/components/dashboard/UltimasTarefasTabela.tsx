import { ActionIcon, Badge, Group, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { useMemo, useState } from 'react'
import { montarCaminhoTarefaBitrix, montarUrlTarefaBitrix } from '../../services/bitrixPortal'
import { abrirNoPortal } from '../../services/bitrixSdk'
import { STATUS_LABELS, type Tarefa } from '../../types/domain'
import { calcularMetricas, tarefaFoiConcluidaComAtraso } from '../../utils/tarefasMetrics'
import { pesoSituacao } from './ColaboradorTarefasModal'
import { compararData, compararNumero, compararTexto } from './ordenacao'
import { TarefaDetalheModal } from './TarefaDetalheModal'
import { COR_POR_EQUIPE, corDoStatus, formatarData, formatarDataHora } from './tarefaApresentacao'
import { TabelaAnimadaPaginada, type ColunaTabelaAnimada } from './TabelaAnimadaPaginada'

interface UltimasTarefasTabelaProps {
  tarefasFiltradas: Tarefa[]
}

const DIA_MS = 24 * 60 * 60 * 1000
const JANELA_DIAS = 30

function IconeAbrirBitrix() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  )
}

/**
 * Tabela resumida das tarefas dos últimos 30 dias (por finalizadoEm, com
 * fallback a prazoFinal para as ainda abertas) — mesmo critério de janela que
 * `ResumoCalculistaEquipe.tsx` já usa para seu recorte mensal.
 */
export function UltimasTarefasTabela({ tarefasFiltradas }: UltimasTarefasTabelaProps) {
  const [tarefaDetalhe, setTarefaDetalhe] = useState<Tarefa | null>(null)

  const tarefasRecentes = useMemo(() => {
    const limite = new Date().getTime() - JANELA_DIAS * DIA_MS
    return tarefasFiltradas.filter((tarefa) => {
      const dataRef = tarefa.finalizadoEm
        ? new Date(tarefa.finalizadoEm)
        : tarefa.prazoFinal
          ? new Date(tarefa.prazoFinal)
          : null
      return dataRef !== null && dataRef.getTime() >= limite
    })
  }, [tarefasFiltradas])

  const resumo = useMemo(() => calcularMetricas(tarefasRecentes, 'total'), [tarefasRecentes])

  const colunas = useMemo<ColunaTabelaAnimada<Tarefa>[]>(
    () => [
      {
        chave: 'titulo',
        rotulo: 'Título',
        comparar: (a, b, direcao) => compararTexto(a.titulo, b.titulo, direcao),
        render: (tarefa) => (
          <UnstyledButton onClick={() => setTarefaDetalhe(tarefa)}>
            <Text
              size="sm"
              lineClamp={1}
              className="item-clicavel-hover"
              style={{ cursor: 'pointer' }}
            >
              {tarefa.titulo}
            </Text>
          </UnstyledButton>
        ),
      },
      {
        chave: 'situacao',
        rotulo: 'Status',
        comparar: (a, b, direcao) => {
          const agora = new Date()
          return compararNumero(pesoSituacao(a, agora), pesoSituacao(b, agora), direcao)
        },
        render: (tarefa) => (
          <Badge
            size="sm"
            color={tarefaFoiConcluidaComAtraso(tarefa) ? 'orange' : corDoStatus(tarefa)}
            variant="light"
          >
            {tarefaFoiConcluidaComAtraso(tarefa)
              ? 'Concluído com atraso'
              : STATUS_LABELS[tarefa.status]}
          </Badge>
        ),
      },
      {
        chave: 'equipe',
        rotulo: 'Equipe',
        comparar: (a, b, direcao) =>
          compararTexto(a.equipeAtendimento, b.equipeAtendimento, direcao),
        render: (tarefa) => (
          <Badge
            size="sm"
            variant="light"
            color={tarefa.equipeAtendimento === 'indefinido' ? 'gray' : undefined}
            style={
              tarefa.equipeAtendimento === 'indefinido'
                ? undefined
                : {
                    backgroundColor: `${COR_POR_EQUIPE[tarefa.equipeAtendimento]}22`,
                    color: COR_POR_EQUIPE[tarefa.equipeAtendimento],
                  }
            }
          >
            {tarefa.equipeAtendimento}
          </Badge>
        ),
      },
      {
        chave: 'prazo',
        rotulo: 'Prazo',
        comparar: (a, b, direcao) => compararData(a.prazoFinal, b.prazoFinal, direcao),
        render: (tarefa) => <Text size="xs">{formatarData(tarefa.prazoFinal)}</Text>,
      },
      {
        chave: 'finalizado',
        rotulo: 'Finalizado em',
        direcaoInicial: 'desc',
        comparar: (a, b, direcao) => compararData(a.finalizadoEm, b.finalizadoEm, direcao),
        render: (tarefa) => <Text size="xs">{formatarDataHora(tarefa.finalizadoEm)}</Text>,
      },
    ],
    [],
  )

  return (
    <>
      <Group gap="lg" mb="sm">
        <Text size="xs" c="dimmed">
          {resumo.total} tarefa(s) nos últimos {JANELA_DIAS} dias
        </Text>
        <Text size="xs" c="dimmed">
          {resumo.concluidas} concluída(s)
        </Text>
        <Text size="xs" c="dimmed">
          {resumo.atrasadas} atrasada(s)
        </Text>
      </Group>

      <TabelaAnimadaPaginada
        dados={tarefasRecentes}
        colunas={colunas}
        chaveLinha={(tarefa) => tarefa.id}
        ordenacaoInicial={{ chave: 'prazo', direcao: 'asc' }}
        itensPorPagina={15}
        colunaAcao={{
          rotulo: 'Ação',
          render: (tarefa) => {
            const url = montarUrlTarefaBitrix(
              tarefa.id,
              tarefa.projetoId,
              tarefa.responsavelId,
              tarefa.fechadoPorId,
              tarefa.responsavelAtendimentoId,
            )
            const caminho = montarCaminhoTarefaBitrix(
              tarefa.id,
              tarefa.projetoId,
              tarefa.responsavelId,
              tarefa.fechadoPorId,
              tarefa.responsavelAtendimentoId,
            )
            if (!url || !caminho) return null
            return (
              <Tooltip label="Abrir no Bitrix" withArrow>
                <ActionIcon
                  component="button"
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={() => abrirNoPortal(caminho, url)}
                  aria-label="Abrir tarefa no Bitrix"
                >
                  <IconeAbrirBitrix />
                </ActionIcon>
              </Tooltip>
            )
          },
        }}
        estadoVazio={{
          titulo: 'Nenhuma tarefa recente',
          descricao: 'Sem tarefas com prazo ou finalização nos últimos 30 dias, no recorte atual.',
        }}
      />

      <TarefaDetalheModal tarefa={tarefaDetalhe} aoFechar={() => setTarefaDetalhe(null)} />
    </>
  )
}
