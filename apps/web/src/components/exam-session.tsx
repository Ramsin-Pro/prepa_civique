'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SERVICE_UNAVAILABLE, readErrorMessage } from '@/lib/errors';
import { frenchDateFormat } from '@/lib/labels';
import type { AnswerId, ExamQuestion, ExamTemplateSummary, ExamView } from '@/lib/types';
import { buttonClasses } from './button';
import { ClockIcon, CorrectBadge, RetryBadge } from './icons';
import { OfferLink } from './premium/offer-link';
import { ProposeToAssociation, ShareWithFriend } from './share/share-actions';
import { AnswerLetter, DraftTag, SourceLine, TypeTag, optionClasses } from './question-ui';
import { SpeakButton } from './speak-button';

// L'identifiant vient de l'adresse de la page : seul un UUID est accepté, pour qu'une adresse fabriquée
// (/examen-blanc/../…) ne fasse jamais appeler une autre adresse de l'API par le navigateur.
const EXAM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = 'Examen blanc introuvable.';

/** Adresse de l'API pour un examen blanc : identifiant vérifié, puis encodé. */
const examUrl = (id: string, suffix = '') => `/api/exams/${encodeURIComponent(id)}${suffix}`;

/** Examen blanc (E10) puis son résultat (E11). */
export function ExamSession({ id }: { id: string }) {
  const validId = EXAM_ID.test(id);
  const [exam, setExam] = useState<ExamView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    fetch(examUrl(id))
      .then(async (res) => {
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return (await res.json()) as ExamView;
      })
      .then((data) => !cancelled && setExam(data))
      .catch((caught: unknown) => !cancelled && setError(caught instanceof Error ? caught.message : SERVICE_UNAVAILABLE));
    return () => {
      cancelled = true;
    };
  }, [id, validId]);

  const message = validId ? error : NOT_FOUND;
  if (message) {
    return (
      <div className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <p role="alert">{message}</p>
        <Link href="/examen-blanc" className={buttonClasses('secondary', 'mt-4')}>
          Retour à l’examen blanc
        </Link>
      </div>
    );
  }
  if (!exam) {
    return (
      <p aria-live="polite" className="rounded-carte border border-ligne bg-white p-6 text-encre-doux shadow-carte">
        Chargement de l’examen…
      </p>
    );
  }
  return exam.result ? <ExamResultView exam={exam} /> : <ExamRunner exam={exam} onFinished={setExam} />;
}

