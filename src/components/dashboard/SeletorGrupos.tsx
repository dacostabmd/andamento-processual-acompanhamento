import { MultiSelect } from '@mantine/core'
import type { Projeto } from '../../types/domain'
import classes from './FiltrosPainel.module.css'

const CLASSES_INPUT = {
  input: classes.input,
  label: classes.label,
  section: classes.secao,
  dropdown: classes.dropdown,
  option: classes.option,
  pill: classes.option,
}

interface SeletorGruposProps {
  projetosPermitidos: Projeto[]
  selecionados: number[]
  onChange: (ids: number[]) => void
}

/**
 * Multiselect dos grupos de tarefas (workgroups do Bitrix) a incluir na
 * análise. Sempre exige pelo menos 1 grupo marcado — desmarcar o último não
 * tem efeito, para nunca deixar o dashboard sem nenhum dado carregado.
 */
export function SeletorGrupos({ projetosPermitidos, selecionados, onChange }: SeletorGruposProps) {
  const opcoes = projetosPermitidos.map((p) => ({ value: String(p.id), label: p.nome }))

  function aoMudar(valores: string[]) {
    if (valores.length === 0) return
    onChange(valores.map(Number))
  }

  return (
    <MultiSelect
      radius="lg"
      classNames={CLASSES_INPUT}
      label="Grupos de tarefas"
      placeholder={selecionados.length === 0 ? 'Selecione ao menos um grupo' : undefined}
      data={opcoes}
      value={selecionados.map(String)}
      onChange={aoMudar}
      searchable
      clearable={false}
    />
  )
}
