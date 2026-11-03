import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { CheckIcon, SourceIcon } from '@/components/icons';
import { OfferLink } from '@/components/premium/offer-link';
import { StartExamButton } from '@/components/start-exam-button';
import { PathSwitcher } from '@/components/path-switcher';
import { ApiError, apiGet, choosePath } from '@/lib/api';
import { SERVICE_UNAVAILABLE } from '@/lib/errors';
import { frenchDateFormat } from '@/lib/labels';
import { pageMetadata } from '@/lib/seo';
import type { ExamHistory, ExamTemplateSummary, PathSummary } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Examen blanc',
  description:
    'Un examen blanc de l’examen civique dans les conditions réelles : 40 questions en 45 minutes, autant de questions par thème que le jour de l’examen, puis une correction détaillée.',
  path: '/examen-blanc',
});
export const dynamic = 'force-dynamic';

const rules = [
  'Une seule bonne réponse par question. Vous pouvez changer d’avis tant que l’examen n’est pas terminé.',
  'Vos réponses sont enregistrées au fur et à mesure : une coupure ne fait rien perdre.',
  'Vous pouvez passer d’une question à l’autre librement.',
  'Comme le jour de l’examen, il n’y a pas d’aide : ni correction, ni lecture audio, ni lexique. La correction complète s’affiche à la fin.',
  'Quand le temps est écoulé, l’examen se termine tout seul.',
];

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

