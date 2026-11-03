'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { buttonClasses } from '@/components/button';
import { Checkbox, Field, FormAlert, PasswordField } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';
import { formatPrice, frenchDateFormat } from '@/lib/labels';
import type { Account, OrderStatus } from '@/lib/types';

type PathOption = { slug: string; title: string };

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric' });
const price = (cents: number, currency: string) => formatPrice(cents, currency);

const ORDER_STATUS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
  FAILED: 'Échouée',
  EXPIRED: 'Abandonnée',
  REFUNDED: 'Remboursée',
};

/** Profil et abonnement (E16) : démarche, emails, mot de passe, achats, export et suppression des données (RGPD). */
export function AccountSettings({ account, paths }: { account: Account; paths: PathOption[] }) {
  return (
    <div className="mt-8 grid gap-6">
      <Section title="Ma démarche et mes rappels" id="demarche">
        <ProfileForm account={account} paths={paths} />
      </Section>
      <Section title="Adresse email" id="email">
        <ChangeEmailForm email={account.email} />
      </Section>
      <Section title="Mot de passe" id="mot-de-passe">
        <ChangePasswordForm />
      </Section>
      <Section title="Mes achats" id="achats">
        <Orders account={account} />
      </Section>
      <Section title="Structure qui m’accompagne" id="structure">
        <Memberships account={account} />
      </Section>
      <Section title="Mes données" id="donnees">
        <p>
          Téléchargez toutes les données de votre compte : profil, progression, favoris, examens blancs, achats et messages. Le fichier
          est au format JSON, lisible par d’autres services.
        </p>
        <a href="/api/account/export" download className={buttonClasses('secondary', 'mt-4')}>
          Télécharger mes données
        </a>
      </Section>
      <Section title="Supprimer mon compte" id="suppression" danger>
        {account.ownedOrganization ? (
          <p>
            Vous gérez l’espace de votre structure, <strong>{account.ownedOrganization}</strong>. Pour supprimer votre compte, confiez d’abord cet espace à une autre
            personne :{' '}
            <a href="/contact" className="font-bold text-sapin-700 underline underline-offset-4">
              écrivez-nous
            </a>
            .
          </p>
        ) : (
          <DeleteAccountForm hasOrders={account.orders.length > 0} />
        )}
      </Section>
    </div>
  );
}

