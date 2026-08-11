import { Modal, Stack, Text, TextInput } from '@mantine/core'
import { useMemo, useState } from 'react'
import type { TarefaLink } from '../../services/aiAssistantService'
import { EstadoVazio } from '../EstadoVazio'
import { CabecalhoOrdenavel } from './CabecalhoOrdenavel'
import { compararNumero, compararTexto, useOrdenacaoTabela } from './ordenacao'

type ColunaResultado = 'id' | 'titulo'

function normalizarBusca(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

  const ordenadas = useMemo(() => {
    const { chave, direcao } = ordem
    const comparar =
      chave === 'titulo'
        ? (a: TarefaLink, b: TarefaLink) => compararTexto(a.titulo, b.titulo, direcao)
        : (a: TarefaLink, b: TarefaLink) => compararNumero(a.id, b.id, direcao)
    return [...lista].sort((a, b) => comparar(a, b) || a.id - b.id)
  }, [lista, ordem])

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca)
    if (!termo) return ordenadas
    return ordenadas.filter((t) => normalizarBusca(t.titulo ?? '').includes(termo))
  }, [ordenadas, busca])

  return (
    <Modal
      opened={tarefas !== null}
      onClose={aoFechar}
      onExitTransitionEnd={() => {
        setBusca('')
        setOrdem({ chave: 'id', direcao: 'asc' })
      }}
      title={`Resultado — ${lista.length} tarefa(s)`}
      centered
      size="auto"
      styles={{ content: { width: 'min(720px, calc(100vw - 2rem))' } }}
      radius="md"
      transitionProps={{ transition: 'slide-up', duration: 250 }}
    >
      <Stack gap="sm">
        <TextInput
          placeholder="Buscar por título da tarefa…"
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
              </colgroup>
              <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--superficie)' }}>
                <tr style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
                  <CabecalhoOrdenavel chave="id" rotulo="Tarefa" ordem={ordem} aoOrdenar={alternar} />
                  <CabecalhoOrdenavel chave="titulo" rotulo="Título" ordem={ordem} aoOrdenar={alternar} />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
                    <td className="px-2 py-2">
                      {t.link ? (
                        <a
                          href={t.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--mantine-color-blue-4)', textDecoration: 'underline' }}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Stack>
    </Modal>
  )
}
