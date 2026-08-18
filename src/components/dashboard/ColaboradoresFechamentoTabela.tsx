import { ActionIcon, Badge, Group, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { useMemo } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import { montarCaminhoPerfilBitrix, montarUrlPerfilBitrix } from '../../services/bitrixPortal'
import { abrirNoPortal } from '../../services/bitrixSdk'
import type { RankingFechador, Tarefa } from '../../types/domain'
import { idsColaboradoresDasTarefas } from '../../utils/pessoas'
import { calcularRankingFechadores, tarefasDaPessoa } from '../../utils/tarefasMetrics'
import { UserAvatar } from '../UserAvatar'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { compararNumero, compararTexto } from './ordenacao'
import { COR_POR_EQUIPE } from './tarefaApresentacao'
import { TabelaAnimadaPaginada, type ColunaTabelaAnimada } from './TabelaAnimadaPaginada'

interface ColaboradoresFechamentoTabelaProps {
  tarefasFiltradas: Tarefa[]
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
}

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

/** Pontualidade em percentual, excluindo quem não tem nenhuma tarefa com prazo julgável. */
function pontualidade(linha: RankingFechador): number | null {
  const comPrazo = linha.noPrazo + linha.comAtraso
  return comPrazo === 0 ? null : (linha.noPrazo / comPrazo) * 100
}

/** "Colaboradores que mais fecharam" — mesmos dados de `RankingFechadores.tsx`, na tabela animada paginada. */
export function ColaboradoresFechamentoTabela({
  tarefasFiltradas,
  onSelecionarColaborador,
}: ColaboradoresFechamentoTabelaProps) {
  const dados = useMemo(() => calcularRankingFechadores(tarefasFiltradas), [tarefasFiltradas])
  const idsColaboradores = useMemo(
    () => idsColaboradoresDasTarefas(tarefasFiltradas),
    [tarefasFiltradas],
  )
  const fotos = useFotosColaboradores(idsColaboradores)

  const colunas = useMemo<ColunaTabelaAnimada<RankingFechador>[]>(
    () => [
      {
        chave: 'nome',
        rotulo: 'Pessoa',
        comparar: (a, b, direcao) => compararTexto(a.nome, b.nome, direcao),
        render: (linha, indiceGlobal) => (
          <UnstyledButton
            onClick={() =>
              onSelecionarColaborador({
                nome: linha.nome,
                equipe: linha.equipe,
                papel: 'Fechado por',
                cards: tarefasDaPessoa(tarefasFiltradas, {
                  tipo: 'fechadoPor',
                  id: linha.fechadoPorId,
                }),
              })
            }
          >
            <Group gap="xs" wrap="nowrap" align="center">
              <Text size="xs" fw={700} c="dimmed" style={{ minWidth: 24, textAlign: 'right' }}>
                {indiceGlobal}º
              </Text>
              <UserAvatar nome={linha.nome} fotoUrl={fotos.get(linha.fechadoPorId)} size={32} />
              <Text
                size="sm"
                lineClamp={1}
                className="item-clicavel-hover"
                style={{ cursor: 'pointer' }}
              >
                {linha.nome}
              </Text>
            </Group>
          </UnstyledButton>
        ),
      },
      {
        chave: 'equipe',
        rotulo: 'Equipe',
        comparar: (a, b, direcao) => compararTexto(a.equipe, b.equipe, direcao),
        render: (linha) => (
          <Badge
            size="sm"
            variant="light"
            color={linha.equipe === 'indefinido' ? 'gray' : undefined}
            style={
              linha.equipe === 'indefinido'
                ? undefined
                : {
                    backgroundColor: `${COR_POR_EQUIPE[linha.equipe]}22`,
                    color: COR_POR_EQUIPE[linha.equipe],
                  }
            }
          >
            {linha.equipe}
          </Badge>
        ),
      },
      {
        chave: 'total',
        rotulo: 'Fechados',
        alinhamento: 'direita',
        direcaoInicial: 'desc',
        comparar: (a, b, direcao) => compararNumero(a.total, b.total, direcao),
        render: (linha) => (
          <Text size="sm" fw={600} className="tabular-nums">
            {linha.total.toLocaleString('pt-BR')}
          </Text>
        ),
      },
      {
        chave: 'pontualidade',
        rotulo: '% no prazo',
        alinhamento: 'direita',
        direcaoInicial: 'desc',
        comparar: (a, b, direcao) => compararNumero(pontualidade(a), pontualidade(b), direcao),
        render: (linha) => {
          const pct = pontualidade(linha)
          return (
            <Text size="sm" className="tabular-nums">
              {pct === null ? '—' : `${pct.toFixed(0)}%`}
            </Text>
          )
        },
      },
    ],
    [fotos, onSelecionarColaborador, tarefasFiltradas],
  )

  return (
    <>
      <Text size="xs" c="dimmed" mb="sm">
        {dados.totalFechado.toLocaleString('pt-BR')} tarefa(s) fechada(s) por {dados.linhas.length}{' '}
        pessoa(s) no recorte atual.
      </Text>
      <TabelaAnimadaPaginada
        dados={dados.linhas}
        colunas={colunas}
        chaveLinha={(linha) => linha.fechadoPorId}
        ordenacaoInicial={{ chave: 'total', direcao: 'desc' }}
        itensPorPagina={10}
        colunaAcao={{
          rotulo: 'Ação',
          render: (linha) => {
            const url = montarUrlPerfilBitrix(linha.fechadoPorId)
            const caminho = montarCaminhoPerfilBitrix(linha.fechadoPorId)
            if (!url || !caminho) return null
            return (
              <Tooltip label="Abrir perfil no Bitrix" withArrow>
                <ActionIcon
                  component="button"
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={() => abrirNoPortal(caminho, url)}
                  aria-label="Abrir perfil no Bitrix"
                >
                  <IconeAbrirBitrix />
                </ActionIcon>
              </Tooltip>
            )
          },
        }}
        estadoVazio={{
          titulo: 'Nenhuma tarefa fechada no recorte atual',
          descricao: 'Ajuste os filtros ou o período para ver quem está fechando tarefas.',
        }}
      />
    </>
  )
}
