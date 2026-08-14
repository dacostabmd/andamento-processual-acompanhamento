import {
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { obterAuditoriaCadastro } from '../../services/cadastroPessoasApi'
import { ROTULO_CAMPO_CADASTRO, type Colaborador, type HistoricoCadastro } from '../../types/domain'
import { EstadoVazio } from '../EstadoVazio'
import classesInput from './FiltrosPainel.module.css'
import classes from './AuditoriaCadastroPanel.module.css'

const CLASSES_INPUT = {
  input: classesInput.input,
  label: classesInput.label,
  section: classesInput.secao,
  dropdown: classesInput.dropdown,
  option: classesInput.option,
}

interface AuditoriaCadastroPanelProps {
  aberto: boolean
  colaborador: Colaborador | null
  onFechar: () => void
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Data e hora no fuso local, curtas — a coluna precisa caber ao lado das outras. */
function formatarInstante(iso: string): string {
  const data = new Date(iso)
  return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/**
 * Log de auditoria do cadastro de pessoas: quem alterou o quê, quando, e de que
 * para que.
 *
 * A tabela `pessoas_cadastro_log` no worker nunca sofre UPDATE nem DELETE — nem
 * quando a pessoa perde todas as definições manuais e a linha dela sai de
 * `pessoas_cadastro`. É o que permite responder "quem mudou o supervisor desta
 * pessoa" meses depois, que é a pergunta inevitável no primeiro número de métrica
 * que alguém contestar.
 *
 * Visível só para Caio Marques, por pedido do usuário. A lista de permissão no
 * worker (IDS_AUDITORIA_CADASTRO) é separada da de edição, e mais restrita: quem é
 * auditado não é a mesma população de quem audita.
 */
export function AuditoriaCadastroPanel({
  aberto,
  colaborador,
  onFechar,
}: AuditoriaCadastroPanelProps) {
  const [historico, setHistorico] = useState<HistoricoCadastro[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [truncado, setTruncado] = useState(false)
  const [busca, setBusca] = useState('')
  const [campo, setCampo] = useState<string | null>(null)
  const [autor, setAutor] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const dados = await obterAuditoriaCadastro(colaborador)
      setHistorico(dados.historico)
      setTruncado(dados.truncado)
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o log de auditoria.')
    } finally {
      setCarregando(false)
    }
  }, [colaborador])

  useEffect(() => {
    if (!aberto) return
    void carregar()
  }, [aberto, carregar])

  const autores = useMemo(
    () =>
      [...new Set(historico.map((h) => h.autorNome))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [historico],
  )

  const filtrado = useMemo(() => {
    const alvo = normalizar(busca)
    return historico.filter((h) => {
      if (campo && h.campo !== campo) return false
      if (autor && h.autorNome !== autor) return false
      if (!alvo) return true
      // A busca cobre pessoa editada, autor e os dois valores: quem procura "SP"
      // quer achar tanto quem recebeu a UF quanto quem a perdeu.
      const texto = normalizar(
        [h.usuarioNome ?? '', h.autorNome, h.valorAnterior ?? '', h.valorNovo ?? ''].join(' '),
      )
      return texto.includes(alvo)
    })
  }, [historico, busca, campo, autor])

  return (
    <Modal
      opened={aberto}
      onClose={onFechar}
      fullScreen
      zIndex={340}
      title={
        <Title order={3} className={classes.titulo}>
          Auditoria — alterações no cadastro de pessoas
        </Title>
      }
      transitionProps={{ transition: 'slide-up', duration: 250 }}
    >
      <div className={classes.conteudo}>
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            Uma linha por campo alterado, com o valor anterior. Este registro nunca é apagado — nem
            quando a pessoa perde todas as definições manuais, nem quando ela sai do portal.
          </Text>

          <Group align="flex-end" gap="md" wrap="wrap">
            <TextInput
              radius="lg"
              classNames={CLASSES_INPUT}
              label="Buscar"
              placeholder="Pessoa, autor ou valor"
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              className={classes.campoBusca}
            />
            <Select
              radius="lg"
              classNames={CLASSES_INPUT}
              label="Campo"
              placeholder="Todos"
              data={Object.entries(ROTULO_CAMPO_CADASTRO).map(([valor, rotulo]) => ({
                value: valor,
                label: rotulo,
              }))}
              value={campo}
              onChange={setCampo}
              clearable
              className={classes.campoFiltro}
            />
            <Select
              radius="lg"
              classNames={CLASSES_INPUT}
              label="Quem alterou"
              placeholder="Todos"
              data={autores}
              value={autor}
              onChange={setAutor}
              searchable
              clearable
              className={classes.campoFiltro}
            />
            <Button
              variant="default"
              size="xs"
              onClick={() => {
                setBusca('')
                setCampo(null)
                setAutor(null)
              }}
            >
              Limpar filtros
            </Button>
            <Button
              variant="default"
              size="xs"
              onClick={() => void carregar()}
              loading={carregando}
            >
              Atualizar
            </Button>
            <Text size="sm" c="dimmed">
              {filtrado.length} de {historico.length} alteração(ões)
            </Text>
          </Group>

          {truncado && (
            <Alert color="yellow" variant="light" title="Log truncado">
              A consulta bateu no teto de linhas do servidor, então há alterações mais antigas fora
              desta lista. Dito aqui de propósito: um log que parece completo e não é vale menos que
              nenhum.
            </Alert>
          )}

          {erro ? (
            <EstadoVazio titulo="Não foi possível carregar a auditoria" descricao={erro} />
          ) : carregando && historico.length === 0 ? (
            <Center mih={240}>
              <Loader />
            </Center>
          ) : filtrado.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma alteração registrada"
              descricao={
                historico.length === 0
                  ? 'Ninguém editou vínculos de pessoas ainda. As alterações aparecem aqui a partir da primeira.'
                  : 'Nenhuma alteração atende aos filtros aplicados.'
              }
            />
          ) : (
            <div className={classes.rolagemTabela}>
              <Table highlightOnHover className={classes.tabela} verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Quando</Table.Th>
                    <Table.Th>Pessoa editada</Table.Th>
                    <Table.Th>Campo</Table.Th>
                    <Table.Th>Antes</Table.Th>
                    <Table.Th>Depois</Table.Th>
                    <Table.Th>Quem alterou</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filtrado.map((linha) => (
                    <Table.Tr key={linha.id}>
                      <Table.Td className={classes.celulaInstante}>
                        <Text size="sm">{formatarInstante(linha.criadoEm)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {linha.usuarioNome ?? `Usuário ${linha.usuarioId}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray" size="sm">
                          {ROTULO_CAMPO_CADASTRO[linha.campo] ?? linha.campo}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <ValorLog valor={linha.valorAnterior} />
                      </Table.Td>
                      <Table.Td>
                        <ValorLog valor={linha.valorNovo} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{linha.autorNome}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Stack>
      </div>
    </Modal>
  )
}

/**
 * Um dos dois lados da alteração. `null` no log significa "sem definição manual",
 * e é exibido como texto, não como célula vazia: célula vazia se confunde com
 * falha de carregamento, e aqui a ausência é o próprio dado.
 */
function ValorLog({ valor }: { valor: string | null }) {
  if (!valor) {
    return (
      <Text size="sm" component="span" className={classes.valorAusente}>
        sem definição
      </Text>
    )
  }
  return (
    <Text size="sm" component="span">
      {valor}
    </Text>
  )
}
