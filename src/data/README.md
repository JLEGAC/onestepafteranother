# Tenir à jour les exemples de la visite guidée

[exemples-visite.json](exemples-visite.json) contient les scénarios de démonstration. Quand la visite guidée sera reliée à ce fichier, elle proposera les exemples dans l'ordre de la liste. Les exemples serviront à montrer l'application, sans être enregistrés dans les données de l'utilisateur.

## Modifier ou ajouter un exemple

1. Pour modifier un exemple, change ses textes et garde son `id` : il permet de retrouver le scénario lors de la reprise de la visite.
2. Pour en ajouter un, duplique un objet complet dans la liste, donne-lui un `id` inédit et adapte son contenu. Sépare les objets par des virgules, sans virgule après le dernier. Garde les guillemets doubles autour des clés et des textes.
3. Pour déplacer un exemple dans le menu, déplace son objet dans la liste. Pour le retirer, supprime l'objet entier.
4. Vérifie le JSON avant de pousser sur `main`. Une fois la visite raccordée, le déploiement de la PWA publiera les changements.

| Champ | Que renseigner |
| --- | --- |
| `id` | Identifiant unique et stable, en minuscules, avec des tirets si nécessaire. |
| `titre`, `resume` | Le titre et une courte phrase pour aider à choisir le scénario. |
| `usages` | `["personnel"]`, `["professionnel"]` ou `["personnel", "professionnel"]` pour le faire apparaître dans les deux catégories. |
| `vision`, `identite`, `pilier`, `etape` | La direction, qui je veux devenir, sur quoi je m'appuie et le premier résultat que je vise. |
| `microAction.intitule` | Une action concrète liée à l'étape. Ajoute `critereReussite` si utile : comment savoir que c'est fait ? |
| `capHebdo.jour`, `capHebdo.moment` | Le jour en minuscules, de `lundi` à `dimanche`, et un moment en texte libre. Évite les dates fixes. |
| `approfondissement` | Facultatif. Tu peux y illustrer une `habitude`, une action en `reserve`, une décision dans la `boussole`, une `victoire` ou un `bilan`. |

Garde le même fil de la Vision au Cap Hebdo. Par exemple, une action se fait une fois (« marcher 10 minutes mercredi »), alors qu'une habitude se répète (« marcher deux fois par semaine »). Le jour et le moment du Cap Hebdo indiquent quand faire **l'action de l'exemple**.

Pour vérifier la syntaxe depuis la racine du dépôt, avec Node.js :

```sh
node -e "JSON.parse(require('node:fs').readFileSync('src/data/exemples-visite.json', 'utf8')); console.log('JSON valide')"
```

Cette commande vérifie la syntaxe. Vérifie aussi que chaque `id` est unique et que chaque scénario va jusqu'au Cap Hebdo.
