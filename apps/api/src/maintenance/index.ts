import { prisma } from '../db.js';
import { runNotifications } from './notifications.js';
import { runRetention } from './retention.js';

// Passage manuel de la maintenance : durées de conservation, puis emails de fin d'accès et rappels de révision.
//   npm run maintenance -w api        (développement)
//   docker compose exec api node dist/maintenance/index.js
// En production, l'API le fait aussi d'elle-même chaque jour (MAINTENANCE_HOURS).

Promise.all([runRetention(), runNotifications()])
  .then(([retention, notifications]) => console.log('Maintenance :', { retention, notifications }))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
