import { useEffect, useState } from 'react'
import { obterSupervisorIdPorEquipe } from '../services/colaboradoresBitrix'
import type { EquipeAtendimento } from '../types/domain'

/**
 * ID do usuário chefe (UF_HEAD) de cada uma das 4 equipes de atendimento,
 * carregado uma vez por sessão — usado para resolver o avatar real da
 * supervisora a partir do nome da equipe, sem depender de haver tarefa no
 * recorte de filtros atual.
 */
export function useSupervisorIdPorEquipe(): Partial<Record<EquipeAtendimento, number>> {
  const [ids, setIds] = useState<Partial<Record<EquipeAtendimento, number>>>({})

  useEffect(() => {
    let cancelado = false
    obterSupervisorIdPorEquipe().then((mapa) => {
      if (!cancelado) setIds(mapa)
    })
    return () => {
      cancelado = true
    }
  }, [])

  return ids
}