function Section({ title, id, danger = false, children }: { title: string; id: string; danger?: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`rounded-carte border bg-white p-6 shadow-carte ${danger ? 'border-brique-200' : 'border-ligne'}`}>
      <h2 id={id} className="text-[1.375rem]">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function useSubmit() {
  const [state, setState] = useState<{ sending: boolean; error: string | null; fields: Record<string, string>; done: string | null }>({
    sending: false,
    error: null,
    fields: {},
    done: null,
  });
  async function run(action: () => Promise<unknown>, success: string) {
    setState({ sending: true, error: null, fields: {}, done: null });
    try {
      await action();
      setState({ sending: false, error: null, fields: {}, done: success });
      return true;
    } catch (caught) {
      setState({ sending: false, error: errorMessage(caught), fields: caught instanceof RequestError ? caught.fields : {}, done: null });
      return false;
    }
  }
  return { ...state, run };
}

function Feedback({ error, done }: { error: string | null; done: string | null }) {
  if (error) return <FormAlert>{error}</FormAlert>;
  if (done) return <FormAlert tone="success">{done}</FormAlert>;
  return null;
}

function ProfileForm({ account, paths }: { account: Account; paths: PathOption[] }) {
  const [pathSlug, setPathSlug] = useState(account.path?.slug ?? paths[0]?.slug ?? '');
  const [marketing, setMarketing] = useState(account.marketingConsentAt !== null);
  const [reminders, setReminders] = useState(account.reminderOptInAt !== null);
  const [examDate, setExamDate] = useState(account.examDate?.slice(0, 10) ?? '');
  const submit = useSubmit();

  function save(event: FormEvent) {
    event.preventDefault();
    void submit.run(
      () =>
        send('PATCH', '/api/account', {
          pathSlug: pathSlug || undefined,
          marketingConsent: marketing,
          reminders,
          examDate: examDate || null,
        }),
      'Vos choix sont enregistrés.',
    );
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <Feedback error={submit.error} done={submit.done} />
      {paths.length > 0 && (
        <div>
          <label htmlFor="parcours-compte" className="font-bold">
            Démarche préparée
          </label>
          <select
            id="parcours-compte"
            value={pathSlug}
            onChange={(event) => setPathSlug(event.target.value)}
            className="mt-1.5 block min-h-12 w-full max-w-md rounded-bouton border-2 border-ligne bg-white px-3 text-courant"
          >
            {paths.map((path) => (
              <option key={path.slug} value={path.slug}>
                {path.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="grid max-w-xs gap-1.5 font-bold">
        Date de mon examen (facultatif)
        <span className="text-petit font-normal text-encre-doux">Pour vous proposer un rythme de révision. Ce n’est pas une prédiction.</span>
        <input
          type="date"
          value={examDate}
          onChange={(event) => setExamDate(event.target.value)}
          className="min-h-12 rounded-bouton border-2 border-ligne bg-white px-3 font-normal"
        />
      </label>
      <Checkbox checked={reminders} onChange={(event) => setReminders(event.target.checked)}>
        Me prévenir par email quand des questions sont à revoir (une fois par semaine au plus). Un lien dans chaque email permet de
        l’arrêter.
      </Checkbox>
      <Checkbox checked={marketing} onChange={(event) => setMarketing(event.target.checked)}>
        Recevoir par email des conseils de révision et des offres. Vous pouvez changer d’avis à tout moment.
      </Checkbox>
      <div>
        <button type="submit" disabled={submit.sending} className={buttonClasses('primary')}>
          {submit.sending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

function ChangeEmailForm({ email }: { email: string }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = useSubmit();

  async function save(event: FormEvent) {
    event.preventDefault();
    const ok = await submit.run(
      () => send('POST', '/api/auth/change-email', { newEmail, password }),
      'Si cette adresse est disponible, vous allez y recevoir un lien de confirmation. Votre adresse actuelle reste active en attendant.',
    );
    if (ok) setPassword('');
  }

  return (
    <form onSubmit={save} className="grid max-w-md gap-4">
      <p>
        Adresse actuelle : <strong>{email}</strong>
      </p>
      <Feedback error={submit.error} done={submit.done} />
      <Field label="Nouvelle adresse email" type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} error={submit.fields.newEmail} />
      <PasswordField label="Mot de passe actuel" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <div>
        <button type="submit" disabled={submit.sending} className={buttonClasses('secondary')}>
          {submit.sending ? 'Envoi…' : 'Changer d’adresse'}
        </button>
      </div>
    </form>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const submit = useSubmit();

  async function save(event: FormEvent) {
    event.preventDefault();
    const ok = await submit.run(
      () => send('POST', '/api/account/password', { currentPassword, newPassword }),
      'Votre mot de passe est changé. Vos autres appareils sont déconnectés.',
    );
    if (ok) {
      setCurrentPassword('');
      setNewPassword('');
    }
  }

  return (
    <form onSubmit={save} className="grid max-w-md gap-4">
      <Feedback error={submit.error} done={submit.done} />
      <PasswordField label="Mot de passe actuel" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      <PasswordField
        label="Nouveau mot de passe"
        autoComplete="new-password"
        hint="10 caractères au moins."
        required
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        error={submit.fields.newPassword}
      />
      <div>
        <button type="submit" disabled={submit.sending} className={buttonClasses('secondary')}>
          {submit.sending ? 'Enregistrement…' : 'Changer mon mot de passe'}
        </button>
      </div>
    </form>
  );
}

function Orders({ account }: { account: Account }) {
  return (
    <>
      {account.premium.active && account.premium.until ? (
        <p>
          Accès Premium actif jusqu’au <strong>{dateFormat.format(new Date(account.premium.until))}</strong>. Il s’arrête seul : aucun
          renouvellement automatique.
        </p>
      ) : (
        <p>Vous utilisez l’offre gratuite.</p>
      )}
      {account.orders.length > 0 ? (
        <ul className="mt-4 divide-y divide-ligne rounded-carte border border-ligne">
          {account.orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <span>
                <strong>{order.plan.name}</strong>
                {order.organization && ` pour ${order.organization.name}`} · {price(order.amountCents, order.currency)} TTC
                {order.paidAt && <span className="text-encre-doux"> · payé le {dateFormat.format(new Date(order.paidAt))}</span>}
              </span>
              <span className="text-petit text-encre-doux">
                {ORDER_STATUS[order.status]} · commande {order.id.slice(0, 8)} ·{' '}
                <a href={`/espace/compte/commandes/${order.id}`} className="text-sapin-700 underline underline-offset-4">
                  reçu
                </a>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {account.extension.available && <ExtensionOffer days={account.extension.days} />}
      <p className="mt-4 text-petit text-encre-doux">
        Le reçu de chaque paiement est envoyé par email par notre prestataire de paiement. Une question sur un achat ?{' '}
        <a href="/contact" className="text-sapin-700 underline underline-offset-4">
          Écrivez-nous
        </a>
        .
      </p>
    </>
  );
}

/** Prolongation gratuite, une fois, si le rendez-vous en préfecture est repoussé. */
function ExtensionOffer({ days }: { days: number }) {
  const submit = useSubmit();
  const [until, setUntil] = useState<string | null>(null);

  async function extend() {
    if (!window.confirm(`Prolonger votre pass de ${days} jours ? Cette prolongation gratuite n’est possible qu’une fois.`)) return;
    await submit.run(async () => {
      const result = await send<{ expiresAt: string }>('POST', '/api/account/premium/extension');
      setUntil(result.expiresAt);
    }, 'Votre pass est prolongé.');
  }

  if (until) {
    return (
      <div className="mt-4">
        <FormAlert tone="success">Votre pass est prolongé jusqu’au {dateFormat.format(new Date(until))}.</FormAlert>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-carte bg-papier p-4">
      <p className="font-bold">Votre examen est repoussé ?</p>
      <p className="mt-1 text-petit">
        Prolongez gratuitement votre pass de {days} jours, une fois. Rien n’est prélevé : il s’arrête toujours seul.
      </p>
      {submit.error && (
        <div className="mt-3">
          <FormAlert>{submit.error}</FormAlert>
        </div>
      )}
      <button type="button" onClick={extend} disabled={submit.sending} className={buttonClasses('secondary', 'mt-3 min-h-11 text-petit')}>
        {submit.sending ? 'Prolongation…' : `Prolonger de ${days} jours`}
      </button>
    </div>
  );
}

/** Place offerte par une structure : ce que la personne partage, et la possibilité de partir. */
function Memberships({ account }: { account: Account }) {
  const [memberships, setMemberships] = useState(account.memberships);
  const submit = useSubmit();

  async function toggle(id: number, shareProgress: boolean) {
    const ok = await submit.run(
      () => send('PATCH', `/api/account/memberships/${id}`, { shareProgress }),
      shareProgress ? 'Votre progression est partagée avec la structure.' : 'Votre progression n’est plus partagée.',
    );
    if (ok) setMemberships((current) => current.map((member) => (member.id === id ? { ...member, shareProgress } : member)));
  }

  async function leave(id: number, name: string) {
    if (!window.confirm(`Quitter ${name} ? L’accès Premium offert s’arrête aujourd’hui et votre place est rendue à la structure.`)) return;
    const ok = await submit.run(() => send('DELETE', `/api/account/memberships/${id}`), `Vous avez quitté ${name}.`);
    if (ok) setMemberships((current) => current.filter((member) => member.id !== id));
  }

  return (
    <div className="grid gap-4">
      {account.ownedOrganization && (
        <p>
          Vous gérez l’espace de votre structure, <strong>{account.ownedOrganization}</strong>.{' '}
          <a href="/espace/structure" className="font-bold text-sapin-700 underline underline-offset-4">
            Ouvrir l’espace de ma structure
          </a>
        </p>
      )}
      <Feedback error={submit.error} done={submit.done} />
      {memberships.length === 0 ? (
        <p>
          Une association ou un centre de formation vous a donné un code ?{' '}
          <a href="/rejoindre" className="font-bold text-sapin-700 underline underline-offset-4">
            Activer ma place
          </a>
        </p>
      ) : (
        memberships.map((member) => (
          <div key={member.id} className="rounded-carte border border-ligne p-4">
            <p>
              <strong>{member.organizationName}</strong> vous offre l’accès Premium jusqu’au {dateFormat.format(new Date(member.accessUntil))}.
            </p>
            <div className="mt-3">
              <Checkbox checked={member.shareProgress} onChange={(event) => void toggle(member.id, event.target.checked)} disabled={submit.sending}>
                Partager mon email et ma progression avec {member.organizationName}. Sinon, la structure voit seulement mon email masqué et la date
                d’activation.
              </Checkbox>
            </div>
            <button
              type="button"
              onClick={() => void leave(member.id, member.organizationName)}
              disabled={submit.sending}
              className="mt-3 text-petit font-bold text-brique-700 underline underline-offset-4"
            >
              Quitter cette structure
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function DeleteAccountForm({ hasOrders }: { hasOrders: boolean }) {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const submit = useSubmit();

  async function remove(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return;
    const ok = await submit.run(() => send('DELETE', '/api/account', { password }), 'Votre compte est supprimé.');
    if (ok) window.location.assign('/?compte=supprime');
  }

  return (
    <form onSubmit={remove} className="grid max-w-md gap-4">
      <p>
        Votre progression, vos favoris et vos examens blancs sont effacés définitivement.
        {hasOrders && ' Vos factures sont gardées le temps exigé par la loi comptable, sans lien avec votre adresse email.'}
      </p>
      <Feedback error={submit.error} done={null} />
      <PasswordField label="Mot de passe" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>
        Je comprends que la suppression est définitive.
      </Checkbox>
      <div>
        <button type="submit" disabled={submit.sending || !confirmed || !password} className={buttonClasses('primary', 'bg-brique-700 hover:bg-[#8f3523]')}>
          {submit.sending ? 'Suppression…' : 'Supprimer mon compte'}
        </button>
      </div>
    </form>
  );
}
