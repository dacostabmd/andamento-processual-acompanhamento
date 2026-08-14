import { describe, expect, it } from 'vitest'
import type { PessoaCadastro, VinculoEfetivo } from '../../types/domain'
import {
  calcularAlteracoes,
  rascunhoDaPessoa,
  ufDoDepartamentoEstado,
  type Rascunho,
} from './cadastroRascunho'

const herdado = (nome: string, id: number): VinculoEfetivo => ({ id, nome, origem: 'bitrix' })
const editado = (nome: string, id: number): VinculoEfetivo => ({ id, nome, origem: 'cadastro' })
const desassociado: VinculoEfetivo = { id: null, nome: null, origem: 'desassociado' }
const ausente: VinculoEfetivo = { id: null, nome: null, origem: 'ausente' }

function pessoa(parcial: Partial<PessoaCadastro> = {}): PessoaCadastro {
  return {
    usuarioId: 700,
    nome: 'Pessoa da Lorena',
    equipe: 'Lorena Pontes',
    departamento: herdado('Andamento Lorena Pontes', 1416),
    departamentoEstado: ausente,
    supervisor: ausente,
    gerente: ausente,
    diretor: ausente,
    estadoUf: ausente,
    totalCards: 12,
    noAndamento: true,
    desligado: false,
    desligadoEm: null,
    atualizadoEm: null,
    atualizadoPorNome: null,
    ...parcial,
  }
}

/** O rascunho da pessoa, com um campo trocado — como a tela faz ao interagir. */
function comMudanca(base: PessoaCadastro, mudanca: Partial<Rascunho>): Rascunho {
  return { ...rascunhoDaPessoa(base), ...mudanca }
}

describe('calcularAlteracoes', () => {
  it('sem interação, não envia nada', () => {
    const p = pessoa({ supervisor: editado('Simone Freitas', 122096) })
    expect(calcularAlteracoes(p, rascunhoDaPessoa(p))).toEqual({ definir: {}, reverter: [] })
  })

  it('definir um campo herdado envia só esse campo', () => {
    const p = pessoa()
    const r = comMudanca(p, { supervisor: { modo: 'definir', id: 122096, nome: 'Simone Freitas' } })
    expect(calcularAlteracoes(p, r)).toEqual({
      definir: { supervisor: { id: 122096, nome: 'Simone Freitas' } },
      reverter: [],
    })
  })

  it('reescolher o MESMO valor já definido não reenvia', () => {
    // Reenviar geraria uma linha de log falsa e uma reaplicação sobre milhares de
    // tarefas por um valor idêntico.
    const p = pessoa({ supervisor: editado('Simone Freitas', 122096) })
    const r = comMudanca(p, { supervisor: { modo: 'definir', id: 122096, nome: 'Simone Freitas' } })
    expect(calcularAlteracoes(p, r).definir).toEqual({})
  })

  it('desassociar manda o par nulo, que o worker grava como decisão explícita', () => {
    const p = pessoa()
    const r = comMudanca(p, { departamento: { modo: 'desassociar', id: null, nome: null, ids: [] } })
    expect(calcularAlteracoes(p, r)).toEqual({
      // Departamento é campo de LISTA: a lista vazia é o que diz ao worker
      // "desassociada de todos", e é ela que vai ao portal em UF_DEPARTMENT.
      definir: { departamento: { id: null, nome: null, ids: [] } },
      reverter: [],
    })
  })

  it('desassociar o que já está desassociado não reenvia', () => {
    const p = pessoa({ departamento: desassociado })
    const r = comMudanca(p, { departamento: { modo: 'desassociar', id: null, nome: null } })
    expect(calcularAlteracoes(p, r).definir).toEqual({})
  })

  it('voltar ao Bitrix entra em reverter, não em definir', () => {
    const p = pessoa({ supervisor: editado('Simone Freitas', 122096) })
    const r = comMudanca(p, { supervisor: { modo: 'herdar', id: null, nome: null } })
    expect(calcularAlteracoes(p, r)).toEqual({ definir: {}, reverter: ['supervisor'] })
  })

  it('desfazer uma desassociação também é reverter', () => {
    const p = pessoa({ departamento: desassociado })
    const r = comMudanca(p, { departamento: { modo: 'herdar', id: null, nome: null } })
    expect(calcularAlteracoes(p, r)).toEqual({ definir: {}, reverter: ['departamento'] })
  })

  it('NÃO pede reversão de campo que nunca teve definição manual', () => {
    // O worker devolve 404 nesse caso ("esta pessoa não tem cadastro manual"), e
    // o erro apareceria como falha de salvamento de uma edição que deu certo.
    const p = pessoa()
    const r = comMudanca(p, { supervisor: { modo: 'herdar', id: null, nome: null } })
    expect(calcularAlteracoes(p, r)).toEqual({ definir: {}, reverter: [] })
  })

  it('acumula vários campos numa única requisição', () => {
    const p = pessoa({ diretor: editado('Cinthia Filgueiras', 118684) })
    const r = comMudanca(p, {
      departamento: { modo: 'definir', id: 1252, nome: 'Andamento Simone Freitas', ids: [1070, 1252] },
      supervisor: { modo: 'desassociar', id: null, nome: null },
      diretor: { modo: 'herdar', id: null, nome: null },
      estado_uf: { modo: 'definir', id: null, nome: 'MG' },
    })
    expect(calcularAlteracoes(p, r)).toEqual({
      definir: {
        departamento: { id: 1070, nome: 'Andamento Simone Freitas', ids: [1070, 1252] },
        supervisor: { id: null, nome: null },
        estado_uf: { id: null, nome: 'MG' },
      },
      reverter: ['diretor'],
    })
  })
})

