import { describe, expect, it } from 'vitest'
import type { Tarefa } from '../../types/domain'
import { pesoSituacao } from './ColaboradorTarefasModal'

const AGORA = new Date('2026-08-11T12:00:00')
const PRAZO_PASSADO = '2026-08-01T12:00:00'
const PRAZO_FUTURO = '2026-09-01T12:00:00'

function tarefa(op: Partial<Tarefa>): Tarefa {
  return { id: 1, status: 3, prazoFinal: null, finalizadoEm: null, ...op } as Tarefa
}

describe('pesoSituacao', () => {
  it('BUG: separa "concluída com atraso" de "concluída no prazo" — badges visuais diferentes', () => {
    // Antes as duas caíam no mesmo peso (só checava tarefaEstaConcluida), e
    // ordenar por Status intercalava os dois badges (laranja x verde) em vez
    // de agrupá-los — exatamente o sintoma reportado no print do usuário.
    const concluidaComAtraso = tarefa({
      status: 5,
      prazoFinal: PRAZO_PASSADO,
      finalizadoEm: '2026-08-05T12:00:00', // depois do prazo
    })
    const concluidaNoPrazo = tarefa({
      status: 5,
      prazoFinal: PRAZO_FUTURO,
      finalizadoEm: '2026-08-01T12:00:00', // antes do prazo
    })
    expect(pesoSituacao(concluidaComAtraso, AGORA)).not.toBe(pesoSituacao(concluidaNoPrazo, AGORA))
  })

  it('ordem de criticidade: atrasada < no prazo < concluída com atraso < concluída < adiada', () => {
    const atrasada = tarefa({ status: 3, prazoFinal: PRAZO_PASSADO })
    const noPrazo = tarefa({ status: 3, prazoFinal: PRAZO_FUTURO })
    const concluidaComAtraso = tarefa({
      status: 5,
      prazoFinal: PRAZO_PASSADO,
      finalizadoEm: '2026-08-05T12:00:00',
    })
    const concluida = tarefa({ status: 5, prazoFinal: PRAZO_FUTURO, finalizadoEm: PRAZO_PASSADO })
    const adiada = tarefa({ status: 6 })

    const pesos = [atrasada, noPrazo, concluidaComAtraso, concluida, adiada].map((t) =>
      pesoSituacao(t, AGORA),
    )
    expect(pesos).toEqual([...pesos].sort((a, b) => a - b))
    // E são todos distintos — sem empate escondendo um agrupamento errado.
    expect(new Set(pesos).size).toBe(pesos.length)
  })
})
