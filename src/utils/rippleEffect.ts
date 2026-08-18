/**
 * Dispara a onda circular do efeito "ripple" no ponto do clique de um botão.
 *
 * Extraído de GraficosInteligencia.tsx para ser reaproveitado por outros
 * componentes com pílulas/botões clicáveis (ex.: DesempenhoEquipesRipple).
 * `classeOnda` é a classe CSS (do módulo do CALLER) que estiliza a onda —
 * cada componente tem seu próprio `.module.css` com as regras `.ondaRipple` /
 * `@keyframes ripple-expand` copiadas (CSS Modules não compartilham classes
 * entre arquivos), então a classe precisa ser passada, não hardcoded aqui.
 */
export function dispararOnda(evento: React.MouseEvent<HTMLButtonElement>, classeOnda: string) {
  const botao = evento.currentTarget
  const onda = document.createElement('span')
  const tamanho = Math.max(botao.clientWidth, botao.clientHeight)
  const rect = botao.getBoundingClientRect()
  onda.className = classeOnda
  onda.style.width = onda.style.height = `${tamanho}px`
  onda.style.left = `${evento.clientX - rect.left - tamanho / 2}px`
  onda.style.top = `${evento.clientY - rect.top - tamanho / 2}px`
  botao.appendChild(onda)
  onda.addEventListener('animationend', () => onda.remove())
}
