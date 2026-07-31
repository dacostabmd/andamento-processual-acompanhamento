import { Badge, Progress, Text, TextInput, Tooltip } from '@mantine/core'
import { useMemo, useState } from 'react'
import type { RankingFechadores as DadosRanking, RankingFechador } from '../../types/domain'
import { EstadoVazio } from '../EstadoVazio'
import { PilulaDeslizante, type OpcaoPilula } from './PilulaDeslizante'
import { COR_POR_EQUIPE } from './tarefaApresentacao'

type Coluna = 'total' | 'noPrazo' | 'comAtraso' | 'nome'

const ORDENACOES: ReadonlyArray<OpcaoPilula<Coluna>> = [
  { valor: 'total', rotulo: 'Volume' },
  { valor: 'noPrazo', rotulo: 'No prazo' },
  { valor: 'comAtraso', rotulo: 'Com atraso' },
  { valor: 'nome', rotulo: 'A–Z' },
]

interface Props {
  dados: DadosRanking
}

/**
 * Ranking de quem mais fecha tarefas (campo `closedBy` do Bitrix).
 *
 * Complementa o gráfico "Fechado por", que mostra apenas o top 10 num gráfico de
 * barras. Com 103 pessoas fechando tarefas, o top 10 esconde 90% delas, e a
 * barra não permite comparar pontualidade nem saber de qual equipe é cada pessoa.
 *
 * Aqui a lista é completa, ordenável e buscável, e cada linha traz a repartição
 * por prazo — porque volume alto com muito atraso não é a mesma leitura que
 * volume alto no prazo.
 */
