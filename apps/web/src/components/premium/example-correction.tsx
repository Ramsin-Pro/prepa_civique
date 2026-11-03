import { CorrectBadge } from '@/components/icons';
import { AnswerLetter, DraftTag, SourceLine } from '@/components/question-ui';
import { SpeakButton } from '@/components/speak-button';
import { apiGet } from '@/lib/api';
import type { SourceRef } from '@/lib/types';

type Example = {
  id: number;
  statement: string;
  explanation: string;
  inReview: boolean;
  answers: { id: string; text: string; isCorrect: boolean }[];
  answerSource: SourceRef | null;
};

/**
 * Une vraie correction, pour juger le niveau de langue avant de payer. Elle vient de l'API, avec les mêmes règles de
 * publication que l'entraînement : tant que la question n'est pas relue et publiée, rien n'est affiché.
 */
export async function ExampleCorrection() {
  const example = await apiGet<Example>('/api/example-correction').catch(() => null);
  if (!example) return null;
  const correct = example.answers.find((answer) => answer.isCorrect);

  return (
    <figure className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
      <figcaption className="flex flex-wrap items-center gap-2 text-[0.8rem] font-bold uppercase tracking-[0.08em] text-encre-doux">
        Exemple de correction
        {example.inReview && <DraftTag />}
      </figcaption>
      <p className="mt-3 text-[1.125rem] font-bold">{example.statement.replace(/ ([?!:;])/g, ' $1')}</p>
      <ul className="mt-3 grid gap-2">
        {example.answers.map((answer, position) => (
          <li
            key={answer.id}
            className={`flex items-center gap-3 rounded-bouton border-2 px-3 py-2 text-petit ${
              answer.isCorrect ? 'border-sapin-500 bg-sapin-50 font-bold' : 'border-ligne text-encre-doux'
            }`}
          >
            <AnswerLetter state={answer.isCorrect ? 'correct' : 'dimmed'} position={position} />
            {answer.text}
            {answer.isCorrect && <span className="sr-only">(bonne réponse)</span>}
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl bg-sapin-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-bold text-sapin-700">
            <CorrectBadge />
            L’explication
          </p>
          <SpeakButton
            text={`${example.statement} ${correct ? `La bonne réponse est : ${correct.text}. ` : ''}${example.explanation}`}
            label="Écouter"
          />
        </div>
        <p className="mt-2 text-petit">{example.explanation}</p>
        {example.answerSource && (
          <div className="mt-3">
            <SourceLine prefix="Source" source={example.answerSource} />
          </div>
        )}
      </div>
    </figure>
  );
}
