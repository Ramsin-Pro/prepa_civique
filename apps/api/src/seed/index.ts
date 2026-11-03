import { appendFileSync, existsSync } from 'node:fs';
import { hashPassword, randomToken } from '../auth/crypto.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { addLicense } from '../organizations/service.js';
import { answersForInsert, loadContent, normalizeStatement, sourceKey } from './content.js';
import { examTemplates, pathContents, paths, plans, topics } from './data.js';
import { loadPages, loadSheets } from './editorial.js';

// Charge les données de référence et les contenus de apps/api/content. Relançable sans risque :
// tout est mis à jour par clé, et ce que l'équipe a validé ou modifié dans le back-office n'est jamais réécrit.
// Refusé en production sauf demande explicite.

const DRAFT_AUTHOR = 'Brouillon rédigé avec assistance, à valider par l’équipe éditoriale';
const EDITABLE_STATUSES = new Set(['DRAFT', 'IN_REVIEW']);

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--allow-production')) {
    console.error('Refusé : NODE_ENV=production. Ajoutez --allow-production pour charger les données.');
    process.exitCode = 1;
    return;
  }

  // Les champs modifiables dans le back-office (A02) ne sont jamais réécrits par le chargement :
  // un parcours ou un thème existant garde son titre, sa description, son ordre et son ouverture.
  const pathIds = new Map<string, number>();
  for (const path of paths) {
    const existing = await prisma.path.findUnique({ where: { code: path.code }, select: { id: true, sources: true } });
    if (!existing) {
      pathIds.set(path.code, (await prisma.path.create({ data: path, select: { id: true } })).id);
      continue;
    }
    if (Array.isArray(existing.sources) && existing.sources.length === 0) {
      await prisma.path.update({ where: { id: existing.id }, data: { sources: path.sources, verifiedAt: path.verifiedAt } });
    }
    pathIds.set(path.code, existing.id);
  }

  const topicIds = new Map<string, number>();
  for (const { notions: _notions, ...topic } of topics) {
    const { id } = await prisma.topic.upsert({ where: { slug: topic.slug }, create: topic, update: {}, select: { id: true } });
    topicIds.set(topic.slug, id);
  }

  // Les anciennes questions de démonstration (DEV-…) sont remplacées par la liste officielle.
  const legacy = await prisma.question.findMany({ where: { reference: { startsWith: 'DEV-' } }, select: { id: true } });
  if (legacy.length > 0) {
    const legacyIds = legacy.map((question) => question.id);
    await prisma.examAttempt.deleteMany({ where: { items: { some: { questionId: { in: legacyIds } } } } });
    await prisma.question.deleteMany({ where: { id: { in: legacyIds } } });
  }

  // Contenus de chaque parcours. Une question officielle commune à plusieurs listes n'est rédigée qu'une fois :
  // elle est rattachée à chaque parcours dont la liste contient son énoncé. Les mises en situation servent à tous.
  const sourceIds = new Map<string, number>();
  const questionIdsByStatement = new Map<string, number>();
  const situationIds: number[] = [];
  const glossary = new Map<string, { term: string; definition: string }>();
  const summaries: string[] = [];
  const problems: string[] = [];
  const loadedPaths: { code: string; pathId: number; statements: string[] }[] = [];
  let protectedCount = 0;

  for (const entry of pathContents) {
    if (!existsSync(new URL(`../../content/${entry.dir}/enonces-officiels.json`, import.meta.url))) continue;
    const pathId = pathIds.get(entry.path)!;
    const content = loadContent(entry.dir, topics);
    const officialSource = await prisma.source.upsert({
      where: { key: entry.source.key },
      create: entry.source,
      update: entry.source,
      select: { id: true },
    });
    let created = 0;
    let updated = 0;

    for (const question of content.questions) {
      let answerSourceId: number | null = null;
      if (question.answerSource) {
        const key = sourceKey(question.answerSource);
        if (!sourceIds.has(key)) {
          const source = { key, label: question.answerSource.label, url: question.answerSource.url ?? null };
          const { id } = await prisma.source.upsert({ where: { key }, create: source, update: {}, select: { id: true } });
          sourceIds.set(key, id);
        }
        answerSourceId = sourceIds.get(key)!;
      }

      // Une question validée, publiée ou retouchée dans le back-office n'est jamais réécrite par le fichier.
      const existing = await prisma.question.findUnique({
        where: { reference: question.reference },
        select: { id: true, status: true, lastEditedById: true },
      });
      if (existing && (!EDITABLE_STATUSES.has(existing.status) || existing.lastEditedById !== null)) {
        protectedCount++;
        await prisma.questionPath.upsert({
          where: { questionId_pathId: { questionId: existing.id, pathId } },
          create: { questionId: existing.id, pathId },
          update: {},
        });
        if (question.type === 'ORIGINAL_SITUATION') situationIds.push(existing.id);
        else questionIdsByStatement.set(normalizeStatement(question.statement), existing.id);
        continue;
      }

      const fields = {
        type: question.type,
        status: 'IN_REVIEW' as const,
        statement: question.statement,
        explanation: question.explanation,
        difficulty: question.difficulty,
        notion: question.notion ?? null,
        topicId: topicIds.get(question.topic)!,
        statementSourceId: question.type === 'OFFICIAL_KNOWLEDGE' ? officialSource.id : null,
        answerSourceId,
        author: DRAFT_AUTHOR,
        draftConfidence: question.confidence,
        reviewNote: question.reviewNote ?? null,
        verifiedAt: null,
      };

      const id = await prisma.$transaction(async (tx) => {
        const { id } = await tx.question.upsert({
          where: { reference: question.reference },
          create: { reference: question.reference, ...fields },
          update: fields,
          select: { id: true },
        });
        // Les réponses d'un brouillon sont remplacées, sauf si une tentative d'examen les référence encore.
        // Elles sont enregistrées dans un ordre mélangé : la bonne réponse, la première du fichier, n'a ni la
        // première position ni le plus petit numéro.
        const answers = answersForInsert(question.answers);
        const inUse = await tx.examAttemptQuestion.count({ where: { questionId: id } });
        if (inUse > 0) {
          // Les lignes gardent leur numéro, et chacune garde son texte s'il est toujours dans le fichier :
          // les réponses déjà données aux examens gardent leur sens. Les textes nouveaux prennent les lignes restantes.
          const rows = await tx.answer.findMany({ where: { questionId: id }, orderBy: { position: 'asc' }, select: { id: true, text: true } });
          const kept = new Map<number, (typeof answers)[number]>();
          for (const row of rows) {
            const index = answers.findIndex((answer) => answer.text === row.text);
            if (index >= 0) kept.set(row.id, answers.splice(index, 1)[0]!);
          }
          for (const row of rows) {
            await tx.answer.update({ where: { id: row.id }, data: kept.get(row.id) ?? answers.shift() ?? { text: '', isCorrect: false } });
          }
        } else {
          await tx.answer.deleteMany({ where: { questionId: id } });
          await tx.answer.createMany({
            data: answers.map((answer, index) => ({ questionId: id, ...answer, position: index + 1 })),
          });
        }
        await tx.questionPath.upsert({
          where: { questionId_pathId: { questionId: id, pathId } },
          create: { questionId: id, pathId },
          update: {},
        });
        return id;
      });
      if (question.type === 'ORIGINAL_SITUATION') situationIds.push(id);
      else questionIdsByStatement.set(normalizeStatement(question.statement), id);
      if (existing) updated++;
      else created++;
    }

    for (const term of content.glossary) {
      if (!glossary.has(term.term.toLowerCase())) glossary.set(term.term.toLowerCase(), term);
    }
    loadedPaths.push({ code: entry.path, pathId, statements: content.officialStatements });
    problems.push(...content.problems.map((problem) => `${entry.dir} : ${problem}`));
    const situations = content.questions.filter((question) => question.type === 'ORIGINAL_SITUATION').length;
    summaries.push(
      `${entry.path} : ${content.questions.length - situations} questions officielles rédigées dans ses fichiers, ` +
        `${situations} mises en situation (${created} créées, ${updated} mises à jour)` +
        (content.missingFiles.length > 0 ? `. Thèmes sans fichier : ${content.missingFiles.join(', ')}` : ''),
    );
  }

  // Énoncés communs : la question déjà rédigée pour un autre parcours est rattachée à celui-ci.
  for (const { code, pathId, statements } of loadedPaths) {
    let attached = 0;
    let missing = 0;
    for (const statement of statements) {
      const questionId = questionIdsByStatement.get(normalizeStatement(statement));
      if (!questionId) {
        missing++;
        continue;
      }
      await prisma.questionPath.upsert({ where: { questionId_pathId: { questionId, pathId } }, create: { questionId, pathId }, update: {} });
      attached++;
    }
    await prisma.questionPath.createMany({ data: situationIds.map((questionId) => ({ questionId, pathId })), skipDuplicates: true });
    summaries.push(`${code} : ${attached} énoncés officiels sur ${statements.length} ont leur question, ${situationIds.length} mises en situation communes`);
    if (missing > 0) problems.push(`${code} : ${missing} énoncé(s) officiel(s) sans question rédigée`);
  }

  // Lexique : un mot existant garde sa définition (elle a pu être reprise dans le back-office).
  await prisma.glossaryTerm.createMany({ data: [...glossary.values()], skipDuplicates: true });

  // Modèles d'examen : créés s'ils n'existent pas. Une version existante ne change plus (§5 : barème versionné).
  for (const { path, quotas, ...template } of examTemplates) {
    const pathId = pathIds.get(path)!;
    if (await prisma.examTemplate.count({ where: { pathId, version: template.version } })) continue;
    const alreadyActive = (await prisma.examTemplate.count({ where: { pathId, active: true } })) > 0;
    await prisma.examTemplate.create({
      data: {
        pathId,
        ...template,
        active: template.active && !alreadyActive,
        quotas: {
          create: quotas.map((quota) => ({ topicId: topicIds.get(quota.topic)!, kind: quota.kind, notion: quota.notion, count: quota.count })),
        },
      },
    });
  }

  // Offres : créées si elles n'existent pas. Le prix et la durée se gèrent ensuite dans le back-office (A07).
  for (const plan of plans) {
    await prisma.plan.upsert({ where: { code: plan.code }, create: plan, update: {} });
  }

  // Fiches de révision et pages : importées « à relire », jamais par-dessus une version validée ou retouchée.
  const sheetDrafts = loadSheets(new Set(topicIds.keys()));
  let sheetsImported = 0;
  let sheetsProtected = 0;
  for (const { topic, confidence, reviewNote, ...sheet } of sheetDrafts.sheets) {
    const existing = await prisma.revisionSheet.findUnique({ where: { slug: sheet.slug }, select: { id: true, status: true } });
    const editedInBackOffice =
      existing && (await prisma.auditLog.count({ where: { entity: 'sheet', entityId: String(existing.id), action: 'sheet.edit' } })) > 0;
    if (existing && (!EDITABLE_STATUSES.has(existing.status) || editedInBackOffice)) {
      sheetsProtected++;
      continue;
    }
    const data = {
      ...sheet,
      notion: sheet.notion ?? null,
      topicId: topicIds.get(topic)!,
      status: 'IN_REVIEW' as const,
      draftConfidence: confidence,
      reviewNote: reviewNote ?? null,
    };
    await prisma.revisionSheet.upsert({ where: { slug: sheet.slug }, create: data, update: data });
    sheetsImported++;
  }

  const pageDrafts = loadPages();
  let pagesImported = 0;
  for (const page of pageDrafts.pages) {
    const existing = await prisma.contentPage.findUnique({ where: { slug: page.slug }, select: { id: true, status: true } });
    const editedInBackOffice =
      existing && (await prisma.auditLog.count({ where: { entity: 'page', entityId: String(existing.id), action: 'page.edit' } })) > 0;
    if (existing && (!EDITABLE_STATUSES.has(existing.status) || editedInBackOffice)) continue;
    await prisma.contentPage.upsert({
      where: { slug: page.slug },
      create: { ...page, status: 'IN_REVIEW' },
      update: { ...page, status: 'IN_REVIEW' },
    });
    pagesImported++;
  }

  const devAccounts = await seedDevAccounts();
  const demoOrganization = await seedDemoOrganization();

  for (const summary of summaries) console.log(summary);
  console.log(`${glossary.size} mots de lexique dans les fichiers. ${protectedCount} questions validées ou retouchées dans le back-office laissées intactes.`);
  console.log(
    `Fiches : ${sheetsImported} importées à relire, ${sheetsProtected} validées ou retouchées laissées intactes. ` +
      `Pages : ${pagesImported} importées à relire. Offres : ${plans.length}.`,
  );
  for (const problem of [...problems, ...sheetDrafts.problems, ...pageDrafts.problems]) console.warn(`  ! ${problem}`);
  if (devAccounts) console.log(devAccounts);
  if (demoOrganization) console.log(demoOrganization);
}

