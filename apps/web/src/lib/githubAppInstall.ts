export const GITHUB_APP_INSTALL_MESSAGE = "servicebeard:github-app-install";

export const GITHUB_APP_INSTALL_POPUP = "servicebeard-github-app-install";

export interface GithubAppInstallMessage {
  type: typeof GITHUB_APP_INSTALL_MESSAGE;
  installationId?: string;
  error?: string;
}

export function openGithubAppInstallPopup(url: string): Window | null {
  return window.open(
    url,
    GITHUB_APP_INSTALL_POPUP,
    "popup=yes,width=1024,height=720,resizable=yes,scrollbars=yes",
  );
}

export function isGithubAppInstallMessage(
  data: unknown,
): data is GithubAppInstallMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as GithubAppInstallMessage).type === GITHUB_APP_INSTALL_MESSAGE
  );
}
