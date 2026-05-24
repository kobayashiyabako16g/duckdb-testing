import { createFileRoute } from "@tanstack/react-router";
import { CsvByDateApp } from "~/templates/csv-by-date";

export const Route = createFileRoute("/csv/by-date")({
  component: CsvByDatePage,
  head: () => ({
    meta: [{ title: "日付ビュー | DuckDB Testing" }],
  }),
});

function CsvByDatePage() {
  return <CsvByDateApp />;
}
