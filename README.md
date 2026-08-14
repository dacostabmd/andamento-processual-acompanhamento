# Dashboard de Andamento Processual

Dashboard embutido no Bitrix24 que acompanha tarefas com prazo dos projetos
monitorados: métricas gerais e por setor, filtros combináveis e uma tela de
inteligência com gráficos por equipe de atendimento.

## Arquitetura de dados

- **Tarefas** (o grosso do volume): o Bitrix24 deste portal é lento demais no
  método `tasks.task.list` para buscar ao vivo no navegador (grupos
  monitorados somam centenas de milhares de tarefas). Por isso, um
  microsserviço próprio — [worker-sync-dashboard-andamento-processual](https://github.com/dacostabmd/worker-sync-dashboard-andamento-processual)
  (FastAPI + SQLite, rodando numa VPS via Docker Compose) — sincroniza
  continuamente em background e mantém um snapshot pronto. O front lê esse
  snapshot via `VITE_SYNC_API_URL` (`GET /snapshot`), instantâneo
  independente do volume real no Bitrix.
- **Acesso, grupos e departamentos** (chamadas leves): continuam ao vivo,
  via `window.BX24` quando embutido no Bitrix, ou webhook REST
  (`VITE_BITRIX_API_URL`) fora do iframe.

## Desenvolvimento

```bash
npm install
npm run dev
```

Sem `VITE_SYNC_API_URL` configurada (ou com o serviço fora do ar/sem sync
concluído), a tela de inteligência mostra um estado de erro explícito. Embutido
no Bitrix o app usa o `window.BX24` para acesso/departamentos; fora do iframe,
defina `VITE_BITRIX_API_URL` no `.env`.

Outros comandos: `npm run build` (typecheck + build), `npm run lint`,
`npm run format`.

## Configuração

| Variável                  | Descrição                                                                                               | Padrão     |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| `VITE_BITRIX_GRUPOS_ALVO` | IDs dos grupos (projetos) do Bitrix24 monitorados, separados por vírgula. Aplicada em tempo de build.   | `86,92,94` |
| `VITE_SYNC_API_URL`       | URL do microsserviço de sincronização (worker-sync-dashboard-andamento-processual). Sem token embutido. | —          |

## Deploy na Vercel

1. Importe o repositório na Vercel (preset **Vite** é detectado sozinho).
2. Em _Settings → Environment Variables_, defina `VITE_BITRIX_GRUPOS_ALVO` com
   os IDs reais dos grupos monitorados.
3. Em _Settings → Deployment Protection_, desative a proteção do ambiente de
   produção — o Bitrix precisa acessar o app sem login da Vercel (e a função
   `api/index.js` refaz o fetch do próprio deploy).
4. Faça o deploy e guarde a URL de produção (ex.: `https://seu-app.vercel.app/`).

Peças específicas do embed no Bitrix já incluídas no repositório:

- O Bitrix24 abre o iframe do app com **POST** (enviando `AUTH_ID` etc.), e a
  Vercel responde 405 a POST em arquivo estático. O `vercel.json` roteia
  qualquer POST para `api/index.js`, que devolve o `index.html` do deploy.
- O roteamento usa `HashRouter`, então não depende de fallback de SPA nem mexe
  na query string (`DOMAIN`, `APP_SID`) que o SDK BX24 lê.

## Registro no Bitrix24

1. No portal: **Recursos para desenvolvedores → Outro → Aplicativo local**.
2. Escolha aplicativo **com interface (exibido no menu)** e informe a URL de
   produção da Vercel como **caminho do handler** (a raiz já serve o app). Use
   a mesma URL no campo de caminho de instalação inicial, se solicitado.
3. Permissões (escopos) necessárias: `task`, `sonet_group`, `user`,
   `department`.
4. Salve e abra o app pelo menu do portal. O acesso de cada colaborador é
   resolvido pelos grupos de trabalho dele (`sonet_group.user.groups`)
   restritos aos `VITE_BITRIX_GRUPOS_ALVO`; quem não participa de nenhum grupo
   monitorado vê o estado "Nenhum projeto vinculado".

## Decisões de comportamento

- Tarefas **sem prazo** ficam fora do dashboard (o foco é acompanhamento de
  prazos).
- O **setor** de uma tarefa deriva dos departamentos de quem a **fechou**;
  tarefas ainda abertas não entram nas métricas por setor.
- A sessão (usuário + projetos) fica em cache no `localStorage` por 8h como
  otimização de UI; os dados em si são revalidados no Bitrix a cada carga e a
  segurança efetiva é do próprio Bitrix (toda chamada roda como o usuário
  logado).
