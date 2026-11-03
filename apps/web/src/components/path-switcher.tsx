import Link from 'next/link';

/** Choix du parcours affiché, quand plusieurs parcours sont ouverts (examen blanc, progression). */
export function PathSwitcher({
  paths,
  current,
  hrefFor,
}: {
  paths: { slug: string; title: string }[];
  current: string;
  hrefFor: (slug: string) => string;
}) {
  if (paths.length < 2) return null;
  return (
    <nav aria-label="Parcours" className="mt-5 flex flex-wrap gap-2 text-petit">
      {paths.map((path) => (
        <Link
          key={path.slug}
          href={hrefFor(path.slug)}
          aria-current={path.slug === current ? 'page' : undefined}
          className="inline-flex min-h-10 items-center rounded-full border-2 border-ligne bg-white px-4 font-bold hover:border-sapin-500 aria-[current=page]:border-sapin-700 aria-[current=page]:bg-sapin-50 aria-[current=page]:text-sapin-700"
        >
          {path.title}
        </Link>
      ))}
    </nav>
  );
}
