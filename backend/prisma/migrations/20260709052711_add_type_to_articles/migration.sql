/*
  Warnings:

  - You are about to drop the `News` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'swap';

-- DropTable
DROP TABLE "public"."News";
