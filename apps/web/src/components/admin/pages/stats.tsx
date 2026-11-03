'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, ErrorNotice, Loading, PageTitle, TableWrap, formatMoney, inputSmall, selectClasses, smallButton, tableClasses, tdClasses, thClasses, useApi } from '../ui';

type Totals = Record<string, { events: number; learners: number }>;

type Stats = {
  period: { from: string; to: string };
  totals: Totals;
  daily: { day: string; type: string; events: number; learners: number }[];
  revenue: { orders: number; amountCents: number };
  activePremium: number;
  byPath: ({ pathCode: string } & Record<string, number | string>)[];
  byChannel: { channel: string; signups: number; buyers: number; conversion: number | null }[];
  offerByPlace: { place: string; views: number; clicks: number; clickRate: number | null }[];
  hardestQuestions: { id: number; reference: string; statement: string; attempts: number; successRate: number }[];
  mostReported: { id?: number; reference?: string; statement?: string; openReports: number }[];
};

const METRICS = [
  { type: 'visit', label: 'Visites' },
  { type: 'training_answer', label: 'Réponses d’entraînement' },
  { type: 'exam_start', label: 'Examens blancs commencés' },
  { type: 'exam_finish', label: 'Examens blancs terminés' },
  { type: 'paywall_view', label: 'Offre Premium vue' },
  { type: 'premium_click', label: 'Clics vers les tarifs' },
  { type: 'signup', label: 'Inscriptions' },
  { type: 'checkout_start', label: 'Paiements commencés' },
  { type: 'purchase', label: 'Achats' },
] as const;

const OFFER_PLACES: Record<string, string> = {
  quiz: 'Fin d’une série d’entraînement',
  'resultat-examen': 'Résultat de l’examen blanc gratuit',
  'examen-blanc': 'Page Examen blanc',
  accueil: 'Accueil',
};

