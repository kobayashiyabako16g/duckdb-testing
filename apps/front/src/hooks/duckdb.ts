import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import { useEffect, useState } from "react";
import { InitDuckDB } from "~/lib/duckdb";

export const useDuckDB = (dbName: string) => {
  const [db, setDB] = useState<AsyncDuckDB | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      const duckDb = await InitDuckDB(dbName);
      setDB(duckDb);
      setInitialized(true);
    };
    if (!initialized) {
      init();
    }
  }, []);

  return { db, initialized };
};
