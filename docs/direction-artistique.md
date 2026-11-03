# Direction artistique

*Version 0.1 · 31 octobre 2026 · Aperçu visuel : [apercu-direction-artistique.html](apercu-direction-artistique.html)*

Ce document fixe le style du site avant le développement. Les éléments qui dépendent d'une décision encore ouverte (nom, prix, limites du gratuit…) utilisent une **valeur provisoire cohérente**, signalée par la mention *(provisoire)*. Ils sont tous repris dans la section [Décisions à trancher](#décisions-à-trancher), à la fin du document.

---

## 1. L'intention

**« Un carnet de route calme et sérieux. »**

Le candidat vit une démarche dont dépend son séjour. Il est souvent inquiet, parfois peu à l'aise en français, et il a appris à se méfier des sites qui promettent tout. Le site doit donc :

- **rassurer sans infantiliser** : un ton posé, de l'espace, aucune alerte criarde ;
- **inspirer confiance par la transparence** : sources visibles, prix clairs, indépendance affichée, plutôt que par des sceaux et des badges ;
- **guider pas à pas** : l'idée de parcours structure tout le site ;
- **être lisible par tous** : grands caractères, police conçue pour la lisibilité, contrastes élevés, mobile d'abord.

Trois mots pour juger chaque écran : **clair, chaleureux, sérieux.**

## 2. Ce qu'on évite, et pourquoi

| À éviter | Raison |
|---|---|
| Bleu-blanc-rouge, Marianne, drapeau, coq, charte proche des sites .gouv (DSFR) | Le site ne doit jamais ressembler à un service officiel (cahier p. 2, E01). C'est aussi la première chose que copient les arnaques. |
| Dégradés violets, look « startup SaaS » générique | Banal, et peu crédible pour un sujet administratif. |
| Photos de banque d'images (poignées de main, passeports, tours Eiffel) | Clichés, et parfois stigmatisants. |
| Rouge vif pour les erreurs, gros « ÉCHEC » | Anxiogène. Une erreur est une étape d'apprentissage (E09). |
| Comptes à rebours, bandeaux clignotants, « plus que 2 places » | Interdit par le cahier (E14) et destructeur de confiance. |
| Texte gris clair, petites polices | Illisible pour une partie du public. |

## 3. Nom de travail et logo

- **Nom de travail : « Repère »** *(provisoire)*. « Prépa Civique » est déjà utilisé par un concurrent (prepacivique.fr). « Repère » est un mot courant, compréhensible dès le niveau A2, et il colle à l'idée de parcours et d'orientation. Il reste à vérifier (INPI, domaine, réseaux sociaux).
- **Signature :** « Préparation à l'examen civique » suivie de « Plateforme indépendante » en petit.
- **Logo :** un **jalon**, c'est-à-dire un cercle plein posé sur un tracé, dans un carré aux coins arrondis vert sapin. Il est simple, lisible en 16 px (favicon) et sans aucun symbole national.

## 4. Couleurs

Une palette **végétale et chaude**, loin du bleu institutionnel. Le vert évoque la progression et le calme, l'ocre la chaleur et la mise en avant, l'encre le sérieux.

| Rôle | Nom | Hex | Usage | Contraste |
|---|---|---|---|---|
| Texte principal | Encre | `#1B2B34` | Titres, texte courant | 14,5:1 sur papier |
| Texte secondaire | Encre douce | `#55626A` | Légendes, métadonnées | 5,9:1 sur papier |
| Fond de page | Papier | `#FAF7F0` | Fond général, légèrement chaud | — |
| Fond de carte | Blanc | `#FFFFFF` | Cartes, questions | — |
| Bordure | Ligne | `#E4DED1` | Séparateurs, contours de carte | — |
| Couleur principale | Sapin 700 | `#1F5E4B` | Boutons principaux, liens, logo | 7,6:1 avec du blanc |
| Principale, variante | Sapin 500 | `#2E7A62` | Survol, tracé, bonne réponse | 5,1:1 avec du blanc |
| Principale, fond | Sapin 50 | `#EEF5F1` | Encadrés, fond « bonne réponse » | — |
| Accent | Ocre 500 | `#C98A1B` | Jalons, mise en avant, Premium (avec texte encre) | 5:1 avec l'encre |
| Accent, texte | Ocre 700 | `#8A5C0E` | Texte d'accent sur fond clair | 5,8:1 sur blanc |
| Accent, fond | Ocre 100 | `#F8EBCF` | Fond de badge, surlignage | — |
| Troisième couleur | Prune 700 | `#6B3A5B` | Parcours naturalisation | 8,8:1 avec du blanc |
| Erreur | Brique 700 | `#B4442C` | Mauvaise réponse, erreurs de formulaire | 5,5:1 avec du blanc |
| Erreur, fond | Brique 100 | `#F8E3DD` | Fond « mauvaise réponse » | — |

