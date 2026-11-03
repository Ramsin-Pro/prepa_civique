import { formatDate, questionTypeLabel } from '@/lib/labels';
import type { GlossaryEntry, QuestionType, SourceRef } from '@/lib/types';
import { CheckIcon, SourceIcon } from './icons';

// Éléments communs à l'entraînement et à l'examen blanc.

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

export function optionClasses(state: OptionState): string {
  const base =
    'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-courant transition-colors has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ocre-500 has-[input:disabled]:cursor-default';
  const tones: Record<OptionState, string> = {
    idle: 'border-ligne bg-white hover:border-sapin-500',
    selected: 'border-sapin-700 bg-sapin-50',
    correct: 'border-sapin-500 bg-sapin-50',
    wrong: 'border-brique-700 bg-brique-100',
    dimmed: 'border-ligne bg-white opacity-70',
  };
  return `${base} ${tones[state]}`;
}

export function AnswerLetter({ state, position }: { state: OptionState; position: number }) {
  const tones: Record<OptionState, string> = {
    idle: 'border-ligne',
    selected: 'border-sapin-700 bg-sapin-700 text-white',
    correct: 'border-sapin-500 bg-sapin-500 text-white',
    wrong: 'border-brique-700 bg-brique-700 text-white',
    dimmed: 'border-ligne',
  };
  return (
    <span aria-hidden="true" className={`grid size-8 flex-none place-items-center rounded-full border-2 text-sm font-bold ${tones[state]}`}>
      {state === 'correct' ? <CheckIcon className="size-4" /> : LETTERS[position]}
    </span>
  );
}

export function TypeTag({ type }: { type: QuestionType }) {
  const tone =
    type === 'OFFICIAL_KNOWLEDGE'
      ? 'bg-sapin-50 text-sapin-700'
      : type === 'ORIGINAL_SITUATION'
        ? 'bg-prune-100 text-prune-700'
        : 'bg-ocre-100 text-ocre-700';
  return <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${tone}`}>{questionTypeLabel[type]}</span>;
}

/** Signalé en développement seulement : un brouillon n'est jamais visible en production (cahier §7). */
export function DraftTag() {
  return (
    <span
      title="Contenu en cours de relecture par l’équipe éditoriale. Visible en développement uniquement."
      className="rounded-md border border-dashed border-ocre-500 px-2 py-0.5 text-xs font-bold text-ocre-700"
    >
      Brouillon à relire
    </span>
  );
}

export function SourceLine({ prefix, source, verifiedAt }: { prefix: string; source: SourceRef; verifiedAt?: string | null }) {
  return (
    <p className="flex items-start gap-1.5 text-[0.8125rem] leading-snug text-encre-doux">
      <SourceIcon className="mt-0.5 size-3.5 flex-none" />
      <span>
        {prefix}{' '}
        {source.url ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-sapin-700">
            {source.label}
          </a>
        ) : (
          source.label
        )}
        {verifiedAt && ` · vérifiée le ${formatDate(verifiedAt)}`}
      </span>
    </p>
  );
}

/** Les mots difficiles de la question, expliqués simplement (charte éditoriale §6). */
export function GlossaryList({ entries, title = 'Mots expliqués' }: { entries: readonly GlossaryEntry[]; title?: string }) {
  if (entries.length === 0) return null;
  return (
    <details className="group rounded-xl border border-ligne bg-papier px-4 py-2.5 text-petit open:pb-3">
      <summary className="cursor-pointer font-bold text-encre-doux marker:text-ocre-500 hover:text-sapin-700">
        {title} ({entries.length})
      </summary>
      <dl className="mt-2 grid gap-2">
        {entries.map((entry) => (
          <div key={entry.term}>
            <dt className="font-bold first-letter:uppercase">{entry.term}</dt>
            <dd className="text-encre-doux">{entry.definition}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
