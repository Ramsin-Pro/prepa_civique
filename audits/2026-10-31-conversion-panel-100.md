# Audit Prépa Civique — conversion gratuit → Premium (site + panel de 100 acheteurs simulés)
*Date : 2026-10-31 · Cahier de référence : v1.0 · Lu : code du site (accueil, tarifs, paiement, quiz, examen blanc, statistiques), pitch et profil cible (`founder/pitch.md`, `founder/customer.json`), 100 réponses du panel (`founder/panel/results.md`)*

## En bref
Le produit est complet et honnête, mais **il convertit mal dans sa forme actuelle** : 10 acheteurs sur 100 dans le panel. Les acheteurs simulés penchent vers le « oui », donc 10 % est un plafond, pas une prévision. Tous les achats viennent d'un seul profil, les candidats anxieux (62 % d'achat), et aucun des six autres profils n'achète. Trois freins dominent :
- **« Les questions sont gratuites chez le ministère »**, cité par les 100 répondants. C'est pourtant faux sur le fond : la liste officielle donne les énoncés **sans les réponses**, et le site ne le dit nulle part.
- **La confiance** : marque inconnue, aucun avis, peur de payer par carte. C'est la raison n° 1 de refus (34 %).
- **Le prix** : 19 € paraît « cher » à 84 % des répondants, et « trop cher pour acheter » à 25 %.

Le déclencheur d'achat le plus cité est **rater l'examen blanc gratuit** (72 réponses sur 100). Or l'écran de résultat ne propose jamais le Premium.

**À faire en premier :**
1. Trancher le nom avant toute communication (R1), et ne jamais écrire « les questions réellement posées à l'examen » (R2).
2. Dire partout ce que la liste du ministère ne donne pas : les réponses, les explications, l'examen chronométré (R3).
3. Proposer le Premium sur l'écran de résultat de l'examen blanc gratuit, surtout quand le seuil n'est pas atteint (R4), et mesurer ce moment (R10).

> **Suivi (31/10/2026) :** R3, R4, R7 (mention Stripe visible avant connexion), R10 et R11 sont faits. Apple Pay et Google Pay restent à activer dans le tableau de bord Stripe.

## Ce que dit le panel

| Profil (part du panel) | Achat | Profil | Achat |
|---|---:|---|---:|
| Anxieux qui veut être sûr (16) | **62 %** | Conseillé par sa communauté (16) | 0 % |
| Gratuit seulement (22) | 0 % | Lit les avis avant tout (12) | 0 % |
| Compare les concurrents (12) | 0 % | Accompagné par une association (12) | 0 % |
| Tout sur le téléphone (10) | 0 % | **Ensemble** | **10 %** |

Par parcours : naturalisation 12 %, carte de résident 12 %, carte pluriannuelle 8 %.

**Raisons de refus :** confiance 34, prix 25, habitude du gratuit 22, besoin 7, calendrier 1, qualité 1.

**Thèmes récurrents** (nombre de réponses qui en parlent sur 100) :
- liste officielle gratuite : 100 ;
- examen blanc raté : 72 ;
- association ou formation OFII : 43 ;
- carte bancaire ou arnaque : 39 ;
- niveau de français : 20 ;
- rendez-vous repoussé, « les 3 mois passeront pour rien » : 16 ;
- avis en ligne : 14.

**Prix (réponses médianes) :**
- trop bon marché : 2 € ;
- bonne affaire : 7 € ;
- cher : 15 € ;
- trop cher : 25 €.

Entre 5 € et 10 €, personne ne trouve le prix trop élevé (0 sur 100). À 12 €, 10 répondants sur 100 le trouvent trop élevé ; à 15 € comme à 19 €, 25 sur 100.

> Ce sont des acheteurs simulés. Ils servent à trouver les objections et les mots des candidats, pas à prédire un taux de conversion. À confirmer avec de vrais candidats (associations, groupes de cours de français, page de pré-vente) avant de changer le prix. Leurs phrases ne doivent jamais être présentées comme des témoignages.

