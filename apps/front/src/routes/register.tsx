import { createFileRoute } from "@tanstack/react-router";
import { RegisterApp } from "~/templates/register";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  head: () => ({
    meta: [{ title: "ユーザー登録 | DuckDB Testing" }],
  }),
});

function RegisterPage() {
  return <RegisterApp />;
}