**Une couleur par parcours**, reprise partout (cartes, tableau de bord, tracé) :
- carte de séjour pluriannuelle : **sapin** ;
- carte de résident : **ocre** ;
- naturalisation : **prune**.

**Règle :** la couleur n'est jamais le seul indicateur. Une bonne réponse a aussi une icône ✓ et le texte « Bonne réponse ».

## 5. Typographie

| Usage | Police | Pourquoi |
|---|---|---|
| Titres (H1, H2, grands chiffres) | **Fraunces**, graisse 600 | Une serif moderne et chaleureuse, qui donne au site un caractère éditorial et sérieux, différent des sites concurrents en sans-serif standard. Réservée aux grands titres, où elle reste très lisible. |
| Texte, interface, questions | **Atkinson Hyperlegible**, 400 et 700 | Conçue par le Braille Institute pour distinguer les lettres qui se ressemblent (l/I/1, O/0). C'est idéal pour un public qui lit en français langue étrangère. Les deux polices sont gratuites (Google Fonts). |

**Échelle, mobile d'abord** (taille de base de **18 px**, plus grande que l'habituel 16 px, pour la lisibilité) :

| Élément | Mobile | Ordinateur | Interligne |
|---|---|---|---|
| H1 | 34 px | 52 px | 1,1 |
| H2 | 26 px | 34 px | 1,2 |
| H3 | 21 px | 22 px | 1,3 |
| Texte | 18 px | 18 px | 1,6 |
| Énoncé d'une question | 21 px | 22 px | 1,45 |
| Petit texte | 15 px | 15 px | 1,5 |

- Lignes de 60 à 70 caractères au maximum.
- Chiffres tabulaires pour les scores et le chronomètre.

## 6. Le motif signature : le tracé

L'élément qui rend le site reconnaissable est **un tracé ponctué de jalons**, comme un itinéraire sur une carte. Il exprime le cœur de la promesse : on avance étape par étape.

On le retrouve :
- dans l'illustration d'accueil, où les trois parcours sont trois stations ;
- dans « Comment ça marche », avec 3 étapes reliées par le tracé ;
- dans la **barre de progression du QCM**, une ligne avec un jalon toutes les 10 questions ;
- dans le tableau de bord, qui montre la progression par thème ;
- dans le logo.

Il n'y a pas d'autre illustration au lancement : ni photos ni personnages. C'est cohérent, sobre et peu coûteux.

## 7. Composants clés

