import { Link } from 'react-router-dom'
import { VERSAO_ATUAL } from '../components/dashboard/VersaoModal'
import classes from './ChangelogsPage.module.css'

export function ChangelogsPage() {
  return (
    <div className={classes.page}>
      <div className={classes.container}>
        <div className={classes.headerBar}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Documentação de Métricas e Inteligência Artificial
            </h1>
            <p
              style={{
                margin: '4px 0 0 0',
                color: 'var(--texto-secundario, #a0aec0)',
                fontSize: '14px',
              }}
            >
              Dashboard de Andamento Processual — Versão v{VERSAO_ATUAL}
            </p>
          </div>
          <Link to="/dashboard" className={classes.btnVoltar}>
            ‹ Voltar ao Dashboard
          </Link>
        </div>

        {/* SEÇÃO 1: FÓRMULAS DAS MÉTRICAS DO PAINEL */}
        <div className={classes.cardSecao}>
          <h2 className={classes.tituloSecao}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Fórmulas e Regras de Cálculo das Métricas
          </h2>
          <p
            style={{ color: 'var(--texto-secundario, #a0aec0)', fontSize: '14px', lineHeight: 1.6 }}
          >
            Todas as métricas operacionais do painel são calculadas em tempo real com base na
            situação e prazos das tarefas.
          </p>

          <table className={classes.tabelaMetricas}>
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Definição / Conceito</th>
                <th>Fórmula Matemática</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Em Andamento</strong>
                </td>
                <td>Tarefas ativas que ainda estão dentro do prazo final estipulado.</td>
                <td>
                  <span className={classes.badgeFormula}>
                    status &lt; 5 AND prazoFinal &gt;= agora
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Risco de Atraso</strong>
                </td>
                <td>Tarefas ativas no prazo que vencem nos próximos 3 dias.</td>
                <td>
                  <span className={classes.badgeFormula}>
                    status &lt; 5 AND (prazoFinal - agora) &lt;= 3 dias
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Atrasadas</strong>
                </td>
                <td>Tarefas pendentes cujo prazo já venceu e ainda não foram concluídas.</td>
                <td>
                  <span className={classes.badgeFormula}>
                    status &lt; 5 AND prazoFinal &lt; agora
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Taxa de Atraso (Fila Ativa)</strong>
                </td>
                <td>
                  Mede o percentual de atraso em relação apenas ao total de tarefas pendentes
                  (backlog ativo da equipe).
                </td>
                <td>
                  <span className={classes.badgeFormula}>
                    (Atrasadas / (Total - Concluídas)) * 100
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Taxa de Atraso (Volume Total)</strong>
                </td>
                <td>
                  Mede o percentual de atraso considerando todo o volume histórico (pendentes +
                  concluídas).
                </td>
                <td>
                  <span className={classes.badgeFormula}>(Atrasadas / Total Geral) * 100</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Aguardando Controle</strong>
                </td>
                <td>Tarefas pendentes de revisão ou validação de qualidade antes de fechar.</td>
                <td>
                  <span className={classes.badgeFormula}>status == 4</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Concluídas</strong>
                </td>
                <td>Tarefas com encerramento confirmado.</td>
                <td>
                  <span className={classes.badgeFormula}>status == 5</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Eficiência Operacional</strong>
                </td>
                <td>Proporção de tarefas concluídas em relação ao volume total.</td>
                <td>
                  <span className={classes.badgeFormula}>(Concluídas / Total Geral) * 100</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SEÇÃO 2: FUNCIONAMENTO DO CHAT DE INTELIGÊNCIA ARTIFICIAL */}
        <div className={classes.cardSecao}>
          <h2 className={classes.tituloSecao}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <line x1="8" y1="16" x2="8" y2="16" />
              <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
            Arquitetura e Lógica do Chat de IA (Ajudante Virtual)
          </h2>

          <div className={classes.caixaIA}>
            <div className={classes.itemDestaque}>
              <h4>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#cba556"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                1. Motor Text-to-SQL em Tempo Real
              </h4>
              <p>
                O chat converte perguntas em linguagem natural diretamente em consultas SQLite
                otimizadas. A IA acessa estritamente os dados oficiais armazenados na base local,
                sem utilizar estimativas de memória ou alucinações.
              </p>
            </div>

            <div className={classes.itemDestaque}>
              <h4>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#cba556"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                2. Memória Conversacional de Contexto (Follow-ups)
              </h4>
              <p>
                O motor retém até <strong>30 mensagens de histórico recente</strong>. Perguntas de
                seguimento curtas (como
                <em>"Quis dizer no último mês"</em>, <em>"E a Cinthia?"</em> ou{' '}
                <em>"Por que eles são de negociação?"</em>) herdam automaticamente o assunto e os
                alvos discutidos anteriormente.
              </p>
            </div>

            <div className={classes.itemDestaque}>
              <h4>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#cba556"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                3. Mecanismo de Degradação Graciosa
              </h4>
              <p>
                Quando o usuário pesquisa por recortes de período recentes sem tarefas finalizadas
                no intervalo (ex.: <em>"últimos 7 dias"</em>), o sistema detecta a consulta zerada e
                amplia a busca até a <strong>data da última conclusão registrada</strong>,
                informando também o volume de 30 e 90 dias com transparência analítica.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
