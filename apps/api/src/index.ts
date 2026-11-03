import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { runNotifications } from './maintenance/notifications.js';
import { runRetention } from './maintenance/retention.js';

const server = createApp().listen(config.port, () => {
  console.log(`API Prépa Civique prête sur http://localhost:${config.port}`);
});

// Tâches quotidiennes, sans planificateur externe : durées de conservation (§9), fin d'accès Premium et rappels de révision.
// Un premier passage a lieu peu après le démarrage, sinon des redémarrages fréquents (mises à jour) les repousseraient
// sans fin. Les relancer est sans risque : un email déjà envoyé ne repart pas.
function runMaintenance() {
  Promise.all([runRetention(), runNotifications()])
    .then(([retention, notifications]) => console.log('Maintenance quotidienne', { retention, notifications }))
    .catch((error: unknown) => console.error('Échec de la maintenance', error));
}

const maintenance =
  config.maintenanceHours > 0
    ? {
        first: setTimeout(runMaintenance, 5 * 60 * 1000),
        every: setInterval(runMaintenance, config.maintenanceHours * 60 * 60 * 1000),
      }
    : null;

async function shutdown() {
  if (maintenance) {
    clearTimeout(maintenance.first);
    clearInterval(maintenance.every);
  }
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
