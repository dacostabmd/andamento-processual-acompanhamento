import { Alert, Button, Group, Modal, MultiSelect, Select, Stack, Text, Title } from '@mantine/core'
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
  CAMPOS_MULTIPLOS,
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

/** UFs do Brasil, para o seletor de Estado. O worker aceita a sigla de 2 letras. */
const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

/**
 * Rótulos dos dois grupos dos seletores. As opções de Andamento vêm primeiro
 * porque são as únicas que cortam as métricas deste dashboard — mas as demais
 * continuam alcançáveis, e não por descuido: um DIRETOR está acima do Andamento no
 * organograma, e cortar tudo fora do escopo o deixaria impossível de escolher.
 */
const GRUPO_ANDAMENTO = 'Andamento Processual'
const GRUPO_OUTROS = 'Outros departamentos'

/** Agrupa opções em "Andamento Processual" e "Outros", omitindo grupo vazio. */
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
 * Edição dos cinco vínculos de UMA pessoa: departamento, supervisor, gerente,
 * diretor e Estado/UF.
 *
 * Nenhum destes campos é escrito no Bitrix — são uma sobreposição local (tabela
 * `pessoas_cadastro` no worker). O aviso no rodapé diz isso ao usuário, porque a
 * suposição natural ao editar "o departamento de alguém" é que o portal mude.
 */
