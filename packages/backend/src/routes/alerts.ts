import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { importAlerts, listAlerts, getAlert, performAction, handoverAlerts } from '../services/alert.service.js';
import { prisma } from '../db.js';

const importSchema = z.object({
  alerts: z.array(
    z.object({
      externalId: z.string().min(1),
      title: z.string().min(1),
      source: z.string().min(1),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      description: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
  ),
});

const actionSchema = z.object({
  action: z.enum(['CLAIM', 'START', 'RESOLVE', 'FALSE_POSITIVE']),
  operator: z.string().optional(),
  comment: z.string().optional(),
});

const handoverSchema = z.object({
  fromAssignee: z.string().min(1),
  toAssignee: z.string().min(1),
  reason: z.string().min(1),
});

const slaConfigSchema = z.array(
  z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    deadlineMinutes: z.number().int().positive(),
  })
);

export async function alertRoutes(app: FastifyInstance) {
  app.post('/api/alerts/import', async (request, reply) => {
    const parsed = importSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const result = await importAlerts(parsed.data.alerts);
    return reply.status(200).send(result);
  });

  app.get('/api/alerts', async (request) => {
    const { status, severity, source, search } = request.query as Record<string, string>;
    return listAlerts({ status, severity, source, search });
  });

  app.get('/api/alerts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const alert = await getAlert(id);
    if (!alert) return reply.status(404).send({ error: 'Not found' });
    return alert;
  });

  app.post('/api/alerts/:id/action', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const result = await performAction(id, parsed.data.action, parsed.data.operator, parsed.data.comment);
    if (!result.success) {
      return reply.status(422).send({ error: result.error });
    }
    return result.alert;
  });

  app.get('/api/sla-config', async () => {
    return prisma.slaConfig.findMany({ orderBy: { severity: 'asc' } });
  });

  app.put('/api/sla-config', async (request, reply) => {
    const parsed = slaConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    for (const item of parsed.data) {
      await prisma.slaConfig.upsert({
        where: { severity: item.severity },
        update: { deadlineMinutes: item.deadlineMinutes },
        create: { severity: item.severity, deadlineMinutes: item.deadlineMinutes },
      });
    }
    return prisma.slaConfig.findMany({ orderBy: { severity: 'asc' } });
  });

  app.post('/api/alerts/handover', async (request, reply) => {
    const parsed = handoverSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const result = await handoverAlerts(parsed.data.fromAssignee, parsed.data.toAssignee, parsed.data.reason);
    return reply.status(200).send(result);
  });
}
