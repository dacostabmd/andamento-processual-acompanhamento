import { describe, expect, it } from 'vitest'
import {
  ehNomeDePessoa,
  equipeSupervisionadaPeloNome,
  nomeDePessoaOuNulo,
  ROTULO_SEM_RESPONSAVEL,
} from './pessoas'

describe('ehNomeDePessoa', () => {
  it('aceita nome de pessoa normal', () => {
    expect(ehNomeDePessoa('Ana Souza')).toBe(true)
  })

  it('rejeita o rótulo de ausência gravado pelo worker', () => {
    expect(ehNomeDePessoa(ROTULO_SEM_RESPONSAVEL)).toBe(false)
  })

  it('rejeita variações de caixa e acento do rótulo', () => {
    expect(ehNomeDePessoa('responsável indefinido')).toBe(false)
    expect(ehNomeDePessoa('RESPONSAVEL INDEFINIDO')).toBe(false)
  })

  it('rejeita outros placeholders comuns de ausência', () => {
    expect(ehNomeDePessoa('Não informado')).toBe(false)
    expect(ehNomeDePessoa('undefined')).toBe(false)
    expect(ehNomeDePessoa('null')).toBe(false)
    expect(ehNomeDePessoa('-')).toBe(false)
  })

  it('rejeita null, undefined e string vazia', () => {
    expect(ehNomeDePessoa(null)).toBe(false)
    expect(ehNomeDePessoa(undefined)).toBe(false)
    expect(ehNomeDePessoa('')).toBe(false)
    expect(ehNomeDePessoa('   ')).toBe(false)
  })

  it('não rejeita um nome de pessoa que apenas CONTÉM uma palavra da lista', () => {
    // "Indefinido" sozinho é ausência; um sobrenome que combina não deveria ser.
    expect(ehNomeDePessoa('Bruno Indefinido Silva')).toBe(true)
  })
})

describe('nomeDePessoaOuNulo', () => {
  it('devolve o nome quando é pessoa de verdade', () => {
    expect(nomeDePessoaOuNulo('Carla Dias')).toBe('Carla Dias')
  })

  it('devolve null para o rótulo de ausência, pronto para "?? fallback"', () => {
    expect(nomeDePessoaOuNulo(ROTULO_SEM_RESPONSAVEL)).toBeNull()
    expect(nomeDePessoaOuNulo(ROTULO_SEM_RESPONSAVEL) ?? 'sem responsável identificado').toBe(
      'sem responsável identificado',
    )
  })
})

describe('equipeSupervisionadaPeloNome', () => {
  it('reconhece as 4 supervisoras pelo nome exato', () => {
    expect(equipeSupervisionadaPeloNome('Cinthia Filgueiras')).toBe('Cinthia Filgueiras')
    expect(equipeSupervisionadaPeloNome('Simone Freitas')).toBe('Simone Freitas')
    expect(equipeSupervisionadaPeloNome('Quézia Karen')).toBe('Quézia Karen')
    expect(equipeSupervisionadaPeloNome('Lorena Pontes')).toBe('Lorena Pontes')
  })

  it('ignora acento e caixa (nome como vem do Bitrix pode variar)', () => {
    expect(equipeSupervisionadaPeloNome('quezia karen')).toBe('Quézia Karen')
    expect(equipeSupervisionadaPeloNome('CINTHIA FILGUEIRAS')).toBe('Cinthia Filgueiras')
  })

  it('devolve null para quem não é uma das 4 supervisoras', () => {
    expect(equipeSupervisionadaPeloNome('Ana Souza')).toBeNull()
    expect(equipeSupervisionadaPeloNome(null)).toBeNull()
    expect(equipeSupervisionadaPeloNome(undefined)).toBeNull()
    expect(equipeSupervisionadaPeloNome('')).toBeNull()
  })
})
