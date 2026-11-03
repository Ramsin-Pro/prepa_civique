import { config } from '../config.js';
import type { Mail } from './mailer.js';

// Emails transactionnels : français simple, un seul bouton, mention d'indépendance.
const SITE = 'Repère';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(to: string, subject: string, paragraphs: string[], action?: { label: string; url: string }): Mail {
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#faf7f0;font-family:Arial,sans-serif;color:#1b2b34">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="font-size:20px;font-weight:bold;color:#1f5e4b;margin:0 0 24px">${SITE}</p>
<div style="background:#ffffff;border:1px solid #e4ded1;border-radius:14px;padding:24px;font-size:16px;line-height:1.6">
${paragraphs.map((paragraph) => `<p style="margin:0 0 16px">${escape(paragraph)}</p>`).join('\n')}
${action ? `<p style="margin:24px 0 8px"><a href="${escape(action.url)}" style="display:inline-block;background:#1f5e4b;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px">${escape(action.label)}</a></p><p style="margin:0;font-size:13px;color:#55626a">Si le bouton ne fonctionne pas, copiez ce lien : ${escape(action.url)}</p>` : ''}
</div>
<p style="font-size:12px;color:#55626a;margin:20px 0 0">${SITE} est une plateforme indépendante, sans lien avec l’administration française.</p>
</div></body></html>`;
  const text = [...paragraphs, ...(action ? [`${action.label} : ${action.url}`] : []), '', `${SITE} est une plateforme indépendante, sans lien avec l’administration française.`].join('\n\n');
  return { to, subject, text, html };
}

const link = (path: string) => `${config.publicUrl}${path}`;

// « 1er mai 2027 » : en français, le premier jour du mois s'écrit avec « er ».
const longDate = (date: Date) =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1(\s)/, '1er$1');

export const verifyEmailMail = (to: string, token: string) =>
  layout(
    to,
    'Confirmez votre adresse email',
    [
      'Bonjour,',
      'Merci pour votre inscription. Pour activer votre compte, confirmez votre adresse email. Le lien est valable 48 heures.',
      'Si vous n’avez pas créé de compte, ne cliquez pas : ignorez simplement cet email.',
    ],
    { label: 'Confirmer mon adresse', url: link(`/confirmer-email?jeton=${token}`) },
  );

export const alreadyRegisteredMail = (to: string) =>
  layout(
    to,
    'Vous avez déjà un compte',
    [
      'Bonjour,',
      'Quelqu’un a voulu créer un compte avec votre adresse email, mais vous avez déjà un compte. Si c’est vous, connectez-vous. Si vous avez oublié votre mot de passe, vous pouvez le changer.',
      'Si ce n’est pas vous, vous pouvez ignorer cet email.',
    ],
    { label: 'Me connecter', url: link('/connexion') },
  );

export const resetPasswordMail = (to: string, token: string) =>
  layout(
    to,
    'Changer votre mot de passe',
    ['Bonjour,', 'Vous avez demandé à changer votre mot de passe. Le lien est valable 1 heure.', 'Si ce n’est pas vous, ignorez cet email : votre mot de passe ne change pas.'],
    { label: 'Choisir un nouveau mot de passe', url: link(`/reinitialiser-mot-de-passe?jeton=${token}`) },
  );

export const changeEmailMail = (to: string, token: string) =>
  layout(
    to,
    'Confirmez votre nouvelle adresse email',
    [
      'Bonjour,',
      'Vous avez demandé à utiliser cette adresse pour votre compte. Confirmez-la avec le bouton ci-dessous. Le lien est valable 48 heures.',
      'Si ce n’est pas vous, ignorez cet email : rien ne change.',
    ],
    { label: 'Confirmer la nouvelle adresse', url: link(`/confirmer-email?jeton=${token}&changement=1`) },
  );

/** Avis envoyé à l'ancienne adresse après un changement : la personne réagit si elle n'en est pas à l'origine. */
export const emailChangedMail = (to: string) =>
  layout(
    to,
    'L’adresse email de votre compte a changé',
    [
      'Bonjour,',
      'L’adresse email de votre compte Repère vient d’être remplacée par une nouvelle adresse. Vous ne recevrez plus nos emails ici.',
      'Si c’est vous, vous n’avez rien à faire.',
      'Si ce n’est pas vous, écrivez-nous tout de suite depuis la page Contact : nous vous aiderons à récupérer votre compte.',
    ],
    { label: 'Contacter le support', url: link('/contact') },
  );

export const purchaseMail = (to: string, details: { planName: string; amount: string; expiresAt: Date; orderId: string }) =>
  layout(
    to,
    'Votre accès Premium est activé',
    [
      'Bonjour,',
      `Merci pour votre achat : ${details.planName}, ${details.amount} TTC, payé une seule fois.`,
      `Votre accès Premium est actif jusqu’au ${longDate(details.expiresAt)}. Il s’arrête seul à cette date : il n’y a pas de renouvellement automatique.`,
      `Numéro de commande : ${details.orderId}. Le reçu de paiement est envoyé séparément par notre prestataire de paiement.`,
      `Avant le paiement, vous avez accepté nos conditions générales de vente (${link('/cgv')}) et demandé l’accès immédiat à votre espace Premium. Vous avez reconnu que vous perdez ainsi votre droit de rétractation (article L221-28 du Code de la consommation). Cet email vous le confirme.`,
      'Rappel : c’est un entraînement. Seul l’examen officiel donne l’attestation.',
    ],
    { label: 'Commencer à m’entraîner', url: link('/entrainement') },
  );

// Accusés de réception : l'adresse n'est pas vérifiée, aucun texte libre saisi dans le formulaire n'y est repris
// (sinon le site pourrait servir à relayer un message d'hameçonnage). Le sujet vient de la liste fixe du formulaire.
export const contactAckMail = (to: string, subject: string) =>
  layout(to, 'Nous avons bien reçu votre message', [
    'Bonjour,',
    `Nous avons bien reçu votre message « ${subject} ». Nous vous répondons en général sous 3 jours ouvrés.`,
    'Notre support répond aux questions sur le site. Il ne remplace pas l’administration : pour votre dossier, consultez service-public.gouv.fr ou votre préfecture.',
  ]);

export const inactivityWarningMail = (to: string, deletionDate: Date) =>
  layout(
    to,
    'Votre compte sera bientôt supprimé',
    [
      'Bonjour,',
      `Vous ne vous êtes pas connecté depuis longtemps. Pour protéger vos données, votre compte et votre progression seront supprimés le ${longDate(deletionDate)}.`,
      'Pour garder votre compte, il suffit de vous connecter avant cette date.',
    ],
    { label: 'Me connecter', url: link('/connexion') },
  );

export const premiumEndingMail = (to: string, expiresAt: Date) =>
  layout(
    to,
    'Votre accès Premium se termine bientôt',
    [
      'Bonjour,',
      `Votre accès Premium se termine le ${longDate(expiresAt)}. Il n’y a pas de renouvellement automatique : rien ne sera prélevé.`,
      'Après cette date, vous gardez votre compte, votre progression et l’offre gratuite. Si vous avez encore besoin de vous entraîner, vous pourrez reprendre un pass à tout moment.',
    ],
    { label: 'Continuer mes révisions', url: link('/entrainement') },
  );

export const revisionReminderMail = (
  to: string,
  details: { count: number; pathTitle: string | null; url: string; unsubscribeUrl: string },
) => {
  const mail = layout(
    to,
    `${details.count} question${details.count > 1 ? 's' : ''} à revoir`,
    [
      'Bonjour,',
      `${details.count} question${details.count > 1 ? 's sont' : ' est'} à revoir${details.pathTitle ? ` pour le parcours « ${details.pathTitle} »` : ''}. Les revoir maintenant, c’est le meilleur moyen de les retenir.`,
      'Vous recevez ce rappel parce que vous l’avez demandé dans votre compte. Il arrive au plus une fois par semaine.',
    ],
    { label: 'Faire mes révisions', url: details.url },
  );
  const stop = `Ne plus recevoir ces rappels : ${details.unsubscribeUrl}`;
  return {
    ...mail,
    text: `${mail.text}\n\n${stop}`,
    html: mail.html.replace(
      '</div></body></html>',
      `<p style="font-size:12px;color:#55626a;margin:8px 0 0"><a href="${escape(details.unsubscribeUrl)}" style="color:#55626a">Ne plus recevoir ces rappels</a></p></div></body></html>`,
    ),
  };
};


// ─── Associations et structures ──────────────────────────────────────────────

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

export const organizationPackMail = (
  to: string,
  details: { organizationName: string; seats: number; seatDays: number; validUntil: Date; inviteCode: string; amount: string | null },
) =>
  layout(
    to,
    `${plural(details.seats, 'place')} pour ${details.organizationName}`,
    [
      'Bonjour,',
      `${details.amount ? `Merci pour votre commande (${details.amount} TTC). ` : ''}${plural(details.seats, 'place')} ${details.seats > 1 ? 'sont ouvertes' : 'est ouverte'} pour ${details.organizationName}. Chaque place donne un accès Premium de ${Math.round(details.seatDays / 30)} mois à la personne qui l’active.`,
      `Pour inviter les personnes que vous accompagnez, partagez ce lien : ${link(`/rejoindre/${details.inviteCode}`)}. Elles créent un compte gratuit, puis activent leur place. Les places sont à activer avant le ${longDate(details.validUntil)}.`,
      'Depuis votre espace, vous suivez les places utilisées. Chaque personne choisit si elle partage sa progression avec vous.',
    ],
    { label: 'Ouvrir l’espace de ma structure', url: link('/espace/structure') },
  );

// Le nom de la structure, saisi librement et envoyé à une adresse non vérifiée, n'est volontairement pas repris :
// l'email ne doit pas pouvoir servir de relais à un message écrit par n'importe qui.
export const organizationRequestAckMail = (to: string) =>
  layout(to, 'Nous avons bien reçu votre demande', [
    'Bonjour,',
    'Merci pour votre demande. Nous revenons vers vous sous 3 jours ouvrés avec une proposition pour votre structure : devis, facture pour un paiement par virement ou places d’essai.',
    `Vous pouvez déjà découvrir le site avec l’offre gratuite : ${link('/entrainement')}.`,
    'Si vous n’avez pas fait cette demande, vous pouvez ignorer cet email.',
  ]);

export const organizationMemberRemovedMail = (to: string, organizationName: string) =>
  layout(
    to,
    'Votre accès offert par une structure est terminé',
    [
      'Bonjour,',
      `${organizationName} a mis fin à l’accès Premium qu’elle vous offrait. Votre compte, votre progression et l’offre gratuite restent disponibles.`,
      'Si vous pensez que c’est une erreur, contactez directement la structure qui vous accompagne.',
    ],
    { label: 'Continuer avec l’offre gratuite', url: link('/entrainement') },
  );

export const examFollowUpMail = (to: string) =>
  layout(
    to,
    'Comment s’est passé votre examen ?',
    [
      'Bonjour,',
      'La date de votre examen civique est passée. Nous espérons qu’il s’est bien passé.',
      'Si le site vous a aidé, ou s’il pourrait être meilleur, votre avis compte : il aide d’autres candidats à se préparer. Il est publié seulement avec votre accord, après relecture, et vous pouvez le retirer à tout moment.',
      // Les avis publics (Google, Trustpilot…) sont ceux que lisent les candidats qui ne nous connaissent pas encore.
      ...(config.reviewUrl ? [`Vous pouvez aussi laisser un avis public, que d’autres candidats pourront lire : ${config.reviewUrl}`] : []),
      'Vous recevez cet email parce que vous avez accepté les emails d’information. Vous pouvez changer ce choix dans votre compte.',
    ],
    { label: 'Donner mon avis', url: link('/espace/temoignage') },
  );
