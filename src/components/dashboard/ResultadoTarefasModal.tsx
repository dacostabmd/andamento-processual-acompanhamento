import { Badge, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useMemo, useState } from 'react'
import type { TarefaLink } from '../../services/aiAssistantService'
import { EQUIPES_ATENDIMENTO } from '../../types/domain'
import { EstadoVazio } from '../EstadoVazio'
import { CabecalhoOrdenavel } from './CabecalhoOrdenavel'
import { compararData, compararNumero, compararTexto, useOrdenacaoTabela } from './ordenacao'
import { COR_POR_EQUIPE, formatarDataHora } from './tarefaApresentacao'

type ColunaResultado = 'id' | 'titulo' | 'fechadoPor' | 'equipe' | 'finalizado'

function normalizarBusca(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Cor da equipe só quando o valor bate com uma das 4 equipes conhecidas — o
 * worker pode devolver qualquer string (inclusive 'indefinido'), e forçar uma
 * cor nesse caso confundiria mais do que ajudaria. */
function corDaEquipe(equipe: string | undefined): string | undefined {
  if (!equipe) return undefined
  const conhecida = (EQUIPES_ATENDIMENTO as readonly string[]).includes(equipe)
  return conhecida ? COR_POR_EQUIPE[equipe as (typeof EQUIPES_ATENDIMENTO)[number]] : undefined
}

interface Props {
  /** `null` fecha o modal. Array vazio não deveria chegar aqui (o botão só existe com itens). */
  tarefas: TarefaLink[] | null
  aoFechar: () => void
}

/**
 * Modal com a listagem completa de tarefas de um resultado do assistente.
 *
 * Existe porque a bolha do chat não é lugar para uma lista de 40+ tarefas: o
 * usuário pediu um botão "Ver Resultado" em vez da lista inteira despejada
 * inline — o chat fica lendo o RESUMO, e quem quer o detalhe abre o modal.
 *
 * Reaproveita CabecalhoOrdenavel/ordenacao (já usados no ranking de fechamento
 * e no modal de tarefas por pessoa) em vez de outra ordenação ad-hoc.
 */
export function ResultadoTarefasModal({ tarefas, aoFechar }: Props) {
  const [busca, setBusca] = useState('')
  const { ordem, setOrdem, alternar } = useOrdenacaoTabela<ColunaResultado>({
    chave: 'id',
    direcao: 'asc',
  })

  // Própria memoização: sem ela, `tarefas ?? []` cria um array NOVO a cada
  // render quando o modal está fechado (tarefas null), e isso invalidaria a
  // memoização de `ordenadas` a cada render em vez de só quando o resultado muda.
  const lista = useMemo(() => tarefas ?? [], [tarefas])

  // Colunas de detalhe só aparecem quando pelo menos uma tarefa trouxe o
  // campo: consultas antigas (ou um worker ainda não atualizado na VPS) não
  // têm essas colunas, e uma tabela com coluna perpetuamente vazia confunde
  // mais do que ajuda.
  const temFechadoPor = useMemo(() => lista.some((t) => t.fechadoPorNome), [lista])
  const temEquipe = useMemo(() => lista.some((t) => t.equipe), [lista])
  const temFinalizado = useMemo(() => lista.some((t) => t.finalizadoEm), [lista])

  const ordenadas = useMemo(() => {
    const { chave, direcao } = ordem
    const comparar = (a: TarefaLink, b: TarefaLink): number => {
      switch (chave) {
        case 'titulo':
          return compararTexto(a.titulo, b.titulo, direcao)
        case 'fechadoPor':
          return compararTexto(a.fechadoPorNome, b.fechadoPorNome, direcao)
        case 'equipe':
          return compararTexto(a.equipe, b.equipe, direcao)
        case 'finalizado':
          return compararData(a.finalizadoEm, b.finalizadoEm, direcao)
        default:
          return compararNumero(a.id, b.id, direcao)
      }
    }
    return [...lista].sort((a, b) => comparar(a, b) || a.id - b.id)
  }, [lista, ordem])

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca)
    if (!termo) return ordenadas
    return ordenadas.filter((t) => {
      const tituloMatch = normalizarBusca(t.titulo ?? '').includes(termo)
      const idMatch = t.id ? String(t.id).includes(termo) : false
      const fechadoMatch = normalizarBusca(t.fechadoPorNome ?? '').includes(termo)
      const equipeMatch = normalizarBusca(t.equipe ?? '').includes(termo)
      return tituloMatch || idMatch || fechadoMatch || equipeMatch
    })
  }, [ordenadas, busca])

  return (
    <Modal
      opened={tarefas !== null}
      onClose={aoFechar}
      zIndex={1000}
      onExitTransitionEnd={() => {
        setBusca('')
        setOrdem({ chave: 'id', direcao: 'asc' })
      }}
      title={`Resultado — ${lista.length} tarefa(s)`}
      centered
      size="auto"
      styles={{
        content: {
          width:
            temFechadoPor || temEquipe || temFinalizado
              ? 'min(920px, calc(100vw - 2rem))'
              : 'min(720px, calc(100vw - 2rem))',
        },
      }}
      radius="md"
      transitionProps={{ transition: 'slide-up', duration: 250 }}
    >
      <Stack gap="sm">
        <TextInput
          placeholder="Buscar por título, ID, responsável ou equipe…"
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          size="xs"
        />

        {filtradas.length === 0 ? (
          busca ? (
            <Text size="sm" c="dimmed" py="md">
              Nenhuma tarefa encontrada para "{busca}".
            </Text>
          ) : (
            <EstadoVazio titulo="Nenhuma tarefa" descricao="Este resultado não trouxe tarefas." />
          )
        ) : (
          <div className="max-h-[420px] overflow-y-auto overflow-x-auto pr-1">
            <table className="w-full min-w-[420px] border-collapse text-sm table-fixed">
              <colgroup>
                <col className="w-24" />
                <col />
                {temFechadoPor && <col className="w-32" />}
                {temEquipe && <col className="w-32" />}
                {temFinalizado && <col className="w-32" />}
              </colgroup>
              <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--superficie)' }}>
                <tr style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
                  <CabecalhoOrdenavel
                    chave="id"
                    rotulo="Tarefa"
                    ordem={ordem}
                    aoOrdenar={alternar}
                  />
                  <CabecalhoOrdenavel
                    chave="titulo"
                    rotulo="Título"
                    ordem={ordem}
                    aoOrdenar={alternar}
                  />
                  {temFechadoPor && (
                    <CabecalhoOrdenavel
                      chave="fechadoPor"
                      rotulo="Fechado por"
                      ordem={ordem}
                      aoOrdenar={alternar}
                    />
                  )}
                  {temEquipe && (
                    <CabecalhoOrdenavel
                      chave="equipe"
                      rotulo="Equipe"
                      ordem={ordem}
                      aoOrdenar={alternar}
                    />
                  )}
                  {temFinalizado && (
                    <CabecalhoOrdenavel
                      chave="finalizado"
                      rotulo="Finalizado em"
                      ordem={ordem}
                      aoOrdenar={alternar}
                      direcaoInicial="desc"
                    />
                  )}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => {
                  const corEquipe = corDaEquipe(t.equipe)
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
                      <td className="px-2 py-2">
                        {t.link ? (
                          <a
                            href={t.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--mantine-color-blue-4)',
                              textDecoration: 'underline',
                            }}
                          >
                            {t.id}
                          </a>
                        ) : (
                          <Text size="sm">{t.id}</Text>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Text size="sm" lineClamp={1}>
                          {t.titulo ?? '—'}
                        </Text>
                      </td>
                      {temFechadoPor && (
                        <td className="px-2 py-2">
                          <Text size="sm" lineClamp={1}>
                            {t.fechadoPorNome ?? '—'}
                          </Text>
                        </td>
                      )}
                      {temEquipe && (
                        <td className="px-2 py-2">
                          {t.equipe ? (
                            <Badge
                              size="sm"
                              variant="light"
                              color={corEquipe ? undefined : 'gray'}
                              style={
                                corEquipe
                                  ? { backgroundColor: `${corEquipe}22`, color: corEquipe }
                                  : undefined
                              }
                            >
                              {t.equipe}
                            </Badge>
                          ) : (
                            <Text size="sm">—</Text>
                          )}
                        </td>
                      )}
                      {temFinalizado && (
                        <td className="px-2 py-2">
                          <Text size="xs">
                            {t.finalizadoEm ? formatarDataHora(t.finalizadoEm) : '—'}
                          </Text>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Stack>
    </Modal>
  )
}
