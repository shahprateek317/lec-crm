-- AlterTable
ALTER TABLE "CounsellorProfile" ADD COLUMN     "availabilitySlots" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "HealerProfile" ADD COLUMN     "availabilitySlots" TEXT[] DEFAULT ARRAY[]::TEXT[];

