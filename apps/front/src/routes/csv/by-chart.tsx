import { createFileRoute } from "@tanstack/react-router";
import { CsvByChartApp } from "~/templates/csv-by-chart";

export const Route = createFileRoute("/csv/by-chart")({
  component: CsvByChartPage,
  head: () => ({
    meta: [{ title: "ラインチャート | DuckDB Testing" }],
  }),
});

function CsvByChartPage() {
  return <CsvByChartApp />;
}
