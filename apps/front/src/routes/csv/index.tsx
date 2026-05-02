import { createFileRoute } from "@tanstack/react-router";

import { getGCSSignedUrl } from "~/loaders/gcs";
import { HeadApp } from "~/templates/csv";

const FILE_NAME = "mock_data.csv";

export const Route = createFileRoute("/csv/")({
  loader: async () => {
    const signedUrl = await getGCSSignedUrl(FILE_NAME);
    return { signedUrl };
  },
  component: Csv,
  head: () => ({
    meta: [{ title: "CSV Viewer" }, { name: "description", content: "CSV Viewer with DuckDB" }],
  }),
});

function Csv() {
  const { signedUrl } = Route.useLoaderData();

  return <HeadApp signedUrl={signedUrl} />;
}
