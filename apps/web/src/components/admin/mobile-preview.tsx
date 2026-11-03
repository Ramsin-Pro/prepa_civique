'use client';

import { useState } from 'react';
import type { QuestionType } from '@/lib/types';
import { AnswerLetter, TypeTag, optionClasses } from '../question-ui';

type PreviewQuestion = {
  type: QuestionType;
  statement: string;
  answers: { text: string; isCorrect: boolean }[];
  explanation: string;
};

/**
 * Prévisualisation mobile (A03) : la question telle qu'un candidat la voit sur un téléphone de 360 px,
 * avant puis après la correction. Elle suit le formulaire en cours de saisie.
 */
export function MobilePreview({ question }: { question: PreviewQuestion }) {
  const [corrected, setCorrected] = useState(false);
  const correctIndex = question.answers.findIndex((answer) => answer.isCorrect);

  return (
    <div className="grid justify-items-center gap-3">
      <div className="flex gap-2 text-petit" role="group" aria-label="État de l’aperçu">
        <button
          type="button"
          aria-pressed={!corrected}
          onClick={() => setCorrected(false)}
          className="rounded-full border border-ligne px-3 py-1 aria-[pressed=true]:border-sapin-700 aria-[pressed=true]:font-bold"
        >
          Question
        </button>
        <button
          type="button"
          aria-pressed={corrected}
          onClick={() => setCorrected(true)}
          className="rounded-full border border-ligne px-3 py-1 aria-[pressed=true]:border-sapin-700 aria-[pressed=true]:font-bold"
        >
          Correction
        </button>
      </div>
      <div className="w-[360px] max-w-full overflow-hidden rounded-[28px] border-[10px] border-encre bg-papier" aria-label="Aperçu sur téléphone">
        <div className="grid gap-4 bg-white px-4 py-5">
          <div>
            <TypeTag type={question.type} />
          </div>
          <p className="font-texte text-enonce font-bold">{question.statement || 'Énoncé de la question'}</p>
          <div className="grid gap-2.5">
            {question.answers.map((answer, position) => {
              const state = corrected ? (position === correctIndex ? 'correct' : 'dimmed') : 'idle';
              return (
                <div key={position} className={optionClasses(state)}>
                  <AnswerLetter state={state} position={position} />
                  <span className="flex-1">{answer.text || `Proposition ${position + 1}`}</span>
                </div>
              );
            })}
          </div>
          {corrected && (
            <div className="grid gap-2 rounded-carte border border-sapin-100 bg-sapin-50 p-4">
              <p className="font-bold text-sapin-700">Bonne réponse</p>
              <p>{question.explanation || 'Explication de la correction'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
