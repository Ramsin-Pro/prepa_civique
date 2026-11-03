'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { SERVICE_UNAVAILABLE, readErrorMessage } from '@/lib/errors';
import type { AnswerId, CheckResult, GlossaryEntry, PublicQuestion, TrainingAccess, TrainingMode } from '@/lib/types';
import { buttonClasses } from './button';
import { FavoriteButton } from './favorite-button';
import { CorrectBadge, RetryBadge } from './icons';
import { AnswerLetter, DraftTag, GlossaryList, LETTERS, SourceLine, TypeTag, optionClasses, type OptionState } from './question-ui';
import { OfferLink } from './premium/offer-link';
import { RouteProgress, type Outcome } from './route-progress';
import { SpeakButton } from './speak-button';

const QUESTIONS_PER_SERIES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// Reprise après une interruption (E08) : la série en cours est gardée sur l'appareil pendant 24 heures.
type SavedSeries = {
  savedAt: number;
  questions: PublicQuestion[];
  access: TrainingAccess | null;
  index: number;
  answered: Record<number, { selected: AnswerId; result: CheckResult }>;
  outcomes: Outcome[];
};

/** Une série gardée avant le passage aux identifiants opaques (des nombres) n'est plus valable : on la recommence. */
const hasOpaqueAnswerIds = (questions: readonly PublicQuestion[]) =>
  questions.every((question) => question.answers.every((answer) => typeof answer.id === 'string'));

function readSeries(key: string): SavedSeries | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as SavedSeries | null;
    if (!saved || Date.now() - saved.savedAt > DAY_MS || saved.index >= saved.questions.length || saved.questions.length === 0) return null;
    if (!hasOpaqueAnswerIds(saved.questions)) return null;
    return saved;
  } catch {
    return null;
  }
}

function writeSeries(key: string, series: SavedSeries | null) {
  try {
    if (series) localStorage.setItem(key, JSON.stringify(series));
    else localStorage.removeItem(key);
  } catch {
    // stockage indisponible (navigation privée) : la série n'est simplement pas gardée
  }
}

type Props = {
  pathSlug: string;
  mode: TrainingMode;
  topicSlug?: string;
  notion?: string;
  /** Filtres d'une série personnalisée (E07) */
  difficulty?: number;
  seen?: 'new' | 'seen';
  size?: number;
};

