import type { Route } from "./+types/nohead";

import { GetS3SignedUr } from "~/loaders/s3";
import { ACCESS_KEY_ID, BUCKET_NAME, SECRET_ACCESS_KEY } from "~/config/env";
import { NoHeadApp } from "~/templates/csv/nohead";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const FILE_NAME = "output.csv";
export async function loader({ params }: Route.LoaderArgs) {
  const signedUrl = await GetS3SignedUr({
    bucket: BUCKET_NAME,
    key: FILE_NAME,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });
  return { signedUrl };
}
export default function NoHead({ loaderData }: Route.ComponentProps) {
  const { signedUrl } = loaderData;

  return <NoHeadApp signedUrl={signedUrl} />;
}
