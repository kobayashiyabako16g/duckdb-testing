import { useCallback, useEffect, useRef, useState } from "react";
import { DateSelector, getJstToday } from "~/components/DateSelector";
import { ApiError } from "~/lib/apiClient";
import { listUploads, uploadFile, type UploadItem } from "~/loaders/uploads";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatJst(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return fmt.format(d);
}

export function UploadApp() {
  const today = getJstToday();
  const [date, setDate] = useState(today);
  const [existing, setExisting] = useState<UploadItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshExisting = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listUploads({ yyyy: date.yyyy, mm: date.mm, dd: date.dd });
      setExisting(items[0] ?? null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setError(`既存ファイルの取得に失敗: ${msg}`);
      setExisting(null);
    } finally {
      setLoading(false);
    }
  }, [date.yyyy, date.mm, date.dd]);

  useEffect(() => {
    void refreshExisting();
  }, [refreshExisting]);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("ファイルを選択してください");
      return;
    }
    if (existing) {
      const ok = window.confirm(
        `${date.yyyy}-${String(date.mm).padStart(2, "0")}-${String(date.dd).padStart(2, "0")} のファイルを上書きします。よろしいですか？`,
      );
      if (!ok) return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      await uploadFile(file, date);
      setMessage("アップロードが完了しました");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshExisting();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`アップロード失敗: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">CSV アップロード</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        日付ごとに 1 ファイル (data.csv) を保管します。再アップロードは上書きになります。
      </p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">対象日</h2>
        <DateSelector
          mode="day"
          yyyy={date.yyyy}
          mm={date.mm}
          dd={date.dd}
          onChange={(d) => setDate({ yyyy: d.yyyy, mm: d.mm, dd: d.dd ?? 1 })}
        />
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">現在の状態</h2>
        {loading ? (
          <p>読み込み中...</p>
        ) : existing ? (
          <div className="rounded border border-gray-200 dark:border-gray-700 p-3 text-sm">
            <div>
              <span className="font-medium">パス:</span>{" "}
              <code className="break-all">{existing.objectPath}</code>
            </div>
            <div>
              <span className="font-medium">サイズ:</span> {formatSize(existing.size)}
            </div>
            <div>
              <span className="font-medium">アップロード日時:</span>{" "}
              {formatJst(existing.uploadedAt)}
            </div>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">対象日にはまだファイルがありません。</p>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">ファイル</h2>
        <div className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={uploading}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 dark:text-gray-300 dark:file:bg-purple-900 dark:file:text-purple-200"
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="self-start px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {uploading
              ? "アップロード中..."
              : existing
                ? "上書きアップロード"
                : "アップロード"}
          </button>
        </div>
      </section>

      {message && (
        <div className="p-3 rounded bg-green-50 border border-green-200 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-200">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}
    </main>
  );
}
