# Charte éditoriale des questions

*Version 0.1 · 31 octobre 2026 · Application du cahier des charges §7*

Cette charte s'applique à toute question, réponse et explication publiée sur le site, qu'elle soit écrite par l'équipe ou préparée avec un outil d'assistance. **Rien n'est publié sans relecture humaine par une personne compétente** (cahier §7 et §13). Un brouillon reste au statut « à relire » tant que cette relecture n'est pas faite.

## 1. Les deux familles de questions

| Type | Énoncé | Étiquette affichée |
|---|---|---|
| **Question officielle** (`OFFICIAL_KNOWLEDGE`) | Repris **mot pour mot** de la liste publiée par le ministère pour ce parcours. On ne corrige ni la ponctuation ni la formulation. | « Question officielle » |
| **Mise en situation** (`ORIGINAL_SITUATION`) | Rédigé par l'équipe : les mises en situation de l'examen ne sont pas publiques. | « Mise en situation · rédigée par [Nom] » |

On ne présente jamais une question rédigée comme officielle ou « réellement posée à l'examen ».

La liste officielle ne donne que les énoncés. **Les 4 propositions, la bonne réponse et l'explication sont toujours notre travail**, avec leur propre source.

## 2. Les propositions

- **Exactement 4 propositions et une seule bonne réponse**, comme à l'examen.
- La bonne réponse doit être **incontestable** : aucune autre proposition ne doit pouvoir se défendre.
- Les mauvaises réponses (distracteurs) sont **plausibles** pour quelqu'un qui n'a pas révisé. Elles sont de la même forme et d'une longueur proche de la bonne réponse.
- Interdits : propositions absurdes ou moqueuses, « toutes les réponses », « aucune réponse », doubles négations, pièges de vocabulaire.
- Quand l'énoncé se termine par deux-points (« Le principe d'égalité signifie que : »), chaque proposition complète la phrase de façon grammaticale.
- Les nombres et les dates sont écrits de la même façon dans les 4 propositions.

## 3. L'explication

- **2 à 4 phrases courtes**, en français simple (niveau A2-B1), au présent si possible.
- Elle dit **pourquoi la bonne réponse est juste**. Si une mauvaise réponse est un piège courant, elle dit aussi pourquoi elle est fausse.
- Tout mot administratif ou juridique est expliqué simplement, ou ajouté au glossaire.
- Ton neutre et respectueux : pas de stéréotype sur une origine, une religion ou un genre ; pas de jugement sur le candidat.
- Jamais de conseil juridique sur une situation personnelle (titre de séjour, recours…), jamais de promesse de réussite.

## 4. Les sources

