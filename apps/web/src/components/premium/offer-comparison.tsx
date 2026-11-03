import { CheckIcon } from '@/components/icons';

type Cell = string | boolean;

/**
 * Ce que donne la liste du ministère, l'offre gratuite et le Premium. Répond à l'objection la plus fréquente
 * (« les questions sont gratuites sur le site du ministère ») : la liste officielle donne les énoncés, sans les réponses.
 */
export function OfferComparison({ free }: { free: { questionsPerTopic: number; exams: number } }) {
  const rows: { label: string; ministry: Cell; free: Cell; premium: Cell }[] = [
    { label: 'Énoncés de la liste officielle', ministry: true, free: `${free.questionsPerTopic} par thème`, premium: 'Tous' },
    { label: 'Bonne réponse et explication simple, avec sa source', ministry: false, free: true, premium: true },
    {
      label: 'Examen blanc chronométré au format officiel',
      ministry: false,
      free: `${free.exams} examen${free.exams > 1 ? 's' : ''}`,
      premium: 'Illimités',
    },
    { label: 'Révision de vos erreurs au bon moment', ministry: false, free: true, premium: true },
  ];

  return (
    <div className="relative overflow-x-auto rounded-carte border border-ligne bg-white shadow-carte">
      <table className="w-full text-left">
        <caption className="sr-only">Ce que donnent la liste du ministère, l’offre gratuite et le Premium</caption>
        <thead className="bg-papier text-petit">
          <tr>
            <th scope="col" className="px-2 py-2.5 sm:px-3 font-bold">
              Inclus
            </th>
            <th scope="col" className="px-2 py-2.5 sm:px-3 font-bold">
              Ministère
            </th>
            <th scope="col" className="px-2 py-2.5 sm:px-3 font-bold">
              Gratuit
            </th>
            <th scope="col" className="px-2 py-2.5 sm:px-3 font-bold text-sapin-700">
              Premium
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ligne">
          {rows.map((row) => (
            <tr key={row.label} className="align-top">
              <th scope="row" className="px-2 py-2.5 sm:px-3 text-petit font-normal">
                {row.label}
              </th>
              {[row.ministry, row.free, row.premium].map((value, column) => (
                <td key={column} className="px-2 py-2.5 sm:px-3 text-petit">
                  {value === true ? (
                    <>
                      <CheckIcon className="size-5 text-sapin-700" />
                      <span className="sr-only">Oui</span>
                    </>
                  ) : value === false ? (
                    <span className="text-encre-doux">Non</span>
                  ) : (
                    value
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
