// Restauration d'une sauvegarde (§10 : sauvegardes avec restauration testée).
//   npm run db:restore-test                     → restaure la dernière sauvegarde dans une base temporaire,
//                                                 compare quelques tables à la base en service, puis la supprime
//   npm run db:restore -- backups/<fichier>.dump --confirm
//                                               → remplace la base en service (arrêter l'API avant)
import { spawn } from 'node:child_process';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backupsDir = fileURLToPath(new URL('../backups/', import.meta.url));
const TEST_DB = 'prepa_restore_test';
const TABLES = ['users', 'questions', 'answers', 'orders', 'revision_sheets', 'exam_attempts'];
// Tout ou rien : une seule transaction, arrêt à la première erreur. Une restauration à moitié faite
// laisserait une base incohérente, et un essai qui ignore les erreurs ne prouverait rien.
const PG_RESTORE = 'pg_restore -U "$POSTGRES_USER" --no-owner --single-transaction --exit-on-error';

function run(command, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c', command], { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'inherit'] });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    if (input) {
      // pg_restore s'arrête parfois avant la fin du fichier (première erreur) : son code de sortie suffit à le signaler.
      child.stdin.on('error', () => {});
      createReadStream(input).pipe(child.stdin);
    }
    child.on('close', (code) => (code === 0 ? resolve(output.trim()) : reject(new Error(`Commande en échec (${code}) : ${command.split(' ')[0]}`))));
  });
}

const counts = async (database) =>
  Object.fromEntries(
    await Promise.all(TABLES.map(async (table) => [table, Number(await run(`psql -U "$POSTGRES_USER" -d ${database} -tAc "SELECT count(*) FROM ${table}"`))])),
  );

const latest = () => {
  const files = readdirSync(backupsDir)
    .filter((name) => name.endsWith('.dump'))
    .map((name) => ({ name, time: statSync(join(backupsDir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  if (files.length === 0) throw new Error('Aucune sauvegarde dans backups/ : lancez d’abord npm run db:backup.');
  return join(backupsDir, files[0].name);
};

const args = process.argv.slice(2);
if (args[0] === '--test') {
  const file = latest();
  console.log(`Essai de restauration de ${file} dans la base temporaire « ${TEST_DB} »…`);
  await run(`dropdb -U "$POSTGRES_USER" --if-exists ${TEST_DB} && createdb -U "$POSTGRES_USER" ${TEST_DB}`);
  try {
    await run(`${PG_RESTORE} -d ${TEST_DB}`, { input: file });
    const restored = await counts(TEST_DB);
    const live = await counts('"$POSTGRES_DB"');
    console.table(TABLES.map((table) => ({ table, sauvegarde: restored[table], base: live[table] })));
    console.log('Restauration réussie. Des écarts sont normaux si la base a changé depuis la sauvegarde.');
  } finally {
    await run(`dropdb -U "$POSTGRES_USER" --if-exists ${TEST_DB}`);
  }
} else {
  const file = args[0];
  if (!file || !args.includes('--confirm')) {
    console.error('Usage : npm run db:restore -- backups/<fichier>.dump --confirm   (remplace la base en service)');
    process.exit(1);
  }
  console.log(`Restauration de ${file} dans la base en service…`);
  await run(`${PG_RESTORE} -d "$POSTGRES_DB" --clean --if-exists`, { input: file });
  console.log('Restauration terminée. Redémarrez l’API.');
}
