# Index du cahier des charges v1.0 (30 octobre 2026)

Index condensé pour retrouver vite une exigence et la citer. Le PDF fait foi : en cas d'écart, suivre le PDF et le signaler.

## Sommaire
- [§1–2 Objectifs et périmètre MVP](#1-2-objectifs-et-périmètre-mvp)
- [§3–4 Écrans E01–E17](#3-4-écrans)
- [§5 Parcours et règles métier](#5-parcours-et-règles-métier)
- [§6 Back-office A01–A09](#6-back-office)
- [§7 Contenus](#7-contenus)
- [§8 Technique et données](#8-technique-et-données)
- [§9–11 Conformité, non fonctionnel, recette](#9-11-conformité-non-fonctionnel-recette)
- [§12–15 Planning, hors périmètre, budget, décisions](#12-15-planning-hors-périmètre-budget-décisions)

## Avertissement de tête (p. 2)
Règles d'examen, parcours administratifs et contenus à revérifier sur les sources officielles avant publication. Le produit ne doit jamais se présenter comme officiel ou agréé.

## §1–2 Objectifs et périmètre MVP
- Objectifs : acquisition (SEO, réseaux sociaux, publicité), essai gratuit sans compte obligatoire, conversion vers un Premium **à durée déterminée**, back-office pour gérer questions, parcours, utilisateurs, contenus, ventes.
- Public : premières demandes de CSP, de CR ou naturalisation.
- MVP — P0 : site public, orientation, entraînement QCM, examens blancs, compte, Premium, back-office. P1 : progression, fiches de révision, analytics.

## §3–4 Écrans
- **E01 Accueil** : promesse claire, CTA « Choisir mon parcours » / « Tester mes connaissances », 3 cartes parcours, « Comment ça marche » en 3 étapes, témoignages **uniquement authentiques**, mention visible « plateforme indépendante, non affiliée à l'administration ».
- **E02 Choix du parcours** : 3 cartes, lien vers une page détaillée, choix modifiable ; ne pas affirmer qu'un parcours s'applique sans vérification.
- **E03 Détail parcours** : public, objectifs, format d'examen (après validation réglementaire), thématiques, **sources officielles et date de vérification**, CTA QCM gratuit et Premium.
- **E04 Simulateur d'orientation** : étape par étape, données strictement nécessaires, résultat indicatif avec liens officiels, avertissement « ne remplace pas l'administration ni un professionnel du droit », aucune pièce justificative.
- **E05 Inscription / connexion** : email + mot de passe, confirmation email, CGU et confidentialité, **consentement marketing séparé et facultatif**, QCM possibles sans compte, protection contre les tentatives répétées.
- **E06 Tableau de bord** : parcours, indicateurs, « Reprendre », recommandation de révision, statut Gratuit/Premium et date d'expiration.
- **E07 Catalogue** : filtres (parcours, thème, difficulté, déjà vu / à revoir), modes thème / aléatoire / erreurs, nombre de questions et temps estimé, gratuit et Premium identifiés.
- **E08 Écran QCM** : question, type et source, « une ou plusieurs réponses selon la règle », valider / suivant / précédent, progression, signalement, correction immédiate en entraînement et différée en examen, reprise après déconnexion.
- **E09 Correction** : correct/incorrect, réponse attendue, explication claire, source et date, revoir / favoris / suivante, lien vers la fiche.
- **E10 Examen blanc** : préparation (durée, nombre, consignes), chronomètre, navigation, avertissement avant sortie, gestion de l'expiration ; paramètres (40 questions / 45 min / seuil) configurables par parcours.
- **E11 Résultat** : score et seuil, « seuil atteint / non atteint » **sans laisser croire à une réussite officielle**, répartition par thème, recommandations.
- **E12 Fiches** : résumé, notions clés, exemples, vocabulaire, sources, recherche, favoris, mini-quiz, date de mise à jour et responsable de validation.
- **E13 Progression** : historique, évolution, erreurs et favoris, filtres ; **aucune promesse de réussite ni prédiction certaine**.
- **E14 Offres Premium** : comparaison, **prix TTC**, durée, date de fin, renouvellement ou absence de renouvellement clairement indiqué, CGV, **aucun faux compte à rebours ni pression artificielle**.
- **E15 Paiement** : récapitulatif TTC, Stripe Checkout ou équivalent, retours réussi / échoué / en attente, **activation uniquement après confirmation serveur**, email et facture, droit de rétractation et consentement pour l'exécution immédiate d'un contenu numérique.
- **E16 Profil** : email et mot de passe sécurisés, parcours, statut Premium, factures, suppression du compte et droits RGPD.
- **E17 FAQ / contact** : FAQ par thèmes, formulaire à collecte minimale, délai de réponse, avertissement « le support ne remplace pas l'administration ».

## §5 Parcours et règles métier
- Parcours A (visiteur) : page SEO ou accueil → choix du parcours → QCM gratuit sans compte → corrections autorisées → invitation à créer un compte → Premium à une **limite clairement annoncée**.
- Parcours B (inscrit) : compte, email confirmé → parcours → tableau de bord → QCM et examens → résultats retrouvés aux visites suivantes.
- Parcours C (achat) : formule → conditions → paiement → **vérification serveur de la notification** → droit avec début et fin → confirmation.
- Règles : contenu rattaché à un ou plusieurs parcours et à une thématique ; question = énoncé, type, réponses, correction, source, statut ; pas de correction avant soumission en mode examen ; **barème versionné** ; Premium = paiement confirmé + période de validité ; à l'expiration, fonctions bloquées, données selon la politique de conservation ; modification importante d'une question publiée historisée.
- Encadré : format, nombre de questions, seuils, modalités et parcours **paramétrables, pas codés en dur**.

## §6 Back-office
- **A01** Dashboard : inscrits, actifs, achats, CA, répartition, questions signalées, contenus à réviser, alertes.
- **A02** Parcours et thématiques : créer, archiver, ordonner, associer à plusieurs parcours.
- **A03** Questions : créer, dupliquer, importer, archiver ; réponses, explication, type, difficulté, parcours, thème, source, licence, date de vérification ; prévisualisation mobile ; workflow brouillon → à relire → validée → publiée / archivée.
- **A04** Examens : nombre, durée, barème, seuil par parcours et version réglementaire ; répartition par thème et type ; test avant publication.
- **A05** Fiches et pages : éditeur structuré, dates de publication et de révision.
- **A06** Utilisateurs et support : recherche, statut, droits, désactivation contrôlée, jamais de données de carte.
- **A07** Paiements : transactions, formules, expirations, remboursements journalisés, export comptable.
- **A08** Statistiques : entonnoir visite → inscription → entraînement → achat, conversion par parcours et canal, questions difficiles, export CSV limité.
- **A09** Rôles (super-admin, éditeur, support, lecture seule), journal des actions sensibles, authentification renforcée pour les admins.

## §7 Contenus
- Champs obligatoires d'une question : identifiant stable, parcours, thématique, **type** (connaissance officielle / pédagogique originale / mise en situation originale), énoncé, réponses avec ordre et bonne réponse, explication relue, **source** (URL, licence, date de consultation), **version** (création, dernière vérification, auteur, statut).
- Exigences éditoriales : français clair, phrases courtes, termes administratifs expliqués ; relecture des contenus sensibles par une personne compétente ; **ne pas présenter une question inventée comme officielle ou réellement posée** ; signalement d'erreur par les utilisateurs ; revue régulière et historique ; date de vérification et lien vers la source.

## §8 Technique et données
- Stack indicative : Next.js / React, Tailwind, Supabase / PostgreSQL, Supabase Auth, Stripe Checkout, Vercel, Brevo, Matomo.
- Modèle minimal : users, paths, topics, questions (source_id, version), answers, explanations, question_paths, exam_templates (question_count, duration, threshold, version), attempts (user_id ou session_id, template_id), user_answers (answer_id unique), plans / entitlements, payments, content_pages.
- Relations many-to-many quand nécessaire ; réponses et scores liés à une **version** du modèle d'examen.

## §9–11 Conformité, non fonctionnel, recette
- §9 : minimisation ; pas de titres de séjour ni de passeports ; durées de conservation, finalités, bases légales, sous-traitants ; politique de confidentialité ; consentement marketing séparé ; traceurs bloqués avant consentement si requis ; HTTPS, contrôle d'accès par rôle, limitation des tentatives, sauvegardes ; aucune carte stockée ; webhooks vérifiés et **pas de double activation** ; procédure d'incident et de suppression. À valider avant lancement : CGU, CGV, mentions légales, confidentialité, cookies, information précontractuelle, rétractation, accès immédiat aux contenus numériques.
- §10 : mobile-first, rapidité, accessibilité (contrastes, clavier, libellés, erreurs), SEO (URLs, métadonnées, sitemap, données structurées), supervision, sauvegardes avec restauration testée, évolutivité (parcours, langues, formats), navigateurs récents.
- §11 : 12 scénarios d'acceptation en préproduction (pages publiques, entraînement gratuit, correction, score de l'examen blanc, historique, compte, paiement confirmé ou échoué, expiration, publication d'une question, rôles, smartphone, pages légales) ; tests complémentaires recommandés (charge, sécurité, calcul du score, reprise, emails, restauration).

## §12–15 Planning, hors périmètre, budget, décisions
- §12 : S1 cadrage, maquettes, validation réglementaire du contenu ; S2–S3 site, auth, questions, moteur QCM (alpha) ; S4 examens, résultats, tableau de bord, back-office (bêta) ; S5 paiement, Premium, emails, sécurité (préprod) ; S6 recette, pilote, mise en production. Livrables : maquettes, code appartenant au commanditaire, schéma de base et documentation, 3 environnements, back-office, PV de recette, documentation d'exploitation, inventaire des services et coûts récurrents.
- §13 hors périmètre : apps natives (PWA possible), vidéo, chat ou accompagnement juridique, espace formateur, multilingue complet, IA générant des questions sans validation, marketplace de partenaires.
- §14 budget indicatif : 3 300 à 5 200 € HT (UX 400–700, front 800–1 200, back 700–1 000, QCM 500–800, paiement 300–500, back-office 400–600, tests 200–400), hors production éditoriale, marketing, services tiers et maintenance.
- §15 décisions à verrouiller : nom et domaine, limites du gratuit, tarifs et durée (ponctuel ou abonnement), sources et réutilisation des questions officielles, règles de chaque parcours, langues au lancement, prestataires, propriété du code et maintenance, validation juridique du paiement.
- Conclusion : prioriser un moteur fiable, un contenu traçable, un parcours mobile fluide, un Premium transparent, un back-office autonome.
