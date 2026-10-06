# Pas à Pas — PWA

Application mobile-first de développement personnel, utilisable hors ligne, sans compte et avec des données conservées sur l’appareil.

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

## Nouveautés V2

- Suivi d’habitudes par calendrier mensuel, vue globale ou par habitude, séries et détail journalier.
- Défis personnels sur sept jours : un défi actif à la fois, progression par jour, sans retrait de points.
- Collection de capsules vidéo ajoutées par la personne, avec filtres par besoin. La lecture des liens HTTPS demande une connexion.
- Badges de progression et ambiances visuelles déverrouillées à certains niveaux.
- Les XP débloquent uniquement des éléments cosmétiques ; aucune fonction essentielle n’est verrouillée.
- Les actions terminées rapportent 5 XP de base, auxquels s’ajoute le bonus d’effort : S 10, M 20, L 35, XL 50, XXL 70.
- Habitude validée : +1 XP. Grand Chelem quotidien : +10 XP, doublés après 7 jours de Grand Chelem consécutifs.
- Jour de défi validé : +3 XP ; objectif atteint : +15 XP. Capsule marquée comme vue : +3 XP.
- Les XP V1 déjà enregistrés restent inchangés. La base locale et les sauvegardes V1 sont migrées à la lecture/import.
- Le tableau de bord réunit batterie, humeur, habitudes de la semaine, actions du jour et victoires.
- « Cible » rassemble habitudes et objectifs ; « Cap Hebdo » affiche le cap et le planning défilant de la semaine.
- La Vision est accessible directement, conserve « Ce qui résonne » et accepte des images locales.
- L’historique permet de consulter les journées passées ; les victoires ont aussi leur page dédiée.
- L’entrée et la page Réserve restent masquées jusqu’à une phase ultérieure ; les mécanismes existants de mise en réserve restent disponibles.
- Le planning accepte plusieurs actions S dans un créneau et permet aussi de mêler des actions S avec une action plus grande. Il propose une autre plage si une seconde action plus grande est déposée au même endroit.
- Les actions du planning se déplacent par glisser-déposer à la souris ou au toucher ; un formulaire accessible au clavier permet aussi de choisir jour et moment. Une case à cocher marque l’action terminée.

## Mise à jour GitHub Pages

La version de l’application est `0.2.0`. Avant de remplacer une installation existante, exporte une sauvegarde depuis **Profil**. Le manifest utilise des chemins relatifs (`./`) pour fonctionner sur le sous-chemin du dépôt GitHub Pages. Après publication, ouvre d’abord la page du projet dans le navigateur pour charger la mise à jour. Si l’ancienne icône installée ouvre une adresse en erreur, retire-la puis réinstalle l’application depuis la page du projet.
