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
    const r = comMudanca(p, { departamento: { modo: 'desassociar', id: null, nome: null } })
    expect(calcularAlteracoes(p, r)).toEqual({
      definir: { departamento: { id: null, nome: null } },
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
      departamento: { modo: 'definir', id: 1252, nome: 'Andamento Simone Freitas' },
      supervisor: { modo: 'desassociar', id: null, nome: null },
      diretor: { modo: 'herdar', id: null, nome: null },
      estado_uf: { modo: 'definir', id: null, nome: 'MG' },
    })
    expect(calcularAlteracoes(p, r)).toEqual({
      definir: {
        departamento: { id: 1252, nome: 'Andamento Simone Freitas' },
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
