-- Convert single role to roles array
ALTER TABLE "User" ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT '{}';
UPDATE "User" SET "roles" = ARRAY["role"::"Role"];
ALTER TABLE "User" DROP COLUMN "role";
