# Mini-CRM WhatsApp · E3

CRM de atendimento multi-unidade integrado ao WhatsApp. Cada unidade (filial) conecta seu
próprio número, recebe mensagens em uma inbox isolada e responde automaticamente quem
manda `Oi`. O acesso é feito com login Google e cada usuário só enxerga os dados da própria
unidade.

- **Deploy (frontend):** https://e3minicrm.firebaseapp.com
- **Vídeo da demo:** https://www.youtube.com/watch?v=8W8MPzYa4lo

## Stack

| Camada      | Tecnologia                                                        |
| ----------- | ----------------------------------------------------------------- |
| Monorepo    | pnpm workspaces + Turborepo                                       |
| Backend     | NestJS 11, TypeScript, Prisma 7                                   |
| Banco       | PostgreSQL 16                                                     |
| WhatsApp    | Evolution API v2.3.7 (Baileys) + Redis 7 para cache de sessão     |
| Auth        | Firebase Authentication (Google) no front, Firebase Admin no back |
| Frontend    | React 19, Vite 6, Ant Design 5                                    |
| Infra local | Docker Compose                                                    |

## Arquitetura

```
apps/
  api/     NestJS: REST, Prisma, integração Evolution, webhook
  web/     React + Vite: login, inbox, painel admin
packages/
  shared/  espaço para tipos compartilhados entre api e web
docker/
  postgres/init-db.sql   cria o schema usado pela Evolution API
```

Fluxo de uma mensagem recebida:

```
WhatsApp → Evolution API → POST /webhooks/evolution → NestJS
  → grava Conversation + Message (com unitId)
  → se o texto for "oi", envia a resposta automática de volta pela Evolution: Oi! Aqui é o Atendente da E3
```

O frontend nunca fala com a Evolution API direto: ele consome apenas a API NestJS, que é a
única dona das credenciais da Evolution.

## Pré-requisitos

- Node 22+ e pnpm 9.15
- Docker e Docker Compose
- Um projeto Firebase (Authentication com provedor Google habilitado)
- Um número de WhatsApp secundário/descartável para pareamento

## Setup local

### 1. Dependências

```bash
pnpm install
```

### 2. Firebase

