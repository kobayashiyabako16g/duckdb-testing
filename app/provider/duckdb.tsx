import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

import { InitDuckDB } from "~/lib/duckdb";

// Create a context for DuckDB
type DuckDBContextType = {
  db: AsyncDuckDB | null;
  initialized: boolean;
};

const DuckDBContext = createContext<DuckDBContextType>({
  db: null,
  initialized: false,
});

export const useDuckDBContext = () => {
  return useContext(DuckDBContext);
};

export const DuckDBProvider = ({ children }: { children: ReactNode }) => {
  const [duckDB, setDuckDB] = useState<AsyncDuckDB | null>(null);
  const [duckdbInitialized, setDuckdbInitialized] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      const db = await InitDuckDB();
      setDuckDB(db);
      setDuckdbInitialized(true);
    };
    if (!duckdbInitialized) {
      init();
    }
  }, []);

  return (
    <DuckDBContext.Provider
      value={{ db: duckDB, initialized: duckdbInitialized }}
    >
      {children}
    </DuckDBContext.Provider>
  );
};
