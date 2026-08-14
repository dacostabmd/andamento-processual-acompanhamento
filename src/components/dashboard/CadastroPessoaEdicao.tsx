import { Alert, Button, Group, Modal, Select, Stack, Text, Title } from '@mantine/core'
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
      return { ...atual, [campo]: { modo, id: null, nome: null } }
    })
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

            const valor =
              atual.modo !== 'definir'
                ? null
                : campo === 'estado_uf'
                  ? atual.nome
                  : atual.id !== null
                    ? String(atual.id)
                    : null

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
                      trocarModo(campo, 'herdar')
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

          <Alert color="blue" variant="light" title="O que isto muda, e o que não muda">
            Estes vínculos ficam guardados no servidor do dashboard e valem para as métricas — eles
            NÃO são escritos no Bitrix24, então a ficha da pessoa no portal continua como está. As
            tarefas já sincronizadas são recalculadas na hora ao salvar. O departamento de estado
            ("Andamento - SP") existe só aqui e convive com o de equipe: quem decide a equipe nas
            métricas continua sendo o departamento de equipe.
          </Alert>

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

