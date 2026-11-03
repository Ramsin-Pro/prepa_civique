'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { send } from '@/lib/client';
import { organizationKindLabel, plural } from '@/lib/labels';
import {
  Card,
  ErrorNotice,
  Loading,
  PageTitle,
  SuccessNotice,
  TableWrap,
  formatDate,
  formatDateTime,
  formatMoney,
  inputSmall,
  selectClasses,
  smallButton,
  smallDanger,
  smallPrimary,
  tableClasses,
  tdClasses,
  textareaClasses,
  thClasses,
  useAction,
  useApi,
  useRights,
} from '../ui';

// Associations et structures (offre de packs de places) : demandes, structures, packs réglés par virement ou offerts.

type RequestStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED';
type OrganizationRequest = {
  id: number;
  organizationName: string;
  kind: string;
  city: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  seats: number;
  wish: 'devis' | 'virement' | 'pilote';
  message: string | null;
  status: RequestStatus;
  createdAt: string;
};
type Seats = { total: number; used: number; free: number };
type OrganizationRow = {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  contactName: string;
  createdAt: string;
  owner: { id: string; email: string };
  seats: Seats;
  revenueCents: number;
};
type OrganizationDetail = Omit<OrganizationRow, 'revenueCents'> & {
  registration: string | null;
  inviteCode: string;
  licenses: {
    id: number;
    seats: number;
    seatDays: number;
    validUntil: string;
    priceCents: number;
    source: string;
    note: string | null;
    orderId: string | null;
    revokedAt: string | null;
    createdAt: string;
    used: number;
  }[];
  members: { id: number; joinedAt: string; removedAt: string | null; shareProgressAt: string | null; user: { id: string; email: string } }[];
};

const REQUEST_STATUS: Record<RequestStatus, string> = { NEW: 'Nouvelle', CONTACTED: 'Contactée', CONVERTED: 'Convertie', CLOSED: 'Close' };
const WISH: Record<OrganizationRequest['wish'], string> = { devis: 'Devis', virement: 'Facture / virement', pilote: 'Places d’essai' };
const ORG_STATUS: Record<OrganizationRow['status'], string> = { PENDING: 'En attente de paiement', ACTIVE: 'Active', SUSPENDED: 'Suspendue' };
const SOURCE: Record<string, string> = { commande: 'Commande en ligne', virement: 'Virement', pilote: 'Essai offert' };
const KINDS = Object.keys(organizationKindLabel);

