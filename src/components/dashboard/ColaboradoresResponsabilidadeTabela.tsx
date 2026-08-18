import { Badge, Group, Text, UnstyledButton } from '@mantine/core'
import { useMemo } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import type { PacoteAtendimento } from '../../types/domain'
import { UserAvatar } from '../UserAvatar'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { compararNumero, compararTexto } from './ordenacao'
import { COR_POR_EQUIPE } from './tarefaApresentacao'
import { TabelaAnimadaPaginada, type ColunaTabelaAnimada } from './TabelaAnimadaPaginada'

interface ColaboradoresResponsabilidadeTabelaProps {
  pacotes: PacoteAtendimento[]
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
}

/** "Colaboradores com mais tarefas sob responsabilidade" — mesma base de `pacotes` de GraficosInteligencia. */
export function ColaboradoresResponsabilidadeTabela({
  pacotes,
  onSelecionarColaborador,
}: ColaboradoresResponsabilidadeTabelaProps) {
  const idsColaboradores = useMemo(
    () => pacotes.map((p) => p.responsavelAtendimentoId).filter((id): id is number => id !== null),
    [pacotes],
  )
  const fotos = useFotosColaboradores(idsColaboradores)

  const colunas = useMemo<ColunaTabelaAnimada<PacoteAtendimento>[]>(
    () => [
      {
        chave: 'nome',
        rotulo: 'Pessoa',
        comparar: (a, b, direcao) =>
          compararTexto(a.responsavelAtendimentoNome, b.responsavelAtendimentoNome, direcao),
        render: (pacote, indiceGlobal) => (
          <UnstyledButton
            onClick={() =>
              onSelecionarColaborador({
                nome: pacote.responsavelAtendimentoNome,
                equipe: pacote.equipe,
                papel: 'Responsável pelo atendimento',
                cards: pacote.cards,
              })
            }
          >
            <Group gap="xs" wrap="nowrap" align="center">
              <Text size="xs" fw={700} c="dimmed" style={{ minWidth: 24, textAlign: 'right' }}>
                {indiceGlobal}º
              </Text>
              <UserAvatar
                nome={pacote.responsavelAtendimentoNome}
                fotoUrl={
                  pacote.responsavelAtendimentoId
                    ? fotos.get(pacote.responsavelAtendimentoId)
                    : undefined
                }
                size={32}
              />
              <Text
                size="sm"
                lineClamp={1}
                className="item-clicavel-hover"
                style={{ cursor: 'pointer' }}
              >
                {pacote.responsavelAtendimentoNome}
              </Text>
            </Group>
          </UnstyledButton>
        ),
      },
      {
        chave: 'equipe',
        rotulo: 'Equipe',
        comparar: (a, b, direcao) => compararTexto(a.equipe, b.equipe, direcao),
        render: (pacote) => (
          <Badge
            size="sm"
            variant="light"
            color={pacote.equipe === 'indefinido' ? 'gray' : undefined}
            style={
              pacote.equipe === 'indefinido'
                ? undefined
                : {
                    backgroundColor: `${COR_POR_EQUIPE[pacote.equipe]}22`,
                    color: COR_POR_EQUIPE[pacote.equipe],
                  }
            }
          >
            {pacote.equipe}
          </Badge>
        ),
      },
      {
        chave: 'total',
        rotulo: 'Tarefas',
        alinhamento: 'direita',
        direcaoInicial: 'desc',
        comparar: (a, b, direcao) => compararNumero(a.cards.length, b.cards.length, direcao),
        render: (pacote) => (
          <Text size="sm" fw={600} className="tabular-nums">
            {pacote.cards.length.toLocaleString('pt-BR')}
          </Text>
        ),
      },
    ],
    [fotos, onSelecionarColaborador],
  )

  return (
    <TabelaAnimadaPaginada
      dados={pacotes}
      colunas={colunas}
      chaveLinha={(pacote) => pacote.responsavelAtendimentoId ?? pacote.responsavelAtendimentoNome}
      ordenacaoInicial={{ chave: 'total', direcao: 'desc' }}
      itensPorPagina={10}
      estadoVazio={{
        titulo: 'Nenhuma tarefa no recorte atual',
        descricao: 'Ajuste os filtros para ver quem tem mais tarefas sob responsabilidade.',
      }}
    />
  )
}
