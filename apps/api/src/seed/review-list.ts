import { existsSync, writeFileSync } from 'node:fs';
import { loadContent, type ContentQuestion } from './content.js';
import { pathContents, topics } from './data.js';

// Listes de relecture (docs/relecture-<parcours>.md), générées depuis les fichiers de contenu :
// npm run relecture -w api. Elles orientent la relecture humaine, obligatoire avant toute publication (§7).

const PATH_TITLES: Record<string, string> = { CSP: 'CSP', CR: 'carte de résident', NAT: 'naturalisation' };
const cell = (text: string | null | undefined) => (text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const row = (question: ContentQuestion) =>
  `| ${question.reference} | ${cell(question.statement)} | ${cell(question.answers[0])} | ${cell(question.reviewNote)} |`;
const table = (questions: ContentQuestion[]) =>
  questions.length === 0
    ? '_Aucune._'
    : ['| Réf. | Énoncé | Bonne réponse proposée | Ce qu’il faut vérifier |', '|---|---|---|---|', ...questions.map(row)].join('\n');

for (const entry of pathContents) {
  if (!existsSync(new URL(`../../content/${entry.dir}/enonces-officiels.json`, import.meta.url))) continue;
  const content = loadContent(entry.dir, topics);
  const doubtful = content.questions.filter((question) => question.confidence !== 'high');
  const flagged = content.questions.filter((question) => question.confidence === 'high' && question.reviewNote);
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const summary = topics.map((topic) => {
    const own = content.questions.filter((question) => question.topic === topic.slug);
    const official = own.filter((question) => question.type !== 'ORIGINAL_SITUATION').length;
    return `| ${topic.title} | ${official} | ${own.length - official} | ${own.filter((question) => question.confidence !== 'high').length} |`;
  });

  const markdown = `# Relecture des contenus ${PATH_TITLES[entry.path] ?? entry.path}

*Généré le ${date} à partir de \`apps/api/content/${entry.dir}/\` (\`npm run relecture -w api\`). Ces questions arrivent au statut « à relire » : aucune n’est publiée sans relecture humaine.*

Les énoncés officiels sont repris mot pour mot de la liste du ministère (${content.officialCount} énoncés). Les énoncés déjà présents dans une autre liste ne sont pas rédigés ici : la question existante leur est rattachée. Les propositions, les bonnes réponses, les explications et les sources ont été rédigées avec assistance : elles doivent être relues par une personne compétente avant publication (cahier des charges §7). Commencez par la partie 1.

| Thème | Questions officielles | Mises en situation | À vérifier en priorité |
|---|---|---|---|
${summary.join('\n')}

## 1. Confiance moyenne ou faible : la bonne réponse ou la formulation est à confirmer

${table(doubtful)}

## 2. Faits datés ou nuances signalés par la rédaction

Réponse jugée sûre, mais un point est à revérifier : chiffre ou personne susceptible de changer, source à préciser, notion à confirmer.

${table(flagged)}

## 3. Pour toutes les autres questions

Relecture standard selon la [charte éditoriale](charte-editoriale.md) : une seule bonne réponse incontestable, distracteurs plausibles, explication simple et juste, source qui justifie la réponse.
${content.problems.length > 0 ? `\n## Signalé au chargement\n\n${content.problems.map((problem) => `- ${problem}`).join('\n')}\n` : ''}`;

  const file = new URL(`../../../../docs/relecture-${entry.dir}.md`, import.meta.url);
  writeFileSync(file, markdown);
  console.log(`docs/relecture-${entry.dir}.md : ${content.questions.length} questions, ${doubtful.length} à confirmer, ${flagged.length} points datés.`);
}
