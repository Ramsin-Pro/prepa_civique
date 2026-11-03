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
Brevo  ◄─────────── l'API envoie les emails par l'API HTTP de Brevo (pas de SMTP)
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
- **Brevo** : compte gratuit au départ (300 emails par jour), puis offre payante selon le volume.
- **Stripe** : compte activé (identité, RIB) pour encaisser réellement.
- Signez les accords de traitement des données (DPA) de Vercel, Railway, Brevo et Stripe, et citez-les dans la politique de confidentialité.

## 2. Secrets à générer

Générez-les une fois, gardez-les dans un gestionnaire de mots de passe, jamais dans le dépôt :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- **`APP_SECRET`** : il chiffre les secrets de double authentification et sert aux identifiants de réponses. Le changer oblige l'équipe à refaire sa double authentification.
- **`PROXY_SECRET`** : une valeur différente de `APP_SECRET`, à mettre **à l'identique** sur Railway et sur Vercel.

## 3. Brevo (emails)

1. Créez une clé dans « SMTP & API » → « Clés API » : c'est `BREVO_API_KEY`.
2. **Authentifiez votre domaine** dans « Expéditeurs, domaines » : ajoutez chez votre registraire les enregistrements DNS donnés par Brevo (code Brevo, DKIM, DMARC). Sans cela, les emails de confirmation partent dans les courriers indésirables.
3. Créez l'expéditeur `no-reply@votre-domaine.fr`. Votre `MAIL_FROM` sera : `Repère <no-reply@votre-domaine.fr>`.

L'API envoie les emails par l'API HTTP de Brevo (port 443) dès que `BREVO_API_KEY` est renseignée : aucun port SMTP n'est utilisé.

## 4. Railway : base de données et API

1. **Nouveau projet** → « Deploy from GitHub repo » → votre dépôt. Railway lit `railway.json` à la racine : il construit `apps/api/Dockerfile` et contrôle `/api/health`.
2. Dans le même projet : **+ New → Database → PostgreSQL**.
3. Dans le service de l'API, onglet **Variables** :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (référence vers la base, par le réseau privé) |
| `PUBLIC_URL` | `https://www.votre-domaine.fr` (l'adresse du **site**, pas celle de l'API) |
| `APP_SECRET` | le secret généré |
| `PROXY_SECRET` | le secret partagé |
| `TRUST_PROXY` | `1` |
| `BREVO_API_KEY` | la clé Brevo |
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

La personne reçoit un email (par Brevo) pour choisir son mot de passe, puis active la double authentification à sa première visite de `/admin`. Créez ensuite les relecteurs depuis le back-office, puis faites relire et publier les contenus (étape 0).

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
5. **Les emails** : passez Brevo sur une offre payante quand vous approchez de 300 emails par jour (inscriptions, rappels).

## Coûts de départ (ordre de grandeur, à vérifier)

| Service | Coût |
|---|---|
| Vercel Pro | environ 20 $ par mois et par membre |
| Railway (API et PostgreSQL) | environ 5 à 30 $ par mois selon l'usage |
| Brevo | gratuit jusqu'à 300 emails par jour, puis à partir d'environ 9 € par mois |
| Stripe | commission par paiement |
| Domaine | environ 10 à 20 € par an |
