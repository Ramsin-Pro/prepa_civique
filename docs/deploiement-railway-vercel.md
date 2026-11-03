# Mise en production : API sur Railway, site sur Vercel

Ce guide suit l'ordre dans lequel les choses dépendent les unes des autres. Comptez une demi-journée la première fois, hors relecture des contenus.

## Comment les deux morceaux se parlent

```
Navigateur ──► Vercel (site Next.js, www.votre-domaine.fr)
                 │  /api/* est relayé vers l'API, avec l'adresse du visiteur et PROXY_SECRET
                 ▼
               Railway (API Express) ──► Railway PostgreSQL
                 ▲
Stripe ──────────┘  webhook envoyé directement à l'API
Resend ◄─────────── l'API envoie les emails par l'API HTTP de Resend (pas de SMTP)
```

Le navigateur n'appelle que le domaine du site : les cookies de connexion restent sur ce domaine, et aucune configuration CORS n'est nécessaire.

## 0. Avant tout : ce qui bloque l'ouverture

1. **Les contenus sont tous « à relire »** (questions, fiches, pages). En production, rien de ce qui est « à relire » n'est visible : sans relecture, le site est vide. Il faut les valider et les publier dans le back-office (A03), en local ou directement en production après l'étape 6.
2. **Les pages légales** (mentions légales, CGU, CGV, confidentialité) sont des projets marqués [À COMPLÉTER] et [À VÉRIFIER]. Elles doivent être complétées (raison sociale, SIREN, adresse, hébergeurs : Vercel Inc. et Railway Corp.) et validées par un juriste, puis publiées.
3. **Le nom** : « Repère » est un nom de travail (décision n° 1). Choisissez-le avant d'acheter le domaine.
4. **Le code doit être sur GitHub** : Railway et Vercel déploient depuis un dépôt. Rien n'est commité aujourd'hui : faites vous-même le commit et le push sur un dépôt **privé**. Vérifiez avant que `.env` n'apparaît pas dans `git status`.

## 1. Comptes et domaine

