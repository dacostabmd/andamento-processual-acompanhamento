import { Alert, Button, Group, Modal, MultiSelect, Select, Stack, Text, Title } from '@mantine/core'
import { useMemo, useState } from 'react'
import type { Equipe, EquipeInput, OpcoesEquipe } from '../../types/domain'
import classesInput from './FiltrosPainel.module.css'
import classes from './EquipesCadastroPanel.module.css'

/** `'nova'` abre o modal vazio para criar; `null` fecha; uma `Equipe` abre em edição. */
export type EquipeEmEdicao = Equipe | 'nova' | null

interface Rascunho {
  departamentoId: number | null
  departamentoNome: string | null
  supervisorId: number | null
  supervisorNome: string | null
  colaboradores: Array<{ id: number; nome: string }>
}

const RASCUNHO_VAZIO: Rascunho = {
  departamentoId: null,
  departamentoNome: null,
  supervisorId: null,
  supervisorNome: null,
  colaboradores: [],
}

function rascunhoDaEquipe(equipe: Equipe): Rascunho {
  return {
    departamentoId: equipe.departamentoId,
    departamentoNome: equipe.departamentoNome,
    supervisorId: equipe.supervisorId,
    supervisorNome: equipe.supervisorNome,
    colaboradores: equipe.colaboradores,
  }
}

/** Inclui na lista de opções qualquer valor já selecionado que não esteja nela — evita perder seleção "órfã". */
function garantirOpcoes(
  opcoesBase: Array<{ value: string; label: string }>,
  selecionados: Array<{ value: string; label: string }>,
) {
  const existentes = new Set(opcoesBase.map((o) => o.value))
  const faltantes = selecionados.filter((s) => !existentes.has(s.value))
  return faltantes.length === 0 ? opcoesBase : [...faltantes, ...opcoesBase]
}

interface EquipeEdicaoModalProps {
  alvo: EquipeEmEdicao
  opcoes: OpcoesEquipe
  podeEditar: boolean
  salvando: boolean
  excluindo: boolean
  onFechar: () => void
  onSalvar: (input: EquipeInput) => void
  onExcluir: (id: number) => void
}

/**
 * Modal único de equipe: Departamento, Supervisão, Colaboradores — os 3 campos
 * que formam uma equipe. Substitui a edição pessoa-a-pessoa de
 * CadastroPessoaEdicao.tsx nesta tela.
 */
