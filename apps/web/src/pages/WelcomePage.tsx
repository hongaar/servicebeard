import { extensionOnSignupComplete } from "@extensions";
import { slugifyName } from "@servicebeard/shared";
import { useMutation } from "@tanstack/react-query";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthPageShell } from "../components/AuthForms";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api } from "../lib/api";
import { iconMd } from "../lib/icons";
import type { AppUser } from "../lib/loaderTypes";
import { NAV_ICONS } from "../lib/navigation";
import { markWelcomeComplete } from "../lib/onboarding";
import {
  appQueries,
  prependCreatedTeamToCache,
  queryClient,
} from "../lib/queryClient";
import styles from "../styles/pages.module.css";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome",
    description: "Welcome to ServiceBeard",
  },
  {
    id: "how-it-works",
    title: "How it works",
    description: "Teams and projects",
  },
  {
    id: "team",
    title: "Your team",
    description: "Create your team",
  },
] as const;

function WelcomeSlide({ userName }: { userName: string | null }) {
  const greeting = userName ? `Welcome, ${userName}.` : "Welcome.";

  return (
    <div className={styles.welcomeSlide}>
      <p className={styles.welcomeLead}>
        {greeting} We&apos;ll walk you through a quick setup to get ServiceBeard
        configured — starting with your first team.
      </p>
    </div>
  );
}

function HowItWorksSlide() {
  const TeamsIcon = NAV_ICONS.teams;
  const ProjectsIcon = NAV_ICONS.projects;

  return (
    <div className={styles.welcomeSlide}>
      <ol className={styles.welcomeStepsList}>
        <li>
          <span className={styles.welcomeStepIcon} aria-hidden>
            <TeamsIcon {...iconMd} />
          </span>
          <p className={styles.welcomeStepText}>
            <strong>Teams</strong> manage one or more projects.
          </p>
        </li>
        <li>
          <span className={styles.welcomeStepIcon} aria-hidden>
            <ProjectsIcon {...iconMd} />
          </span>
          <p className={styles.welcomeStepText}>
            <strong>Projects</strong> connect a mailbox to your issue board.
          </p>
        </li>
      </ol>
    </div>
  );
}

type CreateTeamSlideProps = {
  name: string;
  onNameChange: (value: string) => void;
  error: string;
};

function CreateTeamSlide({ name, onNameChange, error }: CreateTeamSlideProps) {
  return (
    <div className={styles.welcomeSlide}>
      <p className={styles.welcomeHint} style={{ marginTop: 0 }}>
        Pick a name for your team that will hold your projects. You can invite
        other members later from the Members page.
      </p>
      <Input
        label="Team name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        autoFocus
      />
      {error ? (
        <div className={[styles.alert, styles.alertError].join(" ")}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function WelcomePage() {
  const { user } = useLoaderData({ from: "/welcome" }) as { user: AppUser };
  const [stepIndex, setStepIndex] = useState(0);
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // A new user reaching /welcome means signup succeeded — record the conversion.
  useEffect(() => {
    extensionOnSignupComplete();
  }, []);

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;
  const canContinue = step.id !== "team" ? true : teamName.trim().length > 0;

  const createTeam = useMutation({
    mutationFn: () =>
      api.createTeam({
        name: teamName.trim(),
        slug: slugifyName(teamName),
      }),
    onSuccess: async (team) => {
      markWelcomeComplete(user.id);
      prependCreatedTeamToCache(team);
      await Promise.all([
        queryClient.fetchQuery(appQueries.teams()),
        queryClient.fetchQuery(appQueries.team(team.id)),
        queryClient.fetchQuery(appQueries.projects(team.id)),
      ]);
      navigate({
        to: "/teams/$teamId/projects",
        params: { teamId: team.id },
        search: { onboarding: "project" },
      });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not create team");
    },
  });

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((index) => index - 1);
  };

  const handleContinue = () => {
    if (!canContinue || createTeam.isPending) return;
    if (!isLast) {
      setStepIndex((index) => index + 1);
      return;
    }
    setError("");
    createTeam.mutate();
  };

  return (
    <AuthPageShell subtitle="" cardClassName={styles.welcomeCard}>
      <form
        className={[styles.wizard, styles.welcomeWizard].join(" ")}
        onSubmit={(e) => {
          e.preventDefault();
          handleContinue();
        }}
      >
        <nav
          className={styles.welcomeProgress}
          aria-label="Getting started steps"
        >
          <div className={styles.welcomeProgressMeta}>
            <span>
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            <span className={styles.welcomeProgressTitle}>{step.title}</span>
          </div>
          <ol className={styles.welcomeProgressTrack}>
            {STEPS.map((s, i) => (
              <li
                key={s.id}
                className={[
                  styles.welcomeProgressSegment,
                  i <= stepIndex ? styles.welcomeProgressSegmentActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={i === stepIndex ? "step" : undefined}
                aria-label={`${s.title}: ${s.description}`}
              />
            ))}
          </ol>
        </nav>

        <div className={styles.welcomePanel}>
          <h2 className={styles.welcomePanelTitle}>{step.description}</h2>
          {step.id === "welcome" && <WelcomeSlide userName={user.name} />}
          {step.id === "how-it-works" && <HowItWorksSlide />}
          {step.id === "team" && (
            <CreateTeamSlide
              name={teamName}
              onNameChange={setTeamName}
              error={error}
            />
          )}
        </div>

        <div
          className={[
            styles.formActions,
            stepIndex > 0 ? styles.formActionsSpread : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={goBack}
              disabled={createTeam.isPending}
            >
              <ArrowLeft size={16} /> Back
            </Button>
          ) : null}

          <Button type="submit" disabled={!canContinue || createTeam.isPending}>
            {isLast ? (
              createTeam.isPending ? (
                "Creating team…"
              ) : (
                "Create team"
              )
            ) : (
              <>
                Continue <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </form>
    </AuthPageShell>
  );
}
