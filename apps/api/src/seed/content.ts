import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { shuffle } from '../questions/logic.js';

// Lecture et contrôle des fichiers de contenu (apps/api/content), au format de docs/charte-editoriale.md.

const contentDir = new URL('../../content/', import.meta.url);

const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

const sourceSchema = z.object({
  label: z.string().trim().min(3),
  url: z.preprocess(emptyToNull, z.url().nullable().optional()),
});

export const questionSchema = z.object({
  reference: z.string().regex(/^[A-Z]{2,4}-[A-Z]{2,4}-\d{3}$/),
  type: z.enum(['OFFICIAL_KNOWLEDGE', 'ORIGINAL_KNOWLEDGE', 'ORIGINAL_SITUATION']),
  notion: z.preprocess(emptyToNull, z.string().nullable().optional()),
  statement: z.string().trim().min(5),
  answers: z
    .array(z.string().trim().min(1))
    .length(4)
    .refine((answers) => new Set(answers.map((answer) => answer.toLowerCase())).size === 4, 'Deux propositions identiques.'),
  explanation: z.string().trim().min(20),
  answerSource: sourceSchema.nullable().optional(),
  difficulty: z.number().int().min(1).max(3).default(1),
  confidence: z.enum(['high', 'medium', 'low']),
  reviewNote: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const fileSchema = z.object({
  topic: z.string(),
  questions: z.array(questionSchema),
  situations: z.array(questionSchema).default([]),
  glossary: z.array(z.object({ term: z.string().trim().min(2), definition: z.string().trim().min(10) })).default([]),
});

export type ContentQuestion = z.infer<typeof questionSchema> & { topic: string };

/** Clé stable d'une source, pour éviter les doublons dans la table des sources. */
export function sourceKey(source: { label: string; url?: string | null }): string {
  const slug = source.label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const hash = createHash('sha1').update(`${source.label}|${source.url ?? ''}`).digest('hex').slice(0, 8);
  return `${slug}-${hash}`;
}

export const normalizeStatement = (text: string) => text.replace(/’/g, "'").replace(/\s+/g, ' ').trim();

/** Apostrophe typographique partout, pour un affichage homogène (la comparaison avec la liste officielle l'ignore). */
const typographic = (text: string) => text.replace(/'/g, '’');

/**
 * Dans un QCM, une différence de forme entre propositions trahit la bonne réponse.
 * Soit les quatre propositions finissent par un point, soit aucune.
 */
export function harmonizeAnswers(answers: readonly string[]): string[] {
  const endsWithPeriod = answers.map((answer) => /[^.]\.$/.test(answer.trim()));
  if (endsWithPeriod.every(Boolean) || endsWithPeriod.every((value) => !value)) return [...answers];
  return answers.map((answer) => answer.trim().replace(/([^.])\.$/, '$1'));
}

/**
 * Propositions à enregistrer pour une question d'un fichier, où la bonne réponse est écrite en premier.
 * Elles sont mélangées avant l'insertion : ni leur position ni leur numéro en base ne désignent la bonne réponse.
 */
export function answersForInsert(answers: readonly string[]): { text: string; isCorrect: boolean }[] {
  return shuffle(answers.map((text, index) => ({ text, isCorrect: index === 0 })));
}

/** Indices involontaires repérés automatiquement, ajoutés à la note de relecture. */
export function formCues(answers: readonly string[]): string[] {
  const cues: string[] = [];
  const [correct, ...others] = answers;
  const longestOther = Math.max(...others.map((answer) => answer.length));
  if (correct && correct.length > longestOther * 1.6 && correct.length - longestOther > 15) {
    cues.push('la bonne réponse est nettement plus longue que les autres');
  }
  // Propositions passe-partout (« Toutes les réponses », « Aucune de ces propositions »), pas une phrase qui commence par « Toutes les personnes ».
  if (answers.some((answer) => /^(toutes|aucune)\s+(les|des|de\s+ces)\s+(r[ée]ponses|propositions)\b/i.test(answer.trim()))) {
    cues.push('une proposition du type « toutes » ou « aucune » est à éviter');
  }
  return cues;
}

export function loadContent(pathDir: string, topics: readonly { slug: string; notions: readonly string[] }[]) {
  const official = JSON.parse(readFileSync(new URL(`${pathDir}/enonces-officiels.json`, contentDir), 'utf8')) as {
    enonces: { statement: string; topic: string }[];
  };
  const officialStatements = new Map(official.enonces.map((entry) => [normalizeStatement(entry.statement), entry.topic]));

  const questions: ContentQuestion[] = [];
  const glossary = new Map<string, { term: string; definition: string }>();
  const problems: string[] = [];
  const missingFiles: string[] = [];

  for (const topic of topics) {
    const file = new URL(`${pathDir}/${topic.slug}.json`, contentDir);
    if (!existsSync(file)) {
      missingFiles.push(topic.slug);
      continue;
    }
    const parsed = fileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    if (!parsed.success) {
      // Une question invalide n'empêche pas de charger les autres : on valide question par question.
      const raw = JSON.parse(readFileSync(file, 'utf8')) as { questions?: unknown[]; situations?: unknown[]; glossary?: unknown[] };
      for (const item of [...(raw.questions ?? []), ...(raw.situations ?? [])]) {
        const one = questionSchema.safeParse(item);
        if (one.success) questions.push({ ...one.data, topic: topic.slug });
        else problems.push(`${topic.slug} : ${(item as { reference?: string }).reference ?? '?'} ignorée (${one.error.issues[0]?.message})`);
      }
      continue;
    }

    for (const question of [...parsed.data.questions, ...parsed.data.situations]) {
      questions.push({ ...question, topic: topic.slug });
    }
    for (const entry of parsed.data.glossary) {
      const key = entry.term.toLowerCase();
      if (!glossary.has(key)) glossary.set(key, entry);
    }
  }

  // Contrôles éditoriaux (charte §1 et §8)
  const accepted: ContentQuestion[] = [];
  const references = new Set<string>();
  for (const question of questions) {
    const topic = topics.find((candidate) => candidate.slug === question.topic)!;
    if (references.has(question.reference)) {
      problems.push(`${question.reference} : référence en double, ignorée`);
      continue;
    }
    if (question.type === 'OFFICIAL_KNOWLEDGE' && !officialStatements.has(normalizeStatement(question.statement))) {
      problems.push(`${question.reference} : énoncé absent de la liste officielle, ignoré`);
      continue;
    }
    if (question.type !== 'ORIGINAL_SITUATION' && question.notion && !topic.notions.includes(question.notion)) {
      problems.push(`${question.reference} : notion inconnue « ${question.notion} », remplacée par aucune`);
      question.notion = null;
    }
    if (question.type === 'ORIGINAL_SITUATION') question.notion = null;

    // Forme homogène, puis contrôle des indices involontaires (charte éditoriale §2)
    const answers = harmonizeAnswers(question.answers.map(typographic));
    const cues = formCues(answers);
    if (cues.length > 0) problems.push(`${question.reference} : ${cues.join(' ; ')} (signalé pour relecture)`);
    const notes = [question.reviewNote, ...cues.map((cue) => `Contrôle automatique : ${cue}.`)].filter(Boolean);

    references.add(question.reference);
    accepted.push({
      ...question,
      statement: typographic(question.statement),
      answers,
      explanation: typographic(question.explanation),
      reviewNote: notes.length > 0 ? notes.join(' ') : null,
    });
  }

  const glossaryEntries = [...glossary.values()].map((entry) => ({ term: typographic(entry.term), definition: typographic(entry.definition) }));
  return {
    questions: accepted,
    glossary: glossaryEntries,
    problems,
    missingFiles,
    officialCount: officialStatements.size,
    officialStatements: official.enonces.map((entry) => entry.statement),
  };
}
