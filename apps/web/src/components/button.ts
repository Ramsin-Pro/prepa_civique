const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-bouton px-5 text-courant font-bold leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const variants = {
  primary: 'bg-sapin-700 text-white hover:bg-sapin-900',
  secondary: 'border-2 border-encre bg-transparent text-encre hover:bg-encre hover:text-white',
  quiet: 'px-2 text-sapin-700 underline-offset-4 hover:underline',
};

/** Classes d'un bouton de la charte, utilisables sur <button>, <a> ou <Link>. Un seul bouton principal par écran. */
export function buttonClasses(variant: keyof typeof variants = 'primary', extra = ''): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
