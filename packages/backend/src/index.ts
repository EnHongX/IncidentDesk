import Fastify from 'fastify';
import cors from '@fastify/cors';
import { alertRoutes } from './routes/alerts.js';
import { incidentRoutes } from './routes/incidents.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(alertRoutes);
await app.register(incidentRoutes);

app.get('/api/health', async () => ({ status: 'ok' }));

const port = parseInt(process.env.PORT ?? '3000', 10);
await app.listen({ port, host: '0.0.0.0' });
console.log(`Server running on http://localhost:${port}`);
