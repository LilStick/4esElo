import "dotenv/config";
import { seed } from "./seed";

// Insère les données de seed avant la suite e2e (l'API tourne dans un autre
// process et lit la même DB → voit ces lignes à la première requête).
export default async function globalSetup(): Promise<void> {
  await seed();
}