/** Code d'invitation de la structure de démonstration : les scénarios Maestro l'utilisent. */
const DEMO_INVITE_CODE = 'PREPA234';

/**
 * Structure de démonstration, en développement seulement : 10 places d'essai et un code fixe, pour essayer
 * l'invitation sans rien payer. Son coordinateur n'a pas de mot de passe utilisable : pour ouvrir son espace,
 * passez par « Mot de passe oublié » (le lien s'affiche dans la console de l'API).
 */
async function seedDemoOrganization(): Promise<string | null> {
  if (config.production) return null;
  if (await prisma.organization.findUnique({ where: { inviteCode: DEMO_INVITE_CODE }, select: { id: true } })) return null;
  const now = new Date();
  const owner = await prisma.user.upsert({
    where: { email: 'coordination@repere.test' },
    create: {
      email: 'coordination@repere.test',
      passwordHash: await hashPassword(randomToken()),
      emailVerifiedAt: now,
      termsAcceptedAt: now,
      termsVersion: config.termsVersion,
    },
    update: {},
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'Association de démonstration',
      kind: 'association',
      city: 'Lyon',
      contactName: 'Équipe de démonstration',
      ownerId: owner.id,
      inviteCode: DEMO_INVITE_CODE,
    },
  });
  await addLicense(organization.id, { seats: 10, seatDays: 180, activationDays: 365, priceCents: 0, source: 'pilote', note: 'Démonstration' });
  return `Structure de démonstration : code ${DEMO_INVITE_CODE}, coordinateur coordination@repere.test (mot de passe à choisir avec « Mot de passe oublié »).`;
}

