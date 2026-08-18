import { Pagination, Table } from '@mantine/core'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { EstadoVazio } from '../EstadoVazio'
import { CorNavegacaoAtiva } from '../../theme'
import { CabecalhoOrdenavel } from './CabecalhoOrdenavel'
import { useOrdenacaoTabela, type DirecaoOrdem, type EstadoOrdem } from './ordenacao'
import classes from './TabelaAnimadaPaginada.module.css'

type Alinhamento = 'esquerda' | 'direita' | 'centro'

const CLASSE_ALINHAMENTO: Record<Alinhamento, string> = {
  esquerda: 'text-left',
  direita: 'text-right',
  centro: 'text-center',
}

const CLASSES_PAGINACAO = {
  root: classes.paginacaoRoot,
  control: classes.paginacaoControl,
  dots: classes.paginacaoDots,
}

export interface ColunaTabelaAnimada<T> {
  chave: string
  rotulo: string
  render: (item: T, indiceGlobal: number) => ReactNode
  /** Omitir torna a coluna não ordenável (cabeçalho vira `<th>` simples). */
  comparar?: (a: T, b: T, direcao: DirecaoOrdem) => number
  alinhamento?: Alinhamento
  /** Direção do PRIMEIRO clique nesta coluna — repassada ao `CabecalhoOrdenavel`. */
  direcaoInicial?: DirecaoOrdem
  /** Classes de largura da coluna (ex.: "w-32"). */
  className?: string
}

export interface TabelaAnimadaPaginadaProps<T> {
  dados: T[]
  colunas: ColunaTabelaAnimada<T>[]
  chaveLinha: (item: T) => string | number
  ordenacaoInicial: EstadoOrdem<string>
  /** @default 10 */
  itensPorPagina?: number
  /** Coluna final não ordenável, ex.: botão "abrir no Bitrix". */
  colunaAcao?: { rotulo: string; render: (item: T) => ReactNode }
  estadoVazio?: { titulo: string; descricao?: string }
  /** Callback para tratar clique em qualquer lugar da linha. */
  onLinhaClique?: (item: T) => void
}

/**
 * Tabela genérica, ordenável e paginada, construída sobre os primitivos reais
 * do Mantine (`Table`), reaproveitando `useOrdenacaoTabela`/`CabecalhoOrdenavel`
 * (mesmas peças do ranking de fechamento e do modal de tarefas da pessoa) em
 * vez de reimplementar ordenação.
 *
 * Cada linha entra com uma animação de slide-in-from-right escalonada pelo
 * índice DENTRO da página atual — o escalonamento reaparece naturally
 * sempre que a página muda, já que o índice reinicia em 0.
 *
 * Componente genérico e sem conhecimento de domínio: quem usa decide o que
 * cada coluna renderiza e como ela compara (via `ColunaTabelaAnimada.comparar`).
 */
export function TabelaAnimadaPaginada<T>({
  dados,
  colunas,
  chaveLinha,
  ordenacaoInicial,
  itensPorPagina = 10,
  colunaAcao,
  estadoVazio,
  onLinhaClique,
}: TabelaAnimadaPaginadaProps<T>) {
  const { ordem, alternar } = useOrdenacaoTabela<string>(ordenacaoInicial)
  const [pagina, setPagina] = useState(1)

  // Defensivo: se a coluna ativa não tiver `comparar` (não deveria acontecer,
  // já que só colunas com `comparar` alimentam o estado de ordenação), mantém
  // a ordem recebida em vez de quebrar.
  const dadosOrdenados = useMemo(() => {
    const colunaAtiva = colunas.find((coluna) => coluna.chave === ordem.chave)
    if (!colunaAtiva?.comparar) return dados
    const comparar = colunaAtiva.comparar
    return [...dados].sort((a, b) => comparar(a, b, ordem.direcao))
  }, [dados, colunas, ordem])

  const totalPaginas = Math.max(1, Math.ceil(dadosOrdenados.length / itensPorPagina))

  // Clampa a página quando o total muda (filtro reduziu os dados, página
  // deixou de existir) — sem isto a tabela pode renderizar vazia numa página
  // "fantasma" enquanto o total de páginas diminui.
  useEffect(() => {
    setPagina((atual) => Math.min(Math.max(atual, 1), totalPaginas))
  }, [totalPaginas])

  const inicio = (pagina - 1) * itensPorPagina
  const linhasPagina = dadosOrdenados.slice(inicio, inicio + itensPorPagina)

  if (dados.length === 0) {
    return (
      <EstadoVazio
        titulo={estadoVazio?.titulo ?? 'Nenhum registro encontrado'}
        descricao={estadoVazio?.descricao}
      />
    )
  }

  return (
    <div className={classes.container}>
      <div className={classes.scrollArea}>
        <Table className={classes.tabela} verticalSpacing="xs" horizontalSpacing="sm">
          <Table.Thead className={classes.cabecalho}>
            <tr>
              {colunas.map((coluna) =>
                coluna.comparar ? (
                  <CabecalhoOrdenavel
                    key={coluna.chave}
                    chave={coluna.chave}
                    rotulo={coluna.rotulo}
                    ordem={ordem}
                    aoOrdenar={alternar}
                    direcaoInicial={coluna.direcaoInicial}
                    alinhamento={coluna.alinhamento}
                    className={coluna.className}
                  />
                ) : (
                  <th
                    key={coluna.chave}
                    scope="col"
                    className={`px-2 py-2 font-semibold opacity-70 ${
                      CLASSE_ALINHAMENTO[coluna.alinhamento ?? 'esquerda']
                    } ${coluna.className ?? ''}`}
                  >
                    {coluna.rotulo}
                  </th>
                ),
              )}
              {colunaAcao && (
                <th scope="col" className="px-2 py-2 text-right font-semibold opacity-70">
                  {colunaAcao.rotulo}
                </th>
              )}
            </tr>
          </Table.Thead>
          <Table.Tbody>
            {linhasPagina.map((item, indiceNaPagina) => {
              const indiceGlobal = inicio + indiceNaPagina + 1
              return (
                <motion.tr
                  key={chaveLinha(item)}
                  className={`${classes.linha} ${onLinhaClique ? classes.linhaClicavel : ''}`}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.22, delay: indiceNaPagina * 0.03, ease: 'easeOut' }}
                  onClick={() => onLinhaClique?.(item)}
                  style={onLinhaClique ? { cursor: 'pointer' } : undefined}
                >
                  {colunas.map((coluna) => (
                    <td
                      key={coluna.chave}
                      className={`px-2 py-2 ${CLASSE_ALINHAMENTO[coluna.alinhamento ?? 'esquerda']} ${
                        coluna.className ?? ''
                      }`}
                    >
                      {coluna.render(item, indiceGlobal)}
                    </td>
                  ))}
                  {colunaAcao && (
                    <td
                      className="px-2 py-2 text-right"
                      onClick={(e) => {
                        // Evita que o clique do botão de ação propague para a linha
                        e.stopPropagation()
                      }}
                    >
                      {colunaAcao.render(item)}
                    </td>
                  )}
                </motion.tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </div>

      {totalPaginas > 1 && (
        <div className={classes.paginacaoWrapper}>
          <Pagination
            total={totalPaginas}
            value={pagina}
            onChange={setPagina}
            classNames={CLASSES_PAGINACAO}
            color={CorNavegacaoAtiva}
            radius="md"
          />
        </div>
      )}
    </div>
  )
}
