# Prépa Civique

Plateforme de préparation à l'examen civique pour trois parcours : carte de séjour pluriannuelle (CSP), carte de résident (CR) et naturalisation. Nom de travail du site : **Repère** (à confirmer, voir les [décisions à trancher](docs/direction-artistique.md#décisions-à-trancher)).

**État : MVP en développement, toutes les fonctions du cahier des charges sont en place.** Les trois parcours sont ouverts : carte de séjour pluriannuelle (CSP), carte de résident (CR) et naturalisation, chacun avec toutes les questions de sa liste officielle. Les contenus rédigés avec assistance et les pages légales attendent leur relecture humaine : en production, rien n'est visible avant d'être publié.

## Ce qui fonctionne

### Pour les candidats

- **Questions officielles.** Tous les énoncés des listes officielles du ministère : CSP (191), carte de résident (209) et naturalisation (258), avec 4 propositions, une explication simple et une source pour chacun. Un énoncé commun à plusieurs listes n'est rédigé qu'une fois : 537 questions officielles au total, plus 30 mises en situation rédigées par l'équipe et signalées comme telles (cahier §7), et un lexique de 185 mots.
- **Catalogue (E07, E08).** Séries par thème, mélangées, de révision, de favoris ou d'**erreurs** (les questions manquées à la dernière réponse), et séries personnalisées : thème, difficulté, questions jamais vues ou déjà travaillées, 10 ou 20 questions. Ce qui est gratuit et ce qui est Premium est indiqué avant de commencer. Pendant une série, on peut revenir aux questions déjà corrigées ; une série interrompue reprend là où elle s'est arrêtée (24 heures). Chaque correction renvoie vers la fiche de la notion.
- **Entraînement (E07 à E09).** Par thème, en série mélangée, en révisions ou sur ses favoris. Chaque réponse est corrigée et expliquée. On peut écouter la question ou l'explication, consulter les mots difficiles, mettre une question en favori et signaler une erreur.
- **Apprentissage par répétition espacée.** Une question manquée revient tout de suite en révision. Une question réussie revient 1, 3, 7 puis 16 jours plus tard. Les séries proposent d'abord ce qui reste à apprendre. Les réponses données pendant un examen blanc alimentent aussi les révisions.
- **Examen blanc (E10, E11).** 40 questions en 45 minutes, réparties par thème et par notion comme à l'examen : chronomètre, navigation libre, reprise d'un examen en cours, fin automatique, résultat par thème et correction détaillée.
- **Voix Rémy et vitesse de lecture.** Les questions, les corrections, les fiches et le lexique se lisent à voix haute avec la voix **Rémy** de Microsoft (Azure Speech, `fr-FR-RemyMultilingualNeural`). Un bouton à côté de « Écouter » change la vitesse (0,75× à 2×), même pendant la lecture ; le choix est gardé sur l'appareil. Sans clé Azure, le site utilise la voix du navigateur, Rémy en priorité quand il la propose (Edge).
- **Fiches de révision (E12).** Une fiche par notion de l'arrêté (14 fiches) : résumé, points clés, exemples, vocabulaire, sources, date de validation, lecture audio et mini-quiz de la notion. Recherche et fiches favorites.
- **Comptes (E05, E16).** Inscription avec confirmation de l'email, connexion, mot de passe oublié, changement d'adresse, démarche préparée, consentement marketing séparé, export des données (JSON) et suppression du compte. La progression faite sans compte rejoint le compte à la connexion. Les réponses ne révèlent jamais si une adresse est inscrite.
- **Offre gratuite et Premium (E14, E15).** Gratuit : 10 questions par thème, réparties entre les notions pour que chaque fiche garde son mini-quiz, et 1 examen blanc, sans inscription. Premium : pass de 3 mois à 19 € TTC, payé une fois, sans renouvellement automatique (décision n° 2, provisoire). Avant le paiement, la personne accepte les CGV et demande l'accès immédiat (renonciation au droit de rétractation), et l'email de confirmation le lui rappelle. L'accès n'est ouvert qu'après la confirmation du paiement par le serveur.
- **Pages publiques.** Tarifs, parcours (E03), outil d'orientation sans enregistrement (E04), FAQ, contact (E17), mentions légales, CGU, CGV, confidentialité et cookies. Les pages légales sont des projets à faire valider par un juriste : elles ne s'affichent en production qu'une fois publiées.
- **Progression (E13)** avec l'évolution des scores d'examen blanc, **tableau de bord (E06)** qui propose de reprendre un examen en cours et un rythme de révision quand la date d'examen est indiquée (sans prédiction), **reçus de commande (E16)** imprimables, et **lexique** de mots difficiles.
- **Rappels et emails de service.** Rappel de révision par email sur accord explicite (au plus une fois par semaine, lien d'arrêt sans connexion), avis quelques jours avant la fin d'un accès Premium, et demande d'avis après la date d'examen (une fois, avec l'accord pour les emails d'information). Prolongation gratuite d'un pass de 30 jours, une fois, si l'examen est repoussé.
- **Associations et structures.** Packs de places à tarif réduit (25, 50 ou 100 places, de 8 à 6 € par personne pour 6 mois ; sur devis au-delà de 250), payés en ligne ou par virement sur facture, places d'essai. Chaque structure a un espace : lien et code d'invitation, affiche à imprimer avec QR code, places utilisées, chiffres du groupe (à partir de 5 personnes) et détail par personne seulement avec son accord. Les apprenants activent leur place avec le lien ou le code (`/rejoindre`), choisissent ce qu'ils partagent et peuvent partir à tout moment.
- **Témoignages authentiques (E01).** Seules les personnes qui ont utilisé le site peuvent témoigner, avec leur accord ; chaque témoignage est relu dans le back-office avant d'apparaître sur l'accueil, avec sa date de publication et l'explication de la vérification (Code de la consommation, L111-7-2), et l'auteur peut le retirer.
- **Parcours (E02, E03).** Page de choix des parcours, et page de chaque parcours avec ses sources officielles et leur date de vérification.
- **Référencement et partage (§1, §10).** Plan du site, `robots.txt`, métadonnées et images de partage pour les réseaux sociaux (accueil, fiches, parcours), données structurées (organisation, FAQ, fiches, parcours), installation sur l'écran d'accueil du téléphone.

### Pour l'équipe : le back-office (A01 à A09)

- **Tableau de bord (A01)** : questions à relire, signalements, messages, ventes, et points de vigilance avant lancement (examen impossible à tirer, pages légales non publiées, Stripe, emails, voix).
- **Questions (A03)** : recherche et filtres, édition avec historique des versions, protection contre les modifications simultanées, création, duplication. Relecture **à quatre yeux** : la personne qui valide n'est pas la dernière à avoir modifié la question (un super-administrateur peut valider seul, c'est noté au journal). Une question publiée dont l'énoncé ou la bonne réponse change repasse en relecture. Relecture par lots.
- **Parcours et thèmes (A02), modèles d'examen (A04)** avec essai à blanc et nombre de questions publiées disponibles par ligne de répartition, **fiches et pages (A05)**, **lexique**, **signalements**.
- **Utilisateurs (A06)**, **commandes (A07)** avec remboursement et export CSV, **messages du support**, **statistiques (A08)** : entonnoir de conversion, activité par jour, parcours, canaux d'arrivée, questions les plus difficiles, export CSV. Mesure interne sans traceur ni cookie.
- **Sécurité (A09)** : rôles (lecture seule, support, éditeur, super-administrateur), double authentification par application (obligatoire en production), journal d'audit des actions sensibles.
- **Compléments** : import de questions (JSON), aperçu d'une question sur téléphone, sources avec licence et date de consultation, création de thèmes, sources officielles des parcours, formules et prix (pass individuels et packs des structures), accès Premium qui expirent bientôt.
- **Associations** : demandes de devis, de facture ou d'essai ; création d'une structure avec un compte coordinateur invité ; ajout de places réglées par virement ou offertes ; suspension ; clôture d'un pack.

