import { useCallback, useEffect, useState } from "react";
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import { DataTable } from "~/components/DataTable";
import { DateSelector, getJstToday } from "~/components/DateSelector";
import LoadingSpinner from "~/components/LoadingSpinner";
import { useDuckDB } from "~/hooks/duckdb";
import { ApiError } from "~/lib/apiClient";
import { listUploads, listUploadsRange, type UploadItem } from "~/loaders/uploads";

const TABLE_NAME = "csv_by_date";
const DAY_FILE_NAME = "data.csv";
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

function monthKey(d: { yyyy: number; mm: number }): number {
  return d.yyyy * 100 + d.mm;
}

// SQL identifier に "" を含めるための二重化、文字列リテラルの '' 二重化。
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
function escapeLiteral(s: string): string {
  return s.replace(/'/g, "''");
}

function buildWhereClause(search: string, column: string, cols: string[]): string {
  const q = search.trim();
  if (!q) return "";
  const target = column && cols.includes(column) ? [column] : cols;
  if (target.length === 0) return "";
  const esc = escapeLiteral(q);
  const conds = target.map((c) => `CAST(${quoteIdent(c)} AS VARCHAR) ILIKE '%${esc}%'`);
  return `WHERE ${conds.join(" OR ")}`;
}

interface SearchBarProps {
  columns: string[];
  searchQuery: string;
  searchColumn: string;
  onSearchChange: (q: string) => void;
  onColumnChange: (c: string) => void;
}

function SearchBar({
  columns,
  searchQuery,
  searchColumn,
  onSearchChange,
  onColumnChange,
}: SearchBarProps) {
  const selectClass =
    "px-2 py-1 border border-gray-300 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600";
  const inputClass = `${selectClass} flex-1 min-w-0`;
  return (
    <div className="mb-3 flex items-center gap-2">
      <select
        className={selectClass}
        value={searchColumn}
        onChange={(e) => onColumnChange(e.target.value)}
        disabled={columns.length === 0}
      >
        <option value="">全カラム</option>
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        type="search"
        placeholder="検索..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

type Mode = "day" | "month";

export function CsvByDateApp() {
  const today = getJstToday();
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(today);
  const [fromDate, setFromDate] = useState({ yyyy: today.yyyy, mm: today.mm });
  const [toDate, setToDate] = useState({ yyyy: today.yyyy, mm: today.mm });

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
          from={fromDate}
          to={toDate}
          setFrom={(yyyy, mm) => setFromDate({ yyyy, mm })}
          setTo={(yyyy, mm) => setToDate({ yyyy, mm })}
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
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchColumn, setSearchColumn] = useState("");

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
      await database.registerFileBuffer(DAY_FILE_NAME, bytes);
      const conn = await database.connect();
      try {
        await conn.query(`DROP TABLE IF EXISTS ${TABLE_NAME};`);
        await conn.query(
          `CREATE TABLE ${TABLE_NAME} AS SELECT * FROM read_csv('${DAY_FILE_NAME}', header=true, compression='${compression}');`,
        );
      } finally {
        await conn.close();
      }
    },
    [],
  );

  const fetchColumns = useCallback(async (database: AsyncDuckDB) => {
    const conn = await database.connect();
    try {
      const res = await conn.query(`DESCRIBE ${TABLE_NAME};`);
      return res.toArray().map((r) => String((r as { column_name: unknown }).column_name));
    } finally {
      await conn.close();
    }
  }, []);

  const fetchPage = useCallback(
    async (database: AsyncDuckDB, page: number, where: string) => {
      const conn = await database.connect();
      try {
        const offset = page * PAGE_SIZE;
        const sql = `SELECT * FROM ${TABLE_NAME} ${where} LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
        const res = await conn.query(sql);
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
      setSearchQuery("");
      setSearchColumn("");
      setData([]);
      setColumns([]);
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
        const cols = await fetchColumns(db);
        if (cancelled) return;
        setColumns(cols);
        await fetchPage(db, 0, "");
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
  }, [initialized, db, date.yyyy, date.mm, date.dd, loadForDate, fetchColumns, fetchPage]);

  useEffect(() => {
    if (!initialized || !db || !item) return;
    let cancelled = false;
    (async () => {
      try {
        const where = buildWhereClause(searchQuery, searchColumn, columns);
        await fetchPage(db, currentPage, where);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, searchQuery, searchColumn, columns, initialized, db, item, fetchPage]);

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
          <SearchBar
            columns={columns}
            searchQuery={searchQuery}
            searchColumn={searchColumn}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setCurrentPage(0);
            }}
            onColumnChange={(c) => {
              setSearchColumn(c);
              setCurrentPage(0);
            }}
          />
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
  from: { yyyy: number; mm: number };
  to: { yyyy: number; mm: number };
  setFrom: (yyyy: number, mm: number) => void;
  setTo: (yyyy: number, mm: number) => void;
}

function MonthView({ from, to, setFrom, setTo }: MonthViewProps) {
  const { db, initialized } = useDuckDB("duckdb-wasm-by-date");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [tableReady, setTableReady] = useState(false);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchColumn, setSearchColumn] = useState("");

  const loadForRange = useCallback(
    async (database: AsyncDuckDB, uploads: UploadItem[]) => {
      setHint("データを取得しています...");
      const fetched = await Promise.all(
        uploads.map(async (u) => {
          const buf = await (await fetch(u.signedUrl)).arrayBuffer();
          return { upload: u, bytes: new Uint8Array(buf) };
        }),
      );
      setHint("DuckDB に読み込んでいます...");
      const first = fetched[0]!.bytes;
      const isGzip = first.length >= 2 && first[0] === 0x1f && first[1] === 0x8b;
      const compression = isGzip ? "gzip" : "none";
      const fileNames: string[] = [];
      for (const { upload, bytes } of fetched) {
        const fileName = `data_${upload.yyyy}_${String(upload.mm).padStart(2, "0")}_${String(upload.dd).padStart(2, "0")}.csv`;
        await database.registerFileBuffer(fileName, bytes);
        fileNames.push(fileName);
      }
      const filesLiteral = fileNames.map((n) => `'${n}'`).join(", ");
      const conn = await database.connect();
      try {
        await conn.query(`DROP TABLE IF EXISTS ${TABLE_NAME};`);
        await conn.query(
          `CREATE TABLE ${TABLE_NAME} AS SELECT * FROM read_csv([${filesLiteral}], header=true, compression='${compression}', union_by_name=true);`,
        );
      } finally {
        await conn.close();
      }
    },
    [],
  );

  const fetchColumns = useCallback(async (database: AsyncDuckDB) => {
    const conn = await database.connect();
    try {
      const res = await conn.query(`DESCRIBE ${TABLE_NAME};`);
      return res.toArray().map((r) => String((r as { column_name: unknown }).column_name));
    } finally {
      await conn.close();
    }
  }, []);

  const fetchPage = useCallback(
    async (database: AsyncDuckDB, page: number, where: string) => {
      const conn = await database.connect();
      try {
        const offset = page * PAGE_SIZE;
        const sql = `SELECT * FROM ${TABLE_NAME} ${where} LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
        const res = await conn.query(sql);
        setData(res.toArray());
      } finally {
        await conn.close();
      }
    },
    [],
  );

  const invalid = monthKey(from) > monthKey(to);

  useEffect(() => {
    if (!initialized || !db) return;
    if (invalid) {
      setError("開始月は終了月以前を指定してください。");
      setItems([]);
      setTableReady(false);
      setData([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setCurrentPage(0);
      setSearchQuery("");
      setSearchColumn("");
      setData([]);
      setColumns([]);
      setTableReady(false);
      setItems([]);
      try {
        const uploads = await listUploadsRange({
          from_yyyy: from.yyyy,
          from_mm: from.mm,
          to_yyyy: to.yyyy,
          to_mm: to.mm,
        });
        if (cancelled) return;
        setItems(uploads);
        if (uploads.length === 0) {
          setLoading(false);
          return;
        }
        await loadForRange(db, uploads);
        if (cancelled) return;
        const cols = await fetchColumns(db);
        if (cancelled) return;
        setColumns(cols);
        await fetchPage(db, 0, "");
        if (cancelled) return;
        // テーブル作成 + 初期ページ取得が終わってから tableReady を立てる
        // (DayView と同じ理由)。
        setTableReady(true);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    initialized,
    db,
    from.yyyy,
    from.mm,
    to.yyyy,
    to.mm,
    invalid,
    loadForRange,
    fetchColumns,
    fetchPage,
  ]);

  useEffect(() => {
    if (!initialized || !db || !tableReady) return;
    let cancelled = false;
    (async () => {
      try {
        const where = buildWhereClause(searchQuery, searchColumn, columns);
        await fetchPage(db, currentPage, where);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentPage,
    searchQuery,
    searchColumn,
    columns,
    initialized,
    db,
    tableReady,
    fetchPage,
  ]);

  const totalSize = items.reduce((acc, it) => acc + it.size, 0);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="w-20">開始月:</span>
          <DateSelector
            mode="month"
            yyyy={from.yyyy}
            mm={from.mm}
            onChange={(d) => setFrom(d.yyyy, d.mm)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20">終了月:</span>
          <DateSelector
            mode="month"
            yyyy={to.yyyy}
            mm={to.mm}
            onChange={(d) => setTo(d.yyyy, d.mm)}
          />
        </div>
      </div>
      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingSpinner hint={hint} />
      ) : tableReady ? (
        <>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {items.length} ファイル / 合計 {formatSize(totalSize)}
          </div>
          <SearchBar
            columns={columns}
            searchQuery={searchQuery}
            searchColumn={searchColumn}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setCurrentPage(0);
            }}
            onColumnChange={(c) => {
              setSearchColumn(c);
              setCurrentPage(0);
            }}
          />
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
        <p className="text-gray-600 dark:text-gray-400">対象期間のアップロードはありません。</p>
      )}
    </div>
  );
}
