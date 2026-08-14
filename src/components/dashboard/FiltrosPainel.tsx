import { Checkbox, Grid, Group, Select, Tooltip } from '@mantine/core'

import { DatePickerInput } from '@mantine/dates'
import { useEffect, useState } from 'react'
import {
  listarColaboradoresDisponiveis,
  listarEstadosDisponiveis,
  listarResponsaveisDisponiveis,
  listarSetoresDisponiveis,
} from '../../services/dashboardService'
import {
  filtrosVazios,
  type FiltroPrazo,
  type FiltroStatus,
  type FiltrosDashboard,
  type Projeto,
} from '../../types/domain'
import classes from './FiltrosPainel.module.css'

import { SeletorGrupos } from './SeletorGrupos'

const OPCOES_STATUS: Array<{ value: FiltroStatus; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'atrasado', label: 'Atrasado' },
  { value: 'no_prazo', label: 'No prazo' },
]

const OPCOES_PRAZO: Array<{ value: FiltroPrazo; label: string }> = [
  { value: 'todas', label: 'Todas as tarefas' },
  { value: 'com_prazo', label: 'Apenas com prazo' },
  { value: 'sem_prazo', label: 'Apenas sem prazo' },
]

const CLASSES_INPUT = {
  input: classes.input,
  label: classes.label,
  section: classes.secao,
  dropdown: classes.dropdown,
  option: classes.option,
}

interface Ripple {
  id: number
  x: number
  y: number
}

interface FiltrosPainelProps {
  filtros: FiltrosDashboard
  onChange: (filtros: FiltrosDashboard) => void
  projetosPermitidos: Projeto[]
  gruposSelecionados: number[]
  onMudarGrupos: (ids: number[]) => void
}

