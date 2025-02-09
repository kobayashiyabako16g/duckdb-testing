import type { Route } from "./+types/home";

import { Provider } from "~/provider";
import { GetS3SignedUr } from "~/loaders/s3";
import { HomeApp } from "~/home";
import { ACCESS_KEY_ID, BUCKET_NAME, SECRET_ACCESS_KEY } from "~/config/env";
import { FILE_NAME } from "~/config/constants";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

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
export default function Home({ loaderData }: Route.ComponentProps) {
  const { signedUrl } = loaderData;

  return (
    <Provider>
      <HomeApp signedUrl={signedUrl} />
    </Provider>
  );
}
