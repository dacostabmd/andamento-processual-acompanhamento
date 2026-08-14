import { Alert, Button, Group, Modal, MultiSelect, Stack, Text, Title } from '@mantine/core'
import { useMemo, useState } from 'react'
import {
  CAMPOS_CADASTRO_PESSOA,
  ROTULO_CAMPO_CADASTRO,
  type CampoCadastroPessoa,
  type OpcoesCadastro,
  type PessoaCadastro,
} from '../../types/domain'
import {
  CAMPOS_COM_FONTE_BITRIX,
  calcularAlteracoes,
  rascunhoDaPessoa,
  rascunhoDoVinculo,
  ufDoDepartamentoEstado,
  vinculoDaPessoa,
  type AlteracoesCadastro,
  type ModoVinculo,
  type Rascunho,
  type RascunhoVinculo,
} from './cadastroRascunho'
import classesInput from './FiltrosPainel.module.css'
import classes from './ConfiguracoesCadastroPanel.module.css'

/** As 27 UFs do Brasil, para os seletores de Estado/UF e Departamento de Estado. */
const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

const GRUPO_ANDAMENTO = 'Equipes de Andamento'
const GRUPO_OUTROS = 'Outros departamentos'

/**
 * Campos exibidos no modal de edição. Gerente, diretor e Estado (UF) ficam de
 * fora por serem redundantes com outros vínculos já editáveis aqui — continuam
 * existindo no modelo/worker, só não são editáveis por esta interface.
 */
const CAMPOS_EXIBIDOS_NO_MODAL: CampoCadastroPessoa[] = CAMPOS_CADASTRO_PESSOA.filter(
  (campo) => campo !== 'gerente' && campo !== 'diretor' && campo !== 'estado_uf',
)

/** Agrupa opções em "Equipes de Andamento" e "Outros". */
function agrupar<T extends { andamento: boolean }>(
  itens: T[],
  paraOpcao: (item: T) => { value: string; label: string },
) {
  const dentro = itens.filter((i) => i.andamento).map(paraOpcao)
  const fora = itens.filter((i) => !i.andamento).map(paraOpcao)
  const grupos: Array<{ group: string; items: Array<{ value: string; label: string }> }> = []
  if (dentro.length > 0) grupos.push({ group: GRUPO_ANDAMENTO, items: dentro })
  if (fora.length > 0) grupos.push({ group: GRUPO_OUTROS, items: fora })
  return grupos
}

interface CadastroPessoaEdicaoProps {
  /** Pessoa a editar; `null` fecha o modal. */
  pessoa: PessoaCadastro | null
  opcoes: OpcoesCadastro
  /** `false` deixa a tela em leitura: o worker recusaria a escrita de qualquer forma. */
  podeEditar: boolean
  salvando: boolean
  onFechar: () => void
  onSalvar: (alteracoes: AlteracoesCadastro) => void
}

/**
 * Edição dos vínculos de uma pessoa: departamento (equipe), departamento (estado),
 * supervisor, gerente, diretor e Estado/UF.
 *
 * Todos os seis campos são MultiSelect com layout, espaçamentos e distâncias
 * totalmente padronizados.
 */
