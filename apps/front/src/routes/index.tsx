import { createFileRoute } from "@tanstack/react-router";

import { HomeApp } from "~/templates/home";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "DuckDB Testing" },
      { name: "description", content: "Welcome to DuckDB Testing!" },
    ],
  }),
});

function Home() {
  return <HomeApp />;
}
