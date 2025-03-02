import { ThemeProvider } from "./theme";

export const Provider = ({ children }: { children: React.ReactNode }) => {
  return <ThemeProvider>{children}</ThemeProvider>;
};