### Tests

126 tests Vitest (unitaires, et intégration sur une vraie base) et 12 scénarios Maestro sur le site. Les 12 scénarios d'acceptation du cahier sont repris dans [docs/recette.md](docs/recette.md).

## Stack

| Couche | Choix |
|---|---|
| Front | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Back-end | Node.js 22, Express 5, TypeScript, Zod |
| Base de données | PostgreSQL 17, Prisma 7 |
| Conteneurs | Docker, Docker Compose |
| Tests | Vitest, Supertest, Maestro |

```
apps/api                    API Express + Prisma
apps/api/content/csp        Questions, explications et glossaire (JSON, voir la charte éditoriale)
apps/api/content/fiches     Fiches de révision (JSON)
apps/api/content/pages      FAQ et pages légales (Markdown, projets à faire valider)
apps/web                    Site Next.js + Tailwind CSS, back-office sous /admin
e2e/maestro                 Scénarios de test du site (Maestro)
docs/                       Direction artistique, charte éditoriale, décisions à trancher
```

## Démarrer en local

Prérequis : Node.js 22.12 ou plus récent, Docker Desktop.

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run db:up
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

- Site : http://localhost:3001
- API : http://localhost:4001/api/health
- Back-office : http://localhost:3001/admin

Les ports par défaut (5433, 4001, 3001) évitent les ports habituels, souvent déjà pris par d'autres projets. Ils se changent dans `.env`.