/**
 * Comptes de l'équipe pour le développement : un super-administrateur et un relecteur (rôle éditeur),
 * pour essayer la relecture à quatre yeux. Le mot de passe est généré une fois et gardé dans le .env local.
 */
async function seedDevAccounts(): Promise<string | null> {
  if (config.production) return null;
  const envFile = new URL('../../../../.env', import.meta.url);
  let password = process.env.DEV_ADMIN_PASSWORD;
  if (!password) {
    if (!existsSync(envFile)) return 'Comptes de développement non créés : définissez DEV_ADMIN_PASSWORD.';
    password = randomToken(12);
    appendFileSync(envFile, `\n# Comptes de l'équipe en développement (créés par npm run db:seed)\nDEV_ADMIN_PASSWORD=${password}\n`);
  }
  const accounts = [
    { email: process.env.DEV_ADMIN_EMAIL ?? 'admin@repere.test', role: 'SUPER_ADMIN' as const },
    { email: process.env.DEV_EDITOR_EMAIL ?? 'relecteur@repere.test', role: 'EDITOR' as const },
  ];
  const passwordHash = await hashPassword(password);
  const now = new Date();
  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      create: { ...account, passwordHash, emailVerifiedAt: now, termsAcceptedAt: now, termsVersion: config.termsVersion },
      update: {},
    });
  }
  return `Comptes de développement : ${accounts.map((account) => `${account.email} (${account.role})`).join(', ')}. Mot de passe : DEV_ADMIN_PASSWORD dans le .env.`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
