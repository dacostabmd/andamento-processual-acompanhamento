import { Tabs } from '@mantine/core'
import type { PacoteAtendimento, Tarefa } from '../../types/domain'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { ColaboradoresFechamentoTabela } from './ColaboradoresFechamentoTabela'
import { ColaboradoresResponsabilidadeTabela } from './ColaboradoresResponsabilidadeTabela'

interface FechamentoEquipesTabsProps {
  tarefasFiltradas: Tarefa[]
  pacotes: PacoteAtendimento[]
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
}

/** Abas "colaboradores que mais fecharam" / "colaboradores com mais tarefas sob responsabilidade". */
export function FechamentoEquipesTabs({
  tarefasFiltradas,
  pacotes,
  onSelecionarColaborador,
}: FechamentoEquipesTabsProps) {
  return (
    <Tabs defaultValue="fechamento" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="fechamento">Colaboradores que mais fecharam</Tabs.Tab>
        <Tabs.Tab value="responsabilidade">
          Colaboradores com mais tarefas sob responsabilidade
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="fechamento" pt="md">
        <ColaboradoresFechamentoTabela
          tarefasFiltradas={tarefasFiltradas}
          onSelecionarColaborador={onSelecionarColaborador}
        />
      </Tabs.Panel>

      <Tabs.Panel value="responsabilidade" pt="md">
        <ColaboradoresResponsabilidadeTabela
          pacotes={pacotes}
          onSelecionarColaborador={onSelecionarColaborador}
        />
      </Tabs.Panel>
    </Tabs>
  )
}
