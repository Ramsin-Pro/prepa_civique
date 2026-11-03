# Tests de bout en bout (Maestro)

Ces scénarios pilotent le site dans Chromium, comme un candidat : accueil, entraînement, révisions, examen blanc, progression, lexique, favoris, fiches de révision, tarifs et orientation, contact, offre associations et invitation d'une structure. Le scénario 11 ouvre le back-office avec le compte de développement.

Prérequis : [Maestro](https://maestro.dev) 2.x et Java 17 ou plus récent, et le site lancé sur http://localhost:3001 (`npm run dev`, ou `docker compose up`), avec des questions chargées (`npm run db:seed`).

```bash
npm run test:e2e
```

Pour lancer un seul scénario :

```bash
maestro test e2e/maestro/04-examen-blanc.yaml
```

Règles pour écrire un scénario :

- cibler des textes visibles qui tiennent dans un seul élément (un texte coupé par une balise `<strong>` ne se trouve pas en entier) ;
- cibler les propositions de réponse par leur identifiant (`proposition-1` à `proposition-4`) : leur ordre est tiré au sort ;
- faire défiler avec `scrollUntilVisible` avant de toucher un bouton qui peut être sous la ligne de flottaison ;
- `launchApp` avec `clearState: true` pour repartir d'un visiteur sans historique.

Le scénario du back-office lit le mot de passe du compte de développement dans une variable, jamais dans le fichier :

```bash
maestro test -e DEV_ADMIN_PASSWORD=<valeur de DEV_ADMIN_PASSWORD dans le .env> e2e/maestro/11-back-office.yaml
```

Sans cette variable, `npm run test:e2e` lance aussi ce scénario et il échoue à la connexion : passez la variable avec `-e`, ou lancez les autres scénarios un par un.

La connexion est limitée à 8 tentatives en 15 minutes par adresse email (protection contre les attaques par essais répétés). Si vous relancez le scénario du back-office plusieurs fois de suite, il peut échouer à la connexion : attendez quelques minutes.

Le scénario 14 utilise la structure de démonstration créée par `npm run db:seed` en développement (code d'invitation `PREPA234`, 10 places d'essai). Il s'arrête à l'inscription : la confirmation de l'email passe par un lien envoyé par email. Le scénario 13 envoie une vraie demande de places d'essai : elle apparaît dans le back-office (Associations), et l'API accepte 5 demandes par heure depuis une même adresse.

Sur les conteneurs Docker (mode production), la double authentification est exigée pour l'équipe (`ADMIN_MFA_REQUIRED`). Le scénario du back-office ne tourne donc qu'en développement (`npm run dev`), comme le scénario 14, dont la structure de démonstration n'existe pas en production. Les autres scénarios passent dans les deux modes : sans clés Stripe, la page Tarifs annonce que le paiement n'est pas encore ouvert, et le scénario 09 l'accepte.