export function CadastroPessoaEdicao({
  pessoa,
  opcoes,
  podeEditar,
  salvando,
  onFechar,
  onSalvar,
}: CadastroPessoaEdicaoProps) {
  const [exibida, setExibida] = useState<PessoaCadastro | null>(pessoa)
  const [rascunho, setRascunho] = useState<Rascunho | null>(
    pessoa ? rascunhoDaPessoa(pessoa) : null,
  )

  if (pessoa !== null && pessoa !== exibida) {
    setExibida(pessoa)
    setRascunho(rascunhoDaPessoa(pessoa))
  }

  const usuariosOptions = useMemo(
    () =>
      agrupar(opcoes.usuarios, (u) => ({
        value: String(u.id),
        label: u.desligado ? `${u.nome} (desligado)` : u.nome,
      })),
    [opcoes.usuarios],
  )

  /** Departamentos de equipe: as 4 equipes de Andamento em destaque primeiro. */
  const departamentosEquipeOptions = useMemo(() => {
    const equipesPrincipais = [
      'Andamento Quézia Karen',
      'Andamento Lorena Pontes',
      'Andamento Cinthia Filgueiras',
      'Andamento Simone Freitas',
    ]

    const depsSemEstado = opcoes.departamentos.filter((d) => d.estadoUf === null)

    const principais = depsSemEstado
      .filter((d) =>
        equipesPrincipais.some((eq) => d.nome.toLowerCase().includes(eq.toLowerCase())),
      )
      .map((d) => ({ value: String(d.id), label: d.nome }))

    const outros = depsSemEstado
      .filter(
        (d) => !equipesPrincipais.some((eq) => d.nome.toLowerCase().includes(eq.toLowerCase())),
      )
      .map((d) => ({ value: String(d.id), label: d.nome }))

    const grupos: Array<{ group: string; items: Array<{ value: string; label: string }> }> = []
    if (principais.length > 0) {
      grupos.push({ group: GRUPO_ANDAMENTO, items: principais })
    }
    if (outros.length > 0) {
      grupos.push({ group: GRUPO_OUTROS, items: outros })
    }
    return grupos
  }, [opcoes.departamentos])

  /** Departamentos de estado: garante a presença de todos os 27 estados "Andamento - <UF>". */
  const departamentosEstadoOptions = useMemo(() => {
    const mapaExistentes = new Map(opcoes.departamentosEstado.map((d) => [d.nome.toUpperCase(), d]))

    return UFS.map((uf, idx) => {
      const nome = `Andamento - ${uf}`
      const existente = mapaExistentes.get(nome.toUpperCase())
      const id = existente ? existente.id : -9000 - idx
      return { value: String(id), label: nome }
    })
  }, [opcoes.departamentosEstado])

  const ufsOptions = useMemo(() => UFS.map((uf) => ({ value: uf, label: uf })), [])

  function trocarModo(campo: CampoCadastroPessoa, modo: ModoVinculo) {
    setRascunho((atual) => {
      if (!atual) return atual
      const original = exibida ? rascunhoDoVinculo(vinculoDaPessoa(exibida, campo)) : null
      if (modo === 'herdar') {
        const doBitrix =
          original && original.modo === 'herdar'
            ? original
            : { modo: 'herdar' as const, id: null, nome: null }
        return { ...atual, [campo]: { ...doBitrix, modo: 'herdar' } }
      }
      const vazio: RascunhoVinculo = { modo, id: null, nome: null, ids: [] }
      return { ...atual, [campo]: vazio }
    })
  }

  /** Troca a lista de IDs de um campo múltiplo. Lista vazia desassocia. */
  function definirLista(campo: CampoCadastroPessoa, ids: number[], rotulos: string[]) {
    setRascunho((atual) => {
      if (!atual) return atual
      const proximo: Rascunho = {
        ...atual,
        [campo]: {
          modo: ids.length === 0 ? 'desassociar' : 'definir',
          id: ids[0] ?? null,
          nome: rotulos[0] ?? null,
          ids,
        },
      }

      // Se escolher departamento_estado e a UF ainda for herdada, autopreenche as UFs correspondentes
      if (campo === 'departamento_estado' && atual.estado_uf.modo === 'herdar') {
        const ufs = rotulos.map(ufDoDepartamentoEstado).filter((u): u is string => u !== null)
        if (ufs.length > 0) {
          proximo.estado_uf = { modo: 'definir', id: null, nome: ufs.join(', ') }
        }
      }

      return proximo
    })
  }

  function definirValoresString(campo: CampoCadastroPessoa, valores: string[]) {
    setRascunho((atual) =>
      atual
        ? {
            ...atual,
            [campo]: {
              modo: valores.length === 0 ? 'desassociar' : 'definir',
              id: null,
              nome: valores.length === 0 ? null : valores.join(', '),
            },
          }
        : atual,
    )
  }

  const alteracoes: AlteracoesCadastro =
    exibida && rascunho ? calcularAlteracoes(exibida, rascunho) : { definir: {}, reverter: [] }
  const temAlteracao = Object.keys(alteracoes.definir).length > 0 || alteracoes.reverter.length > 0

  return (
    <Modal
      opened={pessoa !== null}
      onClose={onFechar}
      zIndex={320}
      size="lg"
      title={
        exibida && (
          <Title order={4} className={classes.titulo}>
            {exibida.nome}
          </Title>
        )
      }
    >
      {exibida && rascunho && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {exibida.totalCards > 0
              ? `${exibida.totalCards} card(s) nos grupos monitorados · equipe atual: ${exibida.equipe}`
              : `Sem cards no recorte atual · equipe atual: ${exibida.equipe}`}
          </Text>

          {CAMPOS_EXIBIDOS_NO_MODAL.map((campo) => {
            const atual = rascunho[campo]
            const temFonteBitrix = CAMPOS_COM_FONTE_BITRIX.includes(campo)
            const original = rascunhoDoVinculo(vinculoDaPessoa(exibida, campo))

            const dadosBase =
              campo === 'departamento'
                ? departamentosEquipeOptions
                : campo === 'departamento_estado'
                  ? departamentosEstadoOptions
                  : campo === 'estado_uf'
                    ? ufsOptions
                    : usuariosOptions

            const valorArray =
              atual.modo === 'desassociar'
                ? []
                : campo === 'estado_uf'
                  ? atual.nome
                    ? atual.nome
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : []
                  : (atual.ids ?? (atual.id !== null ? [atual.id] : [])).map(String)

            const dados = garantirOpcoes(dadosBase, valorArray, opcoes, campo)

            return (
              <div key={campo} className={classes.campoEdicao}>
                <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                  <Text size="sm" fw={600} className={classes.labelCampo}>
                    {ROTULO_CAMPO_CADASTRO[campo]}
                  </Text>
                  <Group gap="xs" align="center" style={{ flexShrink: 0 }}>
                    <Text size="xs" className={classeDoModo(atual.modo)}>
                      {descreverModo(campo, atual, temFonteBitrix)}
                    </Text>
                    {temFonteBitrix && atual.modo !== 'desassociar' && (
                      <Button
                        variant="subtle"
                        color="gray"
                        size="compact-xs"
                        disabled={!podeEditar || salvando}
                        onClick={() => trocarModo(campo, 'desassociar')}
                      >
                        Desassociar
                      </Button>
                    )}
                    {atual.modo !== 'herdar' && (
                      <Button
                        variant="subtle"
                        color="gray"
                        size="compact-xs"
                        disabled={!podeEditar || salvando}
                        onClick={() => trocarModo(campo, 'herdar')}
                      >
                        {temFonteBitrix ? 'Usar os do Bitrix' : 'Limpar'}
                      </Button>
                    )}
                  </Group>
                </Group>

                <MultiSelect
                  radius="lg"
                  classNames={{
                    input: classesInput.input,
                    section: classesInput.secao,
                    dropdown: classesInput.dropdown,
                    option: classesInput.option,
                  }}
                  placeholder={placeholderDoCampo(campo, atual, temFonteBitrix)}
                  data={dados}
                  value={valorArray}
                  disabled={!podeEditar || salvando}
                  searchable
                  clearable
                  comboboxProps={{ zIndex: 400, withinPortal: true }}
                  nothingFoundMessage="Nenhuma opção encontrada"
                  onChange={(escolhidos) => {
                    if (campo === 'estado_uf') {
                      definirValoresString(campo, escolhidos)
                    } else {
                      const ids = escolhidos.map(Number).filter((n) => !Number.isNaN(n))
                      const rotulos = ids.map((id) => obterRotuloOpcao(opcoes, campo, id))
                      definirLista(campo, ids, rotulos)
                    }
                  }}
                />

                {original.modo === 'herdar' && temFonteBitrix && (
                  <Text size="xs" c="dimmed" mt={4}>
                    No Bitrix: {descreverValoresBitrix(original, opcoes, campo)}
                  </Text>
                )}
              </div>
            )
          })}

          {!podeEditar && (
            <Alert color="yellow" variant="light" title="Somente leitura">
              Seu usuário não está na lista de quem pode editar o cadastro. O servidor recusaria a
              gravação, então os campos estão desabilitados.
            </Alert>
          )}

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="default" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              color="yellow"
              disabled={!podeEditar || !temAlteracao}
              loading={salvando}
              onClick={() => onSalvar(alteracoes)}
            >
              Salvar
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

function obterRotuloOpcao(opcoes: OpcoesCadastro, campo: CampoCadastroPessoa, id: number): string {
  if (campo === 'departamento') {
    return opcoes.departamentos.find((d) => d.id === id)?.nome ?? `Dep ${id}`
  }
  if (campo === 'departamento_estado') {
    const achado = opcoes.departamentosEstado.find((d) => d.id === id)
    if (achado) return achado.nome
    const idx = -9000 - id
    if (idx >= 0 && idx < UFS.length) return `Andamento - ${UFS[idx]}`
    return `Dep Estado ${id}`
  }
  return opcoes.usuarios.find((u) => u.id === id)?.nome ?? `Usuário ${id}`
}

function descreverValoresBitrix(
  original: RascunhoVinculo,
  opcoes: OpcoesCadastro,
  campo: CampoCadastroPessoa,
): string {
  if (campo === 'estado_uf') {
    return original.nome ?? 'não cadastrado'
  }
  const ids = original.ids ?? (original.id !== null ? [original.id] : [])
  if (ids.length > 0) {
    return ids.map((id) => obterRotuloOpcao(opcoes, campo, id)).join(', ')
  }
  return original.nome ?? 'não cadastrado'
}

function placeholderDoCampo(
  campo: CampoCadastroPessoa,
  atual: RascunhoVinculo,
  temFonteBitrix: boolean,
): string {
  if (atual.modo === 'desassociar') return 'Desassociado'
  if (campo === 'estado_uf') return 'Selecione as UFs'
  if (campo === 'departamento_estado') return 'Selecione os estados (Andamento - <UF>)'
  if (campo === 'departamento') return 'Selecione as equipes'
  if (atual.modo === 'herdar' && atual.nome) return 'Herdado (digite para alterar)'
  if (temFonteBitrix) return 'Não cadastrado no Bitrix'
  return 'Selecione ou digite para buscar'
}

function descreverModo(
  campo: CampoCadastroPessoa,
  atual: RascunhoVinculo,
  temFonteBitrix: boolean,
): string {
  if (atual.modo === 'definir') {
    return campo === 'departamento_estado'
      ? 'Atribuído aqui — não existe no Bitrix'
      : 'Definido à mão — vence o Bitrix'
  }
  if (atual.modo === 'desassociar') return 'Desassociado — o Bitrix não volta a valer'
  if (!temFonteBitrix) {
    if (campo === 'estado_uf') return 'Sem UF definida'
    if (campo === 'departamento_estado') return 'Sem departamento de estado'
    return 'Sem vínculo definido'
  }
  return atual.nome ? 'Herdado do Bitrix' : 'Sem valor no Bitrix'
}

function classeDoModo(modo: ModoVinculo): string {
  if (modo === 'definir') return classes.valorEditado
  if (modo === 'desassociar') return classes.valorDesassociado
  return classes.valorHerdado
}

function garantirOpcoes(
  dados:
    | Array<{ group: string; items: Array<{ value: string; label: string }> }>
    | Array<{ value: string; label: string }>,
  valorArray: string[],
  opcoes: OpcoesCadastro,
  campo: CampoCadastroPessoa,
) {
  const existentes = new Set<string>()
  if (Array.isArray(dados) && dados.length > 0 && 'items' in dados[0]) {
    ;(dados as Array<{ group: string; items: Array<{ value: string; label: string }> }>).forEach(
      (g) => {
        g.items.forEach((item) => existentes.add(item.value))
      },
    )
  } else {
    ;(dados as Array<{ value: string; label: string }>).forEach((item) =>
      existentes.add(item.value),
    )
  }

  const faltantes = valorArray.filter((v) => !existentes.has(v))
  if (faltantes.length === 0) return dados

  const novos = faltantes.map((val) => {
    const id = Number(val)
    const label = !Number.isNaN(id) ? obterRotuloOpcao(opcoes, campo, id) : val
    return { value: val, label }
  })

  if (Array.isArray(dados) && dados.length > 0 && 'items' in dados[0]) {
    const copia = [
      ...(dados as Array<{ group: string; items: Array<{ value: string; label: string }> }>),
    ]
    if (copia.length > 0) {
      copia[0] = { group: copia[0].group, items: [...novos, ...copia[0].items] }
    }
    return copia
  }

  return [...novos, ...(dados as Array<{ value: string; label: string }>)]
}