- **Domaine** (OVH, Gandi…) : par exemple `votre-domaine.fr`. Vous ferez pointer `www` vers Vercel et `api` vers Railway.
- **Railway** : plan Hobby au minimum (le plan d'essai met l'API en veille). Région : **Europe (Amsterdam)**, pour les données personnelles.
- **Vercel** : plan Pro pour un usage commercial (le plan Hobby l'interdit). Région des fonctions : Paris (`cdg1`, déjà dans `apps/web/vercel.json`).
- **Resend** : compte gratuit au départ (3 000 emails par mois, 100 par jour), puis offre Pro.
- **Stripe** : compte activé (identité, RIB) pour encaisser réellement.
- Signez les accords de traitement des données (DPA) de Vercel, Railway, Resend et Stripe, et citez-les dans la politique de confidentialité.

## 2. Secrets à générer

Générez-les une fois, gardez-les dans un gestionnaire de mots de passe, jamais dans le dépôt :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- **`APP_SECRET`** : il chiffre les secrets de double authentification et sert aux identifiants de réponses. Le changer oblige l'équipe à refaire sa double authentification.
- **`PROXY_SECRET`** : une valeur différente de `APP_SECRET`, à mettre **à l'identique** sur Railway et sur Vercel.

## 3. Resend (emails)

1. Créez un compte sur resend.com, puis **Domains → Add Domain** : `votre-domaine.fr`, région **Ireland (eu-west-1)**.
2. Ajoutez chez votre registraire les enregistrements DNS affichés (SPF, DKIM, et le MX d'envoi), puis attendez que le domaine passe à « Verified ». Ajoutez aussi un enregistrement DMARC (`_dmarc`, par exemple `v=DMARC1; p=none;`) : Gmail et Yahoo l'exigent.
3. **API Keys → Create API Key**, avec la permission « Sending access » limitée à votre domaine : c'est `RESEND_API_KEY`.
4. Votre `MAIL_FROM` sera : `Repère <no-reply@votre-domaine.fr>`. L'adresse doit être sur le domaine vérifié.

L'API envoie les emails par l'API HTTP de Resend (port 443) dès que `RESEND_API_KEY` est renseignée : aucun port SMTP n'est utilisé. Les gabarits HTML du site (`apps/api/src/mail/templates.ts`) sont envoyés tels quels. Brevo reste utilisable à la place, avec `BREVO_API_KEY`.

Offre gratuite de Resend, à vérifier sur resend.com : 3 000 emails par mois et 100 par jour, pour un domaine. Au-delà, l'offre Pro coûte environ 20 $ par mois pour 50 000 emails. Passez-y avant une campagne d'inscriptions : une salle d'association qui s'inscrit d'un coup dépasse vite 100 emails dans la journée.

## 4. Railway : base de données et API

1. **Nouveau projet** → « Deploy from GitHub repo » → votre dépôt. Puis, dans le service de l'API :
   - variable **`RAILWAY_DOCKERFILE_PATH`** = `apps/api/Dockerfile` (le dossier racine du service reste la racine du dépôt : l'image a besoin de `package-lock.json`) ;
   - **Settings → Deploy → Healthcheck Path** : `/api/health` ;
   - **Settings → Deploy → Restart Policy** : « On Failure » ;
   - **Settings → Build → Watch Paths** : `apps/api/**`, `package.json`, `package-lock.json`. Un commit qui ne touche que le site ne redéploie pas l'API.

   Le site (`apps/web`) est dans le même dépôt, mais il n'entre pas dans l'image de l'API : le Dockerfile ne copie que `apps/api` et les fichiers `package.json`.

   L'ancien fichier `railway.json` n'est plus lu pour les nouveaux services. Pour décrire ces réglages dans le dépôt, utilisez le nouveau format de Railway (Infrastructure as Code) : `railway config init` crée `.railway/railway.ts`, puis `railway config plan` et `apply` l'appliquent.
2. Dans le même projet : **+ New → Database → PostgreSQL**.
3. Dans le service de l'API, onglet **Variables** :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (référence vers la base, par le réseau privé) |
| `PUBLIC_URL` | `https://www.votre-domaine.fr` (l'adresse du **site**, pas celle de l'API) |
| `APP_SECRET` | le secret généré |
| `PROXY_SECRET` | le secret partagé |
| `TRUST_PROXY` | `1` |
| `RESEND_API_KEY` | la clé Resend |
| `MAIL_FROM` | `Repère <no-reply@votre-domaine.fr>` |
| `STRIPE_SECRET_KEY` | d'abord la clé de test `sk_test_…`, puis la clé réelle `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | à l'étape 7 |
| `REVIEW_URL` | facultatif : la page d'avis Google ou Trustpilot |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | facultatif : la voix Rémy |

Laissez **vides** (ou absentes) `COOKIE_SECURE`, `CONTENT_PREVIEW`, `ADMIN_MFA_REQUIRED`, `API_PORT` et `SMTP_*` : les valeurs sûres s'appliquent, et Railway fournit le port dans `PORT`.

4. **Settings → Networking → Generate Domain**, puis ajoutez un domaine personnalisé `api.votre-domaine.fr` (enregistrement CNAME chez le registraire).
5. Déployez. Les migrations s'appliquent au démarrage. Si un réglage est dangereux, l'API **refuse de démarrer** et la liste apparaît dans les journaux (Deployments → View logs). Corrigez, puis redéployez.
6. Vérifiez que `https://api.votre-domaine.fr/api/health` répond `{"status":"ok"}`.

## 5. Vercel : le site

1. **Add New → Project** → le même dépôt. **Root Directory : `apps/web`**. Le framework Next.js est détecté, et les commandes par défaut conviennent (l'installation se fait à la racine du dépôt, grâce aux workspaces npm).
2. **Environment Variables** (environnement *Production*, **avant** le premier build, car les redirections vers l'API sont calculées au build) :

| Variable | Valeur |
|---|---|
| `API_INTERNAL_URL` | `https://api.votre-domaine.fr` |
| `PUBLIC_URL` | `https://www.votre-domaine.fr` |
| `PROXY_SECRET` | le même secret que sur Railway |

3. Déployez, puis **Settings → Domains** : ajoutez `www.votre-domaine.fr` et `votre-domaine.fr` (redirection vers www), avec les enregistrements DNS indiqués par Vercel.
4. Si vous modifiez une variable, redéployez : elle n'est prise en compte qu'au build suivant.

## 6. Données et premier administrateur

Dans Railway, ouvrez un terminal sur le service de l'API (`railway ssh` avec la CLI Railway, ou l'onglet « Shell » du service), puis :

```bash
node dist/seed/index.js --allow-production
```

Cette commande charge les parcours, les questions, les fiches, les pages et les offres, tous « à relire ». Les comptes de démonstration ne sont pas créés en production.

```bash
node dist/seed/create-admin.js prenom.nom@votre-domaine.fr
```

La personne reçoit un email (par Resend) pour choisir son mot de passe, puis active la double authentification à sa première visite de `/admin`. Créez ensuite les relecteurs depuis le back-office, puis faites relire et publier les contenus (étape 0).

## 7. Stripe

1. Dans le tableau de bord, en **mode test** d'abord : Développeurs → Webhooks → « Ajouter un endpoint » : `https://api.votre-domaine.fr/api/payments/stripe/webhook`.
   - Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`.
   - Recopiez le secret de signature dans `STRIPE_WEBHOOK_SECRET` sur Railway.
2. **Moyens de paiement** : laissez Apple Pay et Google Pay actifs, et activez PayPal si possible (le panel montre une peur de saisir sa carte).
3. Faites un achat de test complet (carte `4242 4242 4242 4242`), un remboursement et un pack associations. Vérifiez l'accès, le reçu et l'email.
4. Puis passez en **mode réel** : nouvelles clés `sk_live_…`, nouveau webhook réel et nouveau secret, sur Railway.

## 8. Recette avant d'ouvrir

Suivez `docs/recette.md`, en particulier :
- inscription, confirmation par email, connexion ;
- mot de passe oublié ;
- double authentification de l'équipe ;
- achat et remboursement, invitation d'une structure ;
- sur téléphone : l'entraînement et l'examen blanc.

Dans le back-office, le tableau de bord ne doit plus afficher aucune alerte « À régler ». Enfin, testez les en-têtes de sécurité sur securityheaders.com : HSTS et CSP doivent apparaître.

## 9. Surveillance et sauvegardes

- **Disponibilité** : un service gratuit (UptimeRobot, Better Stack) appelle `https://api.votre-domaine.fr/api/health` et la page d'accueil toutes les 5 minutes.
- **Sauvegardes** : activez les sauvegardes de la base Railway (plan Pro, ou export planifié avec `pg_dump` vers un stockage chiffré dans l'UE). Testez une restauration une fois par mois. Les scripts `npm run db:backup` du dépôt sont prévus pour Docker Compose, pas pour Railway.
- **Journaux** : Railway garde les journaux selon le plan. Les jetons, les cookies et le secret du proxy y sont masqués.

## 10. Monter en charge

La configuration de départ (une instance de l'API, la base Railway, Vercel) tient sans peine plusieurs milliers d'apprenants actifs par jour. Pour aller plus loin, dans cet ordre :

1. **Agrandir avant de multiplier** : plus de mémoire et de CPU pour l'API et la base dans Railway. C'est le plus simple, et il n'y a aucun changement de code.
2. **Plusieurs instances de l'API** : avant d'augmenter le nombre de répliques, deux choses à faire :
   - **les tâches quotidiennes** (emails de fin d'accès, rappels, durées de conservation) tournent dans chaque instance. Mettez `MAINTENANCE_HOURS=0` sur l'API, et créez un **second service Railway** (même image, une seule réplique, sans domaine public), avec `MAINTENANCE_HOURS=24`. Sinon les emails partent en double ;
   - **les limites d'essais** sont gardées en mémoire, par instance. Avec plusieurs répliques, elles deviennent plus permissives. Il faut un magasin partagé : Redis sur Railway, avec `rate-limit-redis` (petit changement de code à prévoir).
3. **La base** : surveillez les requêtes lentes et ajoutez des index au besoin. Passez à une base plus grosse ou à un pool de connexions (PgBouncer) au-delà de quelques centaines de requêtes par seconde.
4. **La voix Azure** : le cache est en base, donc chaque extrait n'est synthétisé qu'une fois. Surveillez le quota mensuel Azure.
5. **Les emails** : passez Resend en offre Pro dès que vous approchez de 100 emails par jour (inscriptions, rappels, confirmations).

## Coûts de départ (ordre de grandeur, à vérifier)

| Service | Coût |
|---|---|
| Vercel Pro | environ 20 $ par mois et par membre |
| Railway (API et PostgreSQL) | environ 5 à 30 $ par mois selon l'usage |
| Resend | gratuit jusqu'à 3 000 emails par mois, puis environ 20 $ par mois (Pro) |
| Stripe | commission par paiement |
| Domaine | environ 10 à 20 € par an |
