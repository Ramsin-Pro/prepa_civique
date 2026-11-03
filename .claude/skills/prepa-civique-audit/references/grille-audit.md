# Grille d'audit par axe

Pour chaque axe : les questions à se poser, puis les pièges fréquents sur ce type de projet. Ce n'est pas une liste à recopier : ne retiens que ce que la cible justifie, preuve à l'appui.

## Sommaire
1. [Résultats & conversion](#résultats--conversion)
2. [Produit & UX](#produit--ux)
3. [Pédagogie & contenus](#pédagogie--contenus)
4. [Communication](#communication)
5. [Conformité & confiance](#conformité--confiance)
6. [Technique & données](#technique--données)
7. [Pilotage](#pilotage)

---

## Résultats & conversion

**Questions à se poser**
- Les objectifs sont-ils chiffrés ? Sans cible (visiteurs par mois, part des visiteurs qui finissent un premier QCM, inscription, achat), personne ne saura si le lancement est réussi. Si rien n'existe, propose des cibles de départ en les présentant comme des **hypothèses à valider pendant le pilote**, pas comme des faits.
- L'entonnoir (A08) est-il mesurable ? Il faut des événements nommés : `qcm_demarre`, `qcm_termine`, `inscription`, `paywall_vu`, `paiement_demarre`, `achat`, avec la source d'acquisition, dans un outil d'audience conforme (Matomo configuré sans traceur avant consentement si nécessaire).
- La limite du gratuit est-elle définie, annoncée et assez généreuse pour que le candidat sente la valeur avant de payer ?
- Le paywall arrive-t-il au bon moment ? Après une correction utile ou un premier score, oui ; au milieu d'un examen blanc, non.
- Que vend le Premium que le gratuit ne donne pas ? Les énoncés officiels sont publiés gratuitement par le ministère (`examen-civique.md`) et des concurrents offrent déjà un examen blanc gratuit sans inscription (`marche.md`).
- Qui sont les candidats visés, concrètement ? Sans deux ou trois profils types (parcours, niveau de français, appareil, moment de la démarche, budget), les choix de produit et de communication se font à l'aveugle.
- Le modèle de prix colle-t-il au besoin ? Un candidat qui réussit n'a plus besoin du service : un accès de durée limitée (achat ponctuel) se défend mieux qu'un abonnement.
- La progression d'un visiteur anonyme est-elle conservée quand il crée son compte ? Sinon l'incitation « créez un compte pour sauvegarder » perd sa valeur.
- Que fait-on pour faire revenir l'utilisateur (rappel de révision, objectif quotidien, email J-3 avant la fin de l'accès, avec consentement) ?

**Pièges fréquents** : objectifs sans chiffres ; tableau de bord admin qui affiche le CA mais pas l'activation ; aucune mesure de la satisfaction ou de la réussite déclarée après l'examen réel (à demander, jamais à inventer).

## Produit & UX

**Questions à se poser**
- Tout est-il utilisable d'une main sur un smartphone Android d'entrée de gamme, avec une connexion lente ? Poids des pages, zones tactiles d'au moins 44 px, texte d'au moins 16 px.
- Le niveau d'accessibilité visé est-il nommé et testable (RGAA / WCAG 2.1 AA) plutôt que « contrastes suffisants » ?
- Un lecteur de niveau A2–B1 comprend-il chaque écran ? Pictogrammes, lecture audio de la question, glossaire des mots administratifs. L'aide linguistique est une décision ouverte du §15 ; le multilingue complet est hors périmètre (§13).
- Le mode examen blanc reproduit-il les conditions réelles (4 propositions, une seule bonne réponse, chrono, pas de correction avant la fin) ?
- « Recommandation de révision » (E06) et « à revoir » (E07) ont-ils une règle définie ? Ex. : thème au taux le plus bas, question ratée deux fois, répétition espacée.
- Les états vides, les erreurs et la reprise après coupure sont-ils prévus ?
- L'utilisateur comprend-il en moins de 10 secondes quel parcours le concerne, sans que le site affirme sa situation à sa place (E02, E04) ?

**Pièges fréquents** : écrans pensés sur ordinateur ; chronomètre inaccessible au lecteur d'écran ; « une ou plusieurs réponses » en examen blanc alors que l'examen réel n'en a qu'une ; aucune maquette mobile avant le développement.

## Pédagogie & contenus

**Pour chaque question**
- Les champs du §7 sont-ils tous remplis (identifiant, parcours, thématique, type, énoncé, réponses, bonne réponse, explication, source avec date, version et auteur) ?
- **Exactitude** : la réponse marquée juste l'est-elle vraiment ? Vérifie les dates, les chiffres, les noms et les institutions. Une erreur factuelle est un P0, car elle apprend une fausse réponse à quelqu'un qui joue son titre de séjour.
- **Une seule bonne réponse**, sans ambiguïté. Si plusieurs propositions sont défendables, la question est à réécrire.
- **Distracteurs** plausibles, de longueur et de forme proches de la bonne réponse. À éviter : les propositions absurdes ou moqueuses, « toutes les réponses » ou « aucune », la bonne réponse systématiquement la plus longue.
- **Énoncé** : une seule idée, pas de double négation, vocabulaire courant, sigles expliqués. Teste-le à voix haute : un lecteur A2–B1 doit le comprendre du premier coup.
- **Périmètre** : la question porte-t-elle sur les connaissances civiques attendues, ou dérive-t-elle vers du droit des étrangers ou du conseil juridique (hors champ, E04, E17) ? Une question hors champ se **retire** ; la réécrire sur le même sujet garde le problème. Propose à la place un énoncé de la liste officielle du même thème.
- **Position de la bonne réponse** : si elle est presque toujours au même endroit (A ou B), un candidat apprend la position plutôt que la réponse. Recommande de mélanger l'ordre à l'affichage.
- **Explication** : dit pourquoi la bonne réponse est juste **et** pourquoi les autres ne le sont pas, en 2 à 4 phrases simples, avec un lien vers la fiche.
- **Type et source** : « connaissance officielle » seulement si l'énoncé vient de la liste publiée pour **ce parcours**, avec l'URL. Cette liste ne donne que l'énoncé : les propositions, la réponse et l'explication ont besoin de leur propre source (Légifrance, service-public…). Une source du type « groupe Facebook » ou « vu sur internet » n'est pas une source. Une mise en situation est toujours « originale ».
- **Ta version corrigée** repasse toute cette grille : une seule bonne réponse, juste, des distracteurs plausibles, une source précise. Une correction qui garde deux réponses défendables ne corrige rien.
- **Neutralité** : pas de stéréotype sur une origine, une religion ou un genre ; des exemples où chacun peut se reconnaître.

**Pour un ensemble de contenus**
- La couverture est-elle équilibrée entre parcours et thématiques ? Toute la liste officielle publiée est-elle couverte ?
- Qui relit, avec quelle compétence et selon quel workflow (A03) ? Une date de revue est-elle planifiée ?
- Le volume visé au lancement et le temps de production sont-ils estimés ? Le §14 exclut la production éditoriale du budget.

## Communication

**Questions à se poser**
- La promesse tient-elle en une phrase compréhensible au niveau A2 ? Ex. : « Entraînez-vous à l'examen civique sur votre téléphone, avec des corrections expliquées simplement. »
- La mention « plateforme indépendante, non affiliée à l'administration » est-elle visible là où le doute peut naître (accueil, tarifs, pieds de page, publicités) ?
- Le texte contient-il un **mot interdit** : officiel, agréé, certifié, partenaire de l'État, « questions réellement posées », réussite garantie, taux de réussite non mesuré, chiffre d'utilisateurs non réel ?
- Les témoignages sont-ils authentiques, datés et recueillis avec accord ? Avant le lancement, il n'y en a pas : n'en mets pas.
- Y a-t-il une pression artificielle (compte à rebours qui se relance, « plus que 3 places », « l'examen devient payant demain ») ?
- Le ton est-il rassurant et respectueux ? Pas de majuscules alarmistes, pas de « vous risquez l'expulsion », pas de tutoiement familier dans les écrits transactionnels.
- Chaque fait réglementaire cité est-il exact et sourcé ? Ex. : le renouvellement n'est pas concerné par l'examen.
- Les sigles sont-ils expliqués au moins une fois (CSP = carte de séjour pluriannuelle, CR = carte de résident, ANEF = site de demande de titre de séjour) ? Citer l'ANEF ou un site .gouv ne doit pas laisser croire à un lien avec l'administration.
- Les canaux correspondent-ils au public ? Recherche Google (pages « examen civique CSP », « questions examen civique »), groupes Facebook et WhatsApp communautaires, vidéos courtes sous-titrées, associations, centres de cours de français. Un partenariat ponctuel avec une association n'est pas la « marketplace » exclue au §13.
- Les emails vont-ils au-delà du transactionnel ? Bienvenue, rappel de révision, fin d'accès, avec consentement marketing séparé.
- Pour la publicité, les règles des plateformes sur les sujets d'immigration ont-elles été vérifiées ?

**Pièges fréquents** : vouloir « convertir » avec des ressorts qui détruisent la confiance d'un public déjà méfiant envers les arnaques administratives ; slogans incompréhensibles pour un lecteur A2 ; posts qui affirment des règles fausses.

Pour chaque texte à problème, donne la version réécrite (avant → après) : c'est le livrable le plus utile de l'axe. Une réécriture plus courte ne doit pas devenir fausse : si l'original affirmait une règle erronée, la version corrigée énonce la règle exacte (par exemple « pour une première demande de carte de séjour pluriannuelle, de carte de résident ou de naturalisation ; le renouvellement n'est pas concerné »).

## Conformité & confiance

**Questions à se poser**
- Mentions légales (éditeur à confirmer), CGU, CGV, politique de confidentialité et politique cookies : rédigées, validées, accessibles depuis chaque page ?
- Prix affichés TTC, durée, renouvellement ou non, conditions de remboursement (E14) ?
- Contenu numérique fourni immédiatement : la renonciation expresse au droit de rétractation est-elle recueillie avant le paiement (E15) ?
- Données : rien sur les titres de séjour ni sur les pièces d'identité (§9). Les réponses du simulateur d'orientation décrivent une situation administrative : faut-il vraiment les conserver, et liées à un compte ?
- Consentement marketing séparé, facultatif, **non pré-coché** (E05) ; preuve du consentement conservée.
- Traceurs : aucun traceur non essentiel avant consentement ; Matomo configuré pour l'exemption de consentement si c'est le choix retenu.
- Comptes admin protégés par une double authentification (A09) ?
- Droits RGPD (accès, suppression) exerçables simplement (E16) et durées de conservation définies ?

**Pièges fréquents** : demander une copie du titre de séjour « pour mieux orienter » ; case newsletter pré-cochée ; prix HT affichés à des particuliers ; abonnement à renouvellement automatique mal signalé.

## Technique & données

**Questions à se poser**
- Les paramètres d'examen (nombre de questions, durée, seuil, répartition) sont-ils en base et versionnés (`exam_templates.version`), et non codés en dur ?
- En mode examen, les bonnes réponses sont-elles **absentes** de ce que reçoit le navigateur jusqu'à la soumission ? Sinon elles sont lisibles dans les outils du navigateur. Le score est-il calculé côté serveur ?
- Premium : activé seulement par un webhook Stripe dont la signature est vérifiée, de façon idempotente (identifiant d'événement stocké), avec la gestion des paiements en attente et des remboursements ?
- Supabase : RLS activée sur toutes les tables, clé service jamais exposée au client, rôles admin vérifiés côté serveur ?
- Le modèle de données couvre-t-il tout ce que les écrans demandent ? À vérifier en particulier : table des sources (référencée par `questions.source_id`), lien questions ↔ thématiques en many-to-many, signalements (E08, A01), favoris (E09, E13), historique des versions de question (§5), journal d'audit (A09), consentements, événements de paiement, `user_answers` à plusieurs réponses si le multi-réponse est gardé.
- Les tentatives anonymes (`session_id`) sont-elles rattachées au compte à l'inscription ?
- Les pages publiques sont-elles générées statiquement pour le SEO et la vitesse ?
- Tests automatisés du calcul du score, de l'expiration Premium et des webhooks ? Restauration des sauvegardes testée ?

**Pièges fréquents** : correction envoyée au client « pour aller plus vite » ; double activation Premium sur un webhook rejoué ; schéma figé sur 40 questions.

## Pilotage

**Questions à se poser**
- Le nom de marque est-il libre ? Voir `marche.md` : un concurrent direct utilise déjà « PrépaCivique ». À trancher avant les maquettes, le domaine et la communication.
- Le budget est-il cohérent avec le périmètre ? Comparer le nombre d'écrans, de modules du back-office et d'intégrations (paiement, emails, audience, conformité) au montant et aux 6 semaines prévues. S'il est serré, proposer de découper (ce qui reste P0, ce qui passe en P1) plutôt que de tout garder en espérant.
- La production des contenus est-elle planifiée ? Qui écrit, combien de questions, en combien de temps, qui relit ? Le §14 l'exclut du budget alors que le cahier la dit critique.
- Les décisions du §15 ont-elles un responsable et une date ? Sans elles, le développement ne peut pas démarrer proprement.
- Les critères d'acceptation sont-ils mesurables ? « Pages rapides » ou « contrastes suffisants » ne le sont pas ; un score Lighthouse mobile ≥ 90 ou un audit RGAA sur un échantillon de pages l'est.
- Qui maintient les contenus après le lancement, quand les règles changent ? Les coûts récurrents (hébergement, emails, Stripe, relecture) sont-ils estimés ?
- Le document lui-même est-il cohérent ? Sommaire complet, numérotation, termes constants (ex. « fiches de présentation » côté public et « fiches de révision » côté utilisateur), éditeur confirmé.
- Manque-t-il des pièces utiles : personas, objectifs chiffrés, plan de contenu, plan de communication, matrice des responsabilités ?

**Pièges fréquents** : cahier riche en exigences mais sans priorisation de repli ; validation réglementaire placée en S1 alors qu'elle dépend de textes qui évoluent ; maintenance absente.
