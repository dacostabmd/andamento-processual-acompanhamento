import { Badge, Group, Progress, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import type { RankingFechadores as DadosRanking, RankingFechador, Tarefa } from '../../types/domain'
import { idsColaboradoresDasTarefas } from '../../utils/pessoas'
import { tarefasDaPessoa } from '../../utils/tarefasMetrics'
import { UserAvatar } from '../UserAvatar'
import { EstadoVazio } from '../EstadoVazio'
import { CabecalhoOrdenavel } from './CabecalhoOrdenavel'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { compararNumero, compararTexto, useOrdenacaoTabela, type DirecaoOrdem } from './ordenacao'
import { PilulaDeslizante, type OpcaoPilula } from './PilulaDeslizante'
import { COR_POR_EQUIPE } from './tarefaApresentacao'

type Coluna = 'total' | 'noPrazo' | 'comAtraso' | 'nome' | 'setor' | 'supervisor' | 'pontualidade'

type ColunaAtalho = 'total' | 'noPrazo' | 'comAtraso' | 'nome'

/**
 * Atalhos de ordenação. Continuam existindo depois dos cabeçalhos clicáveis
 * porque duas das leituras mais pedidas — "quem tem mais atraso" e "quem tem
 * mais no prazo" em número absoluto — não são colunas próprias: aparecem
 * dentro da barra de prazo, que ordena por PERCENTUAL.
 */
const ORDENACOES: ReadonlyArray<OpcaoPilula<ColunaAtalho>> = [
  { valor: 'total', rotulo: 'Volume' },
  { valor: 'noPrazo', rotulo: 'No prazo' },
  { valor: 'comAtraso', rotulo: 'Com atraso' },
  { valor: 'nome', rotulo: 'A–Z' },
]

/** Direção que cada atalho representa — usada para saber se ele está ativo. */
const DIRECAO_DO_ATALHO: Record<ColunaAtalho, DirecaoOrdem> = {
  total: 'desc',
  noPrazo: 'desc',
  comAtraso: 'desc',
  nome: 'asc',
}

/**
 * Pontualidade em percentual, excluindo quem não tem nenhuma tarefa com prazo
 * (esses ficam no fim da ordenação, não em 0%).
 */
function pontualidade(linha: RankingFechador): number | null {
  const comPrazo = linha.noPrazo + linha.comAtraso
  return comPrazo === 0 ? null : (linha.noPrazo / comPrazo) * 100
}

interface Props {
  dados: DadosRanking
  /** Tarefas cruas do recorte atual — usadas para resolver as tarefas de uma pessoa ao clicar no nome dela. */
  tarefas: Tarefa[]
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
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
export function RankingFechadores({ dados, tarefas, onSelecionarColaborador }: Props) {
  const [busca, setBusca] = useState('')
  const idsColaboradores = useMemo(() => idsColaboradoresDasTarefas(tarefas), [tarefas])
  const fotos = useFotosColaboradores(idsColaboradores)
  const { ordem, setOrdem, alternar } = useOrdenacaoTabela<Coluna>({
    chave: 'total',
    direcao: 'desc',
  })

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

    const filtradas = termo
      ? dados.linhas.filter((l) =>
          `${l.nome} ${l.equipe} ${l.setor ?? ''} ${l.supervisor ?? ''}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .includes(termo),
        )
      : dados.linhas

    const { chave, direcao } = ordem
    const comparar = (a: RankingFechador, b: RankingFechador): number => {
      switch (chave) {
        case 'nome':
          return compararTexto(a.nome, b.nome, direcao)
        case 'setor':
          return compararTexto(a.setor, b.setor, direcao)
        case 'supervisor':
          return compararTexto(a.supervisor, b.supervisor, direcao)
        case 'pontualidade':
          return compararNumero(pontualidade(a), pontualidade(b), direcao)
        default:
          return compararNumero(a[chave], b[chave], direcao)
      }
    }
    // Desempate sempre por nome: com 103 pessoas, muitos empates de contagem.
    return [...filtradas].sort((a, b) => comparar(a, b) || compararTexto(a.nome, b.nome, 'asc'))
  }, [dados.linhas, busca, ordem])

  // O atalho só fica aceso se a ordenação atual for exatamente a dele — clicar
  // num cabeçalho fora dos atalhos apaga todos, em vez de mentir.
  const atalhoAtivo =
    ORDENACOES.find((o) => o.valor === ordem.chave && DIRECAO_DO_ATALHO[o.valor] === ordem.direcao)
      ?.valor ?? null

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
          {dados.totalFechado.toLocaleString('pt-BR')} tarefas fechadas por {dados.linhas.length}{' '}
          pessoa(s)
        </Text>
        {dados.naoConcluidas > 0 && (
          <Text size="xs" c="dimmed">
            {dados.naoConcluidas.toLocaleString('pt-BR')} tarefa(s) ainda não concluída(s) não
            entram neste ranking
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
          valor={atalhoAtivo}
          onChange={(valor) => setOrdem({ chave: valor, direcao: DIRECAO_DO_ATALHO[valor] })}
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
                  <CabecalhoOrdenavel
                    chave="nome"
                    rotulo="Pessoa"
                    ordem={ordem}
                    aoOrdenar={alternar}
                  />
                  <CabecalhoOrdenavel
                    chave="setor"
                    rotulo="Setor"
                    ordem={ordem}
                    aoOrdenar={alternar}
                  />
                  <CabecalhoOrdenavel
                    chave="supervisor"
                    rotulo="Supervisor"
                    ordem={ordem}
                    aoOrdenar={alternar}
                  />
                  <CabecalhoOrdenavel
                    chave="total"
                    rotulo="Fechados"
                    ordem={ordem}
                    aoOrdenar={alternar}
                    direcaoInicial="desc"
                    alinhamento="direita"
                    className="w-32"
                  />
                  {/* Ordena pelo PERCENTUAL no prazo; os números absolutos
                      continuam nos atalhos acima. */}
                  <CabecalhoOrdenavel
                    chave="pontualidade"
                    rotulo="Prazo (% no prazo)"
                    ordem={ordem}
                    aoOrdenar={alternar}
                    direcaoInicial="desc"
                    className="w-40"
                  />
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, indice) => (
                  <LinhaFechador
                    key={linha.fechadoPorId}
                    linha={linha}
                    posicao={indice + 1}
                    liderTotal={liderTotal}
                    ordenadoPorVolume={ordem.chave === 'total' && ordem.direcao === 'desc'}
                    tarefas={tarefas}
                    fotoUrl={fotos.get(linha.fechadoPorId)}
                    onSelecionarColaborador={onSelecionarColaborador}
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
  tarefas,
  fotoUrl,
  onSelecionarColaborador,
}: {
  linha: RankingFechador
  posicao: number
  liderTotal: number
  ordenadoPorVolume: boolean
  tarefas: Tarefa[]
  fotoUrl: string | undefined
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
}) {
  // Base da pontualidade exclui os sem prazo: dividir por `total` puniria quem
  // fecha muitas tarefas que nunca tiveram prazo definido. Mesma função usada
  // na ordenação, para a coluna e a ordem nunca discordarem.
  const pctNoPrazo = pontualidade(linha)

  return (
    <tr style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
      <td className="px-2 py-2 tabular-nums opacity-60">
        {/* A posição só é significativa quando a ordenação é por volume. */}
        {ordenadoPorVolume ? posicao : '–'}
      </td>
      <td className="px-2 py-2">
        <UnstyledButton
          onClick={() =>
            onSelecionarColaborador({
              nome: linha.nome,
              equipe: linha.equipe,
              papel: 'Fechado por',
              cards: tarefasDaPessoa(tarefas, { tipo: 'fechadoPor', id: linha.fechadoPorId }),
            })
          }
        >
          <Group gap="xs" wrap="nowrap" align="center">
            <UserAvatar nome={linha.nome} fotoUrl={fotoUrl} size={35} />
            <Text
              size="sm"
              fw={posicao <= 3 && ordenadoPorVolume ? 700 : 400}
              lineClamp={1}
              className="item-clicavel-hover"
              style={{ cursor: 'pointer' }}
            >
              {linha.nome}
            </Text>
          </Group>
        </UnstyledButton>
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
          <Tooltip
            label="O departamento desta pessoa não tem supervisor definido no Bitrix"
            withArrow
          >
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
