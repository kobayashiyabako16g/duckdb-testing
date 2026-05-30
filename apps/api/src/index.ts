import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./lib/config.js";

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
