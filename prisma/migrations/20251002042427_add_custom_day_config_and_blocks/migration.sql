-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "useCustomDayConfig" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ScheduleDayConfig" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timeSlots" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleDayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleDayConfig_scheduleId_idx" ON "ScheduleDayConfig"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDayConfig_scheduleId_dayOfWeek_key" ON "ScheduleDayConfig"("scheduleId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ScheduleBlock_scheduleId_startDate_endDate_idx" ON "ScheduleBlock"("scheduleId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "ScheduleDayConfig" ADD CONSTRAINT "ScheduleDayConfig_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
