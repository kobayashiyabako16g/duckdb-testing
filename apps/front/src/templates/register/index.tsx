import { useState } from "react";
import { useAuth } from "~/provider/auth";
import { createUser, type CreatedUser } from "~/loaders/users";
import { ApiError } from "~/lib/apiClient";

export function RegisterApp() {
  const { user, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <p className="p-4">読み込み中...</p>;
  }
  if (!user) {
    return <p className="p-4">ログインしていません。</p>;
  }
  if (user.role !== "admin") {
    return <p className="p-4">権限がありません。</p>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const u = await createUser({ email, role });
      setCreated(u);
      setEmail("");
      setRole("viewer");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unknown error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-4">ユーザー登録</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        新しいユーザーをあなたのテナント ({user.tenant_id}) に追加します。
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">メールアドレス</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="user@example.com"
            className="px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">ロール</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
            className="px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
          >
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting || !email}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting ? "登録中..." : "登録"}
        </button>
      </form>
      {created && (
        <div className="mt-4 p-3 rounded bg-green-50 border border-green-200 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-200">
          作成しました: {created.email} ({created.role})
        </div>
      )}
      {error && (
        <div className="mt-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}
    </main>
  );
}
