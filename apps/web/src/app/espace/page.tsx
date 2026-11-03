import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/account/logout-button';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { ArrowRightIcon } from '@/components/icons';
import { MasteryBar } from '@/components/mastery-bar';
import { PendingInvitation } from '@/components/organizations/join';
import { apiGet, getMe, resolvePath } from '@/lib/api';
import { frenchDateFormat, plural } from '@/lib/labels';
import type { ExamHistory, Progress } from '@/lib/types';

export const metadata: Metadata = { title: 'Mon espace', robots: { index: false } };
export const dynamic = 'force-dynamic';

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric' });
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rythme proposé avant la date d'examen : les questions pas encore acquises, réparties sur les jours restants.
 * Un repère pour s'organiser, jamais une promesse de réussite (E13).
 */
function studyPlan(examDate: string, progress: Progress) {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const days = Math.round((new Date(examDate.slice(0, 10)).getTime() - today) / DAY_MS);
  const remaining = Math.max(0, progress.totals.questions - progress.totals.mastered);
  return { days, remaining, perDay: days > 0 ? Math.ceil(remaining / days) : remaining };
}

// Tableau de bord de l'apprenant (E06) : son accès, sa progression et la prochaine étape utile.
export default async function LearnerSpacePage() {
  const me = await getMe();
  if (!me) redirect('/connexion?suite=/espace');

  let progress: Progress | null = null;
  let history: ExamHistory | null = null;
  try {
    const path = await resolvePath(me.path?.slug);
    if (path) {
      [progress, history] = await Promise.all([
        apiGet<Progress>(`/api/progress?path=${path.slug}`, { personal: true }),
        apiGet<ExamHistory>(`/api/exams?path=${path.slug}`, { personal: true }),
      ]);
    }
  } catch {
    // La page reste utile sans la progression (accès, compte).
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Eyebrow>Mon espace</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.75rem]">Bonjour !</h1>
      <p className="mt-2 text-encre-doux">Connecté avec {me.email}</p>
      {!me.organization.memberOf && (
        <div className="mt-6">
          <PendingInvitation />
        </div>
      )}
      {me.organization.owned && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-carte border-2 border-sapin-700 bg-white p-5">
          <p>
            <strong>Vous gérez l’espace de votre structure, {me.organization.owned}.</strong> Places, lien d’invitation et suivi du groupe.
          </p>
          <Link href="/espace/structure" className={buttonClasses('primary')}>
            Ouvrir ma structure
          </Link>
        </div>
      )}

      {history?.active && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-carte border-2 border-ocre-500 bg-white p-5">
          <p>
            <strong>Vous avez un examen blanc en cours.</strong> Le chronomètre continue de tourner.
          </p>
          <Link href={`/examen-blanc/${history.active.id}`} className={buttonClasses('primary')}>
            Reprendre l’examen
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="progression" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
          <h2 id="progression" className="text-[1.375rem]">
            {progress ? `Votre préparation : ${progress.path.title}` : 'Votre préparation'}
          </h2>
          {progress ? (
            <>
              <div className="mt-4">
                <MasteryBar label="Questions acquises" mastered={progress.totals.mastered} seen={progress.totals.seen} total={progress.totals.questions} />
              </div>
              <p className="mt-3 text-petit text-encre-doux">
                {plural(progress.totals.mastered, 'question acquise', 'questions acquises')} sur {progress.totals.questions},{' '}
                {plural(progress.totals.toReview, 'question à revoir', 'questions à revoir')} maintenant.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {progress.totals.toReview > 0 ? (
                  <Link href={`/entrainement/${progress.path.slug}/revisions`} className={buttonClasses('primary')}>
                    Faire mes révisions
                    <ArrowRightIcon className="size-5" />
                  </Link>
                ) : (
                  <Link href="/entrainement" className={buttonClasses('primary')}>
                    Continuer l’entraînement
                    <ArrowRightIcon className="size-5" />
                  </Link>
                )}
                <Link href="/examen-blanc" className={buttonClasses('secondary')}>
                  Examen blanc
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-3 text-encre-doux">Commencez par un thème : chaque réponse est corrigée et expliquée.</p>
          )}
        </section>

        <section aria-labelledby="acces" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
          <h2 id="acces" className="text-[1.375rem]">
            Mon accès
          </h2>
          {me.premium.active && me.premium.until ? (
            <>
              <p className="mt-3 inline-flex rounded-md bg-sapin-50 px-2.5 py-1 text-petit font-bold text-sapin-700">Premium</p>
              <p className="mt-3">Toutes les questions et les examens blancs illimités, jusqu’au {dateFormat.format(new Date(me.premium.until))}.</p>
              {me.organization.memberOf && <p className="mt-1">Accès offert par {me.organization.memberOf}.</p>}
              <p className="mt-1 text-petit text-encre-doux">L’accès s’arrête seul à cette date : aucun renouvellement automatique.</p>
            </>
          ) : (
            <>
              <p className="mt-3">Offre gratuite : une partie des questions de chaque thème et un examen blanc.</p>
              <Link href="/tarifs" className={buttonClasses('primary', 'mt-4 min-h-11 text-petit')}>
                Voir l’offre Premium
              </Link>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="rythme" className="mt-4 rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <h2 id="rythme" className="text-[1.375rem]">
          Mon rythme
        </h2>
        {me.examDate && progress ? (
          <StudyPlanText examDate={me.examDate} progress={progress} />
        ) : (
          <p className="mt-2">
            Indiquez la date de votre examen pour avoir un rythme de révision.{' '}
            <Link href="/espace/compte#demarche" className="text-sapin-700 underline underline-offset-4">
              Indiquer la date
            </Link>
          </p>
        )}
        {!me.reminders && (
          <p className="mt-2 text-petit text-encre-doux">
            Vous pouvez aussi recevoir un rappel par email quand des questions sont à revoir, dans{' '}
            <Link href="/espace/compte#demarche" className="text-sapin-700 underline underline-offset-4">
              mon compte
            </Link>
            .
          </p>
        )}
      </section>

      <nav aria-label="Raccourcis" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/fiches', label: 'Fiches de révision' },
          { href: '/progression', label: 'Ma progression détaillée' },
          ...(progress ? [{ href: `/entrainement/${progress.path.slug}/favoris`, label: 'Mes favoris' }] : []),
          { href: '/espace/compte', label: 'Mon compte et mes données' },
          { href: '/espace/temoignage', label: 'Donner mon avis' },
          ...(me.staff ? [{ href: '/admin', label: 'Back-office' }] : []),
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-14 items-center justify-between gap-3 rounded-carte border border-ligne bg-white px-4 font-bold hover:border-sapin-500 hover:text-sapin-700"
          >
            {link.label}
            <ArrowRightIcon className="size-5 flex-none" />
          </Link>
        ))}
      </nav>

      <div className="mt-10">
        <LogoutButton />
      </div>
    </div>
  );
}

function StudyPlanText({ examDate, progress }: { examDate: string; progress: Progress }) {
  const plan = studyPlan(examDate, progress);
  if (plan.days < 0) {
    return (
      <p className="mt-2">
        La date de votre examen ({dateFormat.format(new Date(examDate))}) est passée.{' '}
        <Link href="/espace/compte#demarche" className="text-sapin-700 underline underline-offset-4">
          Mettre à jour la date
        </Link>
      </p>
    );
  }
  return (
    <p className="mt-2">
      Votre examen : {plan.days === 0 ? 'aujourd’hui' : `dans ${plural(plan.days, 'jour')}`} ({dateFormat.format(new Date(examDate))}).{' '}
      {plan.remaining === 0
        ? 'Toutes les questions sont acquises : gardez le rythme avec vos révisions.'
        : `Pour travailler toutes les questions avant, comptez environ ${plural(plan.perDay, 'question')} par jour, en plus de vos révisions.`}
    </p>
  );
}
