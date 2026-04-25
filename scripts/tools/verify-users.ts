import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const p = new PrismaClient();

async function main() {
  const users = await p.user.findMany({
    select: { email: true, role: true, active: true, passwordHash: true, name: true },
  });
  console.log(`users in DB: ${users.length}\n`);

  const tests: Array<[string, string]> = [
    ["admin@lifeenergycentre.local", "admin@lec1"],
    ["coordinator@lifeenergycentre.local", "coord@lec1"],
    ["counsellor@lifeenergycentre.local", "couns@lec1"],
    ["healer@lifeenergycentre.local", "heal@lec1"],
  ];

  for (const [email, pwd] of tests) {
    const u = users.find((x) => x.email === email);
    if (!u) {
      console.log(`${email} — MISSING`);
      continue;
    }
    const ok = await bcrypt.compare(pwd, u.passwordHash);
    console.log(
      `${u.email.padEnd(40)} role=${u.role.padEnd(12)} active=${u.active}  password_ok=${ok}`,
    );
  }
}

main().finally(() => p.$disconnect());
