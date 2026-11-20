# Pas à Pas — PWA 0.5.1

Application de développement personnel utilisable sur mobile et ordinateur, avec sauvegarde locale et connexion Google facultative via Supabase.

## Version 0.5.1

- Dropbox : lecture des sauvegardes corrigée et autorisation de lister les versions. Après publication, déconnecte puis reconnecte Dropbox dans le Profil si tu l’utilisais déjà.
- Le Profil et la page de confidentialité expliquent ce qui est transmis en mode Dropbox.
- Identités, piliers, étapes et habitudes : émojis et symboles monochromes recolorables, disponibles hors connexion.

## Version identités

**Commence par [le guide 0.4.0](docs/VERSION_0.4.0.md)** : le script SQL de mise à jour Supabase doit être exécuté avant la mise en ligne. Le guide décrit aussi les dépendances, la migration et les limites des tests.

## Livrer cette version

1. Exporte d’abord ta sauvegarde JSON dans **Profil** sur l’application actuelle.
2. Remplace les fichiers du dépôt par ceux de cette archive, y compris `.github/workflows/deploy.yml`.
3. Supprime du dépôt `android-widget/` et `.github/workflows/widget-android.yml` s’ils existent encore : déposer un ZIP ne supprime pas les anciens fichiers automatiquement.
4. Pour activer Google et le cloud, suis [le guide Supabase](docs/CONFIGURATION_SUPABASE.md). Sans configuration, l’application reste utilisable en mode local.
5. Dans GitHub → Settings → Pages, choisis **GitHub Actions**. Le workflow teste et construit le site dans `_site/`, puis publie ce dossier.

**Aucune clé secrète ne doit être ajoutée au navigateur ni au dépôt.** Seules l’URL du projet Supabase et sa clé publique vont dans `src/cloud/config.js`.

## Ce qui change

- PWA uniquement : retrait du compagnon Android et de son workflow. Empreintes, icônes et raccourcis Habitudes, Cap Hebdo, Vision et Victoires conservés. Le menu d’appui long dépend du navigateur et du système ; aucun widget Android natif n’est fourni.
- Compte Google facultatif dans **Profil → Mon compte et mes données**, session persistante et déconnexion.
- Données conservées sur l’appareil ; envoi au cloud après modification et au retour du réseau. Un indicateur ouvre le compte et affiche l’état réel de synchronisation.
- Première connexion avec choix explicite pour transférer les données locales. Si le cloud contient une autre version, aucune version n’est écrasée sans choix ; des sauvegardes locales exportables sont créées.
- Fusion automatique limitée aux domaines indépendants. Deux modifications concurrentes des objectifs/actions/habitudes/XP demandent un choix, pour éviter les doublons et liens incohérents.
- Images de Vision dans un espace Supabase privé ; suppression du compte et de ses données via une fonction serveur protégée.
- Vérification non bloquante des mises à jour à l’ouverture et au retour dans l’application. Bandeau « Mettre à jour / Plus tard », protection des saisies, attente des écritures locales et caches par version.

Les parcours métier existants sont conservés : Vision, objectifs et étapes, habitudes et historique modifiable, Cap Hebdo, Réserve, victoires, outils, bilans, défis, capsules, XP et thèmes.

## Lancer et vérifier

Node.js 24 est utilisé dans le workflow.

```bash
npm ci
npm run check
npm test
npm run build
python3 -m http.server 4173 --directory _site
```

Ouvre `http://localhost:4173`. L’installation et le service worker nécessitent HTTPS ou localhost. Pour tester réellement le mode hors connexion, sers **_site/**, pas les sources : le service worker source est volontairement minimal, les fichiers versionnés sont produits par le build.

```bash
npx playwright install --with-deps chromium
npm run test:browser
```

Le workflow utilise Ubuntu 24.04 explicitement, installe les dépendances avec le lockfile, effectue les tests navigateur et génère deux captures pour le manifeste.

## Données, mises à jour et limites

La base IndexedDB existante n’est pas effacée. L’espace local sans compte et les copies de chaque compte sont distincts. La version 0.4.0 migre la structure des objectifs vers les identités, après sauvegarde, en conservant les contenus existants.

La synchronisation exige une application ouverte ou réouverte ; elle n’est pas garantie lorsque le système a fermé la PWA. Une session peut devoir être renouvelée après révocation ou effacement des données du navigateur. Sauvegarde JSON recommandée avant toute opération importante.

Lors de la toute première transition depuis l’ancien service worker, ferme les anciennes fenêtres puis rouvre la PWA connectée. Les mises à jour suivantes utilisent le nouveau bandeau. Le choix « Plus tard » dure pour l’ouverture courante.

Consulte [l’audit et le bilan des tests](docs/AUDIT_ET_VALIDATION.md) pour les choix techniques, la gestion des conflits et les limites de validation.
