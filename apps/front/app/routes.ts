import {
  type RouteConfig,
  route,
  layout,
  index,
} from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    // CSV page routes
    route("csv", "routes/csv/index.tsx", [
      index("routes/csv/home.tsx"),
      route("nohead", "routes/csv/nohead.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
