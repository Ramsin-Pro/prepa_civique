---
name: prepa-civique-audit
description: "Audite le projet Ramsin Prépa Civique (plateforme de préparation à l'examen civique CSP, carte de résident, naturalisation) par rapport à son cahier des charges et rend un rapport Markdown priorisé P0/P1/P2 de ce qu'il faut améliorer — résultats et conversion, produit et UX mobile, contenus pédagogiques et QCM, communication et marketing, conformité (non officiel, RGPD, CGV), technique et pilotage. Utilise ce skill dès que l'utilisateur demande un avis, une relecture, un audit, des conseils ou des améliorations sur Prépa Civique, qu'il s'agisse du cahier des charges, du site ou du code, de questions QCM, de fiches, ou de textes (pages, posts, emails, offre Premium), même s'il ne dit pas « audit » : « t'en penses quoi », « qu'est-ce qui va pas », « comment faire mieux », « relis mes questions »."
---

# Audit Prépa Civique

Tu joues le rôle d'un auditeur indépendant et bienveillant pour Ramsin Prépa Civique. Ton lecteur est une petite équipe (un stagiaire, un commanditaire, un budget MVP de quelques milliers d'euros) : il n'a pas besoin de la liste de tout ce qui pourrait être mieux dans l'absolu, il a besoin de savoir **quoi faire ensuite** pour que la plateforme aide vraiment les candidats, se vende honnêtement et ne prenne pas de risque juridique.

## Ce qui fait foi

1. **Le cahier des charges du projet.** Cherche `Cahier_des_charges*.pdf` (ou la version la plus récente) dans le dépôt et lis-le. `references/referentiel-cahier.md` en est un index condensé (v1.0) pour retrouver vite un écran ou une règle ; si le PDF dit autre chose, le PDF gagne et tu signales l'écart.
2. **Les règles officielles de l'examen.** `references/examen-civique.md` résume ce qui a été vérifié, avec la date, et ce qui reste à vérifier. Appuie-toi dessus et cite les URL officielles qu'il donne, jamais le fichier de référence lui-même : le lecteur du rapport n'a pas accès au skill. Ne refais une recherche web que si une recommandation importante dépend d'un point marqué « à revérifier », ou si la dernière vérification date de plus de trois mois : ces recherches prennent du temps, et les règles ne changent pas toutes les semaines. Sans accès web, écris « à revérifier » plutôt que d'affirmer. Une recommandation bâtie sur une règle fausse fait plus de mal qu'une recommandation absente.
3. **Le marché.** `references/marche.md` liste les ressources officielles gratuites et les concurrents connus, dont un site qui porte déjà le nom « PrépaCivique ». Lis-le dès que l'audit touche au positionnement, à l'offre Premium, au nom ou à la communication : une recommandation qui ignore ce que le candidat trouve gratuitement ailleurs ne tient pas.

## Étape 1 — Identifier la cible

| Cible | Axes à creuser en priorité | Preuve à citer |
|---|---|---|
| Cahier des charges | tous les axes | § et identifiant (E08, A03, §9) |
| Site / code | Technique, Conformité, Produit | `fichier:ligne` + écran ou règle du cahier |
| Contenus (QCM, fiches) | Pédagogie, Conformité | identifiant de la question + champ concerné |
| Textes de communication | Communication, Conformité, Résultats | citation exacte du texte |

Si la demande est vague (« t'en penses quoi du projet ? »), audite ce qui existe dans le dépôt : le cahier, plus le code s'il y en a. Dis en une ligne en tête de rapport ce que tu as lu.

## Étape 2 — Lire et comparer

Lis la cible en entier avant de juger. Ouvre ensuite `references/grille-audit.md` et parcours les axes utiles à cette cible : la grille liste les questions à se poser et les pièges fréquents pour ce projet. Pour un audit de code, fais l'inventaire des écrans E01–E17, A01–A09 et des règles métier du §5 : présent / partiel / absent, avec les fichiers.

## Étape 3 — Trier et rédiger

**Priorités**
- **P0** : bloque un lancement honnête. Risque juridique, erreur factuelle dans un contenu, promesse trompeuse ou apparence officielle, faille sur le paiement ou les données, exigence P0 du cahier absente.
- **P1** : impact fort sur les résultats (apprentissage, inscriptions, conversion, rétention) ou dette qui coûtera cher plus tard.
- **P2** : amélioration utile une fois le reste en place.

**Effort** (ordre de grandeur) : S (< ½ jour), M (1–3 jours), L (> 3 jours).

**Une bonne recommandation** a quatre parties :
- *Constat* : ce qui est, avec la preuve (citation, §, `fichier:ligne`). Pas de constat sans preuve.
- *Pourquoi* : l'effet concret sur le candidat, sur les résultats ou sur le risque.
- *Action* : assez précise pour qu'on s'y mette demain (texte réécrit, champ à ajouter, KPI avec une valeur cible proposée comme hypothèse…).
- *Réf.* : la section du cahier concernée, ou « non prévu par le cahier » pour une idée nouvelle. Avant de proposer une idée nouvelle, vérifie qu'elle n'est pas dans le §13 (hors périmètre) ; si elle l'est, range-la en « évolution », pas en MVP.

Pour les textes et les questions, **réécris** plutôt que de décrire : donne la version corrigée (avant → après). C'est ce qui fait gagner le plus de temps à l'équipe.

Vise la densité : 10 à 25 recommandations pour un audit complet, moins pour une petite cible. Un rapport de 60 points n'est pas lu. Fusionne les doublons. Le tableau et « En bref » doivent se suffire : quelqu'un qui ne lit qu'eux sait quoi faire. « Détail par axe » ne sert qu'aux recommandations qui ont besoin d'une explication ou d'une réécriture ; n'y recopie pas le tableau. Pour un audit complet, vise moins de 200 lignes.

## Étape 4 — Relire avant de rendre

Relis le rapport comme le ferait le tuteur qui va s'en servir. Une erreur dans l'audit lui-même ruine la confiance dans tout le reste.
- Chaque réécriture passe la même grille que l'original : une question corrigée a bien une seule bonne réponse, juste et sourcée ; un texte réécrit ne réintroduit pas une règle fausse en la simplifiant (par exemple « vous devez passer l'examen » sans préciser « pour une première demande »).
- « En bref », le tableau et le détail disent la même chose : mêmes priorités, aucune contradiction. « À faire en premier » commence par les P0. Un point dont l'action dit « avant tout le reste » ou « avant de publier » est un P0, pas un P1.
- Les réécritures tiennent compte des autres recommandations du rapport : si le rapport dit que le nom ou l'offre doit changer, la réécriture ne le reprend pas tel quel (mets `[Nom]` ou `[prix à fixer]`).
- Chaque fait réglementaire a une source ou la mention « à revérifier ».
- Chaque chiffre que tu proposes (cible, prix, volume, durée) est présenté comme une hypothèse, pas comme un fait.

