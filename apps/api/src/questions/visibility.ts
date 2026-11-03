import { config } from '../config.js';
import type { QuestionStatus } from '../generated/prisma/client.js';

/**
 * Statuts visibles par les candidats. En production, uniquement les questions publiées après relecture (§7).
 * En développement, CONTENT_PREVIEW=true montre aussi les brouillons « à relire », signalés comme tels.
 */
export const visibleStatuses: QuestionStatus[] = config.contentPreview ? ['PUBLISHED', 'IN_REVIEW'] : ['PUBLISHED'];

export const visibleWhere = { status: { in: visibleStatuses } };