function useRemainingSeconds(expiresAt: string): number {
  const end = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const compute = useCallback(() => Math.max(0, Math.ceil((end - Date.now()) / 1000)), [end]);
  const [remaining, setRemaining] = useState(compute);
  useEffect(() => {
    const timer = setInterval(() => setRemaining(compute()), 1000);
    return () => clearInterval(timer);
  }, [compute]);
  return remaining;
}

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function ExamRunner({ exam, onFinished }: { exam: ExamView; onFinished: (exam: ExamView) => void }) {
  const [answers, setAnswers] = useState<Record<number, AnswerId | null>>(() =>
    Object.fromEntries(exam.questions.map((question) => [question.id, question.answerId])),
  );
  const [index, setIndex] = useState(() => Math.max(0, exam.questions.findIndex((question) => question.answerId === null)));
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const statementRef = useRef<HTMLHeadingElement>(null);
  const finishStarted = useRef(false);
  const announced = useRef({ ten: false, one: false });
  const remaining = useRemainingSeconds(exam.expiresAt);

  const total = exam.questions.length;
  const answeredCount = exam.questions.filter((question) => answers[question.id] != null).length;
  const question = exam.questions[index]!;

  const finish = useCallback(async () => {
    if (finishStarted.current) return;
    finishStarted.current = true;
    setFinishing(true);
    try {
      const res = await fetch(examUrl(exam.id, '/finish'), { method: 'POST' });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      onFinished((await res.json()) as ExamView);
    } catch (caught) {
      finishStarted.current = false;
      setFinishing(false);
      setNotice(caught instanceof Error ? caught.message : SERVICE_UNAVAILABLE);
    }
  }, [exam.id, onFinished]);

  // Fin automatique à l'expiration du temps (E10).
  useEffect(() => {
    if (remaining <= 0) void finish();
  }, [remaining, finish]);

  // Annonces pour les lecteurs d'écran, sans annoncer chaque seconde.
  useEffect(() => {
    if (remaining <= 600 && remaining > 60 && !announced.current.ten) {
      announced.current.ten = true;
      setAnnouncement('Il reste 10 minutes.');
    } else if (remaining <= 60 && remaining > 0 && !announced.current.one) {
      announced.current.one = true;
      setAnnouncement('Il reste 1 minute.');
    }
  }, [remaining]);

  // Avertissement avant de quitter la page pendant l'examen (E10).
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    statementRef.current?.focus();
  }, [index]);

  async function choose(questionId: number, answerId: AnswerId) {
    const previous = answers[questionId] ?? null;
    setAnswers((current) => ({ ...current, [questionId]: answerId }));
    setNotice(null);
    try {
      const res = await fetch(examUrl(exam.id, `/answers/${questionId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId }),
      });
      if (res.status === 409) {
        void finish();
        return;
      }
      if (!res.ok) throw new Error(await readErrorMessage(res));
    } catch {
      setAnswers((current) => ({ ...current, [questionId]: previous }));
      setNotice('Votre réponse n’a pas été enregistrée. Vérifiez votre connexion, puis choisissez-la à nouveau.');
    }
  }

  const urgent = remaining <= 300;

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-10 -mx-4 border-b border-ligne bg-papier/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-2 font-bold tabular-nums ${urgent ? 'text-brique-700' : 'text-encre'}`}>
            <ClockIcon className="size-5" />
            <span className="sr-only">Temps restant :</span>
            {clock(remaining)}
          </span>
          <span className="text-petit text-encre-doux">
            <strong className="text-encre tabular-nums">{answeredCount}</strong> / {total} répondues
          </span>
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            disabled={finishing}
            aria-label="Terminer l’examen"
            className={buttonClasses('secondary', 'min-h-10 px-4 text-petit')}
          >
            <span className="sm:hidden">Terminer</span>
            <span className="max-sm:hidden">Terminer l’examen</span>
          </button>
        </div>
        <div aria-hidden="true" className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ligne">
          <div className="h-full rounded-full bg-sapin-500 transition-[width]" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>

      <div className="rounded-carte border border-ligne bg-white shadow-carte">
        <div className="grid gap-4 px-5 pt-5 sm:gap-5 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-petit text-encre-doux">
              Question <strong className="text-encre">{index + 1}</strong> sur {total}
            </span>
            <TypeTag type={question.type} />
            {question.inReview && <DraftTag />}
          </div>

          <fieldset className="min-w-0" disabled={finishing}>
            <legend>
              <h1 ref={statementRef} tabIndex={-1} className="font-texte text-enonce font-bold tracking-normal">
                {question.statement}
              </h1>
            </legend>
            <div className="mt-5 grid gap-3">
              {question.answers.map((answer, position) => {
                const selected = answers[question.id] === answer.id;
                return (
                  <label key={answer.id} id={`proposition-${position + 1}`} className={optionClasses(selected ? 'selected' : 'idle')}>
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={answer.id}
                      checked={selected}
                      onChange={() => void choose(question.id, answer.id)}
                      className="sr-only"
                    />
                    <AnswerLetter state={selected ? 'selected' : 'idle'} position={position} />
                    <span className="flex-1">{answer.text}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {notice && (
            <p role="alert" className="rounded-xl border border-brique-200 bg-brique-100 px-4 py-3 text-petit">
              {notice}
            </p>
          )}

          {/* Sur téléphone, « Précédente » et « Suivante » restent collés en bas de l'écran. */}
          <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap justify-between gap-3 border-t border-ligne bg-white/95 px-5 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <button
              type="button"
              onClick={() => setIndex((current) => current - 1)}
              disabled={index === 0}
              className={buttonClasses('secondary')}
            >
              Précédente
            </button>
            {index < total - 1 ? (
              <button type="button" onClick={() => setIndex((current) => current + 1)} className={buttonClasses('primary')}>
                Suivante
              </button>
            ) : (
              <button type="button" onClick={() => dialogRef.current?.showModal()} className={buttonClasses('primary')}>
                Terminer l’examen
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-ligne bg-papier px-5 py-3">
          <button
            type="button"
            onClick={() => setShowGrid((open) => !open)}
            aria-expanded={showGrid}
            className="text-petit font-bold text-encre-doux underline-offset-4 hover:text-sapin-700 hover:underline"
          >
            {showGrid ? 'Masquer la liste des questions' : 'Voir toutes les questions'}
          </button>
          {showGrid && <QuestionGrid questions={exam.questions} answers={answers} current={index} onSelect={setIndex} />}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="terminer-titre"
        className="m-auto w-[min(92vw,28rem)] rounded-carte border border-ligne bg-white p-6 text-encre shadow-carte backdrop:bg-encre/50"
      >
        <h2 id="terminer-titre" className="text-[1.375rem]">
          Terminer l’examen blanc ?
        </h2>
        <p className="mt-3">
          {answeredCount === total
            ? 'Vous avez répondu à toutes les questions.'
            : `Il reste ${total - answeredCount} question${total - answeredCount > 1 ? 's' : ''} sans réponse. Une question sans réponse compte comme une erreur.`}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClasses('secondary')}>
            Revenir aux questions
          </button>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              void finish();
            }}
            className={buttonClasses('primary')}
          >
            Terminer maintenant
          </button>
        </div>
      </dialog>
    </div>
  );
}

function QuestionGrid({
  questions,
  answers,
  current,
  onSelect,
}: {
  questions: ExamQuestion[];
  answers: Record<number, AnswerId | null>;
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="mt-3 grid grid-cols-8 gap-2 sm:grid-cols-10">
      {questions.map((question, index) => {
        const answered = answers[question.id] != null;
        return (
          <li key={question.id}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={index === current ? 'step' : undefined}
              aria-label={`Question ${index + 1}, ${answered ? 'répondue' : 'sans réponse'}`}
              className={`grid size-10 place-items-center rounded-lg border-2 text-sm font-bold tabular-nums ${
                answered ? 'border-sapin-500 bg-sapin-50 text-sapin-700' : 'border-ligne bg-white text-encre-doux'
              } ${index === current ? 'ring-2 ring-ocre-500 ring-offset-1' : ''}`}
            >
              {index + 1}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Résultat (E11) : seuil atteint ou non, sans jamais laisser croire à une réussite officielle. */
function ExamResultView({ exam }: { exam: ExamView }) {
  const result = exam.result!;
  const [onlyMistakes, setOnlyMistakes] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  // Après l'examen gratuit, c'est le moment où l'on veut s'entraîner encore : on dit simplement ce que le Premium ajoute.
  const [freeExamsLeft, setFreeExamsLeft] = useState<number | null>(null);
  useEffect(() => {
    fetch(`/api/exams/template?${new URLSearchParams({ path: exam.path.slug })}`)
      .then((res) => (res.ok ? (res.json() as Promise<ExamTemplateSummary>) : null))
      .then((template) => setFreeExamsLeft(template && !template.access.premium ? template.access.freeExamsLeft : null))
      .catch(() => undefined);
  }, [exam.path.slug]);

  // Page d'avis publique (Google, Trustpilot…), si l'équipe en a configuré une.
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/plans')
      .then((res) => (res.ok ? (res.json() as Promise<{ reviewUrl: string | null }>) : null))
      .then((plans) => setReviewUrl(plans?.reviewUrl ?? null))
      .catch(() => undefined);
  }, []);

  const questionsById = new Map(exam.questions.map((question) => [question.id, question]));
  const mistakes = result.corrections.filter((correction) => !correction.correct);
  const shown = onlyMistakes ? mistakes : result.corrections;
  const weakest = result.byTopic
    .filter((topic) => topic.correct < topic.total)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, 2);
  const percent = Math.round((result.score / result.total) * 100);

  return (
    <div className="grid gap-6">
      <section className="rounded-carte border border-ligne bg-white p-6 shadow-carte sm:p-8">
        <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-encre-doux">
          Résultat de l’examen blanc · {exam.endedAt ? dateFormat.format(new Date(exam.endedAt)) : ''}
        </p>
        <div className="mt-5 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <div
            role="img"
            aria-label={`${result.score} bonnes réponses sur ${result.total}`}
            className="grid size-36 place-items-center rounded-full"
            style={{
              background: `conic-gradient(${result.thresholdReached ? 'var(--color-sapin-500)' : 'var(--color-ocre-500)'} 0 ${percent}%, var(--color-ligne) ${percent}% 100%)`,
            }}
          >
            <div className="grid size-28 place-content-center rounded-full bg-white text-center">
              <strong className="font-titre text-[2.25rem] leading-none tabular-nums">{result.score}</strong>
              <span className="text-petit text-encre-doux">sur {result.total}</span>
            </div>
          </div>
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] leading-tight">
              {result.thresholdReached ? 'Seuil atteint' : 'Seuil pas encore atteint'}
            </h1>
            <p className="mt-2 text-encre-doux">
              Le seuil est de {result.passThreshold} bonnes réponses sur {result.total}.{' '}
              {result.thresholdReached
                ? 'Continuez à réviser pour garder ce niveau le jour de l’examen.'
                : `Il vous manque ${result.passThreshold - result.score} bonne${result.passThreshold - result.score > 1 ? 's' : ''} réponse${result.passThreshold - result.score > 1 ? 's' : ''}.`}
            </p>
          </div>
        </div>
        <p className="mt-6 rounded-r-lg border-l-4 border-ocre-500 bg-ocre-100 px-4 py-3 text-petit">
          C’est un entraînement. Seul l’examen officiel donne l’attestation de réussite.
        </p>
      </section>

      <section aria-labelledby="par-theme" className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <h2 id="par-theme" className="text-[1.375rem]">
          Par thème
        </h2>
        <ul className="mt-4 grid gap-3">
          {result.byTopic.map((topic) => {
            const ratio = topic.total > 0 ? topic.correct / topic.total : 0;
            return (
              <li key={topic.slug} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-petit">
                <span>{topic.title}</span>
                <span className="tabular-nums text-encre-doux">
                  {topic.correct} / {topic.total}
                </span>
                <span className="col-span-2 h-2 overflow-hidden rounded-full bg-ligne">
                  <span
                    className={`block h-full rounded-full ${ratio >= 0.8 ? 'bg-sapin-500' : 'bg-ocre-500'}`}
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
        {weakest.length > 0 && (
          <div className="mt-6 rounded-xl bg-sapin-50 p-4">
            <p className="font-bold">À revoir en priorité</p>
            <ul className="mt-2 grid gap-1.5">
              {weakest.map((topic) => (
                <li key={topic.slug}>
                  <Link href={`/entrainement/${exam.path.slug}/${topic.slug}`} className="text-sapin-700 underline underline-offset-4">
                    {topic.title}
                  </Link>{' '}
                  <span className="text-petit text-encre-doux">
                    ({topic.correct} / {topic.total})
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-petit text-encre-doux">
              Vos erreurs ont été ajoutées à vos révisions. Les questions sans réponse vous seront proposées dans vos prochaines séries.
            </p>
          </div>
        )}
        {freeExamsLeft !== null && (
          <div className="mt-6 rounded-xl border border-ocre-100 bg-ocre-100/50 p-4">
            {/* Sous le seuil, l'offre parle de ce qui manque vraiment : le nombre de bonnes réponses et les thèmes faibles. */}
            <p className="font-bold">
              {result.thresholdReached ? 'Envie de refaire un examen blanc ?' : `Il vous manque ${result.passThreshold - result.score} bonne${result.passThreshold - result.score > 1 ? 's' : ''} réponse${result.passThreshold - result.score > 1 ? 's' : ''} pour le seuil`}
            </p>
            <p className="mt-1 text-petit">
              {!result.thresholdReached && weakest.length > 0
                ? `Vos thèmes les plus fragiles : ${weakest.map((topic) => topic.title).join(' et ')}. `
                : ''}
              {freeExamsLeft === 0 ? 'Votre examen blanc gratuit est utilisé. ' : ''}Le pass Premium, payé une seule fois et sans abonnement,
              ouvre toutes les questions de votre parcours et des examens blancs illimités, pour vous entraîner jusqu’au jour J.
            </p>
            <OfferLink place="resultat-examen" path={exam.path.slug} className={buttonClasses('primary', 'mt-3 min-h-11 text-petit')}>
              Voir l’offre Premium
            </OfferLink>
          </div>
        )}
        {freeExamsLeft !== null && <ProposeToAssociation className="mt-4" />}
        {result.thresholdReached && (
          <>
            <ShareWithFriend className="mt-4" />
            {reviewUrl && (
              <p className="mt-4 text-petit">
                Le site vous aide ?{' '}
                <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-sapin-700 underline underline-offset-4">
                  Laissez un avis public
                </a>{' '}
                : il aide d’autres candidats à choisir.
              </p>
            )}
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/entrainement/${exam.path.slug}/revisions`} className={buttonClasses('primary')}>
            Revoir mes erreurs
          </Link>
          <Link href={`/examen-blanc?parcours=${exam.path.slug}`} className={buttonClasses('secondary')}>
            Repasser un examen blanc
          </Link>
          <Link href="/progression" className={buttonClasses('quiet')}>
            Ma progression
          </Link>
        </div>
      </section>

      <section aria-labelledby="correction" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="correction" className="text-[1.375rem]">
            Correction
          </h2>
          <label className="flex items-center gap-2 text-petit">
            <input
              type="checkbox"
              checked={onlyMistakes}
              onChange={(event) => setOnlyMistakes(event.target.checked)}
              className="size-5 accent-sapin-700"
            />
            Seulement mes erreurs ({mistakes.length})
          </label>
        </div>
        {shown.length === 0 && <p className="text-encre-doux">Aucune erreur : toutes vos réponses sont justes.</p>}
        {shown.map((correction) => {
          const question = questionsById.get(correction.questionId);
          if (!question) return null;
          const chosen = question.answers.find((answer) => answer.id === correction.chosenAnswerId);
          const right = question.answers.find((answer) => answer.id === correction.correctAnswerId);
          return (
            <article key={correction.questionId} className="grid gap-3 rounded-carte border border-ligne bg-white p-5 shadow-carte">
              <div className="flex flex-wrap items-center gap-2 text-petit text-encre-doux">
                <span>Question {correction.position + 1}</span>
                <span aria-hidden="true">·</span>
                <span>{question.topic.title}</span>
                <TypeTag type={question.type} />
              </div>
              <h3 className="text-[1.125rem] font-bold leading-snug">{question.statement}</h3>
              <p className={`flex items-start gap-2 font-bold ${correction.correct ? 'text-sapin-700' : 'text-brique-700'}`}>
                {correction.correct ? <CorrectBadge className="size-5 flex-none" /> : <RetryBadge className="size-5 flex-none" />}
                <span>
                  {correction.correct
                    ? 'Bonne réponse'
                    : chosen
                      ? `Votre réponse : ${chosen.text}`
                      : 'Pas de réponse'}
                </span>
              </p>
              {!correction.correct && right && (
                <p>
                  La bonne réponse est : <strong>{right.text}</strong>
                </p>
              )}
              <p className="text-encre-doux">{correction.explanation}</p>
              {correction.sheet && (
                <p className="text-petit">
                  Pour aller plus loin :{' '}
                  <Link href={`/fiches/${correction.sheet.slug}`} className="font-bold text-sapin-700 underline underline-offset-4">
                    fiche « {correction.sheet.title} »
                  </Link>
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {correction.answerSource ? <SourceLine prefix="Source :" source={correction.answerSource} /> : <span />}
                <SpeakButton
                  text={`${right ? `La bonne réponse est : ${right.text}. ` : ''}${correction.explanation}`}
                  src={`/api/speech/correction/${correction.questionId}`}
                  label="Écouter"
                />
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