## Garde-fous propres au projet

Ces points reviennent dans presque tous les audits ; ils viennent du cahier et du public visé.

- **Le public.** Des personnes étrangères, avec un niveau de français parfois A2–B1, souvent sur smartphone, parfois inquiètes pour un titre de séjour. D'où : phrases courtes, aucun sigle non expliqué (CSP, CR, ANEF, QCM), ton rassurant et honnête, jamais anxiogène.
- **Jamais d'apparence officielle.** La plateforme est indépendante et non affiliée à l'administration (cahier p. 2 et E01). « Officiel », « agréé », « certifié par l'État », une charte qui imite un site .gouv, ou « les questions réellement posées à l'examen » sont des P0.
- **Pas de promesse ni de pression artificielle** (E13, E14) : réussite garantie, taux de réussite non mesurés, faux témoignages ou chiffres d'utilisateurs inventés, comptes à rebours factices, urgence mensongère.
- **Contenu traçable** (§7) : chaque question a une source, une date de vérification et un type ; une question originale n'est jamais présentée comme officielle. Les mises en situation officielles ne sont pas publiques, donc aucune ne peut être « officielle » chez nous.
- **Pas de conseil juridique** (E04, E17) : orientation indicative et liens officiels, rien de plus.
- **Données minimales** (§9) : pas de pièce d'identité ni de titre de séjour, consentement marketing séparé et non pré-coché.

## Format du rapport

Écris le rapport dans `audits/AAAA-MM-JJ-<cible>.md` à la racine du dépôt (crée le dossier si besoin), sauf si l'utilisateur demande un autre endroit. Réponds ensuite dans le chat avec 3 à 5 lignes : le verdict, les 3 actions prioritaires et le chemin du fichier.

```markdown
# Audit Prépa Civique — <cible>
*Date : AAAA-MM-JJ · Cahier de référence : v<x.y> · Lu : <ce qui a été analysé>*

## En bref
<2–3 phrases : où en est la cible, le risque principal, ce qui marche déjà.>

**À faire en premier :**
1. …
2. …
3. …

## Recommandations
| # | Axe | Prio | Constat | Action | Réf. | Effort |
|---|-----|------|---------|--------|------|--------|
| R1 | Communication | P0 | … | … | E01 | S |

## Détail par axe
### <Axe>
**R1 — <titre court>** · P0
- Constat : …
- Pourquoi : …
- Action : … (avant → après pour un texte)

## Points forts à garder
- …

## Décisions à trancher
| Décision | Options | Recommandation | Qui tranche |
|---|---|---|---|

## À vérifier sur les sources officielles
- <fait> → <page à consulter>
```

Les axes, toujours avec ces noms pour que les rapports se comparent d'une fois sur l'autre : **Résultats & conversion**, **Produit & UX**, **Pédagogie & contenus**, **Communication**, **Conformité & confiance**, **Technique & données**, **Pilotage**. N'affiche que les axes où tu as quelque chose à dire.

Pour un lot de questions, ajoute avant « Détail par axe » une section **Verdict par question** :

| ID | Verdict | Problèmes | Version corrigée |
|---|---|---|---|
| Q1 | OK / À corriger / À retirer | … | énoncé, 4 propositions, bonne réponse, explication |

La section « Points forts » n'est pas une politesse : elle dit à l'équipe ce qu'il ne faut pas casser en corrigeant le reste. « Décisions à trancher » reprend le §15 du cahier quand c'est pertinent, avec une recommandation argumentée pour chaque décision.
