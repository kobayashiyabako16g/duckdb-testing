import { createFileRoute } from "@tanstack/react-router";
import { UploadApp } from "~/templates/upload";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  head: () => ({
    meta: [{ title: "アップロード | DuckDB Testing" }],
  }),
});

function UploadPage() {
  return <UploadApp />;
}
