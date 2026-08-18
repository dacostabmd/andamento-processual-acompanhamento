import { formatarData, formatarDataHora } from '../components/dashboard/tarefaApresentacao'
import { STATUS_LABELS, type Tarefa } from '../types/domain'

export function formatarNumeroTelefone(numero: string): string {
  const limpo = numero.replace(/\D/g, '')
  if (!limpo) return ''
  if (limpo.length === 10 || limpo.length === 11) {
    return `55${limpo}`
  }
  return limpo
}

export function gerarTextoListaTarefas(titulo: string, tarefas: Tarefa[]): string {
  const limiteTarefas = 50
  const total = tarefas.length
  const tarefasExibir = tarefas.slice(0, limiteTarefas)

  const agoraData = new Date().toLocaleDateString('pt-BR')
  const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const linhaDivisoria = '\u2500'.repeat(28)

  let texto = `\uD83D\uDCCA *DASHBOARD DE ANDAMENTO PROCESSUAL*\n`
  texto += `\uD83D\uDCCB *Relatório:* ${titulo}\n`
  texto += `\uD83D\uDD22 *Total:* ${total} tarefa(s)\n`
  texto += `\uD83D\uDCC5 *Gerado em:* ${agoraData} às ${agoraHora}\n`
  texto += `${linhaDivisoria}\n\n`

  tarefasExibir.forEach((t, i) => {
    const statusText = STATUS_LABELS[t.status] ?? 'Pendente'
    const resp =
      t.fechadoPorNome || t.responsavelAtendimentoNome || t.responsavelNome || 'Não informado'
    const equipe =
      t.equipeAtendimento && t.equipeAtendimento !== 'indefinido'
        ? t.equipeAtendimento
        : t.equipeFechador && t.equipeFechador !== 'indefinido'
          ? t.equipeFechador
          : null
    const dataRef = t.finalizadoEm
      ? formatarDataHora(t.finalizadoEm)
      : t.prazoFinal
        ? formatarData(t.prazoFinal)
        : 'Sem data'

    texto += `*${i + 1}. [#${t.id}]* *${t.titulo.trim()}*\n`
    texto += `   \uD83D\uDC64 *Fechado/Resp:* ${resp}\n`
    if (equipe) {
      texto += `   \uD83D\uDC65 *Equipe:* ${equipe}\n`
    }
    texto += `   \uD83D\uDCCC *Status:* ${statusText}\n`
    texto += `   \uD83D\uDD52 *Prazo/Finalizado:* ${dataRef}\n\n`
  })

  if (total > limiteTarefas) {
    texto += `${linhaDivisoria}\n`
    texto += `\u26A0\uFE0F *Exibindo ${limiteTarefas} de ${total} tarefas.*\n`
  } else {
    texto += `${linhaDivisoria}\n`
  }

  texto += `\uD83D\uDCF2 *Enviado via Dashboard Andamento Processual*`

  return texto.trim()
}

export function enviarParaWhatsApp(texto: string, telefoneRaw: string = ''): void {
  const telefone = formatarNumeroTelefone(telefoneRaw)
  const encodedText = encodeURIComponent(texto)

  let url = ''
  if (telefone) {
    url = `https://api.whatsapp.com/send?phone=${telefone}&text=${encodedText}`
  } else {
    url = `https://api.whatsapp.com/send?text=${encodedText}`
  }

  window.open(url, '_blank')
}
