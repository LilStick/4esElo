import "dotenv/config";
import { cleanup } from "./seed";

export default async function globalTeardown(): Promise<void> {
  await cleanup();
}
