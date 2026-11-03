'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Field, FormAlert } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';
import { formatPrice, frenchDateFormat, organizationKindLabel } from '@/lib/labels';
import type { OrganizationSpace } from '@/lib/types';

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const date = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : '—');
const SOURCE: Record<string, string> = { commande: 'Commande en ligne', virement: 'Virement', pilote: 'Places d’essai' };

// Chiffre du groupe masqué par l'API : il laisserait reconnaître une personne qui ne partage pas sa progression.
const MASKED = 'Masqué';
const outOf = (value: number | null, total: number) => (value === null ? MASKED : `${value} / ${total}`);
const groupMasked = (group: NonNullable<OrganizationSpace['group']>) =>
  group.activeLast7Days === null || group.withExam === null || group.weakTopics === null || (group.averageBestExam === null && group.withExam !== 0);

/** Espace de la structure : places, lien d'invitation, suivi du groupe et des personnes qui partagent leur progression. */
export function OrganizationDashboard({ initial }: { initial: OrganizationSpace }) {
  const [space, setSpace] = useState(initial);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setSpace(await send<OrganizationSpace>('GET', '/api/organizations/mine'));
  }

  async function act(action: () => Promise<unknown>, success: string) {
    setNotice(null);
    try {
      await action();
      await refresh();
      setNotice({ tone: 'success', text: success });
    } catch (caught) {
      setNotice({ tone: 'error', text: errorMessage(caught) });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(space.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice({ tone: 'error', text: 'Copie impossible : sélectionnez le lien et copiez-le à la main.' });
    }
  }

  const usedRatio = space.seats.total > 0 ? space.seats.used / space.seats.total : 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {notice && <FormAlert tone={notice.tone}>{notice.text}</FormAlert>}
      {space.status === 'SUSPENDED' && (
        <FormAlert>Cet espace est suspendu : les places ne peuvent plus être activées. Écrivez-nous depuis la page Contact.</FormAlert>
      )}

      <section aria-labelledby="places" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <h2 id="places" className="text-[1.375rem]">
          Places
        </h2>
        <p className="mt-2 text-[1.125rem]">
          <strong className="font-titre text-[2rem]">{space.seats.used}</strong> place{space.seats.used > 1 ? 's' : ''} activée
          {space.seats.used > 1 ? 's' : ''} sur {space.seats.total} · <strong>{space.seats.free}</strong> disponible{space.seats.free > 1 ? 's' : ''}
        </p>
        <div
          className="mt-3 h-3 overflow-hidden rounded-full bg-ligne"
          role="img"
          aria-label={`${space.seats.used} places activées sur ${space.seats.total}`}
        >
          <div className="h-full rounded-full bg-[var(--color-graphe)]" style={{ width: `${Math.min(100, usedRatio * 100)}%` }} />
        </div>
        {space.seats.total > 0 && space.seats.free === 0 && (
          <p className="mt-3 text-petit">
            Toutes les places sont prises.{' '}
            <Link href="/associations/commande" className="font-bold text-sapin-700 underline underline-offset-4">
              Ajouter des places
            </Link>
          </p>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer text-petit font-bold text-sapin-700">Détail des packs</summary>
          <ul className="mt-2 divide-y divide-ligne rounded-carte border border-ligne text-petit">
            {space.licenses.map((license) => (
              <li key={license.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>
                  <strong>{license.seats} places</strong> · {SOURCE[license.source] ?? license.source}
                  {license.priceCents > 0 && ` · ${formatPrice(license.priceCents)} TTC`} · {Math.round(license.seatDays / 30)} mois d’accès par
                  personne
                </span>
                <span className="text-encre-doux">
                  {license.used} activée{license.used > 1 ? 's' : ''} ·{' '}
                  {license.revokedAt ? 'pack clos' : license.open ? `à activer avant le ${date(license.validUntil)}` : 'délai d’activation passé'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="invitation" className="rounded-carte border-2 border-sapin-700 bg-white p-6 shadow-carte">
        <h2 id="invitation" className="text-[1.375rem]">
          Inviter les personnes que vous accompagnez
        </h2>
        <p className="mt-2 text-encre-doux">
          Partagez ce lien par WhatsApp, SMS ou email, ou imprimez l’affiche avec son QR code. Chaque personne crée un compte gratuit puis
          active sa place.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="break-all rounded-bouton border-2 border-ligne bg-papier px-3 py-2 text-petit">{space.inviteUrl}</code>
          <button type="button" onClick={copy} className={buttonClasses('primary', 'min-h-11 text-petit')}>
            {copied ? 'Lien copié' : 'Copier le lien'}
          </button>
        </div>
        <p className="mt-3 text-petit">
          Code à dicter : <strong className="font-titre text-[1.25rem] tracking-[0.2em]">{space.inviteCode}</strong>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/espace/structure/affiche" className={buttonClasses('secondary', 'min-h-11 text-petit')}>
            Imprimer l’affiche avec QR code
          </Link>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Créer un nouveau lien ? L’ancien lien cessera de fonctionner. Les places déjà activées ne changent pas.')) {
                void act(() => send('POST', '/api/organizations/mine/invite-code'), 'Nouveau lien créé : l’ancien ne fonctionne plus.');
              }
            }}
            className={buttonClasses('quiet', 'min-h-11 text-petit')}
          >
            Le lien a trop circulé ? Créer un nouveau lien
          </button>
        </div>
      </section>

      <section aria-labelledby="groupe" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <h2 id="groupe" className="text-[1.375rem]">
          Votre groupe
        </h2>
        {space.group ? (
          <>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Tile label="Actives cette semaine" value={outOf(space.group.activeLast7Days, space.members.length)} />
              <Tile label="Ont passé un examen blanc" value={outOf(space.group.withExam, space.members.length)} />
              <Tile
                label="Meilleur examen blanc, en moyenne"
                value={
                  space.group.averageBestExam !== null
                    ? `${space.group.averageBestExam.toFixed(1).replace('.', ',')} / 40`
                    : space.group.withExam === 0
                      ? '—'
                      : MASKED
                }
              />
            </dl>
            {space.group.weakTopics === null ? (
              <p className="mt-4">
                Thèmes à retravailler en groupe : <strong>{MASKED}</strong>.
              </p>
            ) : (
              space.group.weakTopics.length > 0 && (
                <p className="mt-4">
                  Thèmes à retravailler en groupe :{' '}
                  {space.group.weakTopics.map((topic, index) => (
                    <span key={topic.title}>
                      {index > 0 && ', '}
                      <strong>{topic.title}</strong> ({topic.count} personne{topic.count > 1 ? 's' : ''})
                    </span>
                  ))}
                  .
                </p>
              )
            )}
            {groupMasked(space.group) && (
              <p className="mt-3 text-petit text-encre-doux">
                « {MASKED} » : ce chiffre n’apparaît que si les personnes qui ne partagent pas leur progression y sont au moins{' '}
                {space.minGroupForAverages}, ou aucune. Sinon, on pourrait retrouver la situation de l’une d’elles en comparant avec le détail
                des autres.
              </p>
            )}
            <p className="mt-3 text-petit text-encre-doux">
              Ces chiffres portent sur tout le groupe, sans nom : personne n’y est reconnaissable. L’examen blanc compte 40 questions ; il en faut
              32 pour atteindre le seuil.
            </p>
          </>
        ) : (
          <p className="mt-2 text-encre-doux">
            Les chiffres du groupe apparaissent à partir de {space.minGroupForAverages} personnes, pour que personne n’y soit reconnaissable.
          </p>
        )}
      </section>

      <section aria-labelledby="personnes" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <h2 id="personnes" className="text-[1.375rem]">
          Personnes ({space.members.length})
        </h2>
        <p className="mt-2 text-petit text-encre-doux">
          Vous voyez le détail seulement pour les personnes qui ont accepté de partager leur progression. Les autres apparaissent avec un email
          masqué.
        </p>
        {space.members.length === 0 ? (
          <p className="mt-4">Personne n’a encore activé de place. Partagez le lien d’invitation pour commencer.</p>
        ) : (
          <div className="relative mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-left text-petit">
              <thead>
                <tr className="bg-papier">
                  <th scope="col" className="px-3 py-2">Personne</th>
                  <th scope="col" className="px-3 py-2">Place activée</th>
                  <th scope="col" className="px-3 py-2">Questions travaillées</th>
                  <th scope="col" className="px-3 py-2">Meilleur examen blanc</th>
                  <th scope="col" className="px-3 py-2">Dernière activité</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {space.members.map((member) => (
                  <tr key={member.id} className="border-b border-ligne align-top">
                    <td className="px-3 py-2">
                      <span className="font-bold">{member.email}</span>
                      {member.progress && member.progress.weakTopics.length > 0 && (
                        <span className="block text-encre-doux">À revoir : {member.progress.weakTopics.join(', ')}</span>
                      )}
                      {!member.shared && <span className="block text-encre-doux">Ne partage pas sa progression</span>}
                    </td>
                    <td className="px-3 py-2">
                      {shortDate.format(new Date(member.joinedAt))}
                      {member.accessUntil && <span className="block text-encre-doux">accès jusqu’au {date(member.accessUntil)}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {member.progress ? `${member.progress.answered} (dont ${member.progress.mastered} maîtrisées)` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {member.progress ? (member.progress.bestExam === null ? 'Pas encore' : `${member.progress.bestExam} / 40`) : '—'}
                    </td>
                    <td className="px-3 py-2">{member.progress ? date(member.progress.lastActivityAt) : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Retirer ${member.email} ? Son accès Premium s’arrête aujourd’hui et la place redevient disponible. La personne est prévenue par email.`,
                            )
                          ) {
                            void act(() => send('DELETE', `/api/organizations/mine/members/${member.id}`), 'La personne est retirée : la place est de nouveau disponible.');
                          }
                        }}
                        className="font-bold text-brique-700 underline underline-offset-4"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="structure" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <h2 id="structure" className="text-[1.375rem]">
          Votre structure
        </h2>
        <OrganizationDetailsForm space={space} onSaved={() => act(async () => undefined, 'Informations enregistrées.')} />
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-carte bg-papier p-4">
      <dt className="text-petit text-encre-doux">{label}</dt>
      <dd className="mt-1 font-titre text-[1.75rem] font-semibold leading-none">{value}</dd>
    </div>
  );
}

function OrganizationDetailsForm({ space, onSaved }: { space: OrganizationSpace; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: space.name,
    city: space.city ?? '',
    registration: space.registration ?? '',
    contactName: space.contactName,
  });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setFields({});
    try {
      await send('PATCH', '/api/organizations/mine', {
        name: form.name,
        city: form.city || null,
        registration: form.registration || null,
        contactName: form.contactName,
      });
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof RequestError) setFields(caught.fields);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="mt-4 grid gap-4">
      <p className="text-petit text-encre-doux">{organizationKindLabel[space.kind] ?? space.kind}</p>
      {error && <FormAlert>{error}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de la structure" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={fields.name} />
        <Field label="Ville" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} error={fields.city} />
        <Field
          label="Numéro RNA ou SIRET"
          value={form.registration}
          onChange={(event) => setForm({ ...form, registration: event.target.value })}
          error={fields.registration}
        />
        <Field
          label="Personne de contact"
          value={form.contactName}
          onChange={(event) => setForm({ ...form, contactName: event.target.value })}
          error={fields.contactName}
        />
      </div>
      <div>
        <button type="submit" disabled={sending} className={buttonClasses('secondary', 'min-h-11 text-petit')}>
          {sending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
