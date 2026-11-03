'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { buttonClasses } from '@/components/button';

type PathInfo = { slug: string; title: string; code: string; active: boolean };

type Answer = 'CSP' | 'CR' | 'NAT' | 'renouvellement' | 'inconnu';

const CHOICES: { value: Answer; label: string; hint: string }[] = [
  { value: 'CSP', label: 'Une première carte de séjour pluriannuelle', hint: 'Une carte de 2 à 4 ans, demandée pour la première fois.' },
  { value: 'CR', label: 'Une carte de résident', hint: 'La carte de 10 ans.' },
  { value: 'NAT', label: 'La nationalité française', hint: 'Une demande de naturalisation.' },
  { value: 'renouvellement', label: 'Le renouvellement de ma carte', hint: 'Une carte que vous avez déjà.' },
  { value: 'inconnu', label: 'Je ne sais pas encore', hint: 'Vous hésitez entre plusieurs démarches.' },
];

const OFFICIAL = {
  CSP: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F35799',
  CR: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2208',
  NAT: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2213',
  exam: 'https://www.service-public.gouv.fr/particuliers/actualites/A18713',
  training: 'https://formation-civique.interieur.gouv.fr',
};

/**
 * Simulateur d'orientation (E04) : une indication générale, jamais une décision. Rien n'est enregistré :
 * les réponses restent dans la page et disparaissent à sa fermeture.
 */
export function Orientation({ paths }: { paths: PathInfo[] }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function choose(value: Answer) {
    setAnswer(value);
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  return (
    <div className="grid gap-8">
      <fieldset>
        <legend className="text-[1.375rem] font-bold">Quelle démarche préparez-vous ?</legend>
        <div className="mt-4 grid gap-3">
          {CHOICES.map((choice) => (
            <label
              key={choice.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 bg-white p-4 transition-colors hover:border-sapin-500 ${answer === choice.value ? 'border-sapin-700' : 'border-ligne'}`}
            >
              <input
                type="radio"
                name="demarche"
                value={choice.value}
                checked={answer === choice.value}
                onChange={() => choose(choice.value)}
                className="mt-1 size-5 flex-none accent-sapin-700"
              />
              <span>
                <span className="block font-bold">{choice.label}</span>
                <span className="block text-petit text-encre-doux">{choice.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {answer && (
        <div ref={resultRef} tabIndex={-1} role="status" className="rounded-carte border border-ligne bg-white p-6 shadow-carte outline-none">
          <Result answer={answer} paths={paths} />
        </div>
      )}

      <p className="rounded-carte bg-ocre-100/50 p-4 text-petit">
        Cet outil donne une indication générale. Il ne remplace ni l’administration ni un professionnel du droit. Certaines personnes
        peuvent être dispensées de l’examen : vérifiez toujours votre situation sur{' '}
        <a href={OFFICIAL.exam} target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
          service-public.gouv.fr
        </a>
        .
      </p>
    </div>
  );
}

function Result({ answer, paths }: { answer: Answer; paths: PathInfo[] }) {
  if (answer === 'renouvellement') {
    return (
      <>
        <h2 className="text-[1.375rem]">Le renouvellement n’est pas concerné</h2>
        <p className="mt-2">
          L’examen civique est demandé pour une <strong>première</strong> carte de séjour pluriannuelle, une carte de résident ou la
          naturalisation. Le renouvellement d’une carte de séjour pluriannuelle ou d’une carte de résident n’est pas concerné.
        </p>
        <p className="mt-2 text-petit text-encre-doux">Vous pouvez quand même vous entraîner pour mieux connaître la France.</p>
        <OfficialLinks />
      </>
    );
  }

  if (answer === 'inconnu') {
    return (
      <>
        <h2 className="text-[1.375rem]">Trois démarches demandent l’examen civique</h2>
        <ul className="mt-3 grid gap-2">
          <li>Une première carte de séjour pluriannuelle (2 à 4 ans).</li>
          <li>Une carte de résident (10 ans).</li>
          <li>La naturalisation.</li>
        </ul>
        <p className="mt-3">
          Pour savoir quelle démarche correspond à votre situation, consultez les fiches officielles :{' '}
          <a href={OFFICIAL.CSP} target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
            carte pluriannuelle
          </a>
          ,{' '}
          <a href={OFFICIAL.CR} target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
            carte de résident
          </a>
          ,{' '}
          <a href={OFFICIAL.NAT} target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
            naturalisation
          </a>
          .
        </p>
        <OfficialLinks />
      </>
    );
  }

  const path = paths.find((candidate) => candidate.code === answer);
  const titles = { CSP: 'carte de séjour pluriannuelle', CR: 'carte de résident', NAT: 'naturalisation' } as const;
  return (
    <>
      <h2 className="text-[1.375rem]">En général, l’examen civique est demandé pour cette démarche</h2>
      <p className="mt-2">
        Depuis le 1<sup>er</sup> janvier 2026, il faut avoir réussi l’examen civique avant de déposer une demande de {titles[answer]}.
        L’examen compte 40 questions : 28 de connaissance et 12 mises en situation, en 45 minutes. Il faut 32 bonnes réponses sur 40.
      </p>
      {answer === 'CR' && (
        <p className="mt-2">
          Bon à savoir : une attestation obtenue pour la carte de résident vaut aussi pour la carte de séjour pluriannuelle.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {path?.active ? (
          <>
            <Link href={`/parcours/${path.slug}`} className={buttonClasses('primary')}>
              Préparer le parcours « {path.title} »
            </Link>
            <Link href="/examen-blanc" className={buttonClasses('secondary')}>
              Faire un examen blanc
            </Link>
          </>
        ) : (
          <p className="rounded-xl bg-papier px-4 py-3 text-petit">
            Ce parcours est en préparation. En attendant, les thèmes de l’examen sont les mêmes pour toutes les démarches :{' '}
            <Link href="/entrainement" className="font-bold text-sapin-700 underline underline-offset-4">
              entraînez-vous par thème
            </Link>
            .
          </p>
        )}
      </div>
      <OfficialLinks />
    </>
  );
}

function OfficialLinks() {
  return (
    <p className="mt-5 text-petit text-encre-doux">
      Sources officielles :{' '}
      <a href={OFFICIAL.exam} target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
        service-public.gouv.fr
      </a>{' '}
      ·{' '}
      <a href={OFFICIAL.training} target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
        formation-civique.interieur.gouv.fr
      </a>
    </p>
  );
}