export function OrganizationsAdmin() {
  const rights = useRights();
  const [status, setStatus] = useState<RequestStatus | ''>('NEW');
  const requests = useApi<OrganizationRequest[]>(`/api/admin/organization-requests${status ? `?status=${status}` : ''}`);
  const organizations = useApi<OrganizationRow[]>('/api/admin/organizations');
  const action = useAction();
  const [draft, setDraft] = useState<OrganizationRequest | null>(null);

  async function setRequestStatus(request: OrganizationRequest, next: RequestStatus) {
    if (await action.run(() => send('PATCH', `/api/admin/organization-requests/${request.id}`, { status: next }), 'Demande mise à jour.')) requests.reload();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      name: String(form.get('name')),
      kind: String(form.get('kind')),
      city: String(form.get('city') || '') || undefined,
      registration: String(form.get('registration') || '') || undefined,
      contactName: String(form.get('contactName')),
      ownerEmail: String(form.get('ownerEmail')),
      requestId: draft?.id,
    };
    let created: { id: string; invited: boolean } | null = null;
    const ok = await action.run(async () => {
      created = await send<{ id: string; invited: boolean }>('POST', '/api/admin/organizations', payload);
    });
    if (ok && created) {
      const { id, invited } = created as { id: string; invited: boolean };
      window.location.assign(`/admin/associations/${id}${invited ? '?invite=1' : ''}`);
    }
  }

  return (
    <>
      <PageTitle
        title="Associations et structures"
        description="Demandes de devis, de facture ou d’essai, et structures qui offrent des places Premium aux personnes qu’elles accompagnent."
      />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}

      <Card title="Demandes reçues" className="mt-4">
        <label className="flex items-center gap-2 text-petit">
          Afficher
          <select value={status} onChange={(event) => setStatus(event.target.value as RequestStatus | '')} className={selectClasses}>
            <option value="NEW">Nouvelles</option>
            <option value="CONTACTED">Contactées</option>
            <option value="CONVERTED">Converties</option>
            <option value="CLOSED">Closes</option>
            <option value="">Toutes</option>
          </select>
        </label>
        {requests.error && <ErrorNotice message={requests.error} />}
        {!requests.data && !requests.error && <Loading />}
        {requests.data && requests.data.length === 0 && <p className="mt-3 text-petit text-encre-doux">Aucune demande.</p>}
        {requests.data && requests.data.length > 0 && (
          <TableWrap>
            <table className={tableClasses}>
              <thead>
                <tr>
                  <th className={thClasses}>Structure</th>
                  <th className={thClasses}>Contact</th>
                  <th className={thClasses}>Souhait</th>
                  <th className={thClasses}>Statut</th>
                  <th className={thClasses}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.data.map((request) => (
                  <tr key={request.id}>
                    <td className={tdClasses}>
                      <strong>{request.organizationName}</strong>
                      <span className="block text-encre-doux">
                        {organizationKindLabel[request.kind] ?? request.kind}
                        {request.city ? ` · ${request.city}` : ''} · {formatDateTime(request.createdAt)}
                      </span>
                      {request.message && <span className="mt-1 block whitespace-pre-line">«&nbsp;{request.message}&nbsp;»</span>}
                    </td>
                    <td className={tdClasses}>
                      {request.contactName}
                      <a href={`mailto:${request.email}`} className="block text-sapin-700 underline underline-offset-4">
                        {request.email}
                      </a>
                      {request.phone && <span className="block">{request.phone}</span>}
                    </td>
                    <td className={tdClasses}>
                      {WISH[request.wish]}
                      <span className="block text-encre-doux">{request.seats} personnes</span>
                    </td>
                    <td className={tdClasses}>{REQUEST_STATUS[request.status]}</td>
                    <td className={`${tdClasses} whitespace-nowrap`}>
                      <div className="flex flex-col items-start gap-1.5">
                        {request.status === 'NEW' && (
                          <button type="button" onClick={() => setRequestStatus(request, 'CONTACTED')} disabled={action.pending} className={smallButton}>
                            Marquer contactée
                          </button>
                        )}
                        {rights.superAdmin && request.status !== 'CONVERTED' && (
                          <button type="button" onClick={() => setDraft(request)} className={smallPrimary}>
                            Créer la structure
                          </button>
                        )}
                        {request.status !== 'CLOSED' && request.status !== 'CONVERTED' && (
                          <button type="button" onClick={() => setRequestStatus(request, 'CLOSED')} disabled={action.pending} className={smallButton}>
                            Clore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {rights.superAdmin && (
        <Card title={draft ? `Nouvelle structure : ${draft.organizationName}` : 'Nouvelle structure (virement ou essai)'} className="mt-6">
          <p className="text-petit text-encre-doux">
            Pour une commande payée par virement ou des places d’essai. Si le coordinateur n’a pas de compte, il est créé et reçoit un lien pour
            choisir son mot de passe. Ajoutez ensuite les places depuis la fiche de la structure.
          </p>
          <form key={draft?.id ?? 'vide'} onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-petit font-bold sm:col-span-2">
              Nom de la structure
              <input name="name" required minLength={2} defaultValue={draft?.organizationName} className={`${inputSmall} font-normal`} />
            </label>
            <label className="grid gap-1 text-petit font-bold">
              Type
              <select name="kind" defaultValue={draft?.kind ?? 'association'} className={`${selectClasses} font-normal`}>
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {organizationKindLabel[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-petit font-bold">
              Ville
              <input name="city" defaultValue={draft?.city ?? ''} className={`${inputSmall} font-normal`} />
            </label>
            <label className="grid gap-1 text-petit font-bold">
              RNA ou SIRET
              <input name="registration" className={`${inputSmall} font-normal`} />
            </label>
            <label className="grid gap-1 text-petit font-bold">
              Personne de contact
              <input name="contactName" required minLength={2} defaultValue={draft?.contactName} className={`${inputSmall} font-normal`} />
            </label>
            <label className="grid gap-1 text-petit font-bold sm:col-span-2">
              Email du coordinateur (compte qui gère les places)
              <input name="ownerEmail" type="email" required defaultValue={draft?.email} className={`${inputSmall} font-normal`} />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={action.pending} className={smallPrimary}>
                Créer la structure
              </button>
              {draft && (
                <button type="button" onClick={() => setDraft(null)} className={smallButton}>
                  Annuler
                </button>
              )}
            </div>
          </form>
        </Card>
      )}

      <h2 className="mt-10 font-texte text-[1.25rem] font-bold tracking-normal">Structures</h2>
      {organizations.error && <ErrorNotice message={organizations.error} />}
      {!organizations.data && !organizations.error && <Loading />}
      {organizations.data && organizations.data.length === 0 && <p className="mt-2 text-petit text-encre-doux">Aucune structure pour l’instant.</p>}
      {organizations.data && organizations.data.length > 0 && (
        <TableWrap>
          <table className={tableClasses}>
            <thead>
              <tr>
                <th className={thClasses}>Structure</th>
                <th className={thClasses}>Coordinateur</th>
                <th className={thClasses}>Places</th>
                <th className={thClasses}>Montant</th>
                <th className={thClasses}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {organizations.data.map((organization) => (
                <tr key={organization.id}>
                  <td className={tdClasses}>
                    <Link href={`/admin/associations/${organization.id}`} className="font-bold text-sapin-700 underline underline-offset-4">
                      {organization.name}
                    </Link>
                    <span className="block text-encre-doux">
                      {organizationKindLabel[organization.kind] ?? organization.kind}
                      {organization.city ? ` · ${organization.city}` : ''}
                    </span>
                  </td>
                  <td className={tdClasses}>
                    {organization.contactName}
                    <span className="block text-encre-doux">{organization.owner.email}</span>
                  </td>
                  <td className={tdClasses}>
                    {organization.seats.used} / {organization.seats.total}
                  </td>
                  <td className={tdClasses}>{formatMoney(organization.revenueCents)}</td>
                  <td className={tdClasses}>{ORG_STATUS[organization.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}

export function OrganizationAdmin({ id, invited }: { id: string; invited: boolean }) {
  const rights = useRights();
  const organization = useApi<OrganizationDetail>(`/api/admin/organizations/${id}`);
  const action = useAction();
  const [source, setSource] = useState<'virement' | 'pilote'>('virement');

  async function addLicense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      seats: Number(form.get('seats')),
      seatDays: Math.round(Number(form.get('seatMonths')) * 30),
      activationDays: Math.round(Number(form.get('activationMonths')) * 30),
      priceCents: source === 'pilote' ? 0 : Math.round(Number(String(form.get('price')).replace(',', '.')) * 100),
      source,
      note: String(form.get('note') || '') || undefined,
    };
    if (await action.run(() => send('POST', `/api/admin/organizations/${id}/licenses`, payload), 'Places ajoutées : le coordinateur est prévenu par email.')) {
      formElement.reset();
      organization.reload();
    }
  }

  async function revoke(licenseId: number) {
    if (!window.confirm('Clore ce pack ? Les places restantes ne pourront plus être activées et les accès offerts avec ce pack s’arrêtent.')) return;
    if (await action.run(() => send('DELETE', `/api/admin/organizations/${id}/licenses/${licenseId}`), 'Pack clos.')) organization.reload();
  }

  async function setStatus(status: 'ACTIVE' | 'SUSPENDED') {
    if (await action.run(() => send('PATCH', `/api/admin/organizations/${id}`, { status }), status === 'ACTIVE' ? 'Structure réactivée.' : 'Structure suspendue.'))
      organization.reload();
  }

  if (organization.error) return <ErrorNotice message={organization.error} />;
  if (!organization.data) return <Loading />;
  const data = organization.data;

  return (
    <>
      <p className="text-petit">
        <Link href="/admin/associations" className="text-sapin-700 underline underline-offset-4">
          ← Associations et structures
        </Link>
      </p>
      <PageTitle
        title={data.name}
        description={`${organizationKindLabel[data.kind] ?? data.kind}${data.city ? ` · ${data.city}` : ''}${data.registration ? ` · ${data.registration}` : ''} · ${ORG_STATUS[data.status]}`}
        actions={
          rights.superAdmin && data.status !== 'PENDING' ? (
            data.status === 'ACTIVE' ? (
              <button type="button" onClick={() => setStatus('SUSPENDED')} disabled={action.pending} className={smallDanger}>
                Suspendre
              </button>
            ) : (
              <button type="button" onClick={() => setStatus('ACTIVE')} disabled={action.pending} className={smallPrimary}>
                Réactiver
              </button>
            )
          ) : null
        }
      />
      {invited && <SuccessNotice message="Structure créée. Le coordinateur n’avait pas de compte : il a reçu un lien pour choisir son mot de passe." />}
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card title="Places">
          <p className="text-[1.5rem] font-bold">
            {data.seats.used} / {data.seats.total}
          </p>
          <p className="text-petit text-encre-doux">{plural(data.seats.free, 'disponible')}</p>
        </Card>
        <Card title="Coordinateur">
          <p>{data.contactName}</p>
          <Link href={`/admin/utilisateurs/${data.owner.id}`} className="text-petit text-sapin-700 underline underline-offset-4">
            {data.owner.email}
          </Link>
        </Card>
        <Card title="Code d’invitation">
          <p className="font-bold tracking-[0.15em]">{data.inviteCode}</p>
          <p className="text-petit text-encre-doux">Créée le {formatDate(data.createdAt)}</p>
        </Card>
      </div>

      <Card title="Packs" className="mt-6">
        {data.licenses.length === 0 ? (
          <p className="text-petit text-encre-doux">Aucun pack : ajoutez des places pour ouvrir l’espace de la structure.</p>
        ) : (
          <TableWrap>
            <table className={tableClasses}>
              <thead>
                <tr>
                  <th className={thClasses}>Pack</th>
                  <th className={thClasses}>Origine</th>
                  <th className={thClasses}>Utilisées</th>
                  <th className={thClasses}>À activer avant</th>
                  <th className={thClasses}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.licenses.map((license) => (
                  <tr key={license.id}>
                    <td className={tdClasses}>
                      {license.seats} places · {Math.round(license.seatDays / 30)} mois chacune
                      <span className="block text-encre-doux">
                        {formatMoney(license.priceCents)} · ajouté le {formatDate(license.createdAt)}
                      </span>
                      {license.note && <span className="block text-encre-doux">{license.note}</span>}
                    </td>
                    <td className={tdClasses}>
                      {SOURCE[license.source] ?? license.source}
                      {license.orderId && (
                        <span className="block text-encre-doux">commande {license.orderId.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className={tdClasses}>{license.used}</td>
                    <td className={tdClasses}>{license.revokedAt ? `Clos le ${formatDate(license.revokedAt)}` : formatDate(license.validUntil)}</td>
                    <td className={tdClasses}>
                      {rights.superAdmin && !license.revokedAt && !license.orderId && (
                        <button type="button" onClick={() => revoke(license.id)} disabled={action.pending} className={smallDanger}>
                          Clore
                        </button>
                      )}
                      {license.orderId && <span className="text-encre-doux">Remboursement depuis Commandes</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {rights.superAdmin && (
        <Card title="Ajouter des places" className="mt-6">
          <form onSubmit={addLicense} className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-petit font-bold">
              Origine
              <select value={source} onChange={(event) => setSource(event.target.value as 'virement' | 'pilote')} className={`${selectClasses} font-normal`}>
                <option value="virement">Virement reçu (ou bon de commande)</option>
                <option value="pilote">Places d’essai offertes</option>
              </select>
            </label>
            <label className="grid gap-1 text-petit font-bold">
              Nombre de places
              <input name="seats" type="number" min={1} required defaultValue={source === 'pilote' ? 10 : 100} className={`${inputSmall} font-normal`} />
            </label>
            <label className="grid gap-1 text-petit font-bold">
              Montant TTC (€)
              <input
                name="price"
                inputMode="decimal"
                required={source !== 'pilote'}
                disabled={source === 'pilote'}
                placeholder={source === 'pilote' ? 'Gratuit' : '600,00'}
                className={`${inputSmall} font-normal`}
              />
            </label>
            <label className="grid gap-1 text-petit font-bold">
              Accès par personne (mois)
              <input name="seatMonths" type="number" min={1} max={24} required defaultValue={source === 'pilote' ? 1 : 6} className={`${inputSmall} font-normal`} />
            </label>
            <label className="grid gap-1 text-petit font-bold">
              Délai pour activer (mois)
              <input name="activationMonths" type="number" min={1} max={24} required defaultValue={source === 'pilote' ? 2 : 12} className={`${inputSmall} font-normal`} />
            </label>
            <label className="grid gap-1 text-petit font-bold sm:col-span-3">
              Note interne (numéro de facture, bon de commande…)
              <textarea name="note" rows={2} maxLength={300} className={textareaClasses} />
            </label>
            <div>
              <button type="submit" disabled={action.pending} className={smallPrimary}>
                Ajouter les places
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Personnes (${plural(data.members.filter((member) => !member.removedAt).length, 'active')})`} className="mt-6">
        {data.members.length === 0 ? (
          <p className="text-petit text-encre-doux">Personne n’a encore activé de place.</p>
        ) : (
          <TableWrap>
            <table className={tableClasses}>
              <thead>
                <tr>
                  <th className={thClasses}>Personne</th>
                  <th className={thClasses}>Activée le</th>
                  <th className={thClasses}>Partage sa progression</th>
                  <th className={thClasses}>État</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.id}>
                    <td className={tdClasses}>
                      <Link href={`/admin/utilisateurs/${member.user.id}`} className="text-sapin-700 underline underline-offset-4">
                        {member.user.email}
                      </Link>
                    </td>
                    <td className={tdClasses}>{formatDate(member.joinedAt)}</td>
                    <td className={tdClasses}>{member.shareProgressAt ? 'Oui' : 'Non'}</td>
                    <td className={tdClasses}>{member.removedAt ? `Partie le ${formatDate(member.removedAt)}` : 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
