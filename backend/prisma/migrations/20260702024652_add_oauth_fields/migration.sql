/*
  Warnings:

  - A unique constraint covering the columns `[yandexId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[maxId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "maxId" TEXT,
ADD COLUMN     "yandexId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_yandexId_key" ON "public"."User"("yandexId");

-- CreateIndex
CREATE UNIQUE INDEX "User_maxId_key" ON "public"."User"("maxId");
