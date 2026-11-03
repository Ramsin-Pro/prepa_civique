import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { z } from 'zod';

// Fiches de révision (content/fiches/*.json) et pages éditoriales (content/pages/*.md),
// rédigées comme brouillons : elles sont importées « à relire » et publiées seulement après relecture humaine.

const contentDir = new URL('../../content/', import.meta.url);

const sheetSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug en minuscules et tirets'),
  notion: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(20).max(1500),
  keyPoints: z.array(z.string().trim().min(3).max(500)).min(2).max(12),
  examples: z.array(z.string().trim().min(3).max(600)).max(8).default([]),
  vocabulary: z.array(z.object({ term: z.string().trim().min(1).max(80), definition: z.string().trim().min(3).max(400) })).max(12).default([]),
  sources: z.array(z.object({ label: z.string().trim().min(3).max(200), url: z.url() })).min(1).max(8),
  confidence: z.enum(['high', 'medium', 'low']),
  // Notes pour la relecture : ce qu'il faut vérifier, avec les dates de consultation des sources.
  reviewNote: z.string().trim().max(4000).nullable().optional(),
});

const sheetFileSchema = z.object({ topic: z.string(), sheets: z.array(sheetSchema) });

export type SheetDraft = z.infer<typeof sheetSchema> & { topic: string; position: number };

export function loadSheets(topicSlugs: ReadonlySet<string>): { sheets: SheetDraft[]; problems: string[] } {
  const dir = new URL('fiches/', contentDir);
  const sheets: SheetDraft[] = [];
  const problems: string[] = [];
  if (!existsSync(dir)) return { sheets, problems };

  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    const parsed = sheetFileSchema.safeParse(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
    if (!parsed.success) {
      problems.push(`${file} : ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join(' ; ')}`);
      continue;
    }
    if (!topicSlugs.has(parsed.data.topic)) {
      problems.push(`${file} : thème inconnu « ${parsed.data.topic} »`);
      continue;
    }
    parsed.data.sheets.forEach((sheet, index) => sheets.push({ ...sheet, topic: parsed.data.topic, position: index + 1 }));
  }

  const seen = new Set<string>();
  for (const sheet of sheets) {
    if (seen.has(sheet.slug)) problems.push(`Fiche en double : ${sheet.slug}`);
    seen.add(sheet.slug);
  }
  return { sheets: sheets.filter((sheet, index) => sheets.findIndex((other) => other.slug === sheet.slug) === index), problems };
}

export type PageDraft = { slug: string; title: string; body: string };

/** Page Markdown avec un en-tête simple : slug et title entre deux lignes « --- ». */
export function parsePage(source: string): PageDraft | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source.replace(/^﻿/, ''));
  if (!match) return null;
  const meta = Object.fromEntries(
    match[1]!.split(/\r?\n/).flatMap((line) => {
      const separator = line.indexOf(':');
      return separator > 0 ? [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]] : [];
    }),
  );
  if (!meta.slug || !meta.title) return null;
  return { slug: meta.slug, title: meta.title, body: match[2]!.trim() };
}

export function loadPages(): { pages: PageDraft[]; problems: string[] } {
  const dir = new URL('pages/', contentDir);
  const pages: PageDraft[] = [];
  const problems: string[] = [];
  if (!existsSync(dir)) return { pages, problems };
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.md')).sort()) {
    const page = parsePage(readFileSync(new URL(file, dir), 'utf8'));
    if (page) pages.push(page);
    else problems.push(`${file} : en-tête slug/title manquant`);
  }
  return { pages, problems };
}
