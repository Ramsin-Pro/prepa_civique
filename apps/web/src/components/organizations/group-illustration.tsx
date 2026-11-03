// Aperçu décoratif de l'espace d'une structure, en haut de la page associations : places, code à dicter, emails
// masqués. Les valeurs sont des exemples ; les lecteurs d'écran l'ignorent, le texte de la page dit déjà tout.
const people = [
  { email: 'am••••@gmail.com', date: 'activée le 3 nov.' },
  { email: 'ka••••@orange.fr', date: 'activée le 5 nov.' },
  { email: 'so••••@yahoo.fr', date: 'activée le 6 nov.' },
];

export function GroupIllustration() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-md">
      <div className="rotate-1 rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-encre-doux">Votre espace structure</p>
        <p className="mt-2 font-titre text-[1.375rem] font-semibold">Association du quartier</p>
        <p className="mt-4 text-petit">
          <strong className="font-titre text-[1.75rem]">18</strong> places activées sur 25
        </p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-ligne">
          <div className="h-full w-[72%] rounded-full bg-[var(--color-graphe)]" />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-bouton bg-papier px-3 py-2 text-petit">
          <span>Code à dicter</span>
          <strong className="font-titre text-[1.125rem] tracking-[0.2em]">K7MP4XQ2</strong>
        </div>
        <ul className="mt-4 grid gap-2 text-petit">
          {people.map((person) => (
            <li key={person.email} className="flex justify-between gap-3 border-b border-ligne pb-2 last:border-0 last:pb-0">
              <span>{person.email}</span>
              <span className="text-encre-doux">{person.date}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative -mt-3 ml-4 w-max -rotate-2 rounded-carte border border-ocre-100 bg-white px-4 py-3 text-petit shadow-carte sm:-ml-4">
        <strong className="block">Thème à revoir ensemble</strong>
        Histoire de France
      </div>
    </div>
  );
}
