import { Router } from 'express';
import { glossaryEntries } from '../questions/glossary-store.js';

// Lexique complet des mots difficiles (charte éditoriale §6).
export const glossaryRouter = Router();

glossaryRouter.get('/', async (_req, res) => {
  const entries = await glossaryEntries();
  res.json([...entries].sort((a, b) => a.term.localeCompare(b.term, 'fr', { sensitivity: 'base' })));
});
