export type Outcome = 'correct' | 'wrong';

type Props = {
  total: number;
  /** Index de la question en cours (0 pour la première, total à la fin). */
  current: number;
  /** Résultat des questions déjà corrigées, dans l'ordre. */
  outcomes: readonly Outcome[];
};

/** Barre de progression en forme de tracé : un jalon par question, coloré une fois la question corrigée. */
export function RouteProgress({ total, current, outcomes }: Props) {
  const span = Math.max(total - 1, 1);
  const position = (index: number) => `calc(6px + (100% - 12px) * ${index / span})`;
  const filled = Math.min(current, total - 1) / span;

  return (
    <div
      role="progressbar"
      aria-label="Progression"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={outcomes.length}
      aria-valuetext={`${outcomes.length} question${outcomes.length > 1 ? 's' : ''} sur ${total}`}
      className="relative h-4"
    >
      <span className="absolute inset-x-1.5 top-[7px] border-t-2 border-dotted border-trace" />
      <span
        className="absolute left-1.5 top-1.5 h-1 rounded-full bg-sapin-500 transition-[width] duration-200"
        style={{ width: `calc((100% - 12px) * ${filled})` }}
      />
      {Array.from({ length: total }, (_, index) => {
        const outcome = outcomes[index];
        const tone =
          outcome === 'correct'
            ? 'border-sapin-500 bg-sapin-500'
            : outcome === 'wrong'
              ? 'border-brique-700 bg-brique-700'
              : index === current
                ? 'border-sapin-700 bg-white ring-2 ring-sapin-700/25'
                : 'border-trace bg-white';
        return (
          <span
            key={index}
            className={`absolute top-0.5 size-3 -translate-x-1/2 rounded-full border-2 ${tone}`}
            style={{ left: position(index) }}
          />
        );
      })}
    </div>
  );
}
