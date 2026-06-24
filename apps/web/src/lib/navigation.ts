export const PROJECT_SECTIONS = ["rules", "status", "templates", "settings"] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

export function isProjectSection(value: string): value is ProjectSection {
  return (PROJECT_SECTIONS as readonly string[]).includes(value);
}

export const DEFAULT_PROJECT_SECTION: ProjectSection = "rules";
