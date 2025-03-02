import {
  type RouteConfig,
  route,
  layout,
  index,
} from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("csv/nohead", "routes/csv/nohead.tsx"),
  ]),
] satisfies RouteConfig;
