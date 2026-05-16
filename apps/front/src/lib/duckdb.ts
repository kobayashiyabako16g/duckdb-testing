import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

const dbCache = new Map<string, Promise<duckdb.AsyncDuckDB>>();

async function createDuckDB(dbName: string): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  try {
    await db.open({
      path: `opfs://${dbName}.db`,
      accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
    });
  } catch (error) {
    console.warn("open error", error);
  }
  const conn = await db.connect();
  await conn.query("INSTALL httpfs");
  await conn.query("LOAD httpfs");
  await conn.close();
  return db;
}

export function InitDuckDB(dbName: string): Promise<duckdb.AsyncDuckDB> {
  let cached = dbCache.get(dbName);
  if (!cached) {
    cached = createDuckDB(dbName).catch((err) => {
      dbCache.delete(dbName);
      throw err;
    });
    dbCache.set(dbName, cached);
  }
  return cached;
}
