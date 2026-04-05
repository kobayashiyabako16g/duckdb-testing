import { createFileRoute } from "@tanstack/react-router";

import { GetS3SignedUr } from "~/loaders/s3";
import { ACCESS_KEY_ID, BUCKET_NAME, SECRET_ACCESS_KEY } from "~/config/env";
import { NoHeadApp } from "~/templates/csv/nohead";

const FILE_NAME = "output.csv";

export const Route = createFileRoute("/csv/nohead")({
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
  component: NoHead,
  head: () => ({
    meta: [
      { title: "CSV Viewer (No Header)" },
      { name: "description", content: "CSV Viewer without header" },
    ],
  }),
});

function NoHead() {
  const { signedUrl } = Route.useLoaderData();

  return <NoHeadApp signedUrl={signedUrl} />;
}
