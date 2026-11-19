# Version 0.4.0 — Identités, piliers et petits pas

## Installation dans le dépôt existant

1. Depuis l’ancienne application, exporte une sauvegarde dans **Profil → Exporter**.
2. Dans **Supabase → SQL Editor**, exécute **supabase/migrations/202611180001_identities.sql**. C’est une mise à jour de la fonction de synchronisation : elle ne supprime aucune donnée. Elle accepte les versions 4 et 5 et empêche une ancienne application de remplacer les nouvelles données.
3. Copie les fichiers de cette archive à la racine du dépôt `JLEGAC/onestepafteranother`, en conservant leur arborescence. N’ajoute pas le ZIP lui-même au dépôt. La configuration publique Supabase actuelle est conservée. Aucun secret Google ou service_role n’est nécessaire.
4. Enregistre les changements sur GitHub. Le workflow existant lance les contrôles, construit `_site/`, vérifie les parcours navigateur et publie avec GitHub Pages.
5. Dans la PWA, utilise **Profil → Vérifier maintenant**, puis **Mettre à jour**. Ferme les autres fenêtres si l’application le demande.

Les fichiers `src/identity.js` et `src/identity-views.js` sont nouveaux : ils doivent être ajoutés avec les autres fichiers. Le fichier `sw.js`, les scripts de build et les pages publiques sont également présents pour conserver les corrections précédentes.

Sans l’étape SQL, les données restent sur l’appareil mais la nouvelle synchronisation échoue. Applique le script puis utilise **Synchroniser maintenant**. Ne réinitialise pas les données.

## Ce que tu trouveras

- **Mon identité**, puis **Mes identités** lorsque plusieurs sont renseignées. Chaque carte comporte son nom, sa description et ses piliers, sans pourcentage d’identité « terminée ».
- Toutes les identités sont aussi visibles dans **Vision**, avec les autres contenus déjà présents.
- Dans une identité : habitudes aidantes et piliers dépliables. Dans chaque pilier : **Ajouter une étape**.
- Dans l’étape ouverte : **Ajouter une sous-étape (facultatif)** immédiatement sous le titre, **Modifier l’étape**, puis les actions et **Ajouter une action** en bas.
- Un seul niveau de sous-étapes. L’édition permet de déplacer une étape dans un autre pilier ou de la rattacher à une étape existante. Les sous-étapes d’une étape déplacée la suivent.
- **Mettre en avant** choisit l’étape rappelée sur la carte de l’identité. Si elle est terminée, la prochaine étape disponible prend sa place.
- Chaque action possède **Terminer**, **Modifier** et **Prévoir cette semaine** ; la planification demande un jour et un bloc. Une étape entière n’est jamais embarquée automatiquement.
- Les habitudes gardent leur place sur l’accueil ; leur formulaire indique l’identité associée.
- Les victoires ont un bouton **Enregistrer ma victoire**, placé après le choix facultatif de l’identité. Le texte enregistré reste exactement celui saisi.
- Les liens **À propos · Confidentialité** figurent dans Profil. Les pages publiques restent accessibles directement et hors connexion après mise en cache.
- Profil permet d’activer/désactiver la vérification automatique des mises à jour ; **Vérifier maintenant** fonctionne dans les deux cas. L’installation reste proposée avec **Mettre à jour / Plus tard**. Le navigateur peut aussi faire ses propres vérifications.
- Le titre et le texte du bandeau d’installation apparaissent sur deux lignes distinctes.

## Dépendances

**À faire après** est facultatif : une action peut attendre une action, et une étape peut attendre une étape. Les actions d’une sous-étape héritent aussi du préalable de l’étape qui la contient.

La commande **Terminer** est désactivée tant que le préalable n’est pas terminé. Pour planifier une action dépendante, ses préalables doivent être terminés ou planifiés dans la même semaine, avant elle. Le même bloc est possible ; la liste indique l’ordre et la validation reste bloquée jusqu’au bon moment. Les règles de capacité des créneaux sont conservées.

Si un préalable manque au planning, un bouton propose de le planifier d’abord. Une modification qui invaliderait la planification d’une autre action est refusée avec un message : déplace d’abord les actions dépendantes ou remets-les en réserve. Les boucles sont refusées.

Une étape comportant des actions ou sous-étapes est accomplie quand tous ses éléments sont terminés. Une étape vide peut être déclarée atteinte explicitement. Pour supprimer une étape attendue par une autre, il faut d’abord revoir cette dépendance. Supprimer une étape conserve ses actions dans **Actions à organiser** et remonte ses sous-étapes dans le même pilier.

## Migration et sauvegardes

- Les identifiants des objectifs, étapes et actions sont conservés.
- Les objectifs deviennent des identités ; l’ancien critère de succès devient leur description. Les anciens champs restent dans les données exportées.
- Les anciennes étapes rejoignent un pilier **À organiser**, propre à chaque identité. Renomme-le ou réaffecte tes étapes.
- Les actions directement rattachées restent accessibles dans **Actions à organiser**. Aucune date, réalisation, habitude ou récompense XP n’est recalculée.
- Les anciennes victoires liées à une action sont rattachées à son identité lorsque celle-ci peut être identifiée ; leur texte est préservé.
- Une copie locale des données précédentes est enregistrée avant la migration. Elle est accessible dans **Profil → Mon compte et mes données → Mes sauvegardes de sécurité**, séparément pour chaque compte.
- Le format de sauvegarde passe à 5 ; les formats 1 à 4 restent importables. Le cloud considère identités, piliers, étapes, actions, habitudes, agenda et XP comme un ensemble cohérent en cas de conflit.

## Nom affiché par Google

Le nom de l’écran de connexion Google se règle dans **Google Auth Platform → Branding**, puis avec la procédure de vérification Google. Le code de la PWA ne peut pas remplacer le nom affiché par Google.

Renseigne **Un pas après l’autre** comme nom cohérent avec le logo, l’adresse d’assistance et les pages :

- Accueil public : https://jlegac.github.io/onestepafteranother/presentation.html
- Confidentialité : https://jlegac.github.io/onestepafteranother/confidentialite.html

Vérifie que ces pages affichent bien leur contenu public, puis termine les exigences de vérification de marque et de domaine indiquées par Google. Publier l’application et obtenir la validation de marque sont deux démarches distinctes. L’affichage final n’a pas été vérifié dans ton compte.

Sources officielles consultées le 18 novembre 2026 :
- https://support.google.com/cloud/answer/15549049
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google

## Validation de cette livraison

- `npm run check` : syntaxe JavaScript vérifiée.
- `npm test` : 53 tests réussis, dont migration locale avec sauvegarde, dépendances, ordre de planification, export/import, contrôle des vues, mises à jour, isolation et protection du schéma dans PostgreSQL, et caches du service worker.
- `npm run build` : compilation réussie, ressources versionnées et précachées.
- Parcours Playwright enrichi : création d’identité/pilier/étape/actions, modification d’étape, sous-étape, blocage et déblocage d’une dépendance, planification de deux actions, victoire liée et préférences de mise à jour.
- **Non exécuté ici : le parcours Playwright et les captures mobile/ordinateur.** Chromium ne peut pas créer son socket dans cet environnement (`Operation not permitted`). Le workflow GitHub les exécutera avant publication ; aucun résultat visuel sur appareil réel n’est annoncé dans cette livraison.
- Aucun changement n’a été publié sur GitHub, Supabase ou Google Cloud depuis cet environnement.
