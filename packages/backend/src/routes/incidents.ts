import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listIncidents,
  getIncident,
  mergeIncidents,
  removeAlertFromIncident,
  closeIncident,
  getTimeWindowMin,
  updateTimeWindow,
} from '../services/incident.service.js';

const mergeSchema = z.object({
  sourceIncidentId: z.string().min(1),
  operator: z.string().min(1),
  comment: z.string().optional(),
});

const removeAlertSchema = z.object({
  alertId: z.string().min(1),
  operator: z.string().min(1),
  comment: z.string().optional(),
});

const closeSchema = z.object({
  operator: z.string().min(1),
  comment: z.string().optional(),
});

const configSchema = z.object({
  timeWindowMin: z.number().int().positive(),
});

export async function incidentRoutes(app: FastifyInstance) {
  app.get('/api/incidents', async (request) => {
    const { status, service, severity } = request.query as Record<string, string>;
    return listIncidents({ status, service, severity });
  });

  app.get('/api/incidents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const incident = await getIncident(id);
    if (!incident) return reply.status(404).send({ error: 'Not found' });
    return incident;
  });

  app.post('/api/incidents/:id/merge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = mergeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const result = await mergeIncidents(id, parsed.data.sourceIncidentId, parsed.data.operator, parsed.data.comment);
    if (!result.success) {
      return reply.status(422).send({ error: result.error });
    }
    return result.incident;
  });

  app.post('/api/incidents/:id/remove-alert', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = removeAlertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const result = await removeAlertFromIncident(id, parsed.data.alertId, parsed.data.operator, parsed.data.comment);
    if (!result.success) {
      return reply.status(422).send({ error: result.error });
    }
    return result.incident;
  });

  app.post('/api/incidents/:id/close', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = closeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const result = await closeIncident(id, parsed.data.operator, parsed.data.comment);
    if (!result.success) {
      return reply.status(422).send({ error: result.error });
    }
    return result.incident;
  });

  app.get('/api/incident-config', async () => {
    const timeWindowMin = await getTimeWindowMin();
    return { timeWindowMin };
  });

  app.put('/api/incident-config', async (request, reply) => {
    const parsed = configSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const config = await updateTimeWindow(parsed.data.timeWindowMin);
    return { timeWindowMin: config.timeWindowMin };
  });
}
