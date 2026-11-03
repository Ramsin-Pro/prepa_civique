import nodemailer from 'nodemailer';
import { config } from '../config.js';

export type Mail = { to: string; subject: string; text: string; html: string };

/** Emails non envoyés (tests, ou SMTP absent en développement), consultables par les tests. */
export const outbox: Mail[] = [];

// Serveur d'emails local (Mailpit, dans Docker ou sur le poste) : connexion sans chiffrement acceptée.
const LOCAL_SMTP_HOSTS = ['mail', 'localhost', '127.0.0.1'];
const host = config.mail.host;
// En production, un serveur distant doit chiffrer la connexion (STARTTLS obligatoire, TLS 1.2 au moins) :
// les emails contiennent des liens de connexion à usage unique.
const tlsRequired = config.production && host !== undefined && !LOCAL_SMTP_HOSTS.includes(host.toLowerCase());

const transport = host
  ? nodemailer.createTransport({
      host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      requireTLS: tlsRequired,
      tls: tlsRequired ? { minVersion: 'TLSv1.2' } : undefined,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password ?? '' } : undefined,
    })
  : null;

/** « Repère <no-reply@domaine.fr> » → nom et adresse, comme les attend l'API de Brevo. */
export function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return match ? { ...(match[1] ? { name: match[1].replace(/^"|"$/g, '') } : {}), email: match[2]! } : { email: from.trim() };
}

/** Envoi par l'API HTTP de Brevo (port 443) : fonctionne là où les ports SMTP sont fermés. */
async function sendWithBrevo(mail: Mail, apiKey: string): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: parseSender(config.mail.from),
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  // Le corps d'une erreur Brevo décrit la requête, jamais l'email : on peut le journaliser.
  if (!res.ok) throw new Error(`Brevo a répondu ${res.status} : ${(await res.text()).slice(0, 300)}`);
}

/** Envoi par l'API HTTP de Resend (port 443). L'expéditeur s'écrit tel quel : « Repère <no-reply@domaine.fr> ». */
async function sendWithResend(mail: Mail, apiKey: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: config.mail.from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    signal: AbortSignal.timeout(10_000),
  });
  // Le corps d'une erreur Resend décrit la requête, jamais l'email : on peut le journaliser.
  if (!res.ok) throw new Error(`Resend a répondu ${res.status} : ${(await res.text()).slice(0, 300)}`);
}

/** Envoie un email transactionnel. Une panne d'envoi est journalisée sans faire échouer la requête. */
export async function sendMail(mail: Mail): Promise<void> {
  if (config.env === 'test') {
    outbox.push(mail);
    return;
  }
  const { resendApiKey, brevoApiKey } = config.mail;
  if (resendApiKey || brevoApiKey) {
    try {
      if (resendApiKey) await sendWithResend(mail, resendApiKey);
      else await sendWithBrevo(mail, brevoApiKey!);
    } catch (error) {
      console.error(`Échec de l'envoi de l'email « ${mail.subject} » :`, error);
    }
    return;
  }
  if (!transport) {
    // Production sans SMTP : ni le contenu (liens à usage unique) ni le destinataire ne vont dans les journaux.
    if (config.production) {
      console.error(`[email non envoyé : SMTP non configuré] « ${mail.subject} »`);
      return;
    }
    outbox.push(mail);
    console.info(`[email non envoyé : SMTP non configuré] À ${mail.to} : ${mail.subject}\n${mail.text}\n`);
    return;
  }
  try {
    await transport.sendMail({ from: config.mail.from, ...mail });
  } catch (error) {
    console.error(`Échec de l'envoi de l'email « ${mail.subject} » :`, error);
  }
}

/**
 * Envoi sans attendre le serveur d'emails : la durée de la réponse ne dépend pas de l'envoi, et ne trahit donc pas
 * si une adresse a un compte. Une panne est journalisée. En test, l'email est dans la boîte d'envoi dès le retour.
 */
export function sendMailInBackground(mail: Mail): void {
  sendMail(mail).catch((error: unknown) => console.error(`Échec de l'envoi de l'email « ${mail.subject} » :`, error));
}
