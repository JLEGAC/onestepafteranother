# Un pas après l’autre — prototype PWA

Prototype local-first de l’application de développement personnel.

## Lancer en local

Depuis ce dossier, lance un serveur statique, par exemple :

```bash
python3 -m http.server 4173
```

Ouvre ensuite `http://localhost:4173`. Le service worker et l’installation PWA nécessitent `localhost` ou HTTPS.

## Données et sauvegarde

- Les données sont enregistrées localement dans IndexedDB ; aucun compte ou serveur n’est utilisé.
- Une sauvegarde JSON peut être exportée depuis **Profil** puis importée sur un autre appareil.
- L’import remplace les données locales après un aperçu et une confirmation.
- Le service worker met en cache les fichiers de l’application pour permettre son ouverture hors ligne.

## Gamification V1

Les actions, points d’étape, bilans et exercices rapportent des XP. Les niveaux et célébrations sont visuels ; les points ne débloquent pas de fonctions en V1.
