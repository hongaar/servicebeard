# ServiceBeard extensions

ServiceBeard ships with optional extension points so a hosted/cloud edition can add capabilities without forking the core application. Self-hosted deployments leave every extension unset; behavior is identical to a build without these hooks.

## Backend: `SB_EXTENSIONS_MODULE`

Set `SB_EXTENSIONS_MODULE` to an absolute or workspace-relative path of a module that exports:

```ts
export async function register(ctx: {
  app: Hono;
  setEntitlementsProvider: (provider: EntitlementsProvider) => void;
}): Promise<void>;
```

The API loads this module after mounting core routes (`apps/api/src/extensions.ts`). The worker loads the same module path with a worker-specific context (`apps/worker/src/extensions.ts`):

```ts
export async function register(ctx: { boss: PgBoss }): Promise<void>;
```

A single module may export one `register` function that handles both contexts by checking which properties exist on `ctx`.

When `SB_EXTENSIONS_MODULE` is unset, nothing is loaded.

## Entitlements

Core API code consults an `EntitlementsProvider` before enforcing team-scoped limits (`apps/api/src/lib/entitlements.ts`):

```ts
interface EntitlementsProvider {
  assertCanCreateProject(teamId: string, currentCount: number): Promise<void>;
  assertTeamAccess(teamId: string, ctx: { path: string }): Promise<void>;
}
```

Default (self-host): both methods are no-ops — unlimited projects, no access gate.

Extensions replace the provider via `setEntitlementsProvider` during `register`. Implementations should throw errors with these messages, mapped to HTTP 402 by the API:

| Error message            | HTTP | `code` field               |
|--------------------------|------|----------------------------|
| `PROJECT_LIMIT_REACHED`  | 402  | `PROJECT_LIMIT_REACHED`    |
| `SUBSCRIPTION_REQUIRED`  | 402  | `SUBSCRIPTION_REQUIRED`    |

Enforcement points:

- **Project creation** — `POST /api/teams/:teamId/projects` calls `assertCanCreateProject` after auth.
- **Team access** — `requireTeamMember` calls `assertTeamAccess` for every team-scoped route. Exempt billing paths in your implementation so teams can subscribe.

## Frontend: `@cloudExtensions`

The web app resolves `@cloudExtensions` via Vite/TypeScript path alias (`apps/web/vite.config.ts`). The OSS default is an empty stub (`apps/web/src/extensions/index.tsx`):

```ts
export const cloudRoutes: AnyRoute[] = [];
export function cloudTeamNavItems(teamId: string): CloudTeamNavItem[] { return []; }
```

A cloud build overrides the alias to a module that exports:

- `cloudRoutes` — TanStack Router routes merged in `apps/web/src/router.ts`
- `cloudTeamNavItems(teamId)` — extra sidebar links rendered in `Layout.tsx`
- `isCloudTeamNavActive(pathname, teamId, item)` — optional; OSS provides a default

The API client throws `EntitlementRequiredError` (402) when the response includes a `code` field. Cloud UIs can catch this and redirect users to billing.

## Self-host checklist

- Do **not** set `SB_EXTENSIONS_MODULE`
- Build the web app with the default `@cloudExtensions` stub
- No entitlements provider is registered; limits and access gates are disabled

## Cloud edition (separate repository)

The private `serviceboard-cloud` repository consumes this OSS repo as a git submodule at `oss/` and provides:

- `cloud/api-extension` — billing routes + entitlements + `register` export
- `cloud/web-extension` — billing UI wired through `@cloudExtensions`
- `cloud/db` — billing tables and migrations (same Postgres database, separate migration folder)
- `cloud/billing` — payment provider integration

See `serviceboard-cloud/README.md` in the cloud repository for build and deploy instructions.
