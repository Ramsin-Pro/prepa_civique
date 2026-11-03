import MarkdownIt from 'markdown-it';

// Pages éditoriales (FAQ, pages légales) écrites en Markdown dans le back-office.
// Le HTML brut est refusé : seul le Markdown est interprété.
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

// Les liens vers d'autres sites s'ouvrent dans un nouvel onglet.
const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const href = String(tokens[index]!.attrGet('href') ?? '');
  if (/^https?:\/\//.test(href)) {
    tokens[index]!.attrSet('target', '_blank');
    tokens[index]!.attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, index, options, env, self);
};

// Chaque titre reçoit une ancre (« /cgv#17-packs-de-places-pour-les-structures ») : les autres pages peuvent y renvoyer.
const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

md.renderer.rules.heading_open = (tokens, index, options, _env, self) => {
  const heading = tokens[index]!;
  const text = tokens[index + 1]?.children?.map((child) => child.content).join('') ?? '';
  if (text && (heading.tag === 'h2' || heading.tag === 'h3')) heading.attrSet('id', slugify(text));
  return self.renderToken(tokens, index, options);
};

export const renderMarkdown = (source: string) => md.render(source);
