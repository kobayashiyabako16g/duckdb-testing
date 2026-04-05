import { createFileRoute } from "@tanstack/react-router";

import { GetS3SignedUr } from "~/loaders/s3";
import { ACCESS_KEY_ID, BUCKET_NAME, SECRET_ACCESS_KEY } from "~/config/env";
import { HeadApp } from "~/templates/csv";

const FILE_NAME = "mock_data.csv";

export const Route = createFileRoute("/csv/")({
  loader: async () => {
    const signedUrl = await GetS3SignedUr({
      bucket: BUCKET_NAME,
      key: FILE_NAME,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    });
    return { signedUrl };
  },
  component: Csv,
  head: () => ({
    meta: [
      { title: "CSV Viewer" },
      { name: "description", content: "CSV Viewer with DuckDB" },
    ],
  }),
});

function Csv() {
  const { signedUrl } = Route.useLoaderData();

  return <HeadApp signedUrl={signedUrl} />;
}