// Écran de préparation de l'examen blanc (E10).
export default async function ExamPreparationPage({ searchParams }: { searchParams: Promise<{ parcours?: string }> }) {
  const { parcours } = await searchParams;

  let template: ExamTemplateSummary | null = null;
  let history: ExamHistory = { active: null, finished: [] };
  let open: PathSummary[] = [];
  let error: string | null = null;
  try {
    const chosen = await choosePath(parcours);
    open = chosen.open;
    const path = chosen.path;
    if (path) {
      [template, history] = await Promise.all([
        apiGet<ExamTemplateSummary>(`/api/exams/template?path=${path.slug}`, { personal: true }),
        apiGet<ExamHistory>(`/api/exams?path=${path.slug}`, { personal: true }),
      ]);
    }
  } catch (caught) {
    error = caught instanceof ApiError ? caught.message : SERVICE_UNAVAILABLE;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Eyebrow>Examen blanc</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.75rem]">Passez l’examen dans les conditions réelles</h1>

      {error || !template ? (
        <p role="alert" className="mt-8 rounded-carte border border-brique-200 bg-brique-100 p-5">
          {error ?? 'Aucun examen blanc n’est disponible pour le moment.'}
        </p>
      ) : (
        <>
          <PathSwitcher paths={open} current={template.path.slug} hrefFor={(slug) => `/examen-blanc?parcours=${slug}`} />
          <p className="mt-3 text-encre-doux">Parcours : {template.path.title}</p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact value={String(template.questionCount)} label="questions" />
            <Fact value={`${Math.round(template.durationSeconds / 60)} min`} label="au maximum" />
            <Fact value={`${template.passThreshold} / ${template.questionCount}`} label="bonnes réponses pour atteindre le seuil" />
            <Fact value="1 sur 4" label="une seule bonne réponse par question" />
          </dl>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-labelledby="consignes" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
              <h2 id="consignes" className="text-[1.375rem]">
                Consignes
              </h2>
              <ul className="mt-4 grid gap-3">
                {rules.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-1 size-[18px] flex-none text-sapin-500" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-r-lg border-l-4 border-ocre-500 bg-ocre-100 px-4 py-3 text-petit">
                C’est un entraînement : son résultat n’a aucune valeur officielle. Seul l’examen officiel donne l’attestation.
              </p>
            </section>

            <section aria-labelledby="composition" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
              <h2 id="composition" className="text-[1.375rem]">
                Les questions
              </h2>
              <p className="mt-2 text-petit text-encre-doux">
                {template.knowledgeCount} questions de connaissance et {template.situationCount} mises en situation, réparties comme à
                l’examen :
              </p>
              <table className="mt-4 w-full text-petit">
                <thead className="sr-only">
                  <tr>
                    <th>Thème</th>
                    <th>Nombre de questions</th>
                  </tr>
                </thead>
                <tbody>
                  {template.composition.map((row) => (
                    <tr key={row.topic.slug} className="border-t border-ligne first:border-t-0">
                      <td className="py-2 pr-3">{row.topic.title}</td>
                      <td className="py-2 text-right tabular-nums">
                        <strong>{row.knowledge + row.situation}</strong>
                        {row.situation > 0 && <span className="block text-xs text-encre-doux">dont {row.situation} mises en situation</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {template.regulatoryRef && (
                <p className="mt-4 flex items-start gap-1.5 text-[0.8125rem] leading-snug text-encre-doux">
                  <SourceIcon className="mt-0.5 size-3.5 flex-none" />
                  <span>{template.regulatoryRef}</span>
                </p>
              )}
            </section>
          </div>

          <div className="mt-8 rounded-carte bg-sapin-50 p-6">
            {history.active ? (
              <div className="grid justify-items-start gap-3">
                <p>Vous avez un examen blanc en cours. Le chronomètre continue de tourner.</p>
                <Link href={`/examen-blanc/${history.active.id}`} className={buttonClasses('primary')}>
                  Reprendre l’examen en cours
                </Link>
              </div>
            ) : template.available && template.access.freeExamsLeft === 0 ? (
              <div className="grid justify-items-start gap-3">
                <p className="font-bold">Vous avez utilisé l’examen blanc de l’offre gratuite.</p>
                <p>Le Premium ouvre des examens blancs illimités, tirés à chaque fois parmi toutes les questions.</p>
                <OfferLink place="examen-blanc" path={template.path.slug} className={buttonClasses('primary')}>
                  Voir l’offre Premium
                </OfferLink>
              </div>
            ) : template.available ? (
              <div className="grid gap-3">
                <p>Prévoyez {Math.round(template.durationSeconds / 60)} minutes au calme. Le chronomètre démarre au clic.</p>
                {template.access.freeExamsLeft !== null && (
                  <p className="text-petit text-encre-doux">
                    Offre gratuite : {template.access.freeExamsLeft} examen{template.access.freeExamsLeft > 1 ? 's' : ''} blanc
                    {template.access.freeExamsLeft > 1 ? 's' : ''} disponible{template.access.freeExamsLeft > 1 ? 's' : ''}.
                  </p>
                )}
                <StartExamButton pathSlug={template.path.slug} />
              </div>
            ) : (
              <p>Il n’y a pas encore assez de questions publiées pour un examen blanc complet. Entraînez-vous par thème en attendant.</p>
            )}
          </div>

          {history.finished.length > 0 && (
            <section aria-labelledby="historique" className="mt-10">
              <h2 id="historique" className="text-[1.375rem]">
                Vos derniers examens blancs
              </h2>
              <ul className="mt-4 grid gap-2">
                {history.finished.map((exam) => (
                  <li key={exam.id}>
                    <Link
                      href={`/examen-blanc/${exam.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ligne bg-white px-4 py-3 hover:border-sapin-700"
                    >
                      <span className="text-encre-doux">{dateFormat.format(new Date(exam.endedAt))}</span>
                      <span className="flex items-center gap-3">
                        <strong className="tabular-nums">
                          {exam.score} / {exam.total}
                        </strong>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            exam.thresholdReached ? 'bg-sapin-50 text-sapin-700' : 'bg-ocre-100 text-ocre-700'
                          }`}
                        >
                          {exam.thresholdReached ? 'Seuil atteint' : 'Seuil pas encore atteint'}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse justify-end rounded-carte border border-ligne bg-white p-5">
      <dt className="mt-1 text-petit text-encre-doux">{label}</dt>
      <dd className="font-titre text-[1.75rem] font-semibold leading-none tabular-nums">{value}</dd>
    </div>
  );
}
