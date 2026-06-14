import { useCallback, useEffect, useMemo, useState } from "react";
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { DateSelector, getJstToday } from "~/components/DateSelector";
import LoadingSpinner from "~/components/LoadingSpinner";
import { useDuckDB } from "~/hooks/duckdb";
import { ApiError } from "~/lib/apiClient";
import {
  listUploads,
  listUploadsRange,
  type UploadItem,
} from "~/loaders/uploads";

const TABLE_NAME = "csv_by_chart";
const DAY_FILE_NAME = "data.csv";
const MAX_POINTS = 500;

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

type Mode = "day" | "month";

type ColumnMeta = { name: string; type: string };

interface ChartData {
  xKey: string;
  series: string[];
  rows: Record<string, unknown>[];
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function isNumericType(t: string): boolean {
  const u = t.toUpperCase();
  return (
    u.includes("INT") ||
    u.includes("DECIMAL") ||
    u.includes("DOUBLE") ||
    u.includes("FLOAT") ||
    u.includes("REAL") ||
    u.includes("NUMERIC") ||
    u.includes("HUGEINT") ||
    u.includes("TINYINT") ||
    u.includes("SMALLINT") ||
    u.includes("BIGINT")
  );
}

function formatYmd(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatXValue(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return formatYmd(v);
  if (typeof v === "bigint" || typeof v === "number") {
    let n = Number(v);
    if (Number.isFinite(n) && n > 1e11) {
      // DuckDB が DATE/TIMESTAMP をエポック値で返すケース。
      // 10^14 を超える値はマイクロ秒とみなしてミリ秒に変換する。
      if (n > 1e14) n = n / 1000;
      return formatYmd(new Date(n));
    }
    return String(v);
  }
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  }
  return String(v);
}

function normalizeRows(
  rows: Record<string, unknown>[],
  xKey: string,
  series: string[],
): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = { [xKey]: formatXValue(r[xKey]) };
    for (const s of series) {
      const v = r[s];
      out[s] = typeof v === "bigint" ? Number(v) : v;
    }
    return out;
  });
}

function buildChartConfig(series: string[]): ChartConfig {
  const cfg: ChartConfig = {};
  series.forEach((s, i) => {
    cfg[s] = { label: s, color: CHART_COLORS[i % CHART_COLORS.length] };
  });
  return cfg;
}

type SeriesKind = "area" | "bar" | "line";

function pickSeriesKind(name: string): SeriesKind {
  const n = name.toLowerCase();
  if (n.includes("cpu")) return "area";
  if (n.includes("mem")) return "bar";
  if (n.includes("swap")) return "line";
  return "line";
}

interface CsvLineChartProps {
  data: ChartData;
}

function CsvLineChart({ data }: CsvLineChartProps) {
  const config = useMemo(() => buildChartConfig(data.series), [data.series]);

  if (data.series.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        数値カラムが見つかりません。
      </p>
    );
  }
  if (data.rows.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        表示するデータがありません。
      </p>
    );
  }

  return (
    <ChartContainer config={config} className="h-[420px] w-full">
      <ComposedChart
        data={data.rows}
        margin={{ left: 12, right: 24, top: 12, bottom: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={data.xKey}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {data.series.map((s) => {
          const color = `var(--color-${s})`;
          const kind = pickSeriesKind(s);
          if (kind === "area") {
            return (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stroke={color}
                fill={color}
                fillOpacity={0.3}
                strokeWidth={2}
                isAnimationActive={false}
              />
            );
          }
          if (kind === "bar") {
            return (
              <Bar
                key={s}
                dataKey={s}
                fill={color}
                isAnimationActive={false}
              />
            );
          }
          return (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          );
        })}
      </ComposedChart>
    </ChartContainer>
  );
}

export function CsvByChartApp() {
  const today = getJstToday();
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(today);
  const [fromDate, setFromDate] = useState({ yyyy: today.yyyy, mm: today.mm });
  const [toDate, setToDate] = useState({ yyyy: today.yyyy, mm: today.mm });

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ラインチャート</h1>
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
        <DayChartView date={date} setDate={setDate} />
      ) : (
        <MonthChartView
          from={fromDate}
          to={toDate}
          setFrom={(yyyy, mm) => setFromDate({ yyyy, mm })}
          setTo={(yyyy, mm) => setToDate({ yyyy, mm })}
        />
      )}
    </main>
  );
}