`npm run db:seed` crée aussi deux comptes de l'équipe pour le développement : `admin@repere.test` (super-administrateur) et `relecteur@repere.test` (éditeur, pour essayer la relecture à quatre yeux). Leur mot de passe est généré au premier lancement et rangé dans votre `.env` (`DEV_ADMIN_PASSWORD`) ; il n'est affiché nulle part. Il crée enfin une structure de démonstration (code d'invitation `PREPA234`, 10 places d'essai) pour essayer l'offre associations : son coordinateur, `coordination@repere.test`, choisit son mot de passe avec « Mot de passe oublié » (le lien s'affiche dans la console de l'API).

En développement, sans configuration :

- **Emails** : ils s'affichent dans la console de l'API. Pour les voir dans une vraie boîte, lancez `docker compose up -d mail` puis mettez `SMTP_HOST=localhost` dans `.env` : ils arrivent sur http://localhost:8026.
- **Paiement** : sans clé Stripe, un paiement simulé remplace Stripe (jamais en production).
- **Voix** : sans `AZURE_SPEECH_KEY`, c'est la voix du navigateur. Avec une clé Azure Speech (offre gratuite F0 : 0,5 million de caractères par mois), la voix Rémy est la même partout ; chaque extrait n'est synthétisé qu'une fois puis gardé en base.

## Tout lancer avec Docker

```bash
docker compose up --build -d
```

Il faut `APP_SECRET` dans `.env` (au moins 32 caractères aléatoires). Les migrations s'appliquent au démarrage de l'API. Pour charger les contenus dans les conteneurs :

```bash
docker compose exec api node dist/seed/index.js --allow-production
```

Dans Docker, l'API tourne comme en production : pas de paiement simulé, double authentification obligatoire pour le back-office, emails capturés par Mailpit (http://localhost:8026). Pour créer le premier super-administrateur (un lien pour choisir son mot de passe lui est envoyé) :

```bash
docker compose exec api node dist/seed/create-admin.js prenom.nom@exemple.fr
```

## Contenus et relecture

Les questions sont dans `apps/api/content/<parcours>/<thème>.json`, au format de la [charte éditoriale](docs/charte-editoriale.md).