export function EquipeEdicaoModal({
  alvo,
  opcoes,
  podeEditar,
  salvando,
  excluindo,
  onFechar,
  onSalvar,
  onExcluir,
}: EquipeEdicaoModalProps) {
  const [exibido, setExibido] = useState<EquipeEmEdicao>(alvo)
  const [rascunho, setRascunho] = useState<Rascunho>(
    alvo === 'nova' || alvo === null ? RASCUNHO_VAZIO : rascunhoDaEquipe(alvo),
  )

  if (alvo !== exibido) {
    setExibido(alvo)
    setRascunho(alvo === 'nova' || alvo === null ? RASCUNHO_VAZIO : rascunhoDaEquipe(alvo))
  }

  const departamentosOptions = useMemo(
    () =>
      opcoes.departamentos
        .filter((d) => d.andamento)
        .map((d) => ({ value: String(d.id), label: d.nome })),
    [opcoes.departamentos],
  )

  const usuariosOptions = useMemo(
    () =>
      opcoes.usuarios.map((u) => ({
        value: String(u.id),
        label: u.desligado ? `${u.nome} (desligado)` : u.nome,
      })),
    [opcoes.usuarios],
  )

  const departamentoValor =
    rascunho.departamentoId !== null ? String(rascunho.departamentoId) : null
  const departamentoOpcoesComOrfao = garantirOpcoes(
    departamentosOptions,
    departamentoValor && rascunho.departamentoNome
      ? [{ value: departamentoValor, label: rascunho.departamentoNome }]
      : [],
  )

  const supervisorValor = rascunho.supervisorId !== null ? String(rascunho.supervisorId) : null
  const supervisorOpcoesComOrfao = garantirOpcoes(
    usuariosOptions,
    supervisorValor && rascunho.supervisorNome
      ? [{ value: supervisorValor, label: rascunho.supervisorNome }]
      : [],
  )

  const colaboradoresValor = rascunho.colaboradores.map((c) => String(c.id))
  const colaboradoresOpcoesComOrfaos = garantirOpcoes(
    usuariosOptions,
    rascunho.colaboradores.map((c) => ({ value: String(c.id), label: c.nome })),
  )

  const ehEdicao = alvo !== null && alvo !== 'nova'
  const temAlteracao =
    !ehEdicao ||
    rascunho.departamentoId !== (alvo as Equipe).departamentoId ||
    rascunho.supervisorId !== (alvo as Equipe).supervisorId ||
    rascunho.colaboradores.length !== (alvo as Equipe).colaboradores.length ||
    rascunho.colaboradores.some((c, i) => c.id !== (alvo as Equipe).colaboradores[i]?.id)

  function aoSalvar() {
    onSalvar({
      id: ehEdicao ? (alvo as Equipe).id : undefined,
      departamentoId: rascunho.departamentoId,
      departamentoNome: rascunho.departamentoNome,
      supervisorId: rascunho.supervisorId,
      supervisorNome: rascunho.supervisorNome,
      colaboradores: rascunho.colaboradores,
    })
  }

  return (
    <Modal
      opened={alvo !== null}
      onClose={onFechar}
      zIndex={320}
      size="lg"
      title={
        <Title order={4} className={classes.titulo}>
          {ehEdicao ? (alvo as Equipe).nome : 'Nova equipe'}
        </Title>
      }
    >
      <Stack gap="md">
        <div className={classes.campoEdicao}>
          <Text size="sm" fw={600} className={classes.labelCampo} mb={6}>
            Departamento
          </Text>
          <Select
            radius="lg"
            classNames={{
              input: classes.inputModal,
              section: classesInput.secao,
              dropdown: classesInput.dropdown,
              option: classesInput.option,
            }}
            placeholder="Selecione o departamento da equipe"
            data={departamentoOpcoesComOrfao}
            value={departamentoValor}
            disabled={!podeEditar || salvando}
            searchable
            clearable
            comboboxProps={{ zIndex: 400, withinPortal: true }}
            onChange={(valor) => {
              const id = valor !== null ? Number(valor) : null
              const nome =
                id !== null
                  ? (departamentoOpcoesComOrfao.find((o) => o.value === valor)?.label ?? null)
                  : null
              setRascunho((atual) => ({ ...atual, departamentoId: id, departamentoNome: nome }))
            }}
          />
        </div>

        <div className={classes.campoEdicao}>
          <Text size="sm" fw={600} className={classes.labelCampo} mb={6}>
            Supervisão
          </Text>
          <Select
            radius="lg"
            classNames={{
              input: classes.inputModal,
              section: classesInput.secao,
              dropdown: classesInput.dropdown,
              option: classesInput.option,
            }}
            placeholder="Selecione o supervisor da equipe"
            data={supervisorOpcoesComOrfao}
            value={supervisorValor}
            disabled={!podeEditar || salvando}
            searchable
            clearable
            comboboxProps={{ zIndex: 400, withinPortal: true }}
            onChange={(valor) => {
              const id = valor !== null ? Number(valor) : null
              const nome =
                id !== null
                  ? (supervisorOpcoesComOrfao.find((o) => o.value === valor)?.label ?? null)
                  : null
              setRascunho((atual) => ({ ...atual, supervisorId: id, supervisorNome: nome }))
            }}
          />
        </div>

        <div className={classes.campoEdicao}>
          <Text size="sm" fw={600} className={classes.labelCampo} mb={6}>
            Colaboradores
          </Text>
          <MultiSelect
            radius="lg"
            classNames={{
              input: classes.inputModal,
              section: classesInput.secao,
              dropdown: classesInput.dropdown,
              option: classesInput.option,
            }}
            placeholder="Selecione os colaboradores da equipe"
            data={colaboradoresOpcoesComOrfaos}
            value={colaboradoresValor}
            disabled={!podeEditar || salvando}
            searchable
            clearable
            comboboxProps={{ zIndex: 400, withinPortal: true }}
            nothingFoundMessage="Nenhuma pessoa encontrada"
            onChange={(escolhidos) => {
              const colaboradores = escolhidos
                .map((valor) => {
                  const id = Number(valor)
                  const nome =
                    colaboradoresOpcoesComOrfaos.find((o) => o.value === valor)?.label ??
                    `Usuário ${id}`
                  return Number.isNaN(id) ? null : { id, nome: nome.replace(/ \(desligado\)$/, '') }
                })
                .filter((c): c is { id: number; nome: string } => c !== null)
              setRascunho((atual) => ({ ...atual, colaboradores }))
            }}
          />
        </div>

        {!podeEditar && (
          <Alert color="yellow" variant="light" title="Somente leitura">
            Seu usuário não está na lista de quem pode editar equipes. O servidor recusaria a
            gravação, então os campos estão desabilitados.
          </Alert>
        )}

        <Group justify="space-between" gap="sm" mt="md">
          {ehEdicao ? (
            <Button
              variant="subtle"
              color="red"
              disabled={!podeEditar || salvando || excluindo}
              loading={excluindo}
              onClick={() => onExcluir((alvo as Equipe).id)}
            >
              Excluir equipe
            </Button>
          ) : (
            <span />
          )}
          <Group gap="sm">
            <Button variant="default" onClick={onFechar} disabled={salvando || excluindo}>
              Cancelar
            </Button>
            <Button
              color="yellow"
              disabled={!podeEditar || !temAlteracao}
              loading={salvando}
              onClick={aoSalvar}
            >
              Salvar
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}
