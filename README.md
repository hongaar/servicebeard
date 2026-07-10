<p align="center">
  <img src="apps/web/public/favicon.png" alt="ServiceBeard" width="72" height="72" />
</p>

# ServiceBeard

Multi-tenant application that syncs project mailboxes (IMAP/SMTP) with issue trackers. Supported providers: **GitLab** (cloud + self-hosted) and **GitHub** (cloud + Enterprise Server).

## Features

- OIDC authentication (configurable IdP via env)
- GitHub and GitLab OAuth sign-in
- Teams, projects, member management
- Per-project IMAP polling + SMTP outbound (parallel worker pools)
- Rules engine (match sender/subject/body → create issue with labels/assignee)
- Bidirectional sync: email → issue/comment, issue comment → email reply
- Loop prevention via bot-user filtering, sync markers, and note deduplication
- Webhook + polling fallback for outbound comments
- Concurrent email delivery with pooled SMTP connections
- Docker Compose or Kubernetes (Helm) for self-hosting from this repo

## Stack

| Layer    | Technology                           |
| -------- | ------------------------------------ |
| API      | Bun + Hono                           |
| Worker   | Bun + pg-boss                        |
| Frontend | Vite + React + Base UI + CSS Modules |
| Database | PostgreSQL + Drizzle ORM             |
| Deploy   | Docker Compose or Helm + Docker      |

## How sync works

**Inbound (email → issue)**

1. Worker cron tick enqueues per-project IMAP poll jobs; concurrent workers poll mailboxes independently
2. Thread match via `Message-ID` / `References` / subject+sender
3. Existing thread → append as public comment on issue
4. New thread → evaluate rules → create issue on the linked provider with metadata
5. Optional acknowledgement email to the original sender (project setting)

**Outbound (comment → email)**

1. Provider webhook (`note_events` on GitLab, `issue_comment` on GitHub) or polling fallback
2. Skip internal comments (`[internal]` marker at the start or end, or GitLab internal notes), email-synced comments (sync marker), bot-authored notes, and already-processed notes
3. Send threaded reply email via project SMTP (concurrent workers, pooled connections per credential set)

New issues include a collapsible **Support details** footer with a link back to the ServiceBeard project and a reminder about the `[internal]` marker.

## Quickstart

### Prerequisites

