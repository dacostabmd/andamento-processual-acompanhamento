import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import type { Tarefa } from '../../types/domain'
import { enviarParaWhatsApp, gerarTextoListaTarefas } from '../../utils/whatsappExport'

interface BotaoExportarWhatsAppProps {
  titulo: string
  tarefas: Tarefa[]
  variant?: 'button' | 'actionIcon'
  size?: 'xs' | 'sm' | 'md'
}

function IconeWhatsApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.764.459 3.487 1.333 5.006l-1.417 5.176 5.297-1.389c1.464.798 3.116 1.218 4.773 1.219h.004c5.505 0 9.988-4.478 9.989-9.985 0-2.668-1.038-5.176-2.925-7.062s-4.394-2.949-7.064-2.949zm5.72 13.916c-.244.688-1.415 1.314-1.959 1.396-.544.081-1.25.115-2.02-.132-.468-.149-1.077-.345-1.859-.684-3.284-1.419-5.419-4.73-5.583-4.95-.164-.22-1.338-1.78-1.338-3.396 0-1.616.845-2.41 1.144-2.736.3-.326.654-.408.872-.408.218 0 .436.002.627.011.202.009.474-.077.742.565.272.654.925 2.257 1.006 2.42.082.164.137.355.028.572-.11.217-.164.354-.326.544-.163.19-.344.425-.491.571-.164.164-.335.344-.144.671.19.327.848 1.4 1.822 2.268 1.253 1.117 2.308 1.463 2.635 1.627.327.163.518.136.709-.082.191-.218.817-.954 1.035-1.28.218-.327.436-.273.736-.164.3.109 1.906.899 2.233 1.063.327.163.545.245.626.382.082.136.082.79-.162 1.478z" />
    </svg>
  )
}

export function BotaoExportarWhatsApp({
  titulo,
  tarefas,
  size = 'xs',
}: BotaoExportarWhatsAppProps) {
  const [modalAberto, setModalAberto] = useState(false)
  const [telefone, setTelefone] = useState('')

  const handleExportar = () => {
    const texto = gerarTextoListaTarefas(titulo, tarefas)
    enviarParaWhatsApp(texto, telefone)
    setModalAberto(false)
  }

  return (
    <>
      <Button
        size={size}
        color="teal"
        variant="light"
        leftSection={<IconeWhatsApp />}
        onClick={() => setModalAberto(true)}
      >
        WhatsApp ({tarefas.length})
      </Button>

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={`Exportar tarefas para WhatsApp`}
        centered
        size="sm"
        zIndex={1100}
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Você está exportando a lista com <strong>{tarefas.length} tarefa(s)</strong> referentes
            a <em>"{titulo}"</em>.
          </Text>

          <TextInput
            label="Número do WhatsApp (com DDD)"
            placeholder="Ex: 11999999999 ou deixe em branco"
            value={telefone}
            onChange={(e) => setTelefone(e.currentTarget.value)}
          />

          <Text size="xs" c="dimmed">
            * Se deixar o número em branco, o WhatsApp abrirá para você escolher o destinatário na
            lista de contatos.
          </Text>

          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="xs" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button color="teal" size="xs" leftSection={<IconeWhatsApp />} onClick={handleExportar}>
              Abrir no WhatsApp
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
