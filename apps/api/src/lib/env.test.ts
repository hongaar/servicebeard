import { describe, expect, test } from "bun:test";

describe("login provider env", () => {
  const oidcEnv = {
    OIDC_ISSUER: "https://idp.example.com",
    OIDC_CLIENT_ID: "client",
    OIDC_CLIENT_SECRET: "secret",
  };
  const githubEnv = {
    GITHUB_CLIENT_ID: "client",
    GITHUB_CLIENT_SECRET: "secret",
  };
  const gitlabEnv = {
    GITLAB_CLIENT_ID: "client",
    GITLAB_CLIENT_SECRET: "secret",
  };
  const linearEnv = {
    LINEAR_CLIENT_ID: "client",
    LINEAR_CLIENT_SECRET: "secret",
  };

  function withEnv(
    values: Record<string, string | undefined>,
    run: () => void | Promise<void>,
  ): void | Promise<void> {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(values)) {
      previous.set(key, process.env[key]);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    try {
      return run();
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  test("oauth providers stay disabled unless *_LOGIN=true", async () => {
    const {
      isGithubLoginEnabled,
      isGitlabLoginEnabled,
      isLinearLoginEnabled,
      isLocalLoginEnabled,
      isOidcLoginEnabled,
    } = await import("./env");

    withEnv(
      {
        ...oidcEnv,
        ...githubEnv,
        ...gitlabEnv,
        ...linearEnv,
        OIDC_LOGIN: undefined,
        GITHUB_LOGIN: undefined,
        GITLAB_LOGIN: undefined,
        LINEAR_LOGIN: undefined,
        LOCAL_LOGIN: undefined,
      },
      () => {
        expect(isOidcLoginEnabled()).toBe(false);
        expect(isGithubLoginEnabled()).toBe(false);
        expect(isGitlabLoginEnabled()).toBe(false);
        expect(isLinearLoginEnabled()).toBe(false);
        expect(isLocalLoginEnabled()).toBe(false);
      },
    );
  });

  test("oauth providers require config even when *_LOGIN=true", async () => {
    const {
      isGithubLoginEnabled,
      isGitlabLoginEnabled,
      isLinearLoginEnabled,
      isOidcLoginEnabled,
    } = await import("./env");

    withEnv(
      {
        OIDC_LOGIN: "true",
        GITHUB_LOGIN: "true",
        GITLAB_LOGIN: "true",
        LINEAR_LOGIN: "true",
        OIDC_ISSUER: undefined,
        OIDC_CLIENT_ID: undefined,
        OIDC_CLIENT_SECRET: undefined,
        GITHUB_CLIENT_ID: undefined,
        GITHUB_CLIENT_SECRET: undefined,
        GITLAB_CLIENT_ID: undefined,
        GITLAB_CLIENT_SECRET: undefined,
        LINEAR_CLIENT_ID: undefined,
        LINEAR_CLIENT_SECRET: undefined,
      },
      () => {
        expect(isOidcLoginEnabled()).toBe(false);
        expect(isGithubLoginEnabled()).toBe(false);
        expect(isGitlabLoginEnabled()).toBe(false);
        expect(isLinearLoginEnabled()).toBe(false);
      },
    );
  });

  test("oauth providers enable only with *_LOGIN=true and full config", async () => {
    const {
      isGithubLoginEnabled,
      isGitlabLoginEnabled,
      isLinearLoginEnabled,
      isOidcLoginEnabled,
    } = await import("./env");

    withEnv(
      {
        OIDC_ISSUER: oidcEnv.OIDC_ISSUER,
        OIDC_CLIENT_ID: oidcEnv.OIDC_CLIENT_ID,
        OIDC_CLIENT_SECRET: oidcEnv.OIDC_CLIENT_SECRET,
        GITHUB_CLIENT_ID: githubEnv.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: githubEnv.GITHUB_CLIENT_SECRET,
        GITLAB_CLIENT_ID: gitlabEnv.GITLAB_CLIENT_ID,
        GITLAB_CLIENT_SECRET: gitlabEnv.GITLAB_CLIENT_SECRET,
        LINEAR_CLIENT_ID: linearEnv.LINEAR_CLIENT_ID,
        LINEAR_CLIENT_SECRET: linearEnv.LINEAR_CLIENT_SECRET,
        OIDC_LOGIN: "true",
        GITHUB_LOGIN: "true",
        GITLAB_LOGIN: "true",
        LINEAR_LOGIN: "true",
      },
      () => {
        expect(isOidcLoginEnabled()).toBe(true);
        expect(isGithubLoginEnabled()).toBe(true);
        expect(isGitlabLoginEnabled()).toBe(true);
        expect(isLinearLoginEnabled()).toBe(true);
      },
    );
  });

  test("oauth callback URL prefers WEB_URL for browser cookie flow", async () => {
    const { getOAuthCallbackUrl } = await import("./env");

    withEnv(
      {
        OAUTH_REDIRECT_URI: undefined,
        WEB_URL: "http://localhost:5173",
        API_URL: "http://localhost:3000",
      },
      () => {
        expect(getOAuthCallbackUrl()).toBe(
          "http://localhost:5173/api/auth/callback",
        );
      },
    );
  });

  test("local login requires LOCAL_LOGIN=true", async () => {
    const { isLocalLoginEnabled } = await import("./env");

    withEnv({ LOCAL_LOGIN: "false" }, () => {
      expect(isLocalLoginEnabled()).toBe(false);
    });

    withEnv({ LOCAL_LOGIN: "true" }, () => {
      expect(isLocalLoginEnabled()).toBe(true);
    });
  });
});
