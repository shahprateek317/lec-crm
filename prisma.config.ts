import { defineConfig } from "prisma/config";
import "dotenv/config";

// Prisma 6+ replaces the package.json "prisma" block with this file.
// Today this is mostly a placeholder pointing at the schema and migrations
// dir; if Prisma adds further config fields we can extend here.
export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
