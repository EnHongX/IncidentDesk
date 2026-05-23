import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  // Seed default SLA config
  const slaDefaults = [
    { severity: 'critical', deadlineMinutes: 30 },
    { severity: 'high', deadlineMinutes: 60 },
    { severity: 'medium', deadlineMinutes: 240 },
    { severity: 'low', deadlineMinutes: 480 },
  ];
  for (const sla of slaDefaults) {
    await prisma.slaConfig.upsert({
      where: { severity: sla.severity },
      update: {},
      create: sla,
    });
  }
  console.log('Seeded SLA config: critical=30m, high=60m, medium=4h, low=8h');

  // Seed sample alerts
  const raw = readFileSync(join(__dirname, 'sample-alerts.json'), 'utf-8');
  const alerts = JSON.parse(raw);

  for (const alert of alerts) {
    await prisma.alert.upsert({
      where: { externalId: alert.externalId },
      update: {},
      create: {
        externalId: alert.externalId,
        title: alert.title,
        source: alert.source,
        severity: alert.severity,
        description: alert.description ?? null,
        metadata: alert.metadata ? JSON.stringify(alert.metadata) : null,
      },
    });
  }

  console.log(`Seeded ${alerts.length} alerts`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