## Recommandations
| # | Axe | Prio | Constat | Action | Réf. | Effort |
|---|-----|------|---------|--------|------|--------|
| R1 | Communication | P0 | « PrépaCivique » est déjà le nom d'un concurrent direct (prepacivique.fr) ; « Repère » n'est qu'un nom de travail | Trancher le nom (recherche INPI, nom de domaine, réseaux sociaux) avant toute campagne | §15, E01 | M |
| R2 | Conformité & confiance | P0 | La demande de dire « les questions réellement posées à l'examen » ; le pitch du panel dit « les questions officielles » | Formulation fixe : « les énoncés de la liste officielle publiée par le ministère, avec des réponses et des explications rédigées par [Nom] ». Ne jamais écrire « réellement posées », ni laisser croire que les réponses sont officielles | E01, §7 | S |
| R3 | Résultats & conversion | P1 | Objection n° 1 du panel (100/100). Le site ne dit pas que la liste du ministère n'a pas les réponses | Ajouter le comparatif « Liste du ministère / [Nom] gratuit / Premium » sur l'accueil et sur Tarifs (texte ci-dessous) | E01, E14 | S |
| R4 | Résultats & conversion | P1 | Écran de résultat de l'examen blanc (`exam-session.tsx:340-420`) : « Revoir mes erreurs », mais aucune mention du Premium. L'offre n'apparaît que sur `/examen-blanc` une fois l'examen gratuit utilisé | Pour un visiteur sans Premium, ajouter sous le score un encart « Refaire un examen blanc » (texte ci-dessous). Ton factuel, sans alarme | E11, E14 | S |
| R5 | Résultats & conversion | P1 | 16 répondants craignent que « les 3 mois passent pour rien » si le rendez-vous en préfecture est repoussé | Choisir une option (voir Décisions) : accès « jusqu'à votre examen » (6 mois au plus), ou prolongation gratuite d'un mois sur demande. Le dire sur Tarifs | E14, §15 | M |
| R6 | Résultats & conversion | P1 | 19 € est au-dessus du « cher » médian (15 €) ; la référence de marché tourne autour de 12 € (prepacivique.fr, à revérifier) | Tester un prix de [9,90 à 12 €] (hypothèse) avec une page de pré-vente ou un essai A/B avant le lancement. Le prix se change dans le back-office | §15 | S |
| R7 | Conformité & confiance | P1 | 39 répondants ont peur de payer par carte sur un site inconnu. La mention « Paiement sécurisé par Stripe » n'apparaît qu'une fois connecté (`checkout-form.tsx:108`). Le visiteur, lui, voit seulement « Créer mon compte pour continuer » | Afficher la mention dès la carte de prix, pour tout le monde. Activer Apple Pay et Google Pay dans Stripe Checkout (réglage Stripe, sans code) | E15, §9 | S |
| R8 | Résultats & conversion | P1 | 43 répondants révisent avec une association ou l'OFII, et 0 % achète. Plusieurs demandent un code de l'association | Programme « associations » : un code d'accès gratuit ou réduit par association, suivi par la source d'inscription déjà en place. À vérifier : est-ce hors périmètre (§13) ? | non prévu par le cahier | M |
| R9 | Communication | P1 | Aucun avis au lancement ; les profils « lit les avis » et « communauté » sont à 0 % | Après l'examen officiel, inviter la personne par email à témoigner (avec son accord, déjà en place). Ouvrir une fiche Google Business Profile. Jamais d'avis inventés | E01, E13 | S |
| R10 | Pilotage | P1 | Événements suivis : visite, réponse, examen démarré et terminé, inscription, paiement démarré, achat. Il manque « offre vue » et « clic vers Tarifs » (A08) | Ajouter `paywall_view` (verrou du quiz, résultat d'examen, `/examen-blanc`) et `premium_cta_click`, avec l'endroit d'origine, dans l'entonnoir des statistiques | A08 | S |
| R11 | Produit & UX | P1 | 20 répondants craignent de ne pas comprendre les explications | Sur Tarifs et sur l'accueil, montrer un exemple réel de correction avec le bouton « Écouter » | E09, E14 | S |
| R12 | Résultats & conversion | P2 | Le profil anxieux achète, mais l'encart du quiz bloqué parle de quantité (« N autres questions ») | Parler de préparation : « Entraînez-vous sur les [191] questions de votre parcours et passez autant d'examens blancs que nécessaire » | E07, E14 | S |
| R13 | Produit & UX | P2 | Le profil « tout sur téléphone, peu de données » est à 0 % ; deux répondants parlent de forfait limité | Mesurer le poids des pages et de l'audio sur mobile (cible hypothétique : moins de 500 Ko par question hors audio) ; garder l'audio à la demande | §10 | M |
| R14 | Résultats & conversion | P2 | Une garantie « remboursé si » est demandée par 3 répondants (dont 2 passés par une formation décevante) | À trancher : remboursement sous 7 jours si moins de 20 questions ont été faites (coût faible). À aligner sur la renonciation au droit de rétractation et sur les CGV | §15 | S |

## Détail par axe

### Résultats & conversion
**R3 — Répondre à « c'est gratuit au ministère »** · P1. Texte proposé pour l'accueil et pour Tarifs :

| | Liste du ministère | [Nom] gratuit | [Nom] Premium |
|---|---|---|---|
| Énoncés officiels | Oui | 10 par thème | Tous |
| Bonne réponse et explication simple | **Non** | Oui | Oui |
| Examen blanc chronométré (40 questions, 45 min) | Non | 1 | Illimité |
| Révision de vos erreurs | Non | Oui | Oui |

Phrase d'accroche :
- avant : « Les questions officielles, expliquées »
- après : « La liste du ministère donne les questions, pas les réponses. Ici, chaque question a sa réponse, expliquée simplement, avec sa source. »

À vérifier avant de publier : que la liste du ministère est toujours publiée sans les réponses, pour chacun des trois parcours.

**R4 — Le bon moment pour proposer le Premium** · P1. Texte proposé :

> **Envie de refaire un examen blanc ?** Votre examen gratuit est utilisé. Le pass Premium ([prix à fixer], payé une fois, sans abonnement) ouvre des examens blancs illimités, tirés à chaque fois parmi toutes les questions de votre parcours. [Voir l'offre]

Cet encart n'apparaît pas pendant l'examen, ni chez quelqu'un qui a déjà le Premium. Ne jamais écrire « vous risquez de rater ».

### Conformité & confiance
**R2 — « Questions officielles »** · P0. Les énoncés viennent bien de la liste publiée. Les propositions de réponse, la bonne réponse et l'explication sont rédigées par l'équipe, et sont encore à relire. Les mises en situation de l'examen ne sont pas publiées. Écrire « les questions réellement posées à l'examen » serait une promesse trompeuse (pratique commerciale trompeuse, Code de la consommation L121-2) et donnerait une apparence officielle. Formulation sûre : « Entraînez-vous sur les énoncés de la liste officielle publiée par le ministère de l'Intérieur. »

## Points forts à garder
- **Un gratuit généreux et sans inscription**, avec examen blanc. Le panel s'en sert spontanément, et c'est ce qui crée le moment déclencheur (R4).
- **Paiement unique sans renouvellement**, rappelé partout : les acheteurs le citent comme rassurant.
- **Mention d'indépendance, sources affichées, aucune promesse de réussite** : rien ne doit être sacrifié à la conversion.
- **Lecture audio et lexique** : cités comme raison d'essayer par les profils qui ont peur de ne pas comprendre.
- **Témoignages vérifiés** (accord, modération, date, explication de la vérification) : prêts à recevoir de vrais avis.

## Décisions à trancher
| Décision | Options | Recommandation | Qui tranche |
|---|---|---|---|
| Prix du pass (déc. n° 2) | 19 € · 12 € · 9,90 € | Tester 9,90 € et 12 € sur une page de pré-vente avant le lancement (hypothèse du panel : zone 7–12 €) | Commanditaire |
| Durée d'accès | 3 mois fixes · 6 mois · « jusqu'à l'examen » (6 mois au plus) · prolongation gratuite | « Jusqu'à la date d'examen indiquée, 6 mois au plus » : la date d'examen existe déjà dans le profil | Commanditaire |
| Associations | Rien · codes gratuits · codes réduits · licence payée par l'association | Codes gratuits pour 3 à 5 associations pilotes, en échange de retours | Commanditaire + équipe |
| Garantie | Aucune · remboursement sous 7 jours si peu utilisé | À voir avec le juriste, avec la question de la rétractation (déc. n° 18) | Juriste |

## À vérifier sur les sources officielles
- La liste officielle est-elle toujours publiée sans les réponses, pour la CSP, la carte de résident et la naturalisation ? → formation-civique.interieur.gouv.fr et data.gouv.fr
- Prix actuels des concurrents (dont prepacivique.fr/tarifs) → à relever de nouveau au moment de fixer le prix.