- Chaque question a une **source qui justifie la bonne réponse** : Constitution, Légifrance (loi, code, article précis), service-public.gouv.fr, vie-publique.fr, sites des institutions (elysee.fr, assemblee-nationale.fr, senat.fr, conseil-constitutionnel.fr), europa.eu, insee.fr, culture.gouv.fr, ameli.fr, etc.
- Une adresse web n'est indiquée que si elle a été vérifiée. Sinon, on indique la référence du texte seule (par exemple « Code civil, article 144 »).
- Ne sont jamais des sources : les sites de préparation concurrents, les forums, les réseaux sociaux, les jeux de données qui republient des réponses.
- Un fait susceptible de changer (personne en fonction, montant, numéro, date d'application) est signalé pour relecture : la vérification doit être datée.

## 5. Le niveau de confiance

Chaque brouillon porte un niveau de confiance, qui guide la relecture :

- `high` : fait stable et vérifié dans une source officielle ;
- `medium` : fait juste, mais formulation ou source à confirmer ;
- `low` : doute sur la réponse ou sur la portée de la question. La note de relecture explique pourquoi.

## 6. Le glossaire

Les mots difficiles (laïcité, préfecture, suffrage universel…) reçoivent une définition d'une ou deux phrases, en mots simples, sans renvoyer à d'autres mots difficiles. Le site les affiche à côté des questions qui les utilisent.

## 7. Format des fichiers de contenu

Les brouillons sont dans `apps/api/content/<parcours>/<theme>.json` :

```json
{
  "topic": "principes-et-valeurs",
  "questions": [
    {
      "reference": "CSP-PV-001",
      "type": "OFFICIAL_KNOWLEDGE",
      "notion": "devise-et-symboles",
      "statement": "Énoncé officiel, copié mot pour mot",
      "answers": ["Bonne réponse", "Distracteur", "Distracteur", "Distracteur"],
      "explanation": "Explication en 2 à 4 phrases simples.",
      "answerSource": { "label": "Constitution du 4 octobre 1958, article 2", "url": "https://..." },
      "difficulty": 1,
      "confidence": "high",
      "reviewNote": "Facultatif : ce que la relecture doit vérifier."
    }
  ],
  "situations": [],
  "glossary": [{ "term": "laïcité", "definition": "Définition simple." }]
}
```

- `answers` : **la première proposition est la bonne**. L'ordre d'affichage est tiré au sort par le site.
- Au chargement (`npm run db:seed`), la forme est harmonisée automatiquement : apostrophe typographique ’ partout, et soit les quatre propositions finissent par un point, soit aucune. Une bonne réponse beaucoup plus longue que les autres, ou une proposition « Toutes les réponses » ou « Aucune de ces réponses », est signalée dans la note de relecture.
- Un énoncé marqué officiel qui n'est pas mot pour mot dans `enonces-officiels.json` est refusé au chargement.
- `difficulty` : 1 (connaissance de base), 2 (à retenir), 3 (piège fréquent ou notion précise).
- `notion` : notion de l'arrêté utilisée pour composer l'examen blanc (voir ci-dessous). Les mises en situation n'en ont pas.

### Plusieurs parcours

- Chaque parcours a son dossier : `csp` (carte de séjour pluriannuelle), `cr` (carte de résident), `nat` (naturalisation), avec sa liste officielle `enonces-officiels.json`.
- Un énoncé qui figure dans plusieurs listes officielles n'est rédigé qu'**une fois**, dans le premier dossier où il apparaît (CSP, puis CR, puis naturalisation). Au chargement, la question est rattachée à tous les parcours dont la liste contient cet énoncé, au mot près.
- Les références suivent le dossier : `CSP-PV-001`, `CR-PV-001`, `NAT-PV-001`.
- Les mises en situation sont rédigées une fois (dans `csp`) et servent à tous les parcours.
- `cr/comparaison-csp.json` et `nat/comparaison.json` listent les énoncés communs et ceux qui restent à rédiger.
- Une question créée ou retouchée dans le back-office n'est plus jamais réécrite par le chargement des fichiers : le back-office fait foi. Pour les questions de l'équipe, l'import JSON du back-office (Questions → Importer) accepte ce même format.

## 8. Notions par thème

Elles servent à tirer un examen blanc conforme à la répartition officielle (28 questions de connaissance, 12 mises en situation).

| Thème | Notions (nombre de questions à l'examen) | Mises en situation |
|---|---|---|
| Principes et valeurs de la République | `devise-et-symboles` (3), `laicite` (2) | 6 |
| Système institutionnel et politique | `democratie-et-droit-de-vote` (3), `organisation-de-la-republique` (2), `institutions-europeennes` (1) | — |
| Droits et devoirs | `droits-fondamentaux` (2), `obligations-et-devoirs` (3) | 6 |
| Histoire, géographie et culture | `periodes-et-personnages-historiques` (3), `territoires-et-geographie` (3), `patrimoine-francais` (2) | — |
| Vivre dans la société française | `installation-et-sejour` (1), `acces-aux-soins` (1), `travail-en-france` (1), `autorite-parentale-et-education` (1) | — |

Source : article 3 de l'arrêté du 10 octobre 2025 relatif au programme, aux épreuves et aux modalités d'organisation de l'examen civique (NOR INTV2527907A), vérifié sur [Légifrance](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052381620) le 31 octobre 2026. L'article 2 fixe le seuil à 80 % de bonnes réponses, l'article 4 la durée à 45 minutes au plus.
