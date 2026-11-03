// Sauvegarde de la base PostgreSQL du service « db » (docker compose), au format pg_dump compressé.
//   npm run db:backup                 → backups/prepa-civique-AAAA-MM-JJ-HHMM.dump
//   npm run db:backup -- --keep 30    → supprime aussi les sauvegardes de plus de 30 jours
// À lancer chaque nuit en production (voir docs/exploitation.md), et à copier hors du serveur.
import { spawn } from 'node:child_process';
import { chmodSync, createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

// Vérifiée avant la sauvegarde : --keep 0 (ou une valeur illisible) effacerait aussi celle qui vient d'être faite.
const keepIndex = process.argv.indexOf('--keep');
const keepDays = keepIndex > 0 ? Number(process.argv[keepIndex + 1]) : null;
if (keepDays !== null && !(Number.isInteger(keepDays) && keepDays >= 1)) {
  console.error('--keep attend un nombre entier de jours, au moins 1 (par exemple --keep 30).');
  process.exit(1);
}

// Les sauvegardes contiennent des données personnelles : dossier et fichiers réservés au compte qui les crée.
const dir = fileURLToPath(new URL('../backups/', import.meta.url));
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700); // dossier créé avant cette règle

const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const file = join(dir, `prepa-civique-${stamp}.dump`);

// Les variables POSTGRES_* sont celles du conteneur : rien n'est lu ni affiché ici.
const dump = spawn('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c', 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const out = createWriteStream(file, { mode: 0o600 });
dump.stdout.pipe(out);

const code = await new Promise((resolve) => dump.on('close', resolve));
// Le fichier peut avoir fini de s'écrire avant la fin de docker : attendre « finish » à ce moment-là bloquerait le script.
await finished(out);
if (code !== 0) {
  unlinkSync(file);
  console.error('Échec de la sauvegarde (le service « db » est-il démarré ?).');
  process.exit(1);
}
const size = statSync(file).size;
console.log(`Sauvegarde créée : backups/prepa-civique-${stamp}.dump (${Math.round(size / 1024)} Ko)`);

if (keepDays !== null) {
  const limit = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name.endsWith('.dump') && statSync(path).mtimeMs < limit) {
      unlinkSync(path);
      console.log(`Ancienne sauvegarde supprimée : ${name}`);
    }
  }
}
