// One-shot: populate availabilitySlots on the demo healer/counsellor so the
// new grid UI shows realistic data. Idempotent — safe to re-run.
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const healerSlots = [
  "MON:MORNING", "MON:EVENING",
  "TUE:MORNING", "TUE:EVENING",
  "WED:MORNING", "WED:EVENING",
  "THU:MORNING", "THU:EVENING",
  "FRI:MORNING", "FRI:EVENING",
  "SAT:MORNING", "SAT:AFTERNOON", "SAT:EVENING",
];
const counsellorSlots = [
  "MON:MORNING", "MON:AFTERNOON",
  "TUE:MORNING", "TUE:AFTERNOON",
  "WED:MORNING", "WED:AFTERNOON",
  "THU:MORNING", "THU:AFTERNOON",
  "FRI:MORNING", "FRI:AFTERNOON",
];

async function main() {
  for (const email of ["healer@lec.app", "healer@lifeenergycentre.local"]) {
    const u = await p.user.findUnique({ where: { email } });
    if (!u) continue;
    await p.healerProfile.update({
      where: { userId: u.id },
      data: { availabilitySlots: healerSlots },
    });
    console.log(`✓ healer slots → ${email}`);
  }
  for (const email of ["counsellor@lec.app", "counsellor@lifeenergycentre.local"]) {
    const u = await p.user.findUnique({ where: { email } });
    if (!u) continue;
    await p.counsellorProfile.update({
      where: { userId: u.id },
      data: { availabilitySlots: counsellorSlots },
    });
    console.log(`✓ counsellor slots → ${email}`);
  }
}

main().finally(() => p.$disconnect());