export function RankingFechadores({ dados }: Props) {
  const [busca, setBusca] = useState('')
  const [coluna, setColuna] = useState<Coluna>('total')

  const linhas = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')

    const filtradas = termo
      ? dados.linhas.filter((l) =>
          `${l.nome} ${l.equipe} ${l.setor ?? ''} ${l.supervisor ?? ''}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .includes(termo),
        )
      : dados.linhas

    const ordenadas = [...filtradas]
    ordenadas.sort((a, b) => {
      if (coluna === 'nome') return a.nome.localeCompare(b.nome)
      return b[coluna] - a[coluna] || a.nome.localeCompare(b.nome)
    })
    return ordenadas
  }, [dados.linhas, busca, coluna])

  if (dados.totalFechado === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma tarefa fechada no recorte atual"
        descricao="Ajuste os filtros ou o período para ver quem está fechando tarefas."
      />
    )
  }

  const liderTotal = dados.linhas[0]?.total ?? 1

  return (
    <div className="flex flex-col gap-3">
      {/* Cobertura: sem isto o ranking parece cobrir todas as tarefas, quando só
          as concluídas têm fechador. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Text size="sm" fw={600}>
          {dados.totalFechado.toLocaleString('pt-BR')} tarefas fechadas por{' '}
          {dados.linhas.length} pessoa(s)
        </Text>
        {dados.naoConcluidas > 0 && (
          <Text size="xs" c="dimmed">
            {dados.naoConcluidas.toLocaleString('pt-BR')} tarefa(s) ainda não concluída(s) não entram
            neste ranking
          </Text>
        )}
        {dados.pessoasSemSupervisor > 0 && (
          <Text size="xs" c="dimmed">
            · {dados.pessoasSemSupervisor} pessoa(s) sem supervisor cadastrado no Bitrix
          </Text>
        )}
        {dados.concluidasSemFechador > 0 && (
          <Text size="xs" c="dimmed">
            · {dados.concluidasSemFechador.toLocaleString('pt-BR')} concluído(s) sem fechador
            identificado
          </Text>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          placeholder="Buscar pessoa, setor ou supervisor…"
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          size="xs"
          className="min-w-[220px] flex-1"
        />
        <PilulaDeslizante
          opcoes={ORDENACOES}
          valor={coluna}
          onChange={setColuna}
          rotuloAcessivel="Ordenar ranking por"
          className="gap-0.5 p-0.5"
          classNameOpcao="px-3 py-1 text-xs font-semibold"
          recuo={2}
          style={{
            backgroundColor: 'var(--superficie)',
            border: '1px solid var(--superficie-borda)',
          }}
        />
      </div>

      {/* Overflow no container, não no body: a tabela é larga no celular. */}
      <div className="overflow-x-auto">
        <div className="max-h-[420px] min-w-[760px] overflow-y-auto">
          {linhas.length === 0 ? (
            <Text size="sm" c="dimmed" py="md">
              Nenhuma pessoa encontrada para “{busca}”.
            </Text>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--superficie)' }}>
                <tr style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
                  <th className="w-10 px-2 py-2 text-left font-semibold opacity-70">#</th>
                  <th className="px-2 py-2 text-left font-semibold opacity-70">Pessoa</th>
                  <th className="px-2 py-2 text-left font-semibold opacity-70">Setor</th>
                  <th className="px-2 py-2 text-left font-semibold opacity-70">Supervisor</th>
                  <th className="w-32 px-2 py-2 text-right font-semibold opacity-70">Fechados</th>
                  <th className="w-40 px-2 py-2 text-left font-semibold opacity-70">
                    Prazo (no prazo / atraso)
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, indice) => (
                  <LinhaFechador
                    key={linha.fechadoPorId}
                    linha={linha}
                    posicao={indice + 1}
                    liderTotal={liderTotal}
                    ordenadoPorVolume={coluna === 'total'}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function LinhaFechador({
  linha,
  posicao,
  liderTotal,
  ordenadoPorVolume,
}: {
  linha: RankingFechador
  posicao: number
  liderTotal: number
  ordenadoPorVolume: boolean
}) {
  // Base da pontualidade exclui os sem prazo: dividir por `total` puniria quem
  // fecha muitas tarefas que nunca tiveram prazo definido.
  const comPrazo = linha.noPrazo + linha.comAtraso
  const pctNoPrazo = comPrazo === 0 ? null : (linha.noPrazo / comPrazo) * 100

  return (
    <tr style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
      <td className="px-2 py-2 tabular-nums opacity-60">
        {/* A posição só é significativa quando a ordenação é por volume. */}
        {ordenadoPorVolume ? posicao : '–'}
      </td>
      <td className="px-2 py-2">
        <Text size="sm" fw={posicao <= 3 && ordenadoPorVolume ? 700 : 400} lineClamp={1}>
          {linha.nome}
        </Text>
      </td>
      {/* Setor é o departamento cadastrado na pessoa — mais específico que a
          equipe, e cobre também quem está fora das 4 equipes de andamento
          (FINANCEIRO, JURÍDICO, NEGOCIAÇÃO E ACORDOS…). */}
      <td className="px-2 py-2">
        {linha.setor ? (
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
            {linha.setor}
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">
            sem setor
          </Text>
        )}
      </td>
      <td className="px-2 py-2">
        {linha.supervisor ? (
          <Text size="sm" lineClamp={1}>
            {linha.supervisor}
          </Text>
        ) : (
          // Ausência é falta de cadastro no Bitrix, não ausência de chefia — o
          // rótulo diz isso, em vez de deixar a célula vazia.
          <Tooltip label="O departamento desta pessoa não tem supervisor definido no Bitrix" withArrow>
            <Text size="xs" c="dimmed">
              não cadastrado
            </Text>
          </Tooltip>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <Text size="sm" fw={600} className="tabular-nums">
            {linha.total.toLocaleString('pt-BR')}
          </Text>
          <Text size="xs" c="dimmed" className="tabular-nums">
            {linha.percentual.toFixed(1)}%
          </Text>
        </div>
        {/* Barra relativa ao líder: dá a proporção sem precisar ler os números. */}
        <Progress
          value={(linha.total / liderTotal) * 100}
          size="xs"
          mt={4}
          color="#2f6fb0"
          aria-label={`${linha.total} tarefas fechadas`}
        />
      </td>
      <td className="px-2 py-2">
        {pctNoPrazo === null ? (
          <Text size="xs" c="dimmed">
            sem prazo definido
          </Text>
        ) : (
          <Tooltip
            label={`${linha.noPrazo} no prazo, ${linha.comAtraso} com atraso${
              linha.semPrazo ? `, ${linha.semPrazo} sem prazo` : ''
            }`}
            withArrow
          >
            <div className="flex items-center gap-2">
              <Progress.Root size="sm" className="min-w-[70px] flex-1">
                <Progress.Section value={pctNoPrazo} color="#158a6f" />
                <Progress.Section value={100 - pctNoPrazo} color="#c0395a" />
              </Progress.Root>
              <Text size="xs" c="dimmed" className="tabular-nums whitespace-nowrap">
                {pctNoPrazo.toFixed(0)}%
              </Text>
            </div>
          </Tooltip>
        )}
      </td>
    </tr>
  )
}
