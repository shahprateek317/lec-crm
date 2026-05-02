// One-shot: map free-text `area` to enum `areaCategory` for any clients
// missing the structured value. Used after the schema migration that added
// areaCategory; without it lead-score doesn't know who's "nearby".
import { PrismaClient } from "@prisma/client";
import type { AreaCategory } from "@prisma/client";
import { syncAllLeadScores } from "../../src/lib/lead-score";

const p = new PrismaClient();

const MAP: Array<{ test: RegExp; value: AreaCategory }> = [
  { test: /new\s*town/i,    value: "NEW_TOWN" },
  { test: /salt\s*lake/i,   value: "SALT_LAKE" },
  { test: /rajarhat/i,      value: "RAJARHAT" },
  { test: /dum\s*dum/i,     value: "DUMDUM" },
  { test: /barasat/i,       value: "BARASAT" },
];

async function main() {
  const clients = await p.client.findMany({
    where: { areaCategory: null, area: { not: null } },
    select: { id: true, area: true },
  });
  let mapped = 0, defaulted = 0;
  for (const c of clients) {
    const matched = MAP.find((m) => c.area && m.test.test(c.area));
    if (matched) {
      await p.client.update({ where: { id: c.id }, data: { areaCategory: matched.value } });
      mapped++;
    } else {
      // Anything else in/around Kolkata → OTHER_KOLKATA so lead score can still
      // gate on "nearby" vs "outside" if the spec evolves.
      await p.client.update({ where: { id: c.id }, data: { areaCategory: "OTHER_KOLKATA" } });
      defaulted++;
    }
  }
  console.log(`✓ ${mapped} matched a Kolkata locality; ${defaulted} defaulted to OTHER_KOLKATA`);

  const r = await syncAllLeadScores();
  console.log(`✓ recomputed ${r.updated} lead scores`);
}

main().finally(() => p.$disconnect());
