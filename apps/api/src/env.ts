import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load the monorepo-root .env regardless of the process cwd.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });
