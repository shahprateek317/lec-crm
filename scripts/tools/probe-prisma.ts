import { PrismaClient } from "@prisma/client";

const p = new PrismaClient({ log: ["error"] });

(async () => {
  try {
    const r = await p.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    console.log("✓ prisma connected:", r);
  } catch (err) {
    console.error("✗ prisma failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
