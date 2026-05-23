-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "description" TEXT,
    "metadata" TEXT,
    "assignee" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SlaConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "severity" TEXT NOT NULL,
    "deadlineMinutes" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "TimelineEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "operator" TEXT,
    "comment" TEXT,
    "fromState" TEXT,
    "toState" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineEntry_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Alert_externalId_key" ON "Alert"("externalId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_source_idx" ON "Alert"("source");

-- CreateIndex
CREATE INDEX "Alert_assignee_idx" ON "Alert"("assignee");

-- CreateIndex
CREATE UNIQUE INDEX "SlaConfig_severity_key" ON "SlaConfig"("severity");

-- CreateIndex
CREATE INDEX "TimelineEntry_alertId_idx" ON "TimelineEntry"("alertId");
