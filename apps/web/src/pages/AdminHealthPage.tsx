import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLoaderData } from "@tanstack/react-router";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import {
  api,
  type AdminCheckResult,
  type AdminStatusResponse,
} from "../lib/api";
import { iconMd } from "../lib/icons";
import styles from "../styles/pages.module.css";

const CATEGORY_LABELS: Record<AdminCheckResult["category"], string> = {
  service: "Services",
  mail: "Mail connectivity",
  git: "Issue providers",
};

const CATEGORY_ORDER: AdminCheckResult["category"][] = [
  "service",
  "mail",
  "git",
];

function CheckRow({ check }: { check: AdminCheckResult }) {
  return (
    <div className={styles.adminCheckRow}>
      <div className={styles.adminCheckLabel}>
        {check.ok ? (
          <CheckCircle2 size={16} className={styles.adminCheckIconOk} />
        ) : (
          <XCircle size={16} className={styles.adminCheckIconError} />
        )}
        <span>{check.label}</span>
      </div>
      <div className={styles.adminCheckMeta}>
        {check.latencyMs != null && <span>{check.latencyMs} ms</span>}
        {check.detail && (
          <span className={styles.adminCheckDetail}>{check.detail}</span>
        )}
        {check.error && (
          <span className={styles.adminCheckError}>{check.error}</span>
        )}
      </div>
    </div>
  );
}

function StatusSummary({ status }: { status: AdminStatusResponse }) {
  return (
    <div className={styles.adminSummary}>
      {status.ok ? (
        <span className={styles.testOk}>
          <CheckCircle2 size={18} /> All checks passed
        </span>
      ) : (
        <span className={styles.testError}>
          <XCircle size={18} />{" "}
          {status.checks.filter((check) => !check.ok).length} check
          {status.checks.filter((check) => !check.ok).length === 1
            ? ""
            : "s"}{" "}
          failed
        </span>
      )}
      <span className={styles.adminCheckedAt}>
        Last run {new Date(status.checkedAt).toLocaleString()}
      </span>
    </div>
  );
}

export function AdminHealthPage() {
  const { user } = useLoaderData({ from: "/admin/health" });
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => api.getAdminStatus(),
    refetchOnWindowFocus: false,
  });

  const runChecks = useMutation({
    mutationFn: () => api.runAdminStatusChecks(),
    onSuccess: (status) => {
      queryClient.setQueryData(["admin-health"], { status });
    },
  });

  const status = statusQuery.data?.status ?? null;

  const checksByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    checks: status?.checks.filter((check) => check.category === category) ?? [],
  }));

  return (
    <Layout
      title="System health"
      description="Local services and outbound access required for mailbox sync and issue providers."
      user={user}
    >
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderText}>
            <h2 className={styles.sectionTitle}>Health checks</h2>
            <p className={styles.sectionDescription}>
              Checks local services and outbound access required for mailbox
              sync and issue providers. Mail port probes use Gmail as a
              well-known target; failures usually mean egress restrictions on
              SMTP/IMAP.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => runChecks.mutate()}
            disabled={runChecks.isPending}
          >
            {runChecks.isPending ? (
              <>
                <Loader2 {...iconMd} className={styles.spinIcon} /> Running…
              </>
            ) : (
              <>
                <RefreshCw {...iconMd} /> Run checks
              </>
            )}
          </Button>
        </div>

        {statusQuery.isLoading && (
          <p className={styles.formHint}>Loading last status…</p>
        )}

        {statusQuery.isError && (
          <p className={styles.testError}>
            <XCircle size={16} />{" "}
            {statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "Failed to load status"}
          </p>
        )}

        {runChecks.isError && (
          <p className={styles.testError}>
            <XCircle size={16} />{" "}
            {runChecks.error instanceof Error
              ? runChecks.error.message
              : "Checks failed"}
          </p>
        )}

        {!statusQuery.isLoading && !status && !runChecks.isPending && (
          <p className={styles.formHint}>No checks have been run yet.</p>
        )}

        {status && (
          <>
            <StatusSummary status={status} />
            {checksByCategory.map(({ category, label, checks }) =>
              checks.length > 0 ? (
                <Card
                  key={category}
                  title={label}
                  className={styles.adminCheckCard}
                >
                  <div className={styles.adminCheckList}>
                    {checks.map((check) => (
                      <CheckRow key={check.id} check={check} />
                    ))}
                  </div>
                </Card>
              ) : null,
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