const PRESETS = [7, 30, 90];
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const number = (value: number) => value.toLocaleString('fr-FR');
const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)} %`);
const shortDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Statistiques (A08) : audience, entonnoir de conversion, activité par jour, parcours, canaux et questions difficiles. */
export function StatsAdmin() {
  const today = isoDay(new Date());
  const [range, setRange] = useState({ from: isoDay(new Date(Date.now() - 29 * DAY_MS)), to: today });
  const [metric, setMetric] = useState<(typeof METRICS)[number]['type']>('visit');
  const query = `from=${range.from}&to=${range.to}`;
  const stats = useApi<Stats>(`/api/admin/stats?${query}`);

  const series = useMemo(() => {
    if (!stats.data) return [];
    const byDay = new Map(stats.data.daily.filter((row) => row.type === metric).map((row) => [row.day, row]));
    const days: { day: string; events: number; learners: number }[] = [];
    for (let time = Date.parse(stats.data.period.from); time <= Date.parse(stats.data.period.to); time += DAY_MS) {
      const day = isoDay(new Date(time));
      days.push({ day, events: byDay.get(day)?.events ?? 0, learners: byDay.get(day)?.learners ?? 0 });
    }
    return days;
  }, [stats.data, metric]);

  const preset = (days: number) => setRange({ from: isoDay(new Date(Date.now() - (days - 1) * DAY_MS)), to: today });

  return (
    <>
      <PageTitle
        title="Statistiques"
        description="Mesure interne, sans traceur ni cookie : chaque personne est comptée une fois par jour, avec une empreinte qui change chaque jour."
        actions={
          <a href={`/api/admin/stats/export.csv?${query}`} className={smallButton}>
            Exporter en CSV
          </a>
        }
      />

      {/* Un seul rang de filtres, au-dessus de tout ce qu'il règle. */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        {PRESETS.map((days) => (
          <button key={days} type="button" onClick={() => preset(days)} className={smallButton}>
            {days} derniers jours
          </button>
        ))}
        <label className="grid gap-1 text-petit">
          Du
          <input type="date" value={range.from} max={range.to} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className={inputSmall} />
        </label>
        <label className="grid gap-1 text-petit">
          Au
          <input type="date" value={range.to} max={today} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className={inputSmall} />
        </label>
      </div>

      {stats.error && <ErrorNotice message={stats.error} />}
      {!stats.data && !stats.error && <Loading />}
      {stats.data && (
        <div className="mt-6 grid gap-6">
          <dl className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Tile label="Visites" value={number(stats.data.totals.visit?.events ?? 0)} />
            <Tile label="Personnes qui s’entraînent" value={number(stats.data.totals.training_answer?.learners ?? 0)} hint="somme des personnes distinctes par jour" />
            <Tile label="Inscriptions" value={number(stats.data.totals.signup?.events ?? 0)} />
            <Tile label="Achats" value={number(stats.data.revenue.orders)} />
            <Tile label="Chiffre d’affaires TTC" value={formatMoney(stats.data.revenue.amountCents)} />
            <Tile label="Accès Premium en cours" value={number(stats.data.activePremium)} hint="aujourd’hui" />
          </dl>

          <Card title="Du premier passage à l’achat">
            <Funnel totals={stats.data.totals} purchases={stats.data.revenue.orders} />
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-texte text-[1.125rem] font-bold tracking-normal">Activité par jour</h2>
              <label className="flex items-center gap-2 text-petit">
                Mesure
                <select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)} className={selectClasses}>
                  {METRICS.map((entry) => (
                    <option key={entry.type} value={entry.type}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <DailyColumns days={series} label={METRICS.find((entry) => entry.type === metric)!.label} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Par parcours">
              <TableWrap>
                <table className={tableClasses}>
                  <thead>
                    <tr>
                      <th className={thClasses}>Parcours</th>
                      <th className={`${thClasses} text-right`}>Réponses</th>
                      <th className={`${thClasses} text-right`}>Examens</th>
                      <th className={`${thClasses} text-right`}>Achats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.data.byPath.map((row) => (
                      <tr key={row.pathCode}>
                        <td className={tdClasses}>{row.pathCode}</td>
                        <td className={`${tdClasses} text-right tabular-nums`}>{number(Number(row.training_answer ?? 0))}</td>
                        <td className={`${tdClasses} text-right tabular-nums`}>{number(Number(row.exam_start ?? 0))}</td>
                        <td className={`${tdClasses} text-right tabular-nums`}>{number(Number(row.paid ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>

            <Card title="Où l’offre Premium est vue">
              {stats.data.offerByPlace.length === 0 ? (
                <p className="text-petit text-encre-doux">Pas encore de données sur la période.</p>
              ) : (
                <TableWrap>
                  <table className={tableClasses}>
                    <thead>
                      <tr>
                        <th className={thClasses}>Endroit</th>
                        <th className={`${thClasses} text-right`}>Vues</th>
                        <th className={`${thClasses} text-right`}>Clics vers les tarifs</th>
                        <th className={`${thClasses} text-right`}>Taux de clic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.data.offerByPlace.map((row) => (
                        <tr key={row.place}>
                          <td className={tdClasses}>{OFFER_PLACES[row.place] ?? row.place}</td>
                          <td className={`${tdClasses} text-right tabular-nums`}>{number(row.views)}</td>
                          <td className={`${tdClasses} text-right tabular-nums`}>{number(row.clicks)}</td>
                          <td className={`${tdClasses} text-right tabular-nums`}>{percent(row.clickRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>

            <Card title="Par canal d’arrivée (inscriptions de la période)">
              <TableWrap>
                <table className={tableClasses}>
                  <thead>
                    <tr>
                      <th className={thClasses}>Canal</th>
                      <th className={`${thClasses} text-right`}>Inscriptions</th>
                      <th className={`${thClasses} text-right`}>Acheteurs</th>
                      <th className={`${thClasses} text-right`}>Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.data.byChannel.map((row) => (
                      <tr key={row.channel}>
                        <td className={tdClasses}>{row.channel}</td>
                        <td className={`${tdClasses} text-right tabular-nums`}>{number(row.signups)}</td>
                        <td className={`${tdClasses} text-right tabular-nums`}>{number(row.buyers)}</td>
                        <td className={`${tdClasses} text-right tabular-nums`}>{percent(row.conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          </div>

          <Card title="Questions les plus difficiles (au moins 20 réponses)">
            {stats.data.hardestQuestions.length === 0 ? (
              <p className="text-petit text-encre-doux">Pas encore assez de réponses.</p>
            ) : (
              <TableWrap>
                <table className={tableClasses}>
                  <thead>
                    <tr>
                      <th className={thClasses}>Question</th>
                      <th className={`${thClasses} text-right`}>Réponses</th>
                      <th className={`${thClasses} text-right`}>Bonnes réponses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.data.hardestQuestions.map((question) => (
                      <tr key={question.id}>
                        <td className={tdClasses}>
                          <Link href={`/admin/questions/${question.id}`} className="font-bold text-sapin-700 underline underline-offset-4">
                            {question.reference}
                          </Link>{' '}
                          <span className="line-clamp-1">{question.statement}</span>
                        </td>
                        <td className={`${tdClasses} text-right tabular-nums`}>{number(question.attempts)}</td>
                        <td className={`${tdClasses} text-right tabular-nums`}>{percent(question.successRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-carte border border-ligne bg-white p-4 shadow-carte">
      <dt className="text-petit text-encre-doux">{label}</dt>
      <dd className="mt-1 text-[1.75rem] font-bold leading-tight">{value}</dd>
      {hint && <dd className="text-xs text-encre-doux">{hint}</dd>}
    </div>
  );
}

/** Entonnoir : une barre par étape (une seule série, une seule couleur), valeur au bout de la barre. */
function Funnel({ totals, purchases }: { totals: Totals; purchases: number }) {
  const stages = [
    { label: 'Visites', value: totals.visit?.events ?? 0 },
    { label: 'Personnes qui s’entraînent', value: totals.training_answer?.learners ?? 0 },
    { label: 'Offre Premium vue', value: totals.paywall_view?.learners ?? 0 },
    { label: 'Clics vers les tarifs', value: totals.premium_click?.learners ?? 0 },
    { label: 'Inscriptions', value: totals.signup?.events ?? 0 },
    { label: 'Paiements commencés', value: totals.checkout_start?.events ?? 0 },
    { label: 'Achats', value: purchases },
  ];
  const max = Math.max(1, ...stages.map((stage) => stage.value));

  return (
    <>
      <ol className="grid gap-3">
        {stages.map((stage, index) => {
          const previous = index > 0 ? stages[index - 1]!.value : null;
          // Les étapes ne sont pas comptées sur la même base (sessions, personnes par jour) : au-delà de 100 %, le taux n'a pas de sens.
          const rate = previous && stage.value <= previous ? stage.value / previous : null;
          return (
            <li key={stage.label} className="grid gap-1 sm:grid-cols-[13rem_1fr] sm:items-center sm:gap-3">
              <span className="text-petit">{stage.label}</span>
              <span className="flex items-center gap-2" title={`${stage.label} : ${number(stage.value)}`}>
                <span
                  aria-hidden="true"
                  className="h-4 rounded-r-[4px] bg-[var(--color-graphe)]"
                  style={{ width: `${Math.max((stage.value / max) * 100, stage.value > 0 ? 0.6 : 0)}%` }}
                />
                <span className="whitespace-nowrap text-petit">
                  <strong>{number(stage.value)}</strong>
                  {rate !== null && <span className="text-encre-doux"> · {percent(rate)} de l’étape précédente</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-encre-doux">
        « Personnes qui s’entraînent » additionne les personnes distinctes de chaque jour : une personne venue trois jours compte trois fois.
      </p>
    </>
  );
}

/** Colonnes par jour (une seule série) : infobulle au survol et au clavier, tableau équivalent juste en dessous. */
function DailyColumns({ days, label }: { days: { day: string; events: number; learners: number }[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...days.map((day) => day.events), 0);
  const top = niceCeiling(max);
  // Des comptes entiers : pas de graduation à virgule.
  const ticks = top >= 2 && top % 2 === 0 ? [top, top / 2, 0] : [top, 0];
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));

  if (days.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="grid grid-cols-[3rem_1fr] gap-2">
        <div className="relative h-48 text-right text-xs text-encre-doux tabular-nums" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (tick / top) * 100}%` }}>
              {compact(tick)}
            </span>
          ))}
        </div>
        <div className="relative h-48">
          {ticks.map((tick) => (
            <span key={tick} aria-hidden="true" className="absolute inset-x-0 h-px bg-ligne" style={{ top: `${100 - (tick / top) * 100}%` }} />
          ))}
          <ol className="absolute inset-0 flex items-end gap-[2px]" aria-label={`${label} par jour`}>
            {days.map((day, index) => (
              <li
                key={day.day}
                tabIndex={0}
                aria-label={`${shortDate(day.day)} : ${number(day.events)}`}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive((current) => (current === index ? null : current))}
                onFocus={() => setActive(index)}
                onBlur={() => setActive((current) => (current === index ? null : current))}
                className="relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none focus-visible:bg-sapin-50"
              >
                <span
                  aria-hidden="true"
                  className={`w-full max-w-6 rounded-t-[4px] bg-[var(--color-graphe)] transition-opacity ${active !== null && active !== index ? 'opacity-60' : ''}`}
                  style={{ height: `${top > 0 ? (day.events / top) * 100 : 0}%` }}
                />
                {active === index && (
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-ligne bg-white px-2.5 py-1.5 text-xs shadow-carte ${index > days.length / 2 ? 'right-0' : 'left-0'}`}
                  >
                    <strong className="block text-[0.875rem] text-encre">{number(day.events)}</strong>
                    <span className="text-encre-doux">
                      {shortDate(day.day)} · {number(day.learners)} personne{day.learners > 1 ? 's' : ''}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="ml-[3.5rem] mt-1 flex gap-[2px] text-xs text-encre-doux" aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.day} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {index % labelEvery === 0 ? shortDate(day.day) : ''}
          </span>
        ))}
      </div>
      <details className="mt-3 text-petit">
        <summary className="cursor-pointer text-sapin-700 underline underline-offset-4">Voir les chiffres en tableau</summary>
        <TableWrap>
          <table className={tableClasses}>
            <thead>
              <tr>
                <th className={thClasses}>Jour</th>
                <th className={`${thClasses} text-right`}>{label}</th>
                <th className={`${thClasses} text-right`}>Personnes distinctes</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.day}>
                  <td className={tdClasses}>{shortDate(day.day)}</td>
                  <td className={`${tdClasses} text-right tabular-nums`}>{number(day.events)}</td>
                  <td className={`${tdClasses} text-right tabular-nums`}>{number(day.learners)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </details>
    </div>
  );
}

/** Graduation haute arrondie (1, 2, 5 × 10ⁿ), pour des repères lisibles. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value)!;
  return step * magnitude;
}

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k` : value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
