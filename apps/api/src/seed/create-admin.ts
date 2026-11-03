import { hashPassword, randomToken } from '../auth/crypto.js';
import { issueToken, revokeTokens } from '../auth/tokens.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { sendMail } from '../mail/mailer.js';
import { resetPasswordMail } from '../mail/templates.js';

// Premier compte super-administrateur (A09), en production comme en développement :
//   npm run admin:create -w api -- prenom.nom@exemple.fr          (développement)
//   docker compose exec api node dist/seed/create-admin.js prenom.nom@exemple.fr
// Aucun mot de passe n'est affiché : la personne reçoit un lien pour choisir le sien,
// puis active la double authentification à sa première visite du back-office.

// Même durée que le lien « mot de passe oublié », annoncée dans l'email.
const HOUR_MS = 60 * 60 * 1000;

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage : create-admin <adresse email>');
    process.exitCode = 1;
    return;
  }

  const now = new Date();
  // Mot de passe inutilisable tant que la personne n'a pas choisi le sien avec le lien.
  const unusablePassword = await hashPassword(randomToken());
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: unusablePassword,
      role: 'SUPER_ADMIN',
      emailVerifiedAt: now,
      termsAcceptedAt: now,
      termsVersion: config.termsVersion,
    },
    // Compte existant : mot de passe et double authentification remis à zéro. Un ancien mot de passe ou un ancien
    // appareil d'authentification ne donne donc pas les droits de super-administrateur.
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash: unusablePassword, mfaSecret: null, mfaEnabledAt: null },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  // Liens encore en attente (changement d'adresse, réinitialisation) : annulés, seul le nouveau lien compte.
  await revokeTokens(user.id, ['CHANGE_EMAIL', 'RESET_PASSWORD']);
  await prisma.auditLog.create({ data: { actorId: null, action: 'user.role', entity: 'user', entityId: user.id, details: { to: 'SUPER_ADMIN', by: 'create-admin' } } });

  const token = await issueToken(user.id, 'RESET_PASSWORD', HOUR_MS);
  await sendMail(resetPasswordMail(email, token));
  console.log(`Super-administrateur prêt : ${email}. Un lien pour choisir le mot de passe lui a été envoyé (valable 1 heure).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
