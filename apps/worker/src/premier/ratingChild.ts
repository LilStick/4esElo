import { ratingFromDemo } from "@4eselo/premier";

/**
 * Process enfant : parse une démo hors du thread principal du worker.
 * Le décompress bz2 + parse demoparser2 sont synchrones et bloquent l'event loop
 * plusieurs secondes → si on les lance dans le worker, steam-user n'envoie plus son
 * heartbeat et le GC coupe la session. Isolé ici, le worker reste réactif.
 *
 * argv : <demoUrl> <steamId64>  ·  stdout : JSON du rating (ou "null").
 */
const [demoUrl, steamId64] = process.argv.slice(2);
if (!demoUrl || !steamId64) {
  process.stderr.write("usage: ratingChild <demoUrl> <steamId64>");
  process.exit(2);
}

ratingFromDemo(demoUrl, steamId64)
  .then((rating) => {
    process.stdout.write(JSON.stringify(rating ?? null));
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