export function FiltrosPainel({
  filtros,
  onChange,
  projetosPermitidos,
  gruposSelecionados,
  onMudarGrupos,
}: FiltrosPainelProps) {
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<string[]>([])
  const [colaboradoresDisponiveis, setColaboradoresDisponiveis] = useState<
    Array<{ id: number; nome: string }>
  >([])
  const [responsaveisDisponiveis, setResponsaveisDisponiveis] = useState<
    Array<{ id: number; nome: string }>
  >([])
  const [estadosDisponiveis, setEstadosDisponiveis] = useState<string[]>([])
  const [ripples, setRipples] = useState<Ripple[]>([])

  const handleLimparFiltros = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const novoRipple = { id: Date.now(), x, y }

    setRipples((prev) => [...prev, novoRipple])
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== novoRipple.id))
    }, 600)

    onChange(filtrosVazios(new Date()))
  }

  useEffect(() => {
    let cancelado = false
    listarSetoresDisponiveis(filtros, projetosPermitidos, gruposSelecionados).then((setores) => {
      if (!cancelado) setSetoresDisponiveis(setores)
    })
    return () => {
      cancelado = true
    }
  }, [projetosPermitidos, gruposSelecionados])

  useEffect(() => {
    let cancelado = false
    listarColaboradoresDisponiveis(filtros, projetosPermitidos, gruposSelecionados).then(
      (colaboradores) => {
        if (!cancelado) setColaboradoresDisponiveis(colaboradores)
      },
    )
    return () => {
      cancelado = true
    }
  }, [projetosPermitidos, gruposSelecionados])

  useEffect(() => {
    let cancelado = false
    listarResponsaveisDisponiveis(filtros, projetosPermitidos, gruposSelecionados).then(
      (responsaveis) => {
        if (!cancelado) setResponsaveisDisponiveis(responsaveis)
      },
    )
    return () => {
      cancelado = true
    }
  }, [projetosPermitidos, gruposSelecionados])

  useEffect(() => {
    let cancelado = false
    listarEstadosDisponiveis(filtros, projetosPermitidos, gruposSelecionados).then((estados) => {
      if (!cancelado) setEstadosDisponiveis(estados)
    })
    return () => {
      cancelado = true
    }
  }, [projetosPermitidos, gruposSelecionados])

  return (
    <div>
      <Grid align="flex-end">
        {/* LINHA 1: Grupos de tarefas (6) + Status (3) + Prazo (3) = 12 spans */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <SeletorGrupos
            projetosPermitidos={projetosPermitidos}
            selecionados={gruposSelecionados}
            onChange={onMudarGrupos}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Select
            radius="lg"
            classNames={CLASSES_INPUT}
            label="Status"
            data={OPCOES_STATUS}
            value={filtros.status}
            onChange={(valor) =>
              onChange({ ...filtros, status: (valor as FiltroStatus | null) ?? 'todos' })
            }
            allowDeselect={false}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Select
            radius="lg"
            classNames={CLASSES_INPUT}
            label="Prazo"
            data={OPCOES_PRAZO}
            value={filtros.filtroPrazo}
            onChange={(valor) =>
              onChange({ ...filtros, filtroPrazo: (valor as FiltroPrazo | null) ?? 'todas' })
            }
            allowDeselect={false}
          />
        </Grid.Col>

        {/* LINHA 2: Data início (3) + Data fim (3) + Departamento (3) + Estado UF (3) = 12 spans */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <DatePickerInput
            radius="lg"
            classNames={CLASSES_INPUT}
            label="Data início"
            placeholder="Selecione a data"
            value={filtros.dataInicio}
            onChange={(valor) => onChange({ ...filtros, dataInicio: valor })}
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <DatePickerInput
            radius="lg"
            classNames={CLASSES_INPUT}
            label="Data fim"
            placeholder="Selecione a data"
            value={filtros.dataFim}
            onChange={(valor) => onChange({ ...filtros, dataFim: valor })}
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Select
            radius="lg"
            classNames={CLASSES_INPUT}
            label="Departamento"
            placeholder="Todos"
            data={setoresDisponiveis}
            value={filtros.setor}
            onChange={(valor) => onChange({ ...filtros, setor: valor })}
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Select
            radius="lg"
            classNames={CLASSES_INPUT}
            label="Estado (UF)"
            placeholder="Todos"
            data={estadosDisponiveis}
            value={filtros.estado}
            onChange={(valor) => onChange({ ...filtros, estado: valor })}
            searchable
            clearable
          />
        </Grid.Col>

        {/* LINHA 3: Fechado por (6) + Responsável (6) = 12 spans */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Select
            radius="lg"
            classNames={CLASSES_INPUT}
            label="Fechado por"
            placeholder="Todos"
            data={colaboradoresDisponiveis.map((c) => ({ value: String(c.id), label: c.nome }))}
            value={filtros.fechadoPorId === null ? null : String(filtros.fechadoPorId)}
            onChange={(valor) =>
              onChange({ ...filtros, fechadoPorId: valor === null ? null : Number(valor) })
            }
            searchable
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Select
            radius="lg"
            classNames={CLASSES_INPUT}
            label="Responsável"
            placeholder="Todos"
            data={responsaveisDisponiveis.map((r) => ({ value: String(r.id), label: r.nome }))}
            value={filtros.responsavelId === null ? null : String(filtros.responsavelId)}
            onChange={(valor) =>
              onChange({ ...filtros, responsavelId: valor === null ? null : Number(valor) })
            }
            searchable
            clearable
          />
        </Grid.Col>
      </Grid>

      <Group
        justify="space-between"
        align="center"
        mt="md"
        wrap="wrap"
        className={classes.rodapeFiltros}
      >
        <Group gap="xl" wrap="wrap">
          <Checkbox
            classNames={{ input: classes.checkboxInput, label: classes.checkboxLabel }}
            label="Ocultar dados indefinidos"
            checked={filtros.ocultarIndefinidos}
            onChange={(evento) =>
              onChange({ ...filtros, ocultarIndefinidos: evento.currentTarget.checked })
            }
          />
          <Checkbox
            classNames={{ input: classes.checkboxInput, label: classes.checkboxLabel }}
            label="Ocultar quem não é das equipes"
            checked={filtros.ocultarForaDasEquipes}
            onChange={(evento) =>
              onChange({ ...filtros, ocultarForaDasEquipes: evento.currentTarget.checked })
            }
          />
          <Group gap="xs" align="center">
            <Checkbox
              classNames={{ input: classes.checkboxInput, label: classes.checkboxLabel }}
              label="Filtrar apenas concluídas"
              checked={filtros.apenasConcluidas}
              onChange={(evento) =>
                onChange({ ...filtros, apenasConcluidas: evento.currentTarget.checked })
              }
            />
            <Tooltip
              label="Quando marcado: TODAS as métricas consideram apenas tarefas concluídas. Quando desmarcado (padrão): considera tarefas gerais (backlog ativo + concluídas dos últimos 10 dias)."
              multiline
              w={280}
              withArrow
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--superficie-borda, rgba(255, 255, 255, 0.12))',
                  color: 'var(--mantine-color-dourado-4, #cba556)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                ?
              </span>
            </Tooltip>
          </Group>
          <Group gap="xs" align="center">
            <Checkbox
              classNames={{ input: classes.checkboxInput, label: classes.checkboxLabel }}
              label="Taxa de Atraso sobre Fila Ativa"
              checked={filtros.modoTaxaAtraso === 'ativas'}
              onChange={(evento) =>
                onChange({
                  ...filtros,
                  modoTaxaAtraso: evento.currentTarget.checked ? 'ativas' : 'total',
                })
              }
            />
            <Tooltip
              label="Fila Ativa: Calcula a % de atraso apenas sobre tarefas pendentes (Atrasadas / Ativas). Quando desmarcado, calcula sobre o Volume Total (Atrasadas / Total Geral)."
              multiline
              w={260}
              withArrow
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--superficie-borda, rgba(255, 255, 255, 0.12))',
                  color: 'var(--mantine-color-dourado-4, #cba556)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                ?
              </span>
            </Tooltip>
          </Group>
        </Group>

        <button
          type="button"
          className={classes.btnLimparRipple}
          onClick={handleLimparFiltros}
          title="Limpar todos os filtros"
        >
          {ripples.map((r) => (
            <span key={r.id} className={classes.rippleEffect} style={{ left: r.x, top: r.y }} />
          ))}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M7 12h10" />
            <path d="M10 18h4" />
          </svg>
          Limpar filtros
        </button>
      </Group>
    </div>
  )
}
