-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IncidentTimeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "operator" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentTimeline_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncidentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timeWindowMin" INTEGER NOT NULL DEFAULT 60
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "description" TEXT,
    "metadata" TEXT,
    "assignee" TEXT,
    "service" TEXT,
    "fingerprint" TEXT,
    "incidentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Alert_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Alert" ("assignee", "createdAt", "description", "externalId", "id", "metadata", "severity", "source", "status", "title", "updatedAt") SELECT "assignee", "createdAt", "description", "externalId", "id", "metadata", "severity", "source", "status", "title", "updatedAt" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE UNIQUE INDEX "Alert_externalId_key" ON "Alert"("externalId");
CREATE INDEX "Alert_status_idx" ON "Alert"("status");
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");
CREATE INDEX "Alert_source_idx" ON "Alert"("source");
CREATE INDEX "Alert_assignee_idx" ON "Alert"("assignee");
CREATE INDEX "Alert_service_fingerprint_idx" ON "Alert"("service", "fingerprint");
CREATE INDEX "Alert_incidentId_idx" ON "Alert"("incidentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Incident_service_fingerprint_status_idx" ON "Incident"("service", "fingerprint", "status");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");

-- CreateIndex
CREATE INDEX "IncidentTimeline_incidentId_idx" ON "IncidentTimeline"("incidentId");
