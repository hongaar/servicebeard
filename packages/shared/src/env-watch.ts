/**
 * Static import so Bun --watch restarts dev servers when the monorepo .env changes.
 * Values are applied at runtime via loadMonorepoEnv().
 */
import "../../../.env" with { type: "text" };
