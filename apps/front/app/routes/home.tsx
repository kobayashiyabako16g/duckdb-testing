import type { Route } from "./+types/home";

import { Provider } from "~/provider";
import { HomeApp } from "~/templates/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return <HomeApp />;
}
