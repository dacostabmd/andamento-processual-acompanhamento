import type {
  FiltrosDashboard,
  MetricasTarefas,
  PacoteAtendimento,
  Projeto,
  Tarefa,
} from '../../types/domain'
import { AiAssistantChat } from './AiAssistantChat'
import { FiltrosPainel } from './FiltrosPainel'
import { UltimasTarefasTabela } from './UltimasTarefasTabela'
import classes from './UltimasTarefasBox.module.css'

interface UltimasTarefasBoxProps {
  tarefasFiltradas: Tarefa[]
  metricas: MetricasTarefas | null
  pacotes: PacoteAtendimento[] | null
  filtros: FiltrosDashboard
  onChangeFiltros: (filtros: FiltrosDashboard) => void
  projetosPermitidos: Projeto[]
  gruposSelecionados: number[]
  onMudarGrupos: (ids: number[]) => void
}

/** Tabela paginada das últimas tarefas (30 dias) com filtros e o assistente de IA acoplado ao lado. */
export function UltimasTarefasBox({
  tarefasFiltradas,
  metricas,
  pacotes,
  filtros,
  onChangeFiltros,
  projetosPermitidos,
  gruposSelecionados,
  onMudarGrupos,
}: UltimasTarefasBoxProps) {
  return (
    <div className={classes.grade}>
      <div className={classes.colunaTabela}>
        <FiltrosPainel
          filtros={filtros}
          onChange={onChangeFiltros}
          projetosPermitidos={projetosPermitidos}
          gruposSelecionados={gruposSelecionados}
          onMudarGrupos={onMudarGrupos}
        />
        <div style={{ marginTop: '16px' }}>
          <UltimasTarefasTabela tarefasFiltradas={tarefasFiltradas} />
        </div>
      </div>
      <div className={classes.colunaChat}>
        <AiAssistantChat variant="inline" metricas={metricas} pacotes={pacotes} filtros={filtros} />
      </div>
    </div>
  )
}
