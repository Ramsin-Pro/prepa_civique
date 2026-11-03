'use client';

import Link from 'next/link';
import { Card, ErrorNotice, Loading, PageTitle, STATUS_LABELS, formatMoney, useApi, type ContentStatus } from '../ui';

type Dashboard = {
  role: string;
  content: { questions: Partial<Record<ContentStatus, number>>; sheets: Partial<Record<ContentStatus, number>>; pages: Partial<Record<ContentStatus, number>>; openReports: number };
  support: { newMessages: number };
  learners: { active: number; newThisWeek: number; premium: number };
  sales: { last30Days: { orders: number; amountCents: number } };
  alerts: { level: 'error' | 'warning'; message: string }[];
};

const ORDER: ContentStatus[] = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];

/** Tableau de bord (A01) : ce qui attend une action, et l'état du lancement. */
export function AdminDashboard() {
  const { data, error } = useApi<Dashboard>('/api/admin/dashboard');
  if (error) return <ErrorNotice message={error} />;
  if (!data) return <Loading />;

  const toReview = data.content.questions.IN_REVIEW ?? 0;
  return (
    <>
      <PageTitle title="Tableau de bord" description="Ce qui attend une action, et les points à régler avant la mise en ligne." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Questions à relire" value={toReview} href="/admin/questions?statut=IN_REVIEW" />
        <Kpi label="Signalements ouverts" value={data.content.openReports} href="/admin/signalements" />
        <Kpi label="Nouveaux messages" value={data.support.newMessages} href="/admin/messages" />
        <Kpi label="Ventes sur 30 jours" value={formatMoney(data.sales.last30Days.amountCents)} detail={`${data.sales.last30Days.orders} commande(s)`} href="/admin/commandes" />
      </div>

      {data.alerts.length > 0 && (
        <ul className="mt-6 grid gap-2">
          {data.alerts.map((alert) => (
            <li
              key={alert.message}
              className={`rounded-carte border p-3 text-petit ${alert.level === 'error' ? 'border-brique-200 bg-brique-100' : 'border-ocre-100 bg-ocre-100/50'}`}
            >
              <strong>{alert.level === 'error' ? 'À régler : ' : 'À savoir : '}</strong>
              {alert.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {(
          [
            ['Questions', data.content.questions, '/admin/questions'],
            ['Fiches de révision', data.content.sheets, '/admin/fiches'],
            ['Pages', data.content.pages, '/admin/pages'],
          ] as const
        ).map(([title, counts, href]) => (
          <Card key={title} title={title}>
            <dl className="grid gap-1.5 text-petit">
              {ORDER.filter((status) => counts[status]).map((status) => (
                <div key={status} className="flex justify-between gap-3">
                  <dt>{STATUS_LABELS[status]}</dt>
                  <dd className="font-bold tabular-nums">{counts[status]}</dd>
                </div>
              ))}
            </dl>
            <Link href={href} className="mt-3 inline-block text-petit text-sapin-700 underline underline-offset-4">
              Gérer
            </Link>
          </Card>
        ))}
      </div>

      <Card title="Candidats" className="mt-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Stat label="Comptes actifs" value={data.learners.active} />
          <Stat label="Nouveaux cette semaine" value={data.learners.newThisWeek} />
          <Stat label="Accès Premium en cours" value={data.learners.premium} />
        </dl>
      </Card>
    </>
  );
}

function Kpi({ label, value, detail, href }: { label: string; value: number | string; detail?: string; href: string }) {
  return (
    <Link href={href} className="rounded-carte border border-ligne bg-white p-5 shadow-carte hover:border-sapin-500">
      <p className="text-petit text-encre-doux">{label}</p>
      <p className="mt-1 text-[2rem] font-bold leading-none">{value}</p>
      {detail && <p className="mt-1 text-petit text-encre-doux">{detail}</p>}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-petit text-encre-doux">{label}</dt>
      <dd className="text-[1.75rem] font-bold">{value}</dd>
    </div>
  );
}
