import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ApiError } from "~/lib/apiClient";
import type { AppTenant } from "~/lib/auth";
import { getTenants, submitOnboarding } from "~/loaders/onboarding";
import { useAuth } from "~/provider/auth";

type Action = "create" | "join";

export function OnboardingApp() {
  const { email, needsOnboarding, refresh, isLoading } = useAuth();
  const navigate = useNavigate();
  const [action, setAction] = useState<Action>("create");
  const [tenantName, setTenantName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [tenants, setTenants] = useState<AppTenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!needsOnboarding) {
      void navigate({ to: "/" });
    }
  }, [isLoading, needsOnboarding, navigate]);

  useEffect(() => {
    let cancelled = false;
    setTenantsLoading(true);
    void (async () => {
      try {
        const list = await getTenants();
        if (!cancelled) {
          setTenants(list);
          if (list[0]) setTenantId(list[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setTenantsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (action === "create") {
        if (!tenantName.trim()) {
          setError("テナント名を入力してください");
          setSubmitting(false);
          return;
        }
        await submitOnboarding({ action: "create", tenantName: tenantName.trim() });
      } else {
        if (!tenantId) {
          setError("参加するテナントを選んでください");
          setSubmitting(false);
          return;
        }
        await submitOnboarding({ action: "join", tenantId });
      }
      await refresh();
      void navigate({ to: "/" });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <p className="p-4">読み込み中...</p>;

  return (
    <main className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-2">セットアップ</h1>
      {email && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {email} としてサインインしています。続けるためにテナントを選んでください。
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium mb-2">アクション</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="action"
              value="create"
              checked={action === "create"}
              onChange={() => setAction("create")}
            />
            新規テナントを作成 (自分が admin になる)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="action"
              value="join"
              checked={action === "join"}
              onChange={() => setAction("join")}
            />
            既存テナントに参加 (viewer として加入)
          </label>
        </fieldset>

        {action === "create" ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">テナント名</span>
            <input
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              placeholder="My Workspace"
              className="px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">参加するテナント</span>
            {tenantsLoading ? (
              <span className="text-sm">読み込み中...</span>
            ) : tenants.length === 0 ? (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                参加できるテナントがありません。新規作成を選んでください。
              </span>
            ) : (
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}

        <button
          type="submit"
          disabled={submitting || (action === "join" && tenants.length === 0)}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting ? "処理中..." : "セットアップを完了"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}
    </main>
  );
}
