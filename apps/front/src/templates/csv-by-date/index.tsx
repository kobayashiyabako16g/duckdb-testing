import { useCallback, useEffect, useState } from "react";
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import { DataTable } from "~/components/DataTable";
import { DateSelector, getJstToday } from "~/components/DateSelector";
import LoadingSpinner from "~/components/LoadingSpinner";
import { useDuckDB } from "~/hooks/duckdb";
import { ApiError } from "~/lib/apiClient";
import { listUploads, type UploadItem } from "~/loaders/uploads";

const TABLE_NAME = "csv_by_date";
const FILE_NAME = "data.csv";
const PAGE_SIZE = 10;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatJst(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

type Mode = "day" | "month";

export function CsvByDateApp() {
  const today = getJstToday();
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(today);

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">日付ビュー</h1>
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("day")}
          className={`px-4 py-2 rounded ${
            mode === "day"
              ? "bg-purple-600 text-white"
              : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          日モード
        </button>
        <button
          type="button"
          onClick={() => setMode("month")}
          className={`px-4 py-2 rounded ${
            mode === "month"
              ? "bg-purple-600 text-white"
              : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          月モード
        </button>
      </div>
      {mode === "day" ? (
        <DayView date={date} setDate={setDate} />
      ) : (
        <MonthView
          yyyy={date.yyyy}
          mm={date.mm}
          setYearMonth={(yyyy, mm) => setDate({ yyyy, mm, dd: date.dd })}
          openDay={(yyyy, mm, dd) => {
            setDate({ yyyy, mm, dd });
            setMode("day");
          }}
        />
      )}
    </main>
  );
}

interface DayViewProps {
  date: { yyyy: number; mm: number; dd: number };
  setDate: (d: { yyyy: number; mm: number; dd: number }) => void;
}

function DayView({ date, setDate }: DayViewProps) {
  const { db, initialized } = useDuckDB("duckdb-wasm-by-date");
  const [item, setItem] = useState<UploadItem | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const loadForDate = useCallback(
    async (database: AsyncDuckDB, signedUrl: string) => {
      setHint("データを取得しています...");
      const buf = await (await fetch(signedUrl)).arrayBuffer();
      setHint("DuckDB に読み込んでいます...");
      const bytes = new Uint8Array(buf);
      // gzip magic (1f 8b) を見て圧縮形式を判定する。
      // DuckDB の compression='auto' は拡張子で判断するため、'data.csv' だと gzip を見落とす。
      const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
      const compression = isGzip ? "gzip" : "none";
      await database.registerFileBuffer(FILE_NAME, bytes);
      const conn = await database.connect();
      try {
        await conn.query(`DROP TABLE IF EXISTS ${TABLE_NAME};`);
        await conn.query(
          `CREATE TABLE ${TABLE_NAME} AS SELECT * FROM read_csv('${FILE_NAME}', header=true, compression='${compression}');`,
        );
      } finally {
        await conn.close();
      }
    },
    [],
  );

  const fetchPage = useCallback(
    async (database: AsyncDuckDB, page: number) => {
      const conn = await database.connect();
      try {
        const offset = page * PAGE_SIZE;
        const res = await conn.query(
          `SELECT * FROM ${TABLE_NAME} LIMIT ${PAGE_SIZE} OFFSET ${offset};`,
        );
        setData(res.toArray());
      } finally {
        await conn.close();
      }
    },
    [],
  );

  useEffect(() => {
    if (!initialized || !db) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setCurrentPage(0);
      setData([]);
      setItem(null);
      try {
        const uploads = await listUploads({ yyyy: date.yyyy, mm: date.mm, dd: date.dd });
        if (cancelled) return;
        const found = uploads[0] ?? null;
        if (!found) {
          setLoading(false);
          return;
        }
        await loadForDate(db, found.signedUrl);
        if (cancelled) return;
        await fetchPage(db, 0);
        if (cancelled) return;
        // テーブル作成 + 初期ページ取得が終わってから item を立てる。
        // 先に setItem すると、currentPage の useEffect が CREATE TABLE より前に
        // SELECT を発火して "Table does not exist" になる。
        setItem(found);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialized, db, date.yyyy, date.mm, date.dd, loadForDate, fetchPage]);

  useEffect(() => {
    if (!initialized || !db || !item) return;
    let cancelled = false;
    (async () => {
      try {
        await fetchPage(db, currentPage);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, initialized, db, item, fetchPage]);

  return (
    <div>
      <div className="mb-4">
        <DateSelector
          mode="day"
          yyyy={date.yyyy}
          mm={date.mm}
          dd={date.dd}
          onChange={(d) => setDate({ yyyy: d.yyyy, mm: d.mm, dd: d.dd ?? 1 })}
        />
      </div>
      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingSpinner hint={hint} />
      ) : item ? (
        <>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {item.objectPath} ({formatSize(item.size)}, {formatJst(item.uploadedAt)})
          </div>
          <DataTable data={data} />
          <div className="flex justify-start gap-4 mt-4">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50"
            >
              前の {PAGE_SIZE} 行
            </button>
            <button
              type="button"
              disabled={data.length < PAGE_SIZE}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              次の {PAGE_SIZE} 行
            </button>
          </div>
        </>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">対象日のアップロードはありません。</p>
      )}
    </div>
  );
}

interface MonthViewProps {
  yyyy: number;
  mm: number;
  setYearMonth: (yyyy: number, mm: number) => void;
  openDay: (yyyy: number, mm: number, dd: number) => void;
}

function MonthView({ yyyy, mm, setYearMonth, openDay }: MonthViewProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const uploads = await listUploads({ yyyy, mm });
        if (!cancelled) setItems(uploads);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [yyyy, mm]);

  return (
    <div>
      <div className="mb-4">
        <DateSelector
          mode="month"
          yyyy={yyyy}
          mm={mm}
          onChange={(d) => setYearMonth(d.yyyy, d.mm)}
        />
      </div>
      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}
      {loading ? (
        <p>読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">対象月のアップロードはありません。</p>
      ) : (
        <table className="w-full border-collapse border">
          <thead>
            <tr>
              <th className="border p-2 text-left">日</th>
              <th className="border p-2 text-left">サイズ</th>
              <th className="border p-2 text-left">アップロード日時</th>
              <th className="border p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.objectPath}>
                <td className="border p-2">
                  {it.yyyy}-{String(it.mm).padStart(2, "0")}-{String(it.dd).padStart(2, "0")}
                </td>
                <td className="border p-2">{formatSize(it.size)}</td>
                <td className="border p-2">{formatJst(it.uploadedAt)}</td>
                <td className="border p-2">
                  <button
                    type="button"
                    onClick={() => openDay(it.yyyy, it.mm, it.dd)}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    開く
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
