import type { Route } from "./+types/home";

import { GetS3SignedUr } from "~/loaders/s3";
import { ACCESS_KEY_ID, BUCKET_NAME, SECRET_ACCESS_KEY } from "~/config/env";
import { HeadApp } from "~/templates/csv";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const FILE_NAME = "mock_data.csv";
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
export default function Csv({ loaderData }: Route.ComponentProps) {
  const { signedUrl } = loaderData;

  return <HeadApp signedUrl={signedUrl} />;
}