No [console do Firebase](https://console.firebase.google.com):

1. Crie um projeto e habilite **Authentication → Sign-in method → Google**.
2. Em **Authentication → Settings → Authorized domains**, confirme que `localhost` está na lista.
3. Registre um app **Web** e guarde as credenciais (`apiKey`, `authDomain`, `projectId`, `appId`).
4. Em **Project settings → Service accounts**, gere uma chave privada. Dela saem
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`.

### 3. Variáveis de ambiente

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
```

Preencha o `.env` da raiz (usado pelo Docker Compose e pela API) e o `apps/web/.env` (lido
pelo Vite; só variáveis com prefixo `VITE_` chegam ao bundle).

No `FIREBASE_PRIVATE_KEY`, mantenha a chave entre aspas e com os `\n` literais:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Defina segredos próprios para `EVOLUTION_API_KEY`, `WEBHOOK_SECRET` e `ADMIN_SECRET` — os
valores `change-me` são apenas placeholders.

### 4. Subir o ambiente

```bash
docker compose up -d --build
```

Isso sobe Postgres, Redis, Evolution API e a API NestJS. O container da API roda
`prisma migrate deploy` e, com `RUN_SEED=true`, o seed (que cria as unidades **Unidade A** e
**Unidade B**) antes de iniciar.

Serviços e portas:

| Serviço       | URL                               |
| ------------- | --------------------------------- |
| API           | http://localhost:3000 (`/health`) |
| Evolution API | http://localhost:8080             |
| Postgres      | localhost:5432                    |
| Redis         | localhost:6379                    |

Na **primeira vez** que o ambiente sobe, abra http://localhost:8080 e faça login na
Evolution API com a `EVOLUTION_API_KEY` definida no `.env`. Sem isso, o Manager fica
bloqueado e a criação de instâncias pelo CRM pode falhar.

### 5. Frontend

```bash
pnpm --filter @e3/web dev
```

Disponível em http://localhost:5173.

### 6. Testes da API

```bash
pnpm --filter @e3/api test
```

Unitários com Vitest (Prisma e Evolution mockados). O script roda `prisma generate` antes.

## Primeiro acesso

Como o login é com Google, não existe usuário semeado: o vínculo é feito por e-mail no
painel admin. Sem isso, o login retorna `403` informando que o e-mail não está vinculado.

1. Abra http://localhost:5173/admin e destrave com o `ADMIN_SECRET` do seu `.env`.
2. Na aba **Unidades**, confirme que existem as duas unidades do seed (ou crie outras).
3. Na aba **Acessos**, vincule os e-mails Google que vão logar — pelo menos um em cada
   unidade, para demonstrar o isolamento.
4. Volte para http://localhost:5173 e entre com Google.
5. No painel de WhatsApp, clique em **Conectar** e leia o QR Code com o celular.
6. De outro número, mande `Oi` para o número pareado. A resposta automática
   `Oi! Aqui é o Atendente da E3` é enviada e a conversa aparece na inbox.

Para ver o isolamento, entre com o usuário da outra unidade: a inbox estará vazia, porque
as conversas pertencem à unidade que conectou o número.

## Variáveis de ambiente

### Raiz (`.env`) — Docker Compose e API

| Variável                                                                 | Descrição                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `PORT`                                                                   | Porta da API (padrão `3000`)                                       |
| `DATABASE_URL`                                                           | Conexão Postgres do schema `public`                                |
| `CORS_ORIGIN`                                                            | Origem liberada para o frontend                                    |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Service account do Firebase Admin                                  |
| `EVOLUTION_API_URL`                                                      | Base da Evolution (`http://evolution-api:8080` dentro do Compose)  |
| `EVOLUTION_API_KEY`                                                      | API key global da Evolution                                        |
| `WEBHOOK_SECRET`                                                         | Segredo que autentica o webhook da Evolution                       |
| `PUBLIC_API_URL`                                                         | URL da API acessível pela Evolution (`http://api:3000` no Compose) |
| `ADMIN_SECRET`                                                           | Senha do painel `/admin`                                           |
| `RUN_SEED`                                                               | Roda o seed no start do container (`true`/`false`)                 |

### `apps/web/.env` — Vite

| Variável                                                                                                    | Descrição                     |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `VITE_API_URL`                                                                                              | Base da API                   |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_PROJECT_ID` / `VITE_FIREBASE_APP_ID` | Config do app web no Firebase |

## Modelo de dados

`Unit` é a raiz do isolamento: `User`, `WhatsAppInstance`, `Conversation` e `Message` todos
carregam `unitId`.

| Modelo             | Papel                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| `Unit`             | Filial, com `slug` único usado no nome da instância na Evolution           |
| `User`             | E-mail Google vinculado a uma unidade                                      |
| `WhatsAppInstance` | Conexão da unidade (nome da instância, token, telefone, status, último QR) |
| `Conversation`     | Contato por unidade, único em `(unitId, remoteJid)`                        |
| `Message`          | Mensagem `inbound`/`outbound` com o texto e o id externo                   |

Guardar `unitId` também em `Message` e `Conversation` (e não apenas na relação pai) permite
filtrar por unidade sem join e deixa o filtro de isolamento explícito em toda query.

## API

Rotas autenticadas exigem `Authorization: Bearer <id-token do Firebase>`. O `FirebaseAuthGuard`
valida o token, resolve o usuário pelo e-mail e injeta `request.user` com o `unitId` usado em
todas as consultas.

| Método   | Rota                           | Descrição                                             |
| -------- | ------------------------------ | ----------------------------------------------------- |
| `GET`    | `/health`                      | Healthcheck                                           |
| `GET`    | `/me`                          | Perfil e unidade do usuário logado                    |
| `GET`    | `/conversations`               | Conversas da unidade                                  |
| `GET`    | `/conversations/:id/messages`  | Mensagens da conversa                                 |
| `POST`   | `/conversations/:id/messages`  | Envio manual (além do escopo do teste)                |
| `DELETE` | `/conversations/:id`           | Remove a conversa                                     |
| `POST`   | `/whatsapp/connect`            | Cria a instância e retorna o QR                       |
| `GET`    | `/whatsapp/qr`                 | QR atual do pareamento                                |
| `GET`    | `/whatsapp/status`             | Status da conexão                                     |
| `POST`   | `/whatsapp/disconnect`         | Desconecta e remove a instância                       |
| `POST`   | `/whatsapp/cancel`             | Cancela um pareamento em andamento                    |
| `POST`   | `/webhooks/evolution`          | Webhook da Evolution (protegido por `WEBHOOK_SECRET`) |
| `*`      | `/admin/units`, `/admin/users` | CRUD do painel (protegido por `ADMIN_SECRET`)         |

## Decisões de arquitetura

**PostgreSQL -** O domínio é relacional (unidades → usuários → conversas → mensagens), e chaves
estrangeiras transformam o isolamento por `unitId` em restrição do schema, não em convenção de
código. A Evolution também precisa de um banco para guardar as sessões do WhatsApp, e aceita
apenas PostgreSQL ou MySQL. Em vez de subir dois bancos, um único Postgres atende os dois: a
aplicação usa o schema `public` e a Evolution o `evolution_api`, criado pelo `db-init` no boot.

**Evolution API -** A sessão do WhatsApp é um processo longo: uma vez pareada por QR Code, ela
precisa continuar viva. Se o Baileys rodasse dentro da API, cada deploy derrubaria a conexão e
exigiria parear de novo. Por isso a Evolution fica em container separado, com o próprio volume de
sessões — a API só conversa com ela por HTTP e recebe os eventos de mensagem por webhook.

## Deploy do frontend (Firebase Hosting)

Configuração já no repo:

- [`firebase.json`](firebase.json) — `public: apps/web/dist`, rewrite SPA para `index.html`
- [`.firebaserc`](.firebaserc) — projeto `e3minicrm`

### URL pública

https://e3minicrm.firebaseapp.com

Na API em produção, use essa URL em `CORS_ORIGIN`.

### Pré-requisitos

```bash
firebase login
```

Preencha `apps/web/.env` (ver `apps/web/.env.example`). Em produção, `VITE_API_URL` deve ser a
URL HTTPS da API, não `localhost`.

### Build e deploy

```bash
pnpm --filter @e3/web build
firebase deploy --only hosting --project e3minicrm
```

(ou só `firebase deploy --only hosting` se o projeto default do `.firebaserc` estiver ok)

As variáveis `VITE_*` entram no bundle no momento do **build**. Se mudar a URL da API, rebuild
e deploy de novo.

Em **Firebase Authentication → Settings → Authorized domains**, confirme
`e3minicrm.web.app` e `e3minicrm.firebaseapp.com` (o Firebase costuma incluir automaticamente).

## O que faria diferente com mais tempo

- **Quebrar os arquivos grandes.** `whatsapp.service.ts` (~860 linhas) acumula pareamento,
  webhook, persistência e auto-resposta; separaria em serviços por responsabilidade. No front,
  `AdminPage.tsx` e `InboxPage.tsx` (~600 linhas cada) pedem extração de componentes e hooks.
- **Tipar os erros de verdade.** Hoje o tratamento passa por `unknown` e checagens
  `instanceof Error`, com o motivo real da Evolution embrulhado em `InternalServerErrorException`.
  Criaria classes de exceção de domínio (herdando de `HttpException` do Nest) para casos como
  WhatsApp desconectado, e-mail não vinculado e payload inválido — o `catch` usaria
  `instanceof` nessas classes, e o Nest traduziria o status HTTP. Em paralelo, um schema
  Zod validaria os payloads de webhook na entrada (hoje o narrowing é manual em `unknown`).
- **Convite por WhatsApp ou e-mail.** Hoje o vínculo usuário→unidade é manual no `/admin`
  (e-mail cadastrado antes do login). Com mais tempo, o admin geraria um link de convite
  amarrado à unidade; o convidado abriria o link, faria login Google e já sairia vinculado
  automaticamente — sem cadastrar o e-mail na mão.
- **Ampliar os testes.** Já há unitários nos pontos críticos (isolamento por unidade,
  auto-resposta, resolução `@lid` e guards). Com mais tempo, cobriria slugify, geração de
  QR e um e2e do webhook.
- **Fila para o webhook.** O processamento é síncrono na request; um worker daria retry e
  evitaria perder eventos sob carga.
- **Rate limit.** Limitar tentativas no `/admin` e nas rotas autenticadas; o webhook da
  Evolution ficaria de fora (ou com teto bem alto), para não dropar eventos reais.
- **Observabilidade e CI.** Logs estruturados com correlação por instância, além de lint,
  typecheck e build no pipeline.
  
---

> **Nota pós-entrega:** As melhorias citadas nesta seção (refatoração de arquivos monolíticos no backend e frontend, hierarquia de exceções de domínio no NestJS, validação estrita Zod no webhook, ampliação de testes unitários e E2E, controle de rate limit com `@nestjs/throttler`, comunicação em tempo real via WebSockets/Socket.IO, cliente HTTP centralizado com interceptores e tratamento de erros por classes de domínio) foram posteriormente implementadas e organizadas em Pull Requests e branches técnicas dedicadas no repositório.