- **Boutons.** Hauteur minimale de 48 px, coins arrondis de 10 px, libellé avec un verbe (« Commencer l'entraînement »). Le bouton principal est sapin plein avec texte blanc. Le secondaire a un contour encre. Il n'y a qu'un seul bouton principal par écran.
- **Cartes.** Fond blanc, bordure « ligne » de 1 px, coins arrondis de 14 px, ombre très légère. Pas d'ombres lourdes.
- **Puce de source.** Chaque question et chaque fiche affiche une pastille discrète, par exemple « Source : liste officielle · vérifiée le 31/10/2026 ». C'est le principal signal de confiance (§7 du cahier).
- **Étiquette de type.** « Question officielle » ou « Mise en situation · rédigée par [Nom] ». Les deux ont un style distinct pour ne jamais les confondre.
- **Propositions de QCM.** Grandes zones cliquables sur toute la largeur, lettre A–D dans un cercle, état sélectionné bien visible.
- **Correction.** Un encadré vert sapin avec ✓ pour une bonne réponse, un encadré brique avec une icône douce et le titre « Ce n'est pas la bonne réponse » pour une erreur, jamais « Faux ! ». L'explication vient tout de suite, avec la bonne réponse en gras et un lien vers la fiche.
- **Résultat d'examen blanc.** « Seuil atteint » ou « Seuil pas encore atteint », jamais « réussi » ni « échoué ». Une phrase rappelle toujours : « C'est un entraînement. Seul l'examen officiel donne l'attestation. » (E11)
- **Bandeau d'indépendance.** Il est présent en pied de chaque page, sur la page Premium et dans les emails : « [Nom] est une plateforme indépendante. Elle n'a aucun lien avec l'administration française. »

## 8. Ton et rédaction

- **Vouvoiement**, phrases courtes (15 mots en moyenne), un message par phrase.
- **Mots simples**, sigles expliqués la première fois : « carte de séjour pluriannuelle (CSP) ».
- **Verbes d'action** sur les boutons, sans jargon (« Valider ma réponse » plutôt que « Soumettre »).
- **Honnête sur les limites** : « Nous ne pouvons pas vous dire si vous devez passer l'examen. Le site service-public.gouv.fr vous le dira. »
- **Promesse d'accueil** *(provisoire)* : « Préparez l'examen civique, étape par étape. » Sous-titre : « Des questions au format de l'examen, des corrections expliquées simplement, et vos progrès sur votre téléphone. »

## 9. Accessibilité et mobile

- Objectif **RGAA / WCAG 2.1 niveau AA**, et AAA pour le texte courant (contraste ≥ 7:1 sur le texte principal).
- Conception à **360 px de large d'abord**. Toutes les zones cliquables font au moins 48 × 48 px.
- Navigation complète au clavier, focus visible avec un contour ocre de 3 px.
- Le chronomètre de l'examen est lisible par les lecteurs d'écran, avec une annonce à 10 min et à 1 min, et pas d'annonce chaque seconde.
- Les animations sont courtes (moins de 200 ms) et désactivées si l'utilisateur a demandé à réduire les animations.
- Le poids de page reste léger : 2 polices, aucune image lourde, illustrations en SVG.

## 10. Jetons pour le développement (Tailwind CSS v4)

En place dans [apps/web/src/app/globals.css](../apps/web/src/app/globals.css), qui fait foi. Les polices se chargent avec `next/font/google` ([layout.tsx](../apps/web/src/app/layout.tsx)). Extrait :

```css
@import "tailwindcss";

@theme {
  --color-encre: #1B2B34;
  --color-encre-doux: #55626A;
  --color-papier: #FAF7F0;
  --color-ligne: #E4DED1;

  --color-sapin-50: #EEF5F1;
  --color-sapin-100: #D6E8DE;
  --color-sapin-500: #2E7A62;
  --color-sapin-700: #1F5E4B;
  --color-sapin-900: #123A2E;

  --color-ocre-100: #F8EBCF;
  --color-ocre-500: #C98A1B;
  --color-ocre-700: #8A5C0E;

  --color-prune-100: #F1E4EC;
  --color-prune-700: #6B3A5B;

  --color-brique-100: #F8E3DD;
  --color-brique-700: #B4442C;

  --font-titre: var(--font-fraunces), Georgia, serif;
  --font-texte: var(--font-atkinson), system-ui, sans-serif;

  --radius-bouton: 10px;
  --radius-carte: 14px;
  --shadow-carte: 0 1px 2px rgb(27 43 52 / 0.06), 0 4px 16px rgb(27 43 52 / 0.04);
}

body { font-size: 1.125rem; } /* texte courant à 18 px */
```

La taille de 18 px est posée sur le texte (`body`) et non sur la page (`html`). Ainsi, les espacements et les points de rupture de Tailwind gardent leurs valeurs habituelles.

## 11. Stack technique retenue

C'est décidé : le front en **Next.js + TypeScript + Tailwind CSS**, le back-end en **Node.js + Express**, la base **PostgreSQL**, le tout conteneurisé avec **Docker**.

Ce choix remplace Supabase et Vercel, que le cahier (§8) indiquait à titre indicatif : à faire valider par Ramsin. Les points encore ouverts liés à ce choix sont dans la section suivante.

---

## Décisions à trancher

Valeurs provisoires utilisées dans ce document et dans l'aperçu. Chaque ligne est à confirmer, ou à remplacer, avant d'aller plus loin sur la partie concernée.

| # | Décision | Valeur provisoire utilisée | Pourquoi ce choix provisoire | Bloque |
|---|---|---|---|---|
| 1 | **Nom de marque** | « Repère » (nom de travail) | « Prépa Civique » est pris par prepacivique.fr. Mot simple, en lien avec le parcours. Disponibilité à vérifier (INPI, domaine, réseaux). | Logo, domaine, textes, maquettes |
| 2 | **Modèle Premium** | Pass 3 mois, **19 € TTC**, paiement unique, sans renouvellement automatique | L'examen se réussit une fois, le cahier prévoit un accès « à durée déterminée » (§1), et le marché se situe autour de 12 à 25 € en paiement unique. | Page Premium, paiement, droits |
| 3 | **Limites du gratuit** | 1 examen blanc complet + 10 questions par thème, sans inscription | Un concurrent offre déjà un examen blanc gratuit sans inscription : il faut au moins l'égaler. | Catalogue, paywall, textes |
| 4 | **Format de l'examen blanc** | 28 questions de connaissance + 12 mises en situation, 4 propositions, **une seule bonne réponse**, 45 min, seuil 32/40, paramétrable | C'est le format officiel vérifié ; le cahier (E08) prévoit à tort « une ou plusieurs réponses ». | Moteur QCM, modèle de données |
| 5 | **Premier parcours à produire** | Carte de séjour pluriannuelle (CSP) d'abord, puis la carte de résident, puis la naturalisation | La liste officielle CSP est publiée (environ 191 énoncés) ; mieux vaut un parcours complet que trois à moitié. | Plan de contenu, page d'accueil |
| 6 | **Rédaction et relecture des questions** | À nommer : un rédacteur et un relecteur différents, au rythme d'un lot par thème | Le cahier exige une relecture compétente (§7), et c'est le plus gros chantier du projet. | Contenu, planning |
| 7 | **Langues au lancement** | Français seul, avec un glossaire des mots administratifs et une lecture audio des questions (en P1) | Le multilingue est hors périmètre (§13). L'aide à la lecture sert un public A2–B1 à moindre coût. | Interface QCM, fiches |
| 8 | **Validation du changement de stack** | Express + PostgreSQL + Docker à la place de Supabase / Vercel | Choix de l'équipe ; le cahier le donnait à titre indicatif. | Architecture |
| 9 | **ORM / accès à la base** | Prisma | Typage TypeScript de bout en bout, migrations versionnées. Alternative : Drizzle. | Back-end |
| 10 | **Authentification** | Sessions en cookie httpOnly stockées en base, mots de passe hachés avec scrypt (intégré à Node.js, sans dépendance native ; argon2id reste possible) | Plus simple et plus sûr que des jetons JWT pour un site web classique. | Back-end, front |
| 11 | **Hébergement** | Serveur en France ou dans l'UE (par exemple Scaleway ou OVHcloud), avec Docker Compose | Vercel ne convient plus à Express + Docker ; un hébergement européen simplifie le RGPD. | Déploiement, coûts |
| 12 | **Services tiers** | Stripe Checkout (paiement), Brevo (emails), statistiques internes sans traceur à la place de Matomo | Ce sont ceux du cahier (§8), et ils restent compatibles avec la nouvelle stack. | Paiement, emails, mesure |
| 13 | **Mode sombre** | Pas au lancement | Pas demandé par le cahier ; à reconsidérer après le pilote. | Front (tokens) |
| 14 | **Logo définitif** | Jalon sur tracé, dessiné en SVG simple | Suffisant pour le MVP ; un graphiste pourra le retravailler une fois le nom choisi. | Identité |
| 15 | **Budget et découpage en lots** | Lot 1 : site public, QCM, examen blanc, comptes, back-office des questions. Lot 2 : Premium et paiement, fiches, statistiques | 3 300 à 5 200 € pour 6 semaines est serré pour tout le périmètre (§14). | Planning |
| 16 | **Voix de lecture** | Voix Rémy de Microsoft (Azure Speech, `fr-FR-RemyMultilingualNeural`), extraits gardés en cache, voix du navigateur en secours, vitesse 0,75× à 2× | Demandé par l'équipe ; une voix naturelle aide le public A2-B1. Gratuit jusqu'à 0,5 million de caractères par mois (offre F0), payant au-delà : tarif à vérifier. | Compte Azure, clé |
| 17 | **Fiches de révision** | Gratuites pour tous | Elles attirent par la recherche et donnent confiance ; le Premium se joue sur les questions et les examens blancs. | Offre, textes |
| 18 | **Droit de rétractation** | Pass vu comme un contenu numérique : renonciation recueillie avant paiement et confirmée par email (L221-28 13°) | Si un juriste le qualifie de service numérique, la rétractation sous 14 jours s'applique (L221-25) et un bouton « renoncer au contrat » en ligne devient nécessaire (directive (UE) 2023/2673, depuis le 19 juin 2026). | CGV, paiement, compte |
| 19 | **Remboursements** | Au cas par cas par un super-administrateur ; remboursement total = accès retiré, partiel = accès gardé | Simple pour démarrer ; à aligner sur les CGV validées. | CGV, back-office |
| 20 | **Relecture à quatre yeux** | Validation par une autre personne que la dernière à avoir modifié ; un super-administrateur peut valider seul (noté au journal) | Petite équipe au lancement, sans renoncer à la traçabilité. | Workflow éditorial |
| 21 | **Rappels et emails de fidélité** | Rappel de révision sur accord seulement, au plus une fois par semaine ; avis 7 jours avant la fin d'un accès Premium | Utile sans être insistant ; l'avis de fin évite la surprise, puisqu'il n'y a pas de renouvellement automatique. | Emails, politique de confidentialité |
| 22 | **Témoignages** | Réservés aux personnes qui ont terminé un examen blanc ou répondu à 20 questions ; relus avant publication, jamais modifiés par l'équipe, 6 au plus sur l'accueil | Des avis authentiques et vérifiables, comme le demande le droit de la consommation (avis en ligne) ; aucun faux témoignage pour démarrer. | Accueil, modération |
| 23 | **Offre associations et structures** | Packs de 25, 50 et 100 places à 8, 7 et 6 € par personne (200, 350 et 600 € TTC), sur devis à 5 € à partir de 250 ; chaque place donne 6 mois de Premium à partir de son activation, places à activer dans les 12 mois ; paiement par carte ou virement ; places d'essai sur demande | Demande issue du rendez-vous avec les associations. Le panel simulé situe la « bonne affaire » vers 7 à 8 € et le seuil « cher » vers 15 € ; 6 mois couvrent les rendez-vous repoussés. Le pass individuel reste à 19 € pour 3 mois. | CGV, back-office, facturation |
| 24 | **Prolongation gratuite** | 30 jours, une fois par pass, depuis le compte (`PREMIUM_EXTENSION_DAYS`, 0 pour désactiver) | Répond à la crainte « les 3 mois passeront pour rien si mon rendez-vous est repoussé », pour un coût faible. | Compte, CGV |
| 25 | **Ce que voit une structure** | Email masqué et date d'activation pour tous ; email complet et progression avec l'accord de la personne ; chiffres de groupe à partir de 5 personnes | Gérer les places sans exposer les personnes ; le partage reste un choix réversible. | Confidentialité, CGV |
| 26 | **Place de l'offre associations** | Au même niveau que le Premium : lien « Associations » dans le menu principal, encart dans le haut de l'accueil, troisième carte de la page Tarifs, carte à côté du Premium sur l'accueil | Demande de l'équipe : les coordinateurs ne font pas forcément défiler jusqu'en bas. L'encart reste discret pour ne pas détourner les candidats de « Tester mes connaissances ». | Menu, accueil, tarifs |
| 27 | **Sécurité qui touche le parcours** | La confirmation de l'email ne connecte plus : la personne se connecte ensuite. Sessions de l'équipe fermées après 8 h sans activité. 5 essais de code de double authentification par quart d'heure. 30 nouvelles lectures Azure par heure et par adresse IP, puis la voix du navigateur prend le relais. | Empêche qu'un tiers inscrive l'adresse de quelqu'un avec son propre mot de passe ; limite les abus et les coûts. Les seuils se règlent dans le code si une salle d'association les atteint. | Inscription, back-office, voix |
