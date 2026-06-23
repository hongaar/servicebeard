# Serviceboard

Multi-tenant application that syncs project mailboxes (IMAP/SMTP) with issue trackers. First supported provider: **GitLab** (cloud + self-hosted).

## Features

- OIDC authentication (configurable IdP via env)
- Teams, projects, member management
- Per-project IMAP polling + SMTP outbound
- Rules engine (match sender/subject/body → create issue with labels/assignee)
- Bidirectional sync: email → issue/comment, issue comment → email reply
- Loop prevention via GitLab internal notes
- Webhook + polling fallback for outbound comments
- Kubernetes deployment via Helm

## Stack

| Layer | Technology |
|-------|------------|
| API | Bun + Hono |
| Worker | Bun + pg-boss |
| Frontend | Vite + React + Base UI + CSS Modules |
| Database | PostgreSQL + Drizzle ORM |
| Deploy | Helm + Docker |

## Quickstart

### Prerequisites

- [Bun](https://bun.sh) 1.2+
- Docker (for Postgres, GreenMail, Adminer, Roundcube)

### 1. Start infrastructure

```bash
docker compose up -d
cp .env.example .env
# Edit .env with your OIDC settings
```

### 2. Install & migrate

```bash
bun install
bun run db:generate
bun run db:migrate
```

### 3. Run dev servers

```bash
# Terminal 1 - API
bun run dev:api

# Terminal 2 - Worker
bun run dev:worker

# Terminal 3 - Web UI
bun run dev:web
```

Open http://localhost:5173 (web UI) and http://localhost:3000 (API).

## Local development

`docker compose up -d` also starts Postgres, GreenMail, Adminer, and Roundcube. These services are for local development only — they are not deployed to Kubernetes.

### Dev URLs

| Service | URL |
|---------|-----|
| Web UI | http://localhost:5173 |
| API | http://localhost:3000 |
| Dev mail UI (Roundcube) | http://localhost:8888 |
| GreenMail API / raw browser | http://localhost:8080 |
| Database UI (Adminer) | http://localhost:8081 |

### Configuration

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM secret encryption |
| `OIDC_ISSUER` | OIDC provider issuer URL |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |
| `OIDC_REDIRECT_URI` | Callback URL (e.g. `http://localhost:3000/api/auth/callback`) |
| `SESSION_SECRET` | Session signing secret |
| `WEBHOOK_BASE_URL` | Public URL for GitLab webhooks |
| `TLS_CA_BUNDLE` | Optional path to a PEM CA bundle used for all GitLab API calls (merged with per-project CA) |

### Database UI

[Adminer](https://www.adminer.org/) is available at http://localhost:8081:

| Field | Value |
|-------|-------|
| System | PostgreSQL |
| Server | `postgres` (from Adminer container) or `localhost` (from host tools) |
| Username | `serviceboard` |
| Password | `serviceboard` |
| Database | `serviceboard` |

For a schema-aware view without an extra container, use Drizzle Studio:

```bash
bun run db:studio
```

### How sync works

**Inbound (email → issue)**

1. Worker polls IMAP for unseen messages per active project
2. Thread match via `Message-ID` / `References` / subject+sender
3. Existing thread → append as internal comment on issue
4. New thread → evaluate rules → create GitLab issue with metadata
5. Optional acknowledgement email to the original sender (project setting)

**Outbound (comment → email)**

1. GitLab `note_events` webhook (or polling fallback)
2. Skip internal notes and bot-authored notes
3. Send threaded reply email via project SMTP

### Testing

Run the unit test suite:

```bash
bun test
```

#### Mail testing with GreenMail

[GreenMail](https://greenmail-mail-test.github.io/greenmail/) provides **IMAP** (3143) and **SMTP** (3025). Two mailboxes are preconfigured:

| Mailbox | IMAP/SMTP login | Password |
|---------|-----------------|----------|
| `support@mail.test` (project inbox) | `support` | `support` |
| `customer@mail.test` (simulate a reporter) | `customer` | `customer` |

**Webmail:** [Roundcube](http://localhost:8888) connects to GreenMail over IMAP. Standard folders (Sent, Drafts, Spam, Trash, Archive) are scaffolded at startup for both mailboxes. Log in with `support` / `support` or `customer` / `customer` (local-part username). When composing mail, use `@mail.test` addresses — Roundcube rejects single-label domains like `@localhost`. Log out and sign in as the other user to switch mailboxes.

GreenMail’s raw API/message browser is at http://localhost:8080.

Configure your project mail settings to use the **support** inbox for both IMAP and SMTP:

| Field | Value |
|-------|-------|
| IMAP host | `localhost` |
| IMAP port | `3143` |
| IMAP TLS | off |
| IMAP user | `support` |
| IMAP password | `support` |
| SMTP host | `localhost` |
| SMTP port | `3025` |
| SMTP TLS | off |
| SMTP user | `support` |
| SMTP password | `support` |
| From | `support@mail.test` (or `Support <support@mail.test>`) |

**1. Inbound (email → issue)** — send mail into the project inbox ([swaks](https://www.jetmore.org/john/code/swaks/) optional):

```bash
swaks --to support@mail.test \
  --from customer@mail.test \
  --server 127.0.0.1 --port 3025 \
  --header "Subject: Help needed" \
  --body "My app is broken"
```

The worker polls IMAP and should create a GitLab issue (with a matching rule). View the message in Roundcube (support inbox).

If **Send acknowledgement email for new issues** is enabled on the project, the worker also sends a threaded reply to the inbound `From` address. The reply lands in the reporter mailbox — log into Roundcube as `customer` / `customer` and check the inbox. Use `@mail.test` addresses when composing mail; acknowledgements are sent to whatever address appears in `From` (misconfigured clients that send as `@greenmail` or `@localhost` will not deliver to the `customer@mail.test` inbox).

**2. Outbound (comment → email)** — add a public comment on the synced GitLab issue. The reply is sent via SMTP to `customer@mail.test`. Log into Roundcube as `customer` / `customer` to read it.

**3. Reply (email → comment)** — send a threaded reply back to the project inbox:

```bash
swaks --to support@mail.test \
  --from customer@mail.test \
  --server 127.0.0.1 --port 3025 \
  --header "Subject: Re: Help needed" \
  --header "In-Reply-To: <paste-message-id-from-greenmail>" \
  --body "Thanks, here is more detail"
```

The worker should append this as a comment on the existing issue instead of opening a new one.

**Self-hosted GitLab (custom TLS):** When creating a project, enable **Skip TLS certificate verification** for private CAs, or paste a PEM CA cert on the project. You can also set `TLS_CA_BUNDLE=/path/to/ca-bundle.pem` in `.env` to apply a CA bundle to all GitLab API calls.

## Deploy

Kubernetes deployment via Helm:

```bash
helm dependency update deploy/helm
helm install serviceboard deploy/helm \
  --set ingress.host=your-domain.com \
  --set secrets.encryptionKey=<64-char-hex> \
  --set secrets.oidcClientSecret=<secret> \
  --set secrets.sessionSecret=<secret>
```

## Project structure

```
apps/
  api/       Hono REST API + webhooks
  worker/    pg-boss job processors
  web/       React frontend
packages/
  db/        Drizzle schema + crypto
  providers/ Issue tracker adapters (GitLab)
  shared/    Zod schemas + types
deploy/
  helm/      Kubernetes Helm chart
```
