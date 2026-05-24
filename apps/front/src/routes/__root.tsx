import { createRootRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { Header } from "~/components/Header";
import { SignInWithGoogle } from "~/components/SignInWithGoogle";
import { Provider } from "~/provider";
import { useAuth } from "~/provider/auth";

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  return (
    <Provider>
      <AppShell />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </Provider>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && needsOnboarding && location.pathname !== "/onboarding") {
      void navigate({ to: "/onboarding" });
    }
  }, [isLoading, isAuthenticated, needsOnboarding, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignInScreen />;
  }

  return (
    <div className="container mx-auto p-4">
      <Header />
      <Outlet />
    </div>
  );
}

function SignInScreen() {
  return (
    <div className="container mx-auto p-4 max-w-md mt-16">
      <h1 className="text-2xl font-bold mb-4">DuckDB Testing</h1>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Google アカウントでサインインしてください。
      </p>
      <SignInWithGoogle />
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
