-- CreateEnum
CREATE TYPE "AgeBucket" AS ENUM ('UNDER_18', 'AGE_18_25', 'AGE_26_40', 'AGE_41_60', 'AGE_60_PLUS');

-- CreateEnum
CREATE TYPE "AreaCategory" AS ENUM ('NEW_TOWN', 'SALT_LAKE', 'RAJARHAT', 'DUMDUM', 'BARASAT', 'OTHER_KOLKATA', 'OUTSIDE_KOLKATA');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('STRESS_ANXIETY', 'PHYSICAL_HEALTH', 'EMOTIONAL', 'RELATIONSHIP', 'FINANCIAL', 'WELLBEING', 'OTHER');

-- CreateEnum
CREATE TYPE "DurationBucket" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'OVER_YEAR');

-- CreateEnum
CREATE TYPE "PreferredTimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'WEEKEND');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "ageBucket" "AgeBucket",
ADD COLUMN     "areaCategory" "AreaCategory",
ADD COLUMN     "durationBucket" "DurationBucket",
ADD COLUMN     "issueCategory" "IssueCategory",
ADD COLUMN     "preferredTimeSlot" "PreferredTimeSlot";