describe('rascunhoDaPessoa', () => {
  it('traduz a origem de cada vínculo no modo correspondente', () => {
    const r = rascunhoDaPessoa(
      pessoa({
        departamento: herdado('Andamento Lorena Pontes', 1416),
        supervisor: editado('Simone Freitas', 122096),
        gerente: desassociado,
        diretor: ausente,
      }),
    )
    expect(r.departamento.modo).toBe('herdar')
    expect(r.supervisor.modo).toBe('definir')
    expect(r.gerente.modo).toBe('desassociar')
    expect(r.diretor.modo).toBe('herdar')
  })
})

describe('departamento de estado', () => {
  it('é um vínculo à parte: atribuí-lo não mexe no departamento de equipe', () => {
    // O ponto central do desenho. Se os dois compartilhassem o mesmo campo,
    // escolher "Andamento - SP" tiraria a pessoa da equipe dela e a métrica da
    // equipe cairia sem nada na tela explicando por quê.
    const p = pessoa()
    const r = comMudanca(p, {
      departamento_estado: { modo: 'definir', id: -9024, nome: 'Andamento - SP' },
    })
    expect(calcularAlteracoes(p, r)).toEqual({
      definir: { departamento_estado: { id: -9024, nome: 'Andamento - SP' } },
      reverter: [],
    })
  })

  it('reverter devolve o campo ao estado de não-atribuído', () => {
    const p = pessoa({ departamentoEstado: editado('Andamento - RJ', -9018) })
    const r = comMudanca(p, { departamento_estado: { modo: 'herdar', id: null, nome: null } })
    expect(calcularAlteracoes(p, r)).toEqual({ definir: {}, reverter: ['departamento_estado'] })
  })

  it('rascunhoDaPessoa lê o vínculo do campo departamentoEstado', () => {
    const r = rascunhoDaPessoa(pessoa({ departamentoEstado: editado('Andamento - MG', -9012) }))
    expect(r.departamento_estado).toEqual({ modo: 'definir', id: -9012, nome: 'Andamento - MG' })
  })
})

describe('departamento como lista (UF_DEPARTMENT é array)', () => {
  const multiplo = (ids: number[]): VinculoEfetivo => ({
    id: ids[0] ?? null,
    nome: ids.length ? `Dep ${ids[0]}` : null,
    origem: 'bitrix',
    itens: ids.map((id) => ({ id, nome: `Dep ${id}` })),
  })

  it('o rascunho vem com TODOS os departamentos, não só o principal', () => {
    // É o patchValue do MultiSelect: com um id só, salvar apagaria os outros
    // departamentos da pessoa — agora inclusive na ficha do portal.
    const r = rascunhoDaPessoa(pessoa({ departamento: multiplo([149, 1070, 1252]) }))
    expect(r.departamento.ids).toEqual([149, 1070, 1252])
    expect(r.departamento.modo).toBe('herdar')
  })

  it('remover um departamento é uma alteração, mesmo mantendo o principal', () => {
    // [149, 1070, 1252] → [1252] tem o mesmo conjunto de "principal" possível pela
    // ordem canônica. Comparar por id enxergaria "nada mudou" e engoliria a
    // remoção de dois departamentos.
    const p = pessoa({ departamento: multiplo([149, 1070, 1252]) })
    const r = comMudanca(p, { departamento: { modo: 'definir', id: 1252, nome: 'Dep 1252', ids: [1252] } })
    expect(calcularAlteracoes(p, r).definir.departamento).toEqual({
      id: 1252,
      nome: 'Dep 1252',
      ids: [1252],
    })
  })

  it('a mesma lista em outra ordem NÃO é alteração', () => {
    // O MultiSelect devolve na ordem de clique. Sem comparar por conjunto, reabrir
    // e fechar o modal geraria linha de log falsa e uma reaplicação sobre milhares
    // de tarefas.
    const p = pessoa({
      departamento: { ...multiplo([149, 1252]), origem: 'cadastro' },
    })
    const r = comMudanca(p, { departamento: { modo: 'definir', id: 1252, nome: 'Dep 1252', ids: [1252, 149] } })
    expect(calcularAlteracoes(p, r).definir.departamento).toBeUndefined()
  })

  it('vínculo antigo sem a lista continua valendo pelo id único', () => {
    // Cadastro gravado antes de o campo ser múltiplo. Tratar `ids` ausente como
    // lista vazia faria o salvamento desassociar a pessoa de tudo.
    const p = pessoa({ departamento: editado('Andamento Cinthia Filgueiras', 1250) })
    const r = rascunhoDaPessoa(p)
    expect(r.departamento.ids).toBeUndefined()
    expect(calcularAlteracoes(p, r).definir.departamento).toBeUndefined()
  })
})

describe('ufDoDepartamentoEstado', () => {
  it('extrai a sigla do nome do departamento', () => {
    expect(ufDoDepartamentoEstado('Andamento - SP')).toBe('SP')
    expect(ufDoDepartamentoEstado('Andamento -rj')).toBe('RJ')
  })

  it('devolve null para o que não é departamento de estado', () => {
    // Sem isto, "Andamento Simone Freitas" produziria uma UF inventada a partir das
    // duas últimas letras de um nome próprio.
    expect(ufDoDepartamentoEstado('Andamento Simone Freitas')).toBeNull()
    expect(ufDoDepartamentoEstado(null)).toBeNull()
    expect(ufDoDepartamentoEstado('')).toBeNull()
  })
})
