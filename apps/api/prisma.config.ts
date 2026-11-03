import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// En local, les variables viennent du .env à la racine du dépôt ; en Docker, de l'environnement.
const envFile = resolve(process.cwd(), '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed/index.ts',
  },
  datasource: {
    // Inutile pour `prisma generate` (build de l'image Docker), indispensable pour les migrations.
    url: process.env.DATABASE_URL ?? '',
  },
});
