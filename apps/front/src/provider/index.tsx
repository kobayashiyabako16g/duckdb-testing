import { AuthProvider } from "./auth";
import { ThemeProvider } from "./theme";

export const Provider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
};