- [Bun](https://bun.sh) 1.2+
- Docker (for Postgres, GreenMail, Adminer, Roundcube)

### 1. Environment

```bash
cp .env.example .env
# Edit .env — see Configuration below (at minimum DATABASE_URL, ENCRYPTION_KEY, SESSION_SECRET, and login providers)
```

### 2. Install dependencies

```bash
bun install
```

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts Postgres, GreenMail, Roundcube, and Adminer (local development only).

### 4. Database

```bash
bun run db:generate   # after schema changes only
bun run db:migrate
```

`db:migrate` applies OSS migrations. When `SB_EXTENSION_MANIFEST` is set in `.env`, extension migrations run in the same command.

### 5. Run dev servers

```bash
bun run dev
```

This runs the API, worker, and web UI in parallel via Bun workspaces (`bun run --filter './apps/*' dev`).

Run a single app:

```bash
bun run dev:api
bun run dev:worker
bun run dev:web
```

| Service                     | URL                   |
| --------------------------- | --------------------- |
| Web UI                      | http://localhost:5173 |
| API                         | http://localhost:3000 |
| Dev mail UI (Roundcube)     | http://localhost:8888 |
| GreenMail API / raw browser | http://localhost:8080 |
| Database UI (Adminer)       | http://localhost:8081 |

Dev login (when `LOCAL_LOGIN=true`): `dev@localhost` / `dev`

## Configuration

Environment variables for local development live in [`.env.example`](.env.example). Production Docker Compose uses [`deploy/compose/.env.example`](deploy/compose/.env.example). Kubernetes deployments use Helm values (see [Deploy](#deploy)).

### Core

| Variable         | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`   | Postgres connection string                                        |
| `ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM secret encryption                 |
| `SESSION_SECRET` | Session signing secret                                            |
| `NODE_ENV`       | `development` or `production`                                     |
| `PORT`           | API listen port (default: `3000`)                                 |
| `LOG_LEVEL`      | Log verbosity (`debug`, `info`, `warn`, `error`; default: `info`) |

### URLs

| Variable             | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `API_URL`            | Public API base URL (e.g. `http://localhost:3000`)                                            |
| `WEB_URL`            | Public web UI base URL (e.g. `http://localhost:5173`)                                         |
| `WEBHOOK_BASE_URL`   | Public URL for issue-tracker webhooks (GitLab/GitHub must reach this)                         |
| `OAUTH_REDIRECT_URI` | Optional override for OAuth callback (default: `{WEB_URL}/api/auth/callback`)                 |
| `TLS_CA_BUNDLE`      | Optional path to a PEM CA bundle used for all provider API calls (merged with per-project CA) |

### Worker

| Variable                        | Description                                                 |
| ------------------------------- | ----------------------------------------------------------- |
| `IMAP_POLL_INTERVAL_SECONDS`    | IMAP poll interval in seconds (minimum: 60)                 |
| `COMMENT_POLL_INTERVAL_SECONDS` | Comment poll interval in seconds (minimum: 60)              |
| `SEND_EMAIL_CONCURRENCY`        | Parallel outbound email workers (default: 5)                |
| `IMAP_POLL_CONCURRENCY`         | Parallel per-project IMAP poll workers (default: 3)         |
| `COMMENT_POLL_CONCURRENCY`      | Parallel per-project comment poll workers (default: 3)      |
| `SMTP_MAX_CONNECTIONS`          | Max SMTP connections per credential pool (default: 3)       |
| `SMTP_MAX_MESSAGES`             | Max messages per pooled SMTP connection (default: 100)      |
| `SMTP_IDLE_TTL_MS`              | Evict idle SMTP transporter pools after ms (default: 60000) |
| `SMTP_MAX_POOLS`                | LRU cap on cached SMTP credential pools (default: 50)       |

### Authentication

Servicebeard supports multiple login providers. Enable one or more by setting `*_LOGIN=true` and the required credentials (see `.env.example`). All OAuth/OIDC providers share one callback URL, defaulting to `{WEB_URL}/api/auth/callback` so the OAuth state cookie matches the browser origin (in local dev, register `http://localhost:5173/api/auth/callback` in your OAuth app). Override with `OAUTH_REDIRECT_URI` if needed.

#### Local (email/password & passkey)

Enabled with `LOCAL_LOGIN=true`. Supports credential sign-in and passkeys without an external IdP. In development, the API also seeds `dev@localhost` / `dev` on startup for quick testing.

| Variable             | Description                                                                       |
| -------------------- | --------------------------------------------------------------------------------- |
| `LOCAL_LOGIN`        | `true` to enable, `false` or unset to disable                                     |
| `LOCAL_LOGIN_SIGNUP` | Allow sign-up via local credentials (default: `true` when local login is enabled) |
| `WEBAUTHN_RP_ID`     | Passkey relying party ID (defaults from `WEB_URL`)                                |
| `WEBAUTHN_RP_NAME`   | Passkey relying party display name (default: `Servicebeard`)                      |
| `WEBAUTHN_ORIGIN`    | Passkey origin (defaults from `WEB_URL`)                                          |

#### OIDC (generic IdP)

Works with any OpenID Connect provider (Keycloak, Auth0, etc.).

| Variable             | Description                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `OIDC_LOGIN`         | `true` to enable (requires OIDC_* config), `false` or unset to disable                                      |
| `OIDC_SIGNUP`        | Allow new users on first sign-in (default: `true`)                                                          |
| `OIDC_PROVIDER_NAME` | Display name on the login button (e.g. `Keycloak` → "Continue with Keycloak"; omit for "Continue with SSO") |
| `OIDC_ISSUER`        | Issuer URL (e.g. `https://auth.example.com/realms/myrealm`)                                                 |
| `OIDC_CLIENT_ID`     | Client ID                                                                                                   |
| `OIDC_CLIENT_SECRET` | Client secret                                                                                               |

Register `{WEB_URL}/api/auth/callback` as the redirect URI in your IdP.

#### GitHub OAuth

1. Go to [GitHub Developer settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**
2. Set **Authorization callback URL** to `{WEB_URL}/api/auth/callback` (local dev: `http://localhost:5173/api/auth/callback`)
3. Copy the Client ID and generate a Client Secret into `.env`:

| Variable               | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `GITHUB_LOGIN`         | `true` to enable (requires GITHUB_* config), `false` or unset to disable |
| `GITHUB_SIGNUP`        | Allow new users on first sign-in (default: `true`)                       |
| `GITHUB_CLIENT_ID`     | OAuth App client ID                                                      |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret                                                  |

#### GitHub App (issue sync)

Optional alternative to per-project personal access tokens. When configured, projects can authenticate with a GitHub App **installation ID** instead of a PAT. Issues and comments appear as `your-app[bot]`.

1. Create a GitHub App (see in-app docs under **Provider setup → GitHub**) with Issues, Webhooks, and Administration (read) permissions on repositories.
2. Set the app **Setup URL** to `{API_URL}/api/github-app/setup` (for local dev: `http://localhost:3000/api/github-app/setup`).
3. Generate a private key and note the **App ID**.
4. Add server-wide credentials to `.env` for the API and worker:

| Variable                      | Description                                                  |
| ----------------------------- | ------------------------------------------------------------ |
| `GITHUB_APP_ID`               | Numeric App ID from the app settings page                    |
| `GITHUB_APP_PRIVATE_KEY`      | PEM private key (use `\n` for line breaks in `.env`), **or** |
| `GITHUB_APP_PRIVATE_KEY_PATH` | Path to the `.pem` file (relative to repo root, or absolute) |

5. In the project wizard, choose GitHub and click **Install GitHub App** — no manual installation ID is needed. When `GITHUB_APP_ID` is not set, projects use a personal access token instead.

**PAT alternative:** create a dedicated machine/bot GitHub account, grant it access to the repository, and generate a fine-grained or classic PAT for that account — not your personal login — so created issues clearly come from ServiceBeard.

#### GitLab OAuth

Works with GitLab.com or self-hosted GitLab.

1. Create an application under **User Settings → Applications** (GitLab.com) or **Admin → Applications** (self-hosted)
2. Set **Redirect URI** to `{WEB_URL}/api/auth/callback` (local dev: `http://localhost:5173/api/auth/callback`)
3. Enable the `read_user` scope
4. Copy Application ID and Secret into `.env`:

| Variable               | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `GITLAB_LOGIN`         | `true` to enable (requires GITLAB_* config), `false` or unset to disable |
| `GITLAB_SIGNUP`        | Allow new users on first sign-in (default: `true`)                       |
| `GITLAB_BASE_URL`      | GitLab instance URL (default: `https://gitlab.com`)                      |
| `GITLAB_CLIENT_ID`     | Application ID                                                           |
| `GITLAB_CLIENT_SECRET` | Application secret                                                       |

#### Linear OAuth

1. Create an OAuth2 application at [Linear → Settings → API → Applications](https://linear.app/settings/api/applications/new)
2. Set **Redirect URI** to `{WEB_URL}/api/auth/callback` (local dev: `http://localhost:5173/api/auth/callback`)
3. Enable the `read` scope (included by default)
4. Copy Client ID and Client Secret into `.env`:

| Variable               | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `LINEAR_LOGIN`         | `true` to enable (requires LINEAR_* config), `false` or unset to disable |
| `LINEAR_SIGNUP`        | Allow new users on first sign-in (default: `true`)                       |
| `LINEAR_CLIENT_ID`     | OAuth application client ID                                              |
| `LINEAR_CLIENT_SECRET` | OAuth application client secret                                          |

For production, register `{WEB_URL}/api/auth/callback` in each OAuth app (same host users sign in from).

### System mail (optional)

Used for team invites, password reset, and email verification when local login is enabled.

| Variable               | Description                               |
| ---------------------- | ----------------------------------------- |
| `MAIL_ADAPTER`         | Mail adapter (`smtp`; default when unset) |
| `MAIL_FROM_NAME`       | Sender display name                       |
| `SYSTEM_SMTP_HOST`     | SMTP host                                 |
| `SYSTEM_SMTP_PORT`     | SMTP port                                 |
| `SYSTEM_SMTP_SECURE`   | Use TLS (`true` / `false`)                |
| `SYSTEM_SMTP_USER`     | SMTP username                             |
| `SYSTEM_SMTP_PASSWORD` | SMTP password                             |
| `SYSTEM_SMTP_FROM`     | From address (e.g. `noreply@example.com`) |

### Observability (optional)

| Variable                | Description                                   |
| ----------------------- | --------------------------------------------- |
| `BUGSINK_API_DSN`       | Bugsink / Sentry-compatible DSN for the API   |
| `BUGSINK_WORKER_DSN`    | DSN for the worker                            |
| `VITE_BUGSINK_DSN`      | DSN for the web UI (embedded at build time)   |
| `VITE_UMAMI_WEBSITE_ID` | Umami Cloud analytics website ID (build time) |

### Extensions (optional)

Plugin extensions add API routes, web UI, and database migrations via a manifest file. Self-hosted OSS deployments typically leave extensions unset.

| Variable                | Description                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| `SB_EXTENSION_MANIFEST` | Path to `extension.config.ts` (absolute or relative to repo root)          |
| `EXTENSION_DIR`         | Path to extension checkout for Docker image builds (see [Deploy](#deploy)) |

**Local development / source builds:**

1. Set `SB_EXTENSION_MANIFEST` in `.env` to the extension's manifest file.
2. Install the extension's dependencies and merge any additional env vars from its `.env.example`.
3. Re-run `bun run db:migrate` so extension tables are applied.

**Docker Compose:** set `EXTENSION_DIR` in `.env` to the extension checkout and add the extension's compose overlay file when starting the stack (see [Deploy](#deploy)).

Extension design and hook points are documented in [ARCHITECTURE.md](./ARCHITECTURE.md#extensions).

### Docker Compose (production)

Additional variables used by [`deploy/compose/`](deploy/compose/) (see [`deploy/compose/.env.example`](deploy/compose/.env.example)):

| Variable            | Description                 |
| ------------------- | --------------------------- |
| `DOMAIN`            | Public hostname for HTTPS   |
| `ACME_EMAIL`        | Let's Encrypt contact email |
| `POSTGRES_USER`     | Postgres username           |
| `POSTGRES_PASSWORD` | Postgres password           |
| `POSTGRES_DB`       | Postgres database name      |

## Local development

`docker compose up -d` also starts Postgres, GreenMail, Adminer, and Roundcube. These services are for local development only — they are not deployed to Kubernetes.

**Typical daily flow:**

```bash
docker compose up -d          # if not already running
bun run db:migrate            # after pulling new migrations
bun run dev                   # API + worker + web
```

In development (`NODE_ENV=development`), the API and worker also append structured JSON logs to `.logs/api.log` and `.logs/worker.log` at the repo root. Use these when `bun run dev` truncates terminal output — e.g. `tail -f .logs/worker.log` for provider API errors including `responseBody`.

### Database UI

[Adminer](https://www.adminer.org/) is available at http://localhost:8081:

| Field    | Value                                                                |
| -------- | -------------------------------------------------------------------- |
| System   | PostgreSQL                                                           |
| Server   | `postgres` (from Adminer container) or `localhost` (from host tools) |
| Username | `servicebeard`                                                       |
| Password | `servicebeard`                                                       |
| Database | `servicebeard`                                                       |

For a schema-aware view without an extra container, use Drizzle Studio:

```bash
bun run db:studio
```

### Testing

Run the unit test suite:

```bash
bun test
```

#### Mail testing with GreenMail

[GreenMail](https://greenmail-mail-test.github.io/greenmail/) provides **IMAP** (3143) and **SMTP** (3025). Two mailboxes are preconfigured:

| Mailbox                                    | IMAP/SMTP login | Password   |
| ------------------------------------------ | --------------- | ---------- |
| `support@mail.test` (project inbox)        | `support`       | `support`  |
| `customer@mail.test` (simulate a reporter) | `customer`      | `customer` |

**Webmail:** [Roundcube](http://localhost:8888) connects to GreenMail over IMAP. Standard folders (Sent, Drafts, Spam, Trash, Archive) are scaffolded at startup for both mailboxes. Log in with `support` / `support` or `customer` / `customer` (local-part username). When composing mail, use `@mail.test` addresses — Roundcube rejects single-label domains like `@localhost`. Log out and sign in as the other user to switch mailboxes.

GreenMail’s raw API/message browser is at http://localhost:8080.

Configure your project mail settings to use the **support** inbox for both IMAP and SMTP:

| Field         | Value                                                  |
| ------------- | ------------------------------------------------------ |
| IMAP host     | `localhost`                                            |
| IMAP port     | `3143`                                                 |
| IMAP TLS      | off                                                    |
| IMAP user     | `support`                                              |
| IMAP password | `support`                                              |
| SMTP host     | `localhost`                                            |
| SMTP port     | `3025`                                                 |
| SMTP TLS      | off                                                    |
| SMTP user     | `support`                                              |
| SMTP password | `support`                                              |
| From          | `support@mail.test` (or `Support <support@mail.test>`) |

**1. Inbound (email → issue)** — send mail into the project inbox ([swaks](https://www.jetmore.org/john/code/swaks/) optional):

```bash
swaks --to support@mail.test \
  --from customer@mail.test \
  --server 127.0.0.1 --port 3025 \
  --header "Subject: Help needed" \
  --body "My app is broken"
```

The worker polls IMAP and should create an issue on the linked provider (with a matching rule). View the message in Roundcube (support inbox).

If **Send acknowledgement email for new issues** is enabled on the project, the worker also sends a threaded reply to the inbound `From` address. The reply lands in the reporter mailbox — log into Roundcube as `customer` / `customer` and check the inbox. Use `@mail.test` addresses when composing mail; acknowledgements are sent to whatever address appears in `From` (misconfigured clients that send as `@greenmail` or `@localhost` will not deliver to the `customer@mail.test` inbox).

**2. Outbound (comment → email)** — add a public comment on the synced issue (GitLab issue or GitHub issue). The reply is sent via SMTP to `customer@mail.test`. Log into Roundcube as `customer` / `customer` to read it.

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

**Self-hosted / custom TLS:** When creating a project, enable **Skip TLS certificate verification** for private CAs, or paste a PEM CA cert on the project. You can also set `TLS_CA_BUNDLE=/path/to/ca-bundle.pem` in `.env` to apply a CA bundle to all provider API calls.

**GitHub projects:** use repository slug `owner/repo`. When `GITHUB_APP_ID` is set on the server, use **Install GitHub App** in the project wizard (issues appear as `your-app[bot]`). Without it, provide a PAT from a **dedicated bot account** — classic `repo` scope or fine-grained token with Issues + Webhooks write. For GitHub Enterprise Server, set the instance URL and use the same `owner/repo` format.

**GitLab projects:** use numeric project ID or `group/project` path and a token with `api` scope.

## Deploy

### Docker Compose (single server)

Production stack: Postgres, API, worker, web (nginx), and Caddy (HTTPS) in [`deploy/compose/`](deploy/compose/).

**Prerequisites:** a VPS with Docker Engine and Compose plugin, and a DNS `A` record pointing at the server.

```bash
cd deploy/compose
cp .env.example .env
# Edit .env — see Configuration above (DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, ENCRYPTION_KEY, SESSION_SECRET, login providers)

# Web image: embed VITE_* and CLOUD_PLAN_* vars from .env (see apps/web/vite.config.ts envPrefix)
bun run extract-vite-env.ts .env .env.vite

docker compose --env-file .env -f docker-compose.yml up -d --build
```

Point your domain at the server before starting Caddy so Let's Encrypt can issue a certificate. The API container runs database migrations on startup.

**With a plugin extension**, set `EXTENSION_DIR` in `.env` to the extension checkout and add its compose overlay:

```bash
bun run extract-vite-env.ts .env .env.vite

docker compose --env-file .env \
  -f docker-compose.yml \
  -f /path/to/extension/deploy/compose.yml \
  up -d --build
```

Build images manually (OSS-only):

```bash
docker build --target api -t servicebeard-api .
docker build --target worker -t servicebeard-worker .
docker build --target web -t servicebeard-web .
```

With an extension build context:

```bash
docker build --build-context extension=/path/to/extension -f Dockerfile --target api .
```

The root [`docker-compose.yml`](docker-compose.yml) is for **local development only** (Postgres, GreenMail, Adminer).

### Kubernetes (Helm)

Container images and the Helm chart are published to [GHCR](https://github.com/hongaar?tab=packages&repo_name=servicebeard). New packages default to private; a maintainer must set each package to **Public** once under [Packages](https://github.com/hongaar?tab=packages&repo_name=servicebeard) (Package settings → Change visibility).

**From GHCR (recommended for self-hosting):**

```bash
helm install servicebeard oci://ghcr.io/hongaar/servicebeard-helm \
  --version 0.1.0 \
  --set ingress.host=your-domain.com \
  --set secrets.encryptionKey=<64-char-hex> \
  --set secrets.oidcClientSecret=<secret> \
  --set secrets.sessionSecret=<secret>
```

The chart defaults to `ghcr.io/hongaar/servicebeard-{api,worker,web}:latest`. Pin a specific release with `--set image.tag=<git-sha>`.

**From this repo (local chart):**

```bash
helm dependency update deploy/helm
helm install servicebeard deploy/helm \
  --set ingress.host=your-domain.com \
  --set secrets.encryptionKey=<64-char-hex> \
  --set secrets.oidcClientSecret=<secret> \
  --set secrets.sessionSecret=<secret>
```

## Documentation

In-app documentation lives under `/docs` in the web UI (mailbox setup, issue providers, GitHub/GitLab guides). Sync design and extension points are in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Project structure

```
apps/
  api/       Hono REST API + webhooks
  worker/    pg-boss job processors
  web/       React frontend
packages/
  db/        Drizzle schema + crypto
  providers/ Issue tracker adapters (GitLab, GitHub)
  shared/    Zod schemas + types
deploy/
  compose/   Production Docker Compose (API, worker, web, Postgres, Caddy)
  helm/      Kubernetes Helm chart
```
