import { createFileRoute } from "@tanstack/react-router";

import { getGCSSignedUrl } from "~/loaders/gcs";
import { NoHeadApp } from "~/templates/csv/nohead";

const FILE_NAME = "output.csv";

export const Route = createFileRoute("/csv/nohead")({
  loader: async () => {
    const signedUrl = await getGCSSignedUrl(FILE_NAME);
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