export function Quiz({ pathSlug, mode, topicSlug, notion, difficulty, seen, size = QUESTIONS_PER_SERIES }: Props) {
  const [series, setSeries] = useState(0); // incrémenté pour recommencer une série
  const [questions, setQuestions] = useState<PublicQuestion[] | null>(null);
  const [access, setAccess] = useState<TrainingAccess | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<AnswerId | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  // Questions déjà corrigées de la série, pour revenir en arrière (E08 « précédent ») sans rejouer la réponse.
  const [answered, setAnswered] = useState<Record<number, { selected: AnswerId; result: CheckResult }>>({});
  const [viewing, setViewing] = useState<number | null>(null);
  const [resumed, setResumed] = useState(false);
  const storageKey = `repere:serie:${pathSlug}:${mode}:${topicSlug ?? ''}:${notion ?? ''}:${difficulty ?? ''}:${seen ?? ''}:${size}`;

  const cardRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLHeadingElement>(null);
  const correctionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setQuestions(null);
    setLoadError(null);
    setIndex(0);
    setSelected(null);
    setResult(null);
    setOutcomes([]);
    setAnswered({});
    setViewing(null);
    setResumed(false);

    // Première ouverture : on reprend la série interrompue s'il y en a une. « Nouvelle série » repart de zéro.
    const saved = series === 0 ? readSeries(storageKey) : null;
    if (series > 0) writeSeries(storageKey, null);
    if (saved) {
      const current = saved.answered[saved.index];
      setQuestions(saved.questions);
      setAccess(saved.access);
      setIndex(saved.index);
      setAnswered(saved.answered);
      setOutcomes(saved.outcomes);
      setSelected(current?.selected ?? null);
      setResult(current?.result ?? null);
      setResumed(true);
      return;
    }

    const query = new URLSearchParams({ path: pathSlug, mode, limit: String(size) });
    if (topicSlug) query.set('topic', topicSlug);
    if (notion) query.set('notion', notion);
    if (difficulty) query.set('difficulty', String(difficulty));
    if (seen) query.set('seen', seen);
    fetch(`/api/training/questions?${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return (await res.json()) as { questions: PublicQuestion[]; access: TrainingAccess };
      })
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.questions);
        setAccess(data.access);
      })
      .catch((error: unknown) => !cancelled && setLoadError(error instanceof Error ? error.message : SERVICE_UNAVAILABLE));

    return () => {
      cancelled = true;
    };
  }, [pathSlug, mode, topicSlug, notion, difficulty, seen, size, series, storageKey]);

  // La série est gardée après chaque réponse, et oubliée une fois terminée.
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    if (index >= questions.length) writeSeries(storageKey, null);
    else writeSeries(storageKey, { savedAt: Date.now(), questions, access, index, answered, outcomes });
  }, [storageKey, questions, access, index, answered, outcomes]);

  // Accessibilité : la correction reçoit le focus quand elle apparaît, la question suivante aussi.
  useEffect(() => {
    if (result) correctionRef.current?.focus();
  }, [result]);
  useEffect(() => {
    if (index === 0 && viewing === null) return;
    // La carte revient en haut de l'écran (progression et étiquettes visibles), puis le focus va sur l'énoncé.
    cardRef.current?.scrollIntoView({ block: 'start' });
    statementRef.current?.focus({ preventScroll: true });
  }, [index, viewing]);

  if (loadError) {
    return (
      <Panel>
        <p role="alert">{loadError}</p>
        <button type="button" onClick={() => setSeries((n) => n + 1)} className={buttonClasses('secondary', 'mt-4')}>
          Réessayer
        </button>
      </Panel>
    );
  }

  if (!questions) {
    return (
      <Panel>
        <p aria-live="polite" className="text-encre-doux">
          Chargement des questions…
        </p>
      </Panel>
    );
  }

  if (questions.length === 0) return <EmptySeries mode={mode} locked={access?.locked ?? 0} />;

  const score = outcomes.filter((outcome) => outcome === 'correct').length;

  if (index >= questions.length) {
    return (
      <Summary
        mode={mode}
        score={score}
        total={questions.length}
        outcomes={outcomes}
        access={access}
        onRestart={() => setSeries((n) => n + 1)}
      />
    );
  }

  // La question affichée : celle en cours, ou une question déjà corrigée revue en arrière.
  const shown = viewing ?? index;
  const reviewing = viewing !== null;
  const question = questions[shown]!;
  const isLast = index === questions.length - 1;
  const shownSelected = reviewing ? (answered[shown]?.selected ?? null) : selected;
  const shownResult = reviewing ? (answered[shown]?.result ?? null) : result;

  async function validate() {
    if (selected === null) return;
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch(`/api/training/questions/${question.id}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId: selected }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const checked = (await res.json()) as CheckResult;
      setResult(checked);
      setAnswered((previous) => ({ ...previous, [index]: { selected, result: checked } }));
      setOutcomes((previous) => [...previous, checked.correct ? 'correct' : 'wrong']);
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : SERVICE_UNAVAILABLE);
    } finally {
      setChecking(false);
    }
  }

  function next() {
    setIndex((current) => current + 1);
    setSelected(null);
    setResult(null);
    setCheckError(null);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (reviewing) return;
    if (result) next();
    else void validate();
  }

  const correctText = shownResult ? question.answers.find((answer) => answer.id === shownResult.correctAnswerId)?.text : undefined;
  const spokenQuestion = `${question.statement} ${question.answers.map((answer, position) => `Réponse ${LETTERS[position]} : ${answer.text}.`).join(' ')}`;
  // L'extrait audio lit les propositions dans l'ordre affiché, désignées par leurs identifiants opaques.
  const questionAudio = `/api/speech/question/${question.id}?${new URLSearchParams({ order: question.answers.map((answer) => answer.id).join(',') })}`;
  const glossary = mergeGlossary(question.glossary, shownResult?.glossary ?? []);

  return (
    <>
      {resumed && (
        <p role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-carte bg-sapin-50 px-4 py-2.5 text-petit">
          <span>Vous reprenez votre série là où vous l’aviez laissée.</span>
          <button type="button" onClick={() => setSeries((n) => n + 1)} className="font-bold text-sapin-700 underline underline-offset-4">
            Commencer une nouvelle série
          </button>
        </p>
      )}
      <div ref={cardRef} className="scroll-mt-4 overflow-clip rounded-carte border border-ligne bg-white shadow-carte">
        <div className="border-b border-ligne px-5 pb-3 pt-4">
          <div className="mb-2.5 flex items-center justify-between text-petit">
            <span className="text-encre-doux">
              Question <strong className="text-encre">{shown + 1}</strong> sur {questions.length}
              {reviewing && ' · déjà corrigée'}
            </span>
            <span className="text-encre-doux">
              <strong className="text-encre tabular-nums">{score}</strong> bonne{score > 1 ? 's' : ''} réponse{score > 1 ? 's' : ''}
            </span>
          </div>
          <RouteProgress total={questions.length} current={index} outcomes={outcomes} />
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 px-5 pt-5 sm:gap-5 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <TypeTag type={question.type} />
            {mode !== 'topic' && (
              <span className="rounded-md bg-papier px-2 py-0.5 text-xs font-bold text-encre-doux">{question.topic.title}</span>
            )}
            {question.inReview && <DraftTag />}
            <span className="ml-auto flex flex-wrap gap-2">
              <SpeakButton text={spokenQuestion} src={questionAudio} label="Écouter la question" />
              <FavoriteButton key={question.id} endpoint={`/api/favorites/${question.id}`} initial={question.favorite} compact />
            </span>
          </div>

          <fieldset disabled={shownResult !== null || checking || reviewing} className="min-w-0">
            <legend>
              <h2 ref={statementRef} tabIndex={-1} className="font-texte text-enonce font-bold tracking-normal">
                {question.statement}
              </h2>
            </legend>
            <div className="mt-5 grid gap-3">
              {question.answers.map((answer, position) => {
                const state = optionState(answer.id, shownSelected, shownResult);
                return (
                  <label key={answer.id} id={`proposition-${position + 1}`} className={optionClasses(state)}>
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={answer.id}
                      checked={shownSelected === answer.id}
                      onChange={() => setSelected(answer.id)}
                      className="peer sr-only"
                    />
                    <AnswerLetter state={state} position={position} />
                    <span className="flex-1">{answer.text}</span>
                    {state === 'correct' && <span className="sr-only">(bonne réponse)</span>}
                    {state === 'wrong' && <span className="sr-only">(votre réponse)</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {question.statementSource && <SourceLine prefix="Énoncé repris de la" source={question.statementSource} />}

          {shownResult && (
            <div
              ref={correctionRef}
              tabIndex={-1}
              role="status"
              className={`grid gap-2 rounded-carte border p-5 ${shownResult.correct ? 'border-sapin-100 bg-sapin-50' : 'border-brique-200 bg-brique-100'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`flex items-center gap-2.5 text-[1.0625rem] font-bold ${shownResult.correct ? 'text-sapin-700' : 'text-brique-700'}`}>
                  {shownResult.correct ? <CorrectBadge /> : <RetryBadge />}
                  {shownResult.correct ? 'Bonne réponse' : 'Ce n’est pas la bonne réponse'}
                </p>
                <SpeakButton
                  text={`${correctText ? `La bonne réponse est : ${correctText}. ` : ''}${shownResult.explanation}`}
                  src={`/api/speech/correction/${question.id}`}
                  label="Écouter l’explication"
                />
              </div>
              {!shownResult.correct && correctText && (
                <p>
                  La bonne réponse est : <strong>{correctText}</strong>
                </p>
              )}
              <p>{shownResult.explanation}</p>
              {shownResult.answerSource && <SourceLine prefix="Source :" source={shownResult.answerSource} verifiedAt={shownResult.verifiedAt} />}
              {shownResult.sheet && (
                <p className="text-petit">
                  Pour aller plus loin :{' '}
                  <Link href={`/fiches/${shownResult.sheet.slug}`} className="font-bold text-sapin-700 underline underline-offset-4">
                    fiche « {shownResult.sheet.title} »
                  </Link>
                </p>
              )}
              <p className="mt-1 text-petit text-encre-doux">{reviewMessage(shownResult)}</p>
            </div>
          )}

          <GlossaryList entries={glossary} />

          {checkError && (
            <p role="alert" className="rounded-xl border border-brique-200 bg-brique-100 px-4 py-3 text-petit">
              {checkError}
            </p>
          )}

          {/* Sur téléphone, le bouton principal reste collé en bas de l'écran : pas besoin de faire défiler pour valider. */}
          <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-ligne bg-white/95 px-5 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            {reviewing ? (
              <button
                type="button"
                onClick={() => setViewing(viewing + 1 < index ? viewing + 1 : null)}
                className={buttonClasses('primary', 'w-full sm:w-auto')}
              >
                {viewing + 1 < index ? 'Question suivante' : 'Revenir à la question en cours'}
              </button>
            ) : (
              <button type="submit" disabled={checking || (!result && selected === null)} className={buttonClasses('primary', 'w-full sm:w-auto')}>
                {result ? (isLast ? 'Voir mon bilan' : 'Question suivante') : checking ? 'Vérification…' : 'Valider ma réponse'}
              </button>
            )}
            {shown > 0 && (
              <button type="button" onClick={() => setViewing(shown - 1)} className={buttonClasses('quiet')}>
                ← Question précédente
              </button>
            )}
          </div>
        </form>

        <ReportQuestion key={question.id} questionId={question.id} />
      </div>
    </>
  );
}

function optionState(answerId: AnswerId, selected: AnswerId | null, result: CheckResult | null): OptionState {
  if (!result) return selected === answerId ? 'selected' : 'idle';
  if (answerId === result.correctAnswerId) return 'correct';
  if (answerId === selected) return 'wrong';
  return 'dimmed';
}

function mergeGlossary(first: readonly GlossaryEntry[], second: readonly GlossaryEntry[]): GlossaryEntry[] {
  const seen = new Set(first.map((entry) => entry.term.toLowerCase()));
  return [...first, ...second.filter((entry) => !seen.has(entry.term.toLowerCase()))];
}

/** Rend visible la répétition espacée : l'apprenant sait quand la question reviendra. */
function reviewMessage(result: CheckResult): string {
  if (!result.correct) return 'Cette question reviendra dans vos révisions pour que vous la reteniez.';
  const days = Math.max(1, Math.round((new Date(result.nextReviewAt).getTime() - Date.now()) / DAY_MS));
  return days === 1 ? 'Vous la reverrez demain pour bien la retenir.' : `Vous la reverrez dans ${days} jours pour bien la retenir.`;
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-carte border border-ligne bg-white p-6 shadow-carte">{children}</div>;
}

/** Offre gratuite (E14) : les questions réservées au Premium sont annoncées clairement, sans bloquer la série en cours. */
function LockedNotice({ locked }: { locked: number }) {
  if (locked <= 0) return null;
  return (
    <div className="mt-6 rounded-carte border border-ocre-100 bg-ocre-100/50 p-5 text-left">
      <p className="font-bold">
        {locked} autre{locked > 1 ? 's' : ''} question{locked > 1 ? 's' : ''} {locked > 1 ? 'vous attendent' : 'vous attend'} avec le Premium.
      </p>
      <p className="mt-1 text-petit">
        L’offre gratuite ouvre une partie des questions de chaque thème et un examen blanc. Le Premium ouvre toutes les questions et des
        examens blancs illimités, pour un paiement unique.
      </p>
      <OfferLink place="quiz" className={buttonClasses('primary', 'mt-4 min-h-11 text-petit')}>
        Voir l’offre Premium
      </OfferLink>
    </div>
  );
}

function EmptySeries({ mode, locked }: { mode: TrainingMode; locked: number }) {
  if (mode === 'favorites') {
    return (
      <Panel>
        <h2 className="text-[1.375rem]">Pas encore de favoris</h2>
        <p className="mt-2 text-encre-doux">
          Pendant l’entraînement, touchez « Ajouter aux favoris » pour garder une question sous la main. Vous la retrouverez ici.
        </p>
        <Link href="/entrainement" className={buttonClasses('primary', 'mt-5')}>
          S’entraîner sur un thème
        </Link>
      </Panel>
    );
  }
  if (mode === 'errors') {
    return (
      <Panel>
        <h2 className="text-[1.375rem]">Aucune erreur à revoir</h2>
        <p className="mt-2 text-encre-doux">
          Les questions que vous manquez arrivent ici. Réussissez-les une fois pour les faire sortir de la liste.
        </p>
        <Link href="/entrainement" className={buttonClasses('primary', 'mt-5')}>
          S’entraîner sur un thème
        </Link>
      </Panel>
    );
  }
  if (mode === 'review') {
    return (
      <Panel>
        <h2 className="text-[1.375rem]">Aucune question à revoir pour le moment</h2>
        <p className="mt-2 text-encre-doux">
          Les questions manquées reviennent ici. Celles que vous réussissez reviennent plus tard, à des intervalles de plus en plus
          longs : c’est ce qui permet de les retenir durablement.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/entrainement" className={buttonClasses('primary')}>
            S’entraîner sur un thème
          </Link>
          <Link href="/progression" className={buttonClasses('secondary')}>
            Voir ma progression
          </Link>
        </div>
      </Panel>
    );
  }
  return (
    <Panel>
      <p>{locked > 0 ? 'Vous avez fait toutes les questions gratuites de ce thème.' : 'Les questions de ce thème sont encore en préparation.'}</p>
      <LockedNotice locked={locked} />
      <Link href="/entrainement" className={buttonClasses('secondary', 'mt-4')}>
        Choisir un autre thème
      </Link>
    </Panel>
  );
}

function Summary({
  mode,
  score,
  total,
  outcomes,
  access,
  onRestart,
}: {
  mode: TrainingMode;
  score: number;
  total: number;
  outcomes: Outcome[];
  access: TrainingAccess | null;
  onRestart: () => void;
}) {
  const ratio = total > 0 ? score / total : 0;
  const message =
    ratio >= 0.8
      ? 'Très bien. Les questions réussies reviendront plus tard pour vérifier que vous les retenez.'
      : ratio >= 0.5
        ? 'C’est un bon début. Les questions manquées sont ajoutées à vos révisions.'
        : 'Ce n’est pas grave : c’est en se trompant qu’on apprend. Les questions manquées sont ajoutées à vos révisions.';
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="rounded-carte border border-ligne bg-white p-6 text-center shadow-carte sm:p-8">
      <h2 ref={headingRef} tabIndex={-1} className="text-[1.5rem]">
        {mode === 'review' ? 'Révisions terminées' : mode === 'errors' ? 'Erreurs revues' : 'Série terminée'}
      </h2>
      <p className="mt-3 font-titre text-[3rem] font-semibold leading-none tabular-nums">
        {score}
        <span className="text-[1.25rem] text-encre-doux"> / {total}</span>
      </p>
      <p className="mt-1 text-petit text-encre-doux">bonnes réponses</p>
      <div className="mx-auto mt-5 max-w-sm">
        <RouteProgress total={total} current={total} outcomes={outcomes} />
      </div>
      <p className="mx-auto mt-5 max-w-md">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onRestart} className={buttonClasses('primary')}>
          {mode === 'review' ? 'Continuer mes révisions' : mode === 'errors' ? 'Revoir les erreurs restantes' : 'Refaire une série'}
        </button>
        <Link href="/progression" className={buttonClasses('secondary')}>
          Voir ma progression
        </Link>
      </div>
      {access && !access.premium && <LockedNotice locked={access.locked} />}
      <p className="mt-6 text-petit text-encre-doux">C’est un entraînement : seul l’examen officiel donne l’attestation.</p>
    </div>
  );
}

const REPORT_REASONS = [
  { value: 'WRONG_ANSWER', label: 'La réponse me semble fausse' },
  { value: 'UNCLEAR_STATEMENT', label: 'La question n’est pas claire' },
  { value: 'WRONG_SOURCE', label: 'La source est incorrecte' },
  { value: 'OTHER', label: 'Autre problème' },
];

/** Signaler une erreur (E08) : remonte au back-office. */
function ReportQuestion({ questionId }: { questionId: number }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [reason, setReason] = useState(REPORT_REASONS[0]!.value);
  const [message, setMessage] = useState('');

  async function send(event: FormEvent) {
    event.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(`/api/questions/${questionId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, message: message.trim() || undefined }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <p role="status" className="border-t border-ligne bg-papier px-5 py-3 text-petit text-encre-doux">
        Merci, votre signalement a été transmis à l’équipe de relecture.
      </p>
    );
  }

  return (
    <details className="border-t border-ligne bg-papier px-5 py-3 text-petit">
      <summary className="cursor-pointer text-encre-doux underline-offset-4 hover:text-sapin-700 hover:underline">
        Signaler une erreur dans cette question
      </summary>
      <form onSubmit={send} className="mt-3 grid gap-3">
        <label className="grid gap-1">
          <span className="font-bold">Quel est le problème ?</span>
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-11 rounded-lg border-2 border-ligne bg-white px-3">
            {REPORT_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-bold">
            Précisions <span className="font-normal text-encre-doux">(facultatif, sans information personnelle)</span>
          </span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={1000}
            rows={3}
            className="rounded-lg border-2 border-ligne bg-white px-3 py-2"
          />
        </label>
        {status === 'error' && (
          <p role="alert" className="text-brique-700">
            L’envoi n’a pas abouti. Réessayez dans un instant.
          </p>
        )}
        <div>
          <button type="submit" disabled={status === 'sending'} className={buttonClasses('secondary', 'min-h-11 text-petit')}>
            {status === 'sending' ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
        </div>
      </form>
    </details>
  );
}