async function describeColumns(database: AsyncDuckDB): Promise<ColumnMeta[]> {
  const conn = await database.connect();
  try {
    const res = await conn.query(`DESCRIBE ${TABLE_NAME};`);
    return res.toArray().map((r) => {
      const row = r as { column_name: unknown; column_type: unknown };
      return { name: String(row.column_name), type: String(row.column_type) };
    });
  } finally {
    await conn.close();
  }
}

function pickAxes(cols: ColumnMeta[]): { xKey: string; series: string[] } {
  if (cols.length === 0) return { xKey: "", series: [] };
  // 先頭列を X 軸として固定。残りの数値列を系列として扱う。
  const xKey = cols[0]!.name;
  const series = cols
    .slice(1)
    .filter((c) => isNumericType(c.type))
    .map((c) => c.name);
  return { xKey, series };
}

async function queryChartRows(
  database: AsyncDuckDB,
  xKey: string,
  series: string[],
): Promise<Record<string, unknown>[]> {
  if (!xKey || series.length === 0) return [];
  const cols = [xKey, ...series]
    .map((c) => `"${c.replace(/"/g, '""')}"`)
    .join(", ");
  const orderClause = `ORDER BY "${xKey.replace(/"/g, '""')}"`;
  const sql = `SELECT ${cols} FROM ${TABLE_NAME} ${orderClause} LIMIT ${MAX_POINTS};`;
  const conn = await database.connect();
  try {
    const res = await conn.query(sql);
    return res.toArray() as Record<string, unknown>[];
  } finally {
    await conn.close();
  }
}

interface DayChartViewProps {
  date: { yyyy: number; mm: number; dd: number };
  setDate: (d: { yyyy: number; mm: number; dd: number }) => void;
}

function DayChartView({ date, setDate }: DayChartViewProps) {
  const { db, initialized } = useDuckDB("duckdb-wasm-by-chart");
  const [item, setItem] = useState<UploadItem | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadForDate = useCallback(
    async (database: AsyncDuckDB, signedUrl: string) => {
      setHint("データを取得しています...");
      const buf = await (await fetch(signedUrl)).arrayBuffer();
      setHint("DuckDB に読み込んでいます...");
      const bytes = new Uint8Array(buf);
      const isGzip =
        bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
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

  useEffect(() => {
    if (!initialized || !db) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setChart(null);
      setItem(null);
      try {
        const uploads = await listUploads({
          yyyy: date.yyyy,
          mm: date.mm,
          dd: date.dd,
        });
        if (cancelled) return;
        const found = uploads[0] ?? null;
        if (!found) {
          setLoading(false);
          return;
        }
        await loadForDate(db, found.signedUrl);
        if (cancelled) return;
        const cols = await describeColumns(db);
        const { xKey, series } = pickAxes(cols);
        const rows = await queryChartRows(db, xKey, series);
        if (cancelled) return;
        setChart({ xKey, series, rows: normalizeRows(rows, xKey, series) });
        setItem(found);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialized, db, date.yyyy, date.mm, date.dd, loadForDate]);

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
      ) : item && chart ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{item.objectPath}</CardTitle>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {formatSize(item.size)} / {formatJst(item.uploadedAt)}
            </div>
          </CardHeader>
          <CardContent>
            <CsvLineChart data={chart} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          対象日のアップロードはありません。
        </p>
      )}
    </div>
  );
}

interface MonthChartViewProps {
  from: { yyyy: number; mm: number };
  to: { yyyy: number; mm: number };
  setFrom: (yyyy: number, mm: number) => void;
  setTo: (yyyy: number, mm: number) => void;
}

function MonthChartView({ from, to, setFrom, setTo }: MonthChartViewProps) {
  const { db, initialized } = useDuckDB("duckdb-wasm-by-chart");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      const isGzip =
        first.length >= 2 && first[0] === 0x1f && first[1] === 0x8b;
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

  const invalid = monthKey(from) > monthKey(to);

  useEffect(() => {
    if (!initialized || !db) return;
    if (invalid) {
      setError("開始月は終了月以前を指定してください。");
      setItems([]);
      setChart(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setChart(null);
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
        const cols = await describeColumns(db);
        const { xKey, series } = pickAxes(cols);
        const rows = await queryChartRows(db, xKey, series);
        if (cancelled) return;
        setChart({ xKey, series, rows: normalizeRows(rows, xKey, series) });
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
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
      ) : chart ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {items.length} ファイル / 合計 {formatSize(totalSize)}
            </CardTitle>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              先頭 {MAX_POINTS} 点まで表示
            </div>
          </CardHeader>
          <CardContent>
            <CsvLineChart data={chart} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          対象期間のアップロードはありません。
        </p>
      )}
    </div>
  );
}
