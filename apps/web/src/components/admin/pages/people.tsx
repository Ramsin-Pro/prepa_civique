'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { send } from '@/lib/client';
import type { OrderStatus, Role } from '@/lib/types';
import {
  Card,
  ErrorNotice,
  Loading,
  PageTitle,
  Pagination,
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
  thClasses,
  useAction,
  useApi,
  useRights,
} from '../ui';

const ROLES: Record<Role, string> = {
  LEARNER: 'Apprenant',
  READONLY: 'Lecture seule',
  SUPPORT: 'Support',
  EDITOR: 'Éditeur',
  SUPER_ADMIN: 'Super-administrateur',
};

const ORDER_STATUS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
  FAILED: 'Échouée',
  EXPIRED: 'Abandonnée',
  REFUNDED: 'Remboursée',
};

type Paged<T> = { total: number; page: number; pageSize: number; items: T[] };

// ─── Utilisateurs (A06) ──────────────────────────────────────────────────────

type UserRow = {
  id: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  emailVerifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  path: { title: string } | null;
  premiumUntil: string | null;
};

export function UsersAdmin() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters, page]);
  const users = useApi<Paged<UserRow>>(`/api/admin/users?${query}`);

  return (
    <>
      <PageTitle title="Utilisateurs" description="Données personnelles : consultez seulement ce qui est utile pour aider la personne." />
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters((current) => ({ ...current, q: search.trim() }));
          setPage(1);
        }}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <label className="grid gap-1 text-petit">
          Email
          <input value={search} onChange={(event) => setSearch(event.target.value)} className={inputSmall} />
        </label>
        <label className="grid gap-1 text-petit">
          Rôle
          <select value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))} className={selectClasses}>
            <option value="">Tous</option>
            {(Object.keys(ROLES) as Role[]).map((role) => (
              <option key={role} value={role}>
                {ROLES[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-petit">
          État
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className={selectClasses}>
            <option value="">Tous</option>
            <option value="ACTIVE">Actif</option>
            <option value="DISABLED">Désactivé</option>
          </select>
        </label>
        <button type="submit" className={smallButton}>
          Rechercher
        </button>
      </form>
      {users.error && <ErrorNotice message={users.error} />}
      {!users.data && !users.error && <Loading />}
      {users.data && (
        <>
          <TableWrap>
            <table className={tableClasses}>
              <thead>
                <tr>
                  <th className={thClasses}>Email</th>
                  <th className={thClasses}>Rôle</th>
                  <th className={thClasses}>Parcours</th>
                  <th className={thClasses}>Premium jusqu’au</th>
                  <th className={thClasses}>Inscrit le</th>
                  <th className={thClasses}>Dernière connexion</th>
                </tr>
              </thead>
              <tbody>
                {users.data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-papier">
                    <td className={tdClasses}>
                      <Link href={`/admin/utilisateurs/${user.id}`} className="font-bold text-sapin-700 underline underline-offset-4">
                        {user.email}
                      </Link>
                      {user.status === 'DISABLED' && <span className="ml-2 text-xs font-bold text-brique-700">désactivé</span>}
                      {!user.emailVerifiedAt && <span className="ml-2 text-xs text-encre-doux">email non confirmé</span>}
                    </td>
                    <td className={tdClasses}>{ROLES[user.role]}</td>
                    <td className={tdClasses}>{user.path?.title ?? '—'}</td>
                    <td className={tdClasses}>{formatDate(user.premiumUntil)}</td>
                    <td className={tdClasses}>{formatDate(user.createdAt)}</td>
                    <td className={tdClasses}>{formatDate(user.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={users.data.page} pageSize={users.data.pageSize} total={users.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}

type UserDetail = {
  id: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  emailVerifiedAt: string | null;
  termsAcceptedAt: string;
  termsVersion: string;
  marketingConsentAt: string | null;
  mfaEnabledAt: string | null;
  acquisitionChannel: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  path: { slug: string; title: string } | null;
  orders: { id: string; status: OrderStatus; amountCents: number; currency: string; provider: string; createdAt: string; paidAt: string | null; refundedAt: string | null; plan: { name: string } }[];
  entitlements: { id: number; startsAt: string; expiresAt: string; revokedAt: string | null; orderId: string | null }[];
  contactMessages: { id: number; subject: string; status: string; createdAt: string }[];
  activeSessions: number;
  premiumUntil: string | null;
  progress: { questionsSeen: number; examsDone: number };
};

export function UserAdmin({ id }: { id: string }) {
  const rights = useRights();
  const user = useApi<UserDetail>(`/api/admin/users/${id}`);
  const action = useAction();
  const [role, setRole] = useState<Role | ''>('');

  if (user.error) return <ErrorNotice message={user.error} />;
  if (!user.data) return <Loading />;
  const data = user.data;

  async function setStatus(status: 'ACTIVE' | 'DISABLED') {
    if (status === 'DISABLED' && !window.confirm('Désactiver ce compte ? La personne sera déconnectée et ne pourra plus se connecter.')) return;
    if (await action.run(() => send('PATCH', `/api/admin/users/${id}/status`, { status }), 'Compte mis à jour.')) user.reload();
  }

  async function changeRole() {
    if (!role || role === data.role) return;
    if (!window.confirm(`Donner le rôle « ${ROLES[role]} » à ${data.email} ?`)) return;
    if (await action.run(() => send('PATCH', `/api/admin/users/${id}/role`, { role }), 'Rôle modifié. La personne doit se reconnecter.')) user.reload();
  }

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await action.run(
      () => send('POST', `/api/admin/users/${id}/grant`, { days: Number(form.get('days')), reason: String(form.get('reason')) }),
      'Accès Premium offert.',
    );
    if (ok) {
      formElement.reset();
      user.reload();
    }
  }

  return (
    <>
      <p className="text-petit">
        <Link href="/admin/utilisateurs" className="text-sapin-700 underline underline-offset-4">
          ← Utilisateurs
        </Link>
      </p>
      <PageTitle title={data.email} description={`${ROLES[data.role]} · ${data.status === 'ACTIVE' ? 'compte actif' : 'compte désactivé'}`} />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Compte">
          <dl className="grid gap-1 text-petit">
            <Row label="Inscription" value={formatDateTime(data.createdAt)} />
            <Row label="Email confirmé" value={formatDateTime(data.emailVerifiedAt)} />
            <Row label="CGU acceptées" value={`${formatDate(data.termsAcceptedAt)} (version ${data.termsVersion})`} />
            <Row label="Emails d’information" value={data.marketingConsentAt ? `oui, depuis le ${formatDate(data.marketingConsentAt)}` : 'non'} />
            <Row label="Parcours" value={data.path?.title ?? '—'} />
            <Row label="Canal d’arrivée" value={data.acquisitionChannel ?? '—'} />
            <Row label="Dernière connexion" value={formatDateTime(data.lastLoginAt)} />
            <Row label="Sessions ouvertes" value={String(data.activeSessions)} />
            <Row label="Double authentification" value={data.mfaEnabledAt ? 'activée' : 'non'} />
            <Row label="Progression" value={`${data.progress.questionsSeen} questions travaillées, ${data.progress.examsDone} examen(s) blanc(s)`} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.status === 'ACTIVE' ? (
              <button type="button" disabled={action.pending} onClick={() => setStatus('DISABLED')} className={smallDanger}>
                Désactiver le compte
              </button>
            ) : (
              <button type="button" disabled={action.pending} onClick={() => setStatus('ACTIVE')} className={smallPrimary}>
                Réactiver le compte
              </button>
            )}
            {!data.emailVerifiedAt && (
              <button
                type="button"
                disabled={action.pending}
                onClick={() => action.run(() => send('POST', `/api/admin/users/${id}/resend-verification`), 'Lien de confirmation renvoyé.')}
                className={smallButton}
              >
                Renvoyer le lien de confirmation
              </button>
            )}
          </div>
          {rights.superAdmin && (
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-petit">
                Rôle
                <select value={role || data.role} onChange={(event) => setRole(event.target.value as Role)} className={selectClasses}>
                  {(Object.keys(ROLES) as Role[]).map((value) => (
                    <option key={value} value={value}>
                      {ROLES[value]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={action.pending || !role || role === data.role} onClick={changeRole} className={smallButton}>
                Changer le rôle
              </button>
            </div>
          )}
        </Card>

        <Card title="Premium et commandes">
          <p className="text-petit">{data.premiumUntil ? `Accès Premium jusqu’au ${formatDate(data.premiumUntil)}.` : 'Pas d’accès Premium en cours.'}</p>
          {data.orders.length > 0 && (
            <ul className="mt-3 grid gap-2 text-petit">
              {data.orders.map((order) => (
                <li key={order.id} className="rounded-md bg-papier p-2">
                  {order.plan.name} · {formatMoney(order.amountCents, order.currency)} · {ORDER_STATUS[order.status]} · {formatDate(order.createdAt)} ·{' '}
                  <span className="text-encre-doux">{order.provider}</span>
                </li>
              ))}
            </ul>
          )}
          {rights.superAdmin && (
            <form onSubmit={grant} className="mt-4 grid gap-2 border-t border-ligne pt-4">
              <p className="text-petit font-bold">Offrir un accès Premium (geste commercial)</p>
              <div className="flex flex-wrap gap-2">
                <input name="days" type="number" min={1} max={365} defaultValue={30} aria-label="Nombre de jours" className={`${inputSmall} w-24`} />
                <input name="reason" required minLength={5} placeholder="Motif (noté au journal)" aria-label="Motif" className={`${inputSmall} flex-1`} />
                <button type="submit" disabled={action.pending} className={smallButton}>
                  Offrir
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>

      {data.contactMessages.length > 0 && (
        <Card title="Messages envoyés au support" className="mt-4">
          <ul className="grid gap-1 text-petit">
            {data.contactMessages.map((message) => (
              <li key={message.id}>
                {formatDate(message.createdAt)} · {message.subject} · {message.status === 'NEW' ? 'nouveau' : message.status === 'ANSWERED' ? 'répondu' : 'clos'}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-ligne py-1 last:border-0">
      <dt className="text-encre-doux">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

// ─── Commandes (A07) ─────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  status: OrderStatus;
  amountCents: number;
  currency: string;
  provider: string;
  providerPaymentId: string | null;
  waiverAcceptedAt: string | null;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  plan: { name: string; code: string };
  user: { id: string; email: string };
};

export function OrdersAdmin() {
  const rights = useRights();
  const [filters, setFilters] = useState({ status: '', q: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters]);
  const orders = useApi<Paged<OrderRow> & { paid: { count: number; amountCents: number } }>(`/api/admin/orders?page=${page}&${filterQuery}`);
  const action = useAction();

  async function refund(order: OrderRow) {
    if (!window.confirm(`Rembourser ${formatMoney(order.amountCents, order.currency)} à ${order.user.email} ? L’accès Premium de cette commande sera retiré.`)) return;
    if (await action.run(() => send('POST', `/api/admin/orders/${order.id}/refund`), 'Commande remboursée.')) orders.reload();
  }

  const set = (key: keyof typeof filters) => (event: { target: { value: string } }) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };

  return (
    <>
      <PageTitle
        title="Commandes"
        description="L’accès Premium n’est ouvert qu’après la confirmation du paiement par le prestataire."
        actions={
          rights.superAdmin ? (
            <a href={`/api/admin/orders/export.csv?${filterQuery}`} className={smallButton}>
              Exporter en CSV
            </a>
          ) : null
        }
      />
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-petit">
          Email ou numéro
          <input value={filters.q} onChange={set('q')} className={inputSmall} />
        </label>
        <label className="grid gap-1 text-petit">
          Statut
          <select value={filters.status} onChange={set('status')} className={selectClasses}>
            <option value="">Tous</option>
            {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-petit">
          Du
          <input type="date" value={filters.from} onChange={set('from')} className={inputSmall} />
        </label>
        <label className="grid gap-1 text-petit">
          Au
          <input type="date" value={filters.to} onChange={set('to')} className={inputSmall} />
        </label>
      </div>
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}
      {orders.error && <ErrorNotice message={orders.error} />}
      {!orders.data && !orders.error && <Loading />}
      {orders.data && (
        <>
          <p className="mt-4 text-petit">
            Payées sur la sélection : <strong>{orders.data.paid.count}</strong> pour <strong>{formatMoney(orders.data.paid.amountCents)}</strong> TTC.
          </p>
          <TableWrap>
            <table className={tableClasses}>
              <thead>
                <tr>
                  <th className={thClasses}>Date</th>
                  <th className={thClasses}>Client</th>
                  <th className={thClasses}>Formule</th>
                  <th className={thClasses}>Montant</th>
                  <th className={thClasses}>Statut</th>
                  <th className={thClasses}>Prestataire</th>
                  {rights.superAdmin && <th className={thClasses}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {orders.data.items.map((order) => (
                  <tr key={order.id} className="hover:bg-papier">
                    <td className={tdClasses}>{formatDateTime(order.createdAt)}</td>
                    <td className={tdClasses}>
                      <Link href={`/admin/utilisateurs/${order.user.id}`} className="text-sapin-700 underline underline-offset-4">
                        {order.user.email}
                      </Link>
                      <span className="block text-xs text-encre-doux">{order.id}</span>
                    </td>
                    <td className={tdClasses}>{order.plan.name}</td>
                    <td className={tdClasses}>{formatMoney(order.amountCents, order.currency)}</td>
                    <td className={tdClasses}>{ORDER_STATUS[order.status]}</td>
                    <td className={tdClasses}>{order.provider}</td>
                    {rights.superAdmin && (
                      <td className={tdClasses}>
                        {order.status === 'PAID' && (
                          <button type="button" disabled={action.pending} onClick={() => refund(order)} className={smallDanger}>
                            Rembourser
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={orders.data.page} pageSize={orders.data.pageSize} total={orders.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}

// ─── Messages du support (E17) ───────────────────────────────────────────────

type Message = { id: number; email: string; subject: string; message: string; status: 'NEW' | 'ANSWERED' | 'CLOSED'; createdAt: string; userId: string | null };

export function MessagesAdmin() {
  const [status, setStatus] = useState<'' | Message['status']>('NEW');
  const [page, setPage] = useState(1);
  const messages = useApi<Paged<Message>>(`/api/admin/messages?page=${page}${status ? `&status=${status}` : ''}`);
  const action = useAction();

  async function mark(id: number, next: Message['status']) {
    if (await action.run(() => send('PATCH', `/api/admin/messages/${id}`, { status: next }))) messages.reload();
  }

  return (
    <>
      <PageTitle title="Messages" description="Répondez depuis votre messagerie, puis marquez le message comme répondu." />
      <label className="mt-4 flex items-center gap-2 text-petit">
        Afficher
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            setPage(1);
          }}
          className={selectClasses}
        >
          <option value="NEW">Nouveaux</option>
          <option value="ANSWERED">Répondus</option>
          <option value="CLOSED">Clos</option>
          <option value="">Tous</option>
        </select>
      </label>
      {action.error && <ErrorNotice message={action.error} />}
      {messages.error && <ErrorNotice message={messages.error} />}
      {!messages.data && !messages.error && <Loading />}
      {messages.data?.items.length === 0 && <p className="mt-6 text-encre-doux">Aucun message.</p>}
      <ul className="mt-4 grid gap-3">
        {messages.data?.items.map((message) => (
          <li key={message.id} className="rounded-carte border border-ligne bg-white p-4 shadow-carte">
            <div className="flex flex-wrap items-center justify-between gap-2 text-petit">
              <span>
                <strong>{message.subject}</strong> · {formatDateTime(message.createdAt)} ·{' '}
                <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re : ${message.subject}`)}`} className="text-sapin-700 underline underline-offset-4">
                  {message.email}
                </a>
                {message.userId && (
                  <>
                    {' '}
                    ·{' '}
                    <Link href={`/admin/utilisateurs/${message.userId}`} className="text-sapin-700 underline underline-offset-4">
                      compte
                    </Link>
                  </>
                )}
              </span>
              <span className="flex gap-2">
                {message.status !== 'ANSWERED' && (
                  <button type="button" disabled={action.pending} onClick={() => mark(message.id, 'ANSWERED')} className={smallPrimary}>
                    Répondu
                  </button>
                )}
                {message.status !== 'CLOSED' && (
                  <button type="button" disabled={action.pending} onClick={() => mark(message.id, 'CLOSED')} className={smallButton}>
                    Clore
                  </button>
                )}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line">{message.message}</p>
          </li>
        ))}
      </ul>
      {messages.data && <Pagination page={messages.data.page} pageSize={messages.data.pageSize} total={messages.data.total} onChange={setPage} />}
    </>
  );
}

// ─── Journal d'audit (A09) ───────────────────────────────────────────────────

type AuditEntry = { id: number; action: string; entity: string; entityId: string; details: unknown; createdAt: string; actor: { email: string } | null };

export function AuditAdmin() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const entries = useApi<Paged<AuditEntry>>(`/api/admin/audit?page=${page}${entity ? `&entity=${entity}` : ''}`);

  return (
    <>
      <PageTitle title="Journal d’audit" description="Les actions sensibles de l’équipe : publications, droits, remboursements, exports." />
      <label className="mt-4 flex items-center gap-2 text-petit">
        Objet
        <select
          value={entity}
          onChange={(event) => {
            setEntity(event.target.value);
            setPage(1);
          }}
          className={selectClasses}
        >
          <option value="">Tous</option>
          <option value="question">Questions</option>
          <option value="sheet">Fiches</option>
          <option value="page">Pages</option>
          <option value="exam_template">Examens blancs</option>
          <option value="user">Utilisateurs</option>
          <option value="order">Commandes</option>
          <option value="glossary">Lexique</option>
        </select>
      </label>
      {entries.error && <ErrorNotice message={entries.error} />}
      {!entries.data && !entries.error && <Loading />}
      {entries.data && (
        <>
          <TableWrap>
            <table className={tableClasses}>
              <thead>
                <tr>
                  <th className={thClasses}>Date</th>
                  <th className={thClasses}>Personne</th>
                  <th className={thClasses}>Action</th>
                  <th className={thClasses}>Objet</th>
                  <th className={thClasses}>Détails</th>
                </tr>
              </thead>
              <tbody>
                {entries.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className={`${tdClasses} whitespace-nowrap`}>{formatDateTime(entry.createdAt)}</td>
                    <td className={tdClasses}>{entry.actor?.email ?? 'système'}</td>
                    <td className={tdClasses}>{entry.action}</td>
                    <td className={tdClasses}>
                      {entry.entity} {entry.entityId}
                    </td>
                    <td className={`${tdClasses} max-w-xs break-words text-xs`}>{entry.details ? JSON.stringify(entry.details) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={entries.data.page} pageSize={entries.data.pageSize} total={entries.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}
