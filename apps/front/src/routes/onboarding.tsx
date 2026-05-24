import { createFileRoute } from "@tanstack/react-router";
import { OnboardingApp } from "~/templates/onboarding";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [{ title: "オンボーディング | DuckDB Testing" }],
  }),
});

function OnboardingPage() {
  return <OnboardingApp />;
}
