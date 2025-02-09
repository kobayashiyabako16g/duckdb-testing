import { DuckDBProvider } from "./duckdb";
import { ThemeProvider } from "./theme";

export const Provider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <DuckDBProvider>{children}</DuckDBProvider>
    </ThemeProvider>
  );
};