- `enonces-officiels.json` contient la liste officielle, recoupée entre quatre republications sur data.gouv.fr. Le chargement refuse toute question « officielle » dont l'énoncé n'y figure pas mot pour mot.
- Les propositions, les explications et les sources ont été rédigées avec assistance. Elles sont chargées au statut **« à relire »** : **rien n'est publié sans relecture humaine** (cahier §7 et §13).
- Chaque brouillon porte un niveau de confiance (`high`, `medium`, `low`) et, si besoin, une note de relecture, pour commencer par les cas douteux. Les listes de relecture sont générées par parcours (`npm run relecture -w api`) : [CSP](docs/relecture-csp.md) (17 questions prioritaires), [carte de résident](docs/relecture-cr.md) (31) et [naturalisation](docs/relecture-nat.md) (26), suivies des faits datés et des nuances à revérifier.
- Au chargement, la forme est harmonisée (apostrophes, points finaux) pour qu'aucune proposition ne se distingue par sa forme. Les indices involontaires restants, comme une bonne réponse beaucoup plus longue que les autres, sont signalés dans la note de relecture.
- `CONTENT_PREVIEW=true` (développement uniquement) affiche les brouillons, avec l'étiquette « Brouillon à relire ». En production, la variable reste à `false` et seules les questions publiées sont visibles.
- Le chargement ne réécrit jamais une question déjà validée ou publiée par l'équipe.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | API et site en mode développement, avec rechargement automatique |
| `npm run build` | Compile l'API et le site |
| `npm run typecheck` | Vérifie les types des deux applications |
| `npm test` | Tests unitaires (moteur QCM, répétition espacée, tirage de l'examen, glossaire) |
| `npm run test:int` | Tests de bout en bout de l'API (base PostgreSQL démarrée) |
| `npm run test:e2e` | Scénarios Maestro sur le site lancé (voir [e2e/maestro](e2e/maestro/README.md)) |
| `npm run db:migrate` | Crée ou applique les migrations (développement) |
| `npm run db:seed` | Charge les parcours, les contenus, les fiches, les pages, l'offre et les comptes de développement |
| `npm run admin:create -w api -- <email>` | Crée ou promeut un super-administrateur et lui envoie un lien pour choisir son mot de passe |
| `npm run db:backup` | Sauvegarde la base dans `backups/` (`-- --keep 30` supprime les sauvegardes de plus de 30 jours) |
| `npm run db:restore-test` | Restaure la dernière sauvegarde dans une base temporaire et la compare à la base en service |
| `npm run maintenance -w api` | Applique les durées de conservation (fait aussi chaque jour par l'API en production) |
| `npm run relecture -w api` | Génère les listes de relecture `docs/relecture-<parcours>.md` à partir des fichiers de contenu |

## API

Toutes les routes sont préfixées par `/api`. Le navigateur passe par le site (`http://localhost:3001/api/...`), que Next.js relaie vers l'API. Il n'y a donc pas de CORS à gérer.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/health` | État de l'API et de la base |
| GET | `/paths`, `/paths/:slug` | Parcours, thèmes et nombre de questions |
| GET | `/training/questions?path=&mode=&topic=&notion=&difficulty=&seen=&limit=` | Série d'entraînement (`topic`, `mixed`, `review`, `favorites` ou `errors`), filtrée au besoin par notion, difficulté et questions déjà vues ou non, sans les bonnes réponses |
| POST | `/training/questions/:id/check` | Correction d'une réponse `{ answerId }`, et mise à jour des révisions |
| GET | `/progress?path=` | Progression du visiteur : maîtrise par thème, révisions, examens |
| GET | `/exams/template?path=` | Modèle de l'examen blanc : format, composition, disponibilité |
| GET | `/exams?path=` | Examen en cours à reprendre et examens terminés du visiteur |
| POST | `/exams` | Démarre un examen blanc `{ path }` |
| GET | `/exams/:id` | Reprend un examen (réponses déjà données incluses) |
| PUT | `/exams/:id/answers/:questionId` | Enregistre une réponse `{ answerId }` (`null` pour l'effacer) |
| POST | `/exams/:id/finish` | Termine l'examen, calcule le score et renvoie la correction |
| GET | `/glossary` | Lexique complet |
| PUT, DELETE | `/favorites/:questionId` | Ajoute une question aux favoris, ou l'en retire |
| POST | `/questions/:id/reports` | Signale une erreur `{ reason, message? }` |
| POST | `/auth/register`, `/auth/verify-email`, `/auth/login`, `/auth/logout` | Inscription, confirmation de l'email, connexion, déconnexion |
| POST | `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-email` | Mot de passe oublié, changement d'adresse |
| POST | `/auth/mfa`, `/auth/mfa/setup`, `/auth/mfa/enable` | Double authentification des comptes de l'équipe |
| GET | `/auth/me` | Compte connecté, accès Premium, rôle |
| GET, PATCH, DELETE | `/account` | Profil et achats, démarche, date d'examen, accords (emails d'information, rappels), suppression du compte |
| POST, GET | `/account/password`, `/account/export` | Changement de mot de passe, export des données |
| GET | `/account/orders/:id` | Reçu d'une commande |
| GET, PUT, DELETE | `/account/testimonial` | Témoignage de la personne connectée : droit de témoigner, dépôt avec accord (repasse en modération), retrait |
| POST | `/account/reminders/unsubscribe` | Arrêt des rappels de révision avec le jeton signé du lien de l'email, sans connexion |
| GET | `/plans` | Offres Premium et limites de l'offre gratuite |
| POST | `/checkout` | Commande `{ planCode, salesTermsAccepted, waiverAccepted }`, renvoie l'adresse de paiement |
| GET | `/checkout/orders/:id` | État d'une commande (retour du paiement) |
| POST | `/payments/stripe/webhook` | Notifications Stripe signées, traitées une seule fois |
| GET | `/organizations/offer` | Packs de places proposés aux structures |
| POST | `/organizations/requests` | Demande de devis, de facture ou de places d'essai |
| POST | `/organizations/checkout` | Commande en ligne d'un pack par le coordinateur d'une structure |
| GET, POST | `/organizations/join/:code`, `/organizations/join` | Invitation d'une structure : informations, puis activation d'une place `{ code, shareProgress }` |
| GET, PATCH | `/organizations/mine` | Espace de la structure : places, membres, chiffres du groupe |
| GET | `/organizations/mine/poster` | Affiche d'invitation : lien, code et QR code (SVG) |
| POST, DELETE | `/organizations/mine/invite-code`, `/organizations/mine/members/:id` | Nouveau lien d'invitation ; retrait d'une personne (sa place est libérée) |
| PATCH, DELETE | `/account/memberships/:id` | Partage de la progression avec la structure ; quitter la structure |
| POST | `/account/premium/extension` | Prolongation gratuite d'un pass, une fois |
| GET | `/sheets`, `/sheets/:slug` | Fiches de révision publiées |
| PUT, DELETE | `/sheets/:slug/favorite` | Ajoute une fiche aux favoris, ou l'en retire |
| GET | `/testimonials` | Derniers témoignages validés par l'équipe, avec leur date de publication |
| GET | `/pages/:slug` | Pages éditoriales et légales publiées |
| POST | `/contact`, `/analytics/visit` | Message au support, visite comptée sans cookie |
| POST | `/analytics/offer` | Offre Premium vue ou cliquée `{ event, place }`, pour savoir quel endroit du site amène aux tarifs |
| GET | `/example-correction` | Exemple de correction affiché sur l'accueil et les tarifs (seulement si la question est publiée) |
| GET | `/speech/status`, `/speech/question/:id?order=`, `/speech/correction/:id`, `/speech/sheet/:slug`, `/speech/glossary?term=` | Lecture audio (MP3, voix Rémy) |
| * | `/admin/...` | Back-office : tableau de bord, questions, fiches, pages, lexique, parcours, sources, examens, témoignages, utilisateurs, commandes, formules, messages, statistiques, journal |

## Choix importants

- **Aucune bonne réponse n'est envoyée au navigateur avant la correction.** En examen blanc, le score est calculé par le serveur à la fin (cahier §5). Pendant un examen, l'entraînement refuse de corriger les questions de cet examen.
- **Rien n'est codé en dur dans le format d'examen.** Le modèle d'examen versionné en base fixe le nombre de questions, la durée, le seuil et la répartition par thème et par notion (§5, A04). Cette répartition est celle de l'article 3 de l'arrêté du 10 octobre 2025 (NOR INTV2527907A), vérifiée sur Légifrance.
- **Pas d'aide pendant l'examen blanc.** Ni correction, ni audio, ni lexique, comme le jour de l'examen. Les aides reviennent dans la correction.
- **Visiteurs anonymes et comptes.** Sans compte, la progression et les examens sont rattachés à un cookie aléatoire `httpOnly` (seule son empreinte SHA-256 est stockée). Avec un compte, la session est un autre cookie `httpOnly`, dont seule l'empreinte est stockée. Ces deux cookies sont fonctionnels. Les journaux du serveur masquent les cookies et les signatures.
- **Mots de passe et sécurité.** Mots de passe hachés avec scrypt (intégré à Node.js), sessions révocables, limitation des tentatives de connexion, contrôle de l'origine des requêtes qui modifient quelque chose, double authentification TOTP pour l'équipe (secret chiffré avec `APP_SECRET`).
- **Paiement.** Stripe Checkout : le site ne voit jamais de numéro de carte. L'accès est activé par la notification signée de Stripe, traitée une seule fois. Un remboursement total retire l'accès ; un remboursement partiel le laisse.
- **Statistiques sans traceur.** Chaque événement est compté par jour avec une empreinte de l'apprenant calculée avec `APP_SECRET` et la date : elle change chaque jour, on ne peut pas suivre une personne dans le temps.
- **La voix ne lit jamais un texte libre.** Le serveur construit le texte à partir du contenu (question, correction, fiche, mot du lexique), pour que personne ne puisse utiliser le quota Azure à autre chose. La correction ne s'écoute qu'après avoir répondu.
- **Railway (API) + Vercel (site).** Guide pas à pas : [docs/deploiement-railway-vercel.md](docs/deploiement-railway-vercel.md). Emails par l'API de Resend (`RESEND_API_KEY`, ou Brevo avec `BREVO_API_KEY`), adresse du visiteur transmise avec `PROXY_SECRET`.
- **Production.** Placer un reverse proxy HTTPS (Caddy, Nginx…) devant le site, laisser `COOKIE_SECURE` vide (les cookies deviennent sécurisés dès que `PUBLIC_URL` est en https), laisser `CONTENT_PREVIEW` à `false` et `ADMIN_MFA_REQUIRED` à `true`, définir `APP_SECRET` (32 caractères au moins), `PUBLIC_URL`, le SMTP (Brevo), les clés Stripe (et l'adresse du webhook `https://<domaine>/api/payments/stripe/webhook`) et, si besoin, la clé Azure Speech. Sur un vrai domaine, l'API refuse de démarrer si l'un de ces réglages est dangereux. Le proxy doit écraser `X-Forwarded-For` avec l'adresse du visiteur : la limitation de débit de l'API s'appuie dessus (`TRUST_PROXY=1`), et le site n'est publié que sur 127.0.0.1 pour qu'on ne puisse pas contourner le proxy.

## Prochaines étapes

1. **Relecture humaine** des 567 questions (en commençant par les listes de relecture de chaque parcours), des 14 fiches et des 6 pages, puis publication depuis le back-office. Les pages légales passent d'abord par un juriste : leurs `[À COMPLÉTER]` et `[À VÉRIFIER]` listent ce qui manque (éditeur, hébergeur, médiateur, durées de conservation…).
2. **Comptes de service** à créer par l'équipe : Stripe (clés et webhook), Brevo (SMTP), Azure Speech (voix Rémy), hébergement européen, puis mise en ligne selon [docs/exploitation.md](docs/exploitation.md) et recette selon [docs/recette.md](docs/recette.md).
3. Trancher les **décisions restantes** (fin de [direction-artistique.md](docs/direction-artistique.md#décisions-à-trancher)), dont la qualification juridique du pass (contenu ou service numérique) et le bouton de rétractation en ligne.

L'exploitation (mise en ligne, sauvegardes, supervision, incidents, données personnelles, coûts) est décrite dans [docs/exploitation.md](docs/exploitation.md).

Le cahier des charges, la [direction artistique](docs/direction-artistique.md) et la [charte éditoriale](docs/charte-editoriale.md) font référence.
