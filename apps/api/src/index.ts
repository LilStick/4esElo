import { API_PORT } from "./env";
import { serve } from "@hono/node-server";
import { app } from "./app";

serve({ fetch: app.fetch, port: API_PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
