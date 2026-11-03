# Recette

Ce document reprend les 12 scénarios d'acceptation du cahier des charges (§11). Pour chacun, il indique ce que les tests automatiques couvrent déjà et ce qu'il reste à vérifier à la main en préproduction. Le procès-verbal en fin de document se remplit à chaque mise en ligne.

## Tests automatiques

| Commande | Contenu |
|---|---|
| `npm test` | Tests unitaires : moteur QCM, répétition espacée, tirage de l'examen, offre gratuite, voix, glossaire |
| `npm run test:int` | Tests de bout en bout de l'API, sur une vraie base : comptes, paiement et notifications Stripe, back-office, contenus, durées de conservation, mode erreurs, témoignages, rappels, packs des structures (achat, invitation, places, retrait, remboursement), prolongation gratuite |
| `npm run test:e2e` | Scénarios Maestro qui pilotent le site dans un navigateur (voir [e2e/maestro](../e2e/maestro/README.md)) |

## Les 12 scénarios du cahier

| # | Scénario (§11) | Couvert automatiquement | À vérifier à la main |
|---|---|---|---|
| 1 | Pages publiques | Maestro 01, 08, 09, 10 ; plan du site et `robots.txt` | Relire les textes, vérifier les liens officiels, la mention « plateforme indépendante » sur chaque page |
| 2 | Entraînement gratuit | Maestro 02, 03 ; intégration `premium` (limite gratuite) | Parcours complet sans compte sur un téléphone |
| 3 | Correction | Maestro 02 ; intégration `api`, `content` (correction, source, lien vers la fiche) | Lisibilité des explications, lecture audio |
| 4 | Score de l'examen blanc | Maestro 04 ; tests unitaires du calcul ; intégration `api` | Examen jusqu'à la fin du temps, reprise après fermeture de l'onglet |
| 5 | Historique | Maestro 05 ; intégration `api` (progression) | Évolution des scores après plusieurs examens |
| 6 | Compte | Intégration `accounts` (inscription, confirmation, connexion, mot de passe oublié, export, suppression) | Réception réelle des emails (Brevo), rendu des emails sur mobile |
| 7 | Paiement confirmé | Intégration `premium` (paiement simulé, notification Stripe signée, double notification) | Paiement Stripe en mode test avec une carte de test, reçu, email de confirmation |
| 8 | Paiement échoué | Intégration `premium` (échec, commande abandonnée) | Carte de test refusée par Stripe, retour sur la page Tarifs |
| 9 | Expiration | Intégration `premium` (accès retiré au remboursement), `engagement` (avis avant la fin de l'accès), `maintenance` (durées de conservation) | Un accès Premium arrivé à son terme bloque bien les questions Premium |
| 10 | Publication d'une question | Intégration `admin` (relecture à quatre yeux, publication, versions) ; Maestro 11 | Une question publiée apparaît sur le site, une question retirée disparaît |
| 11 | Rôles | Intégration `admin` (lecture seule, support, éditeur, super-administrateur) | Double authentification réelle avec une application sur téléphone |
| 12 | Smartphone et pages légales | Maestro (fenêtre réduite), menu mobile | Parcours complet sur un vrai téléphone (iOS et Android) ; pages légales publiées après validation juridique |

## Tests complémentaires recommandés (§11)

- **Charge** : 50 personnes qui passent un examen blanc en même temps (outil à choisir : k6, Artillery).
- **Sécurité** : revue des dépendances (`npm audit`), test des en-têtes HTTPS et des cookies `Secure` en préproduction, tentative de connexion répétée (blocage attendu).
- **Emails** : inscription, mot de passe oublié, achat, avertissement d'inactivité, reçus dans Gmail et Outlook.
- **Structures** : commande d'un pack en mode test Stripe, activation de places depuis deux téléphones, affiche imprimée (QR code scanné depuis un téléphone), retrait d'une personne, création d'une structure payée par virement depuis le back-office.
- **Restauration** : `npm run db:restore-test` (voir [exploitation.md](exploitation.md#3-sauvegardes-et-restauration-9-10)).

## Procès-verbal de recette

| Champ | Valeur |
|---|---|
| Version recettée | |
| Date | |
| Environnement | Préproduction |
| Personne qui a recetté | |
| Résultat des tests automatiques | `npm test` : … · `npm run test:int` : … · `npm run test:e2e` : … |
| Scénarios 1 à 12 | OK / KO (détailler les KO ci-dessous) |
| Anomalies bloquantes | |
| Anomalies non bloquantes | |
| Décision | Mise en production acceptée / refusée |
| Signature du commanditaire | |
