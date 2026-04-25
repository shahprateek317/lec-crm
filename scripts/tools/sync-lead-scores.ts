// One-shot: recompute lead scores for every client in the connected DB.
// Run after schema changes / seeds that affect score inputs.
import { syncAllLeadScores } from "../../src/lib/lead-score";

(async () => {
  const r = await syncAllLeadScores();
  console.log(`✓ recomputed ${r.updated} lead scores`);
  process.exit(0);
})();