export function CadastroPessoaEdicao({
  pessoa,
  opcoes,
  podeEditar,
  salvando,
  onFechar,
  onSalvar,
}: CadastroPessoaEdicaoProps) {
  // Mantém a última pessoa não-nula para o corpo não "sumir" durante a transição
  // de saída do Modal, que já recebe `pessoa=null` de imediato. Ajustado durante
  // a renderização (e não num efeito), como em PainelSupervisorEquipe: assim o
  // rascunho já sai correto no primeiro render em vez de num segundo passe, o que
  // faria os campos aparecerem por um frame com os dados da pessoa anterior.
  const [exibida, setExibida] = useState<PessoaCadastro | null>(pessoa)
  const [rascunho, setRascunho] = useState<Rascunho | null>(pessoa ? rascunhoDaPessoa(pessoa) : null)

  if (pessoa !== null && pessoa !== exibida) {
    setExibida(pessoa)
    setRascunho(rascunhoDaPessoa(pessoa))
  }

  const usuarios = useMemo(
    () =>
      agrupar(opcoes.usuarios, (u) => ({
        value: String(u.id),
        // O desligamento entra no rótulo: escolher alguém que saiu da empresa como
        // supervisor de uma equipe ativa é quase sempre engano, e a lista é o único
        // lugar onde dá para avisar antes do clique.
        label: u.desligado ? `${u.nome} (desligado)` : u.nome,
      })),
    [opcoes.usuarios],
  )

  // Os departamentos de estado saem desta lista: eles têm campo próprio, e
  // oferecer os dois no mesmo seletor faria escolher "Andamento - SP" SUBSTITUIR o
  // departamento de equipe — tirando a pessoa da equipe dela sem nada avisando.
  const departamentos = useMemo(
    () =>
      agrupar(
        opcoes.departamentos.filter((d) => d.estadoUf === null),
        (d) => ({ value: String(d.id), label: d.nome }),
      ),
    [opcoes.departamentos],
  )

  const departamentosEstado = useMemo(
    () => opcoes.departamentosEstado.map((d) => ({ value: String(d.id), label: d.nome })),
    [opcoes.departamentosEstado],
  )

  function definir(campo: CampoCadastroPessoa, id: number | null, nome: string | null) {
    setRascunho((atual) => {
      if (!atual) return atual
      const proximo: Rascunho = { ...atual, [campo]: { modo: 'definir', id, nome } }

      // Escolher "Andamento - SP" preenche a UF junto: são a mesma informação dita
      // de duas formas, e deixá-las discordarem na tela é convite para gravar um
      // departamento de SP com UF do RJ. Só preenche o que ainda não foi decidido à
      // mão — sobrescrever uma UF escolhida de propósito seria pior que a
      // divergência.
      if (campo === 'departamento_estado' && atual.estado_uf.modo === 'herdar') {
        const uf = ufDoDepartamentoEstado(nome)
        if (uf) proximo.estado_uf = { modo: 'definir', id: null, nome: uf }
      }

      return proximo
    })
  }

  function trocarModo(campo: CampoCadastroPessoa, modo: ModoVinculo) {
    setRascunho((atual) => {
      if (!atual) return atual
      const original = exibida ? rascunhoDoVinculo(vinculoDaPessoa(exibida, campo)) : null
      if (modo === 'herdar') {
        // Volta a exibir o valor do Bitrix quando ele existe — é o que o campo
        // passará a mostrar depois de salvar, e não um vazio que sugere perda.
        const doBitrix =
          original && original.modo === 'herdar' ? original : { modo: 'herdar' as const, id: null, nome: null }
        return { ...atual, [campo]: { ...doBitrix, modo: 'herdar' } }
      }
      const vazio: RascunhoVinculo = { modo, id: null, nome: null }
      if (CAMPOS_MULTIPLOS.includes(campo)) vazio.ids = []
      return { ...atual, [campo]: vazio }
    })
  }

  /** Troca a lista de um campo múltiplo (departamentos). Lista vazia desassocia. */
  function definirLista(campo: CampoCadastroPessoa, ids: number[], rotulos: string[]) {
    setRascunho((atual) =>
      atual
        ? {
            ...atual,
            [campo]: {
              // Lista vazia é "desassociar de todos", não "voltar a herdar": quem
              // esvazia o controle está decidindo que a pessoa não tem departamento,
              // e herdar de volta desfaria essa decisão no próximo sync.
              modo: ids.length === 0 ? 'desassociar' : 'definir',
              id: ids[0] ?? null,
              nome: rotulos[0] ?? null,
              ids,
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

          {CAMPOS_CADASTRO_PESSOA.map((campo) => {
            const atual = rascunho[campo]
            const temFonteBitrix = CAMPOS_COM_FONTE_BITRIX.includes(campo)
            const original = rascunhoDoVinculo(vinculoDaPessoa(exibida, campo))

            const dados =
              campo === 'departamento'
                ? departamentos
                : campo === 'departamento_estado'
                  ? departamentosEstado
                  : campo === 'estado_uf'
                    ? UFS.map((uf) => ({ value: uf, label: uf }))
                    : usuarios

            // O controle vem preenchido com o valor EFETIVO, não só com o que foi
            // definido à mão: um campo vazio sobre um dado que existe leva a pessoa
            // a redigitar o que já estava certo, ou a salvar em cima com menos
            // informação do que havia. Só 'desassociar' aparece vazio, porque ali o
            // vazio É o valor.
            const valor =
              atual.modo === 'desassociar'
                ? null
                : campo === 'estado_uf'
                  ? atual.nome
                  : atual.id !== null
                    ? String(atual.id)
                    : null

            if (CAMPOS_MULTIPLOS.includes(campo)) {
              return (
                <div key={campo} className={classes.campoEdicao}>
                  <MultiSelect
                    radius="lg"
                    classNames={{
                      input: classesInput.input,
                      label: classesInput.label,
                      section: classesInput.secao,
                      dropdown: classesInput.dropdown,
                      option: classesInput.option,
                    }}
                    label={ROTULO_CAMPO_CADASTRO[campo]}
                    description="Uma pessoa pode estar em vários departamentos. Salvar grava esta lista na ficha do portal."
                    placeholder={
                      (atual.ids ?? []).length > 0 ? undefined : placeholderDoCampo(campo, atual, temFonteBitrix)
                    }
                    data={dados}
                    value={(atual.ids ?? []).map(String)}
                    disabled={!podeEditar || salvando}
                    searchable
                    clearable
                    hidePickedOptions
                    nothingFoundMessage="Nada encontrado"
                    onChange={(escolhidos) => {
                      const ids = escolhidos.map(Number).filter((n) => !Number.isNaN(n))
                      definirLista(campo, ids, ids.map((id) => nomeDoDepartamento(opcoes, id)))
                    }}
                  />

                  <Group gap="xs" mt={6} justify="space-between" wrap="wrap">
                    <Text size="xs" className={classeDoModo(atual.modo)}>
                      {descreverModo(campo, atual, temFonteBitrix)}
                    </Text>
                    {atual.modo !== 'herdar' && (
                      <Button
                        variant="subtle"
                        color="gray"
                        size="compact-xs"
                        disabled={!podeEditar || salvando}
                        onClick={() => trocarModo(campo, 'herdar')}
                      >
                        Usar os do Bitrix
                      </Button>
                    )}
                  </Group>

                  {original.modo === 'herdar' && (original.ids ?? []).length > 0 && atual.modo !== 'herdar' && (
                    <Text size="xs" c="dimmed" mt={2}>
                      No Bitrix: {(original.ids ?? []).map((id) => nomeDoDepartamento(opcoes, id)).join(', ')}
                    </Text>
                  )}
                </div>
              )
            }

            return (
              <div key={campo} className={classes.campoEdicao}>
                <Select
                  radius="lg"
                  classNames={{
                    input: classesInput.input,
                    label: classesInput.label,
                    section: classesInput.secao,
                    dropdown: classesInput.dropdown,
                    option: classesInput.option,
                  }}
                  label={ROTULO_CAMPO_CADASTRO[campo]}
                  placeholder={placeholderDoCampo(campo, atual, temFonteBitrix)}
                  data={dados}
                  value={valor}
                  disabled={!podeEditar || salvando}
                  searchable
                  clearable
                  nothingFoundMessage="Nada encontrado"
                  onChange={(escolhido, opcao) => {
                    if (escolhido === null) {
                      // Agora que o controle abre preenchido, esvaziá-lo é um ato
                      // deliberado. Onde há fonte no Bitrix isso significa "esta
                      // pessoa não tem este vínculo" (desassociar); onde não há, o
                      // único sentido possível é apagar a definição manual.
                      trocarModo(campo, temFonteBitrix ? 'desassociar' : 'herdar')
                      return
                    }
                    if (campo === 'estado_uf') {
                      definir(campo, null, escolhido)
                      return
                    }
                    definir(campo, Number(escolhido), opcao?.label ?? null)
                  }}
                />

                <Group gap="xs" mt={6} justify="space-between" wrap="wrap">
                  <Text size="xs" className={classeDoModo(atual.modo)}>
                    {descreverModo(campo, atual, temFonteBitrix)}
                  </Text>
                  <Group gap="xs">
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
                        {temFonteBitrix ? 'Usar o do Bitrix' : 'Limpar'}
                      </Button>
                    )}
                  </Group>
                </Group>

                {original.modo !== atual.modo && original.modo === 'herdar' && temFonteBitrix && (
                  <Text size="xs" c="dimmed" mt={2}>
                    No Bitrix: {original.nome ?? 'não cadastrado'}
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

          <Group justify="flex-end" gap="sm">
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

/** Nome de um departamento pelo id, das mesmas opções que o seletor oferece. */
function nomeDoDepartamento(opcoes: OpcoesCadastro, id: number): string {
  return opcoes.departamentos.find((d) => d.id === id)?.nome ?? `Dep ${id}`
}

function placeholderDoCampo(
  campo: CampoCadastroPessoa,
  atual: RascunhoVinculo,
  temFonteBitrix: boolean,
): string {
  if (atual.modo === 'desassociar') return 'Desassociado'
  if (atual.modo === 'herdar' && atual.nome) return atual.nome
  if (temFonteBitrix) return 'Não cadastrado no Bitrix'
  if (campo === 'estado_uf') return 'Selecione a UF'
  if (campo === 'departamento_estado') return 'Nenhum estado atribuído'
  return 'Não definido'
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

