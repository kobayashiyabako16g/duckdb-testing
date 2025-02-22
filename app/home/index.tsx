import { useEffect, useState } from "react";
import { DataTable } from "~/components/DataTable";
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import { FILE_NAME, TABLE_NAME } from "~/config/constants";
import { useDuckDBContext } from "~/provider/duckdb";
import LoadingSpinner from "~/components/LoadingSpinner";
import SearchBar from "~/components/SearchBar";
import ThemeToggle from "~/components/ThemaToggle";

const getRequetBuffer = async (
  PARQUET_FILE_URL: string,
): Promise<ArrayBuffer> => {
  const response = await fetch(PARQUET_FILE_URL);
  return response.arrayBuffer();
};
const readBuffer = async (
  db: AsyncDuckDB,
  buffer: ArrayBuffer,
): Promise<void> => {
  await db.registerFileBuffer(`${FILE_NAME}`, new Uint8Array(buffer));
  const conn = await db.connect();
  try {
    const tableExists = await conn.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = '${TABLE_NAME}' 
      ) as exists_flag;
    `);

    const exists = tableExists.toArray()[0].exists_flag;

    if (!exists) {
      console.log("テーブルが存在しないため作成します");
      await conn.query(`
        CREATE TABLE '${TABLE_NAME}' AS SELECT * FROM read_csv('${FILE_NAME}', names = ['CsvID']);
      `);
    } else {
      console.log("テーブルは既に存在します");
    }
  } catch (error) {
    console.error("テーブル作成中にエラーが発生しました:", error);
    throw error;
  } finally {
    console.log("close");
    await conn.close();
  }
};

type Props = {
  signedUrl: string | undefined;
};
export function HomeApp({ signedUrl }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState("");

  const { db, initialized } = useDuckDBContext();
  useEffect(() => {
    async function fetchData() {
      if (!initialized || !db || !signedUrl) return;
      setLoading(true);
      const offset = currentPage * 10;
      try {
        setHint("データを取得しています....");
        const buffer = await getRequetBuffer(signedUrl);
        setHint("データをインポートしています...");
        await readBuffer(db, buffer);

        const conn = await db.connect();
        let query = `SELECT * FROM ${TABLE_NAME} LIMIT 10 OFFSET ${offset}`;
        if (searchTerm) {
          query = `SELECT * FROM ${TABLE_NAME} WHERE CsvID ILIKE '%${searchTerm}%' LIMIT 10 OFFSET ${offset}`;
        }
        setHint("表示準備をしています...");
        const result = await conn.query(query);
        setData(result.toArray());
      } catch (error) {
        console.error("Error loading CSV:", error);
      }
      setLoading(false);
    }
    fetchData();
  }, [initialized, currentPage, searchTerm]);

  const handleSearch = async (term: string) => {
    console.log("search", term);
    if (!initialized || !db) return;
    const conn = await db.connect();
    const result = await conn.query(
      `SELECT * FROM ${TABLE_NAME} WHERE CsvID ILike '%${term}%' limit 10`,
    );
    setData(result.toArray());
    setCurrentPage(0); // 検索時は最初のページにリセット
  };

  return (
    <main className="container mx-auto p-4">
      <div className="flex justtify-between items-center gap-4">
        <h1 className="text-2xl font-bold mb-4">Search</h1>
        <ThemeToggle />
      </div>
      <div className="mb-4">
        <SearchBar onSearch={handleSearch} disabled={loading} />
      </div>
      {signedUrl ? (
        !loading ? (
          <DataTable data={data} />
        ) : (
          <LoadingSpinner hint={hint} />
        )
      ) : (
        <p>Data Import Error</p>
      )}
      <div className="flex justify-start gap-4">
        <button
          type="button"
          disabled={loading}
          onClick={() => setCurrentPage((prev) => prev + 1)}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          次の10行を表示
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => setCurrentPage((prev) => prev - 1)}
          className="mt-4 px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50"
        >
          前の10行を表示
        </button>
      </div>
    </main>
  );
}
