// Formes des contenus éditoriaux renvoyés par l'API (fiches de révision, pages).

export type SheetSummary = { slug: string; title: string; summary: string; notion: string | null; inReview: boolean; favorite: boolean };

export type SheetTopic = { slug: string; title: string; sheets: SheetSummary[] };

export type Sheet = {
  slug: string;
  title: string;
  summary: string;
  notion: string | null;
  keyPoints: string[];
  examples: string[];
  vocabulary: { term: string; definition: string }[];
  sources: { label: string; url: string }[];
  inReview: boolean;
  favorite: boolean;
  reviewedByName: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  topic: { slug: string; title: string };
  questionCount: number;
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

export type ContentPage = { slug: string; title: string; body: string; inReview: boolean; reviewedAt: string | null; updatedAt: string };
