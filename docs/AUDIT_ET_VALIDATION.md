# Audit et validation — 0.3.0

## Base examinée

Archive reçue : `onestepafteranother-main.zip`. Application JavaScript en modules, sans framework, schéma métier version 4. Les données étaient dans IndexedDB `un-pas-apres-lautre`, version 4, store `workspace`, ligne `workspace`, avec un secours localStorage `upa-fallback`. Les images de Vision étaient des data URLs dans le profil. Les imports/exports JSON existaient déjà.

L'ancien service worker `un-pas-apres-lautre-v6` activait immédiatement la nouvelle version, supprimait les anciens caches et utilisait le réseau en priorité. Le dépôt contenait aussi le compagnon Android et son workflow.

## Adaptation retenue

| Fichier / dossier | Changement |
|---|---|
| `src/data.js` | Même schéma métier et normalisation ; délégation de la persistance |
| `src/local-store.js` | Espace invité conservé, espaces par compte, révisions locales, écritures séquentielles et sauvegardes |
| `src/cloud/` | Configuration publique, Auth, images privées, comparaison/fusion, synchronisation et interface du compte |
| `src/pwa/updates.js` | Vérification, bandeau, choix de mise à jour et protection des saisies |
| `sw.js` et `scripts/build.mjs` | Versions immuables, précache contrôlé par empreintes, activation consentie |
| `supabase/` | Tables, RLS, RPC avec révision attendue, fonction sécurisée de suppression |
| `src/app.js`, `src/views.js`, `styles.css` | Branchements et indicateurs, sans réécriture des écrans métier |
| `.github/workflows/deploy.yml` | Ubuntu 24.04, Node 24, installation verrouillée, tests, build et publication de `_site/` |

## Persistance et synchronisation

La ligne invitée reste compatible avec l'ancienne version. Chaque compte possède une ligne `account:UID`. Son enveloppe comprend l'état métier, la dernière base cloud connue, la révision distante, la révision locale et un indicateur durable de changements en attente. **La file de synchronisation est un instantané persistant de l'état final**, pas une liste séparée de toutes les frappes.

Les écritures locales sont sérialisées. Un contrôle de révision empêche une autre fenêtre de remplacer silencieusement une modification. Un changement de compte dans un autre onglet bloque l'ancienne fenêtre avec export/rechargement proposés. Une réponse serveur ne marque pas comme envoyées les modifications arrivées pendant l'envoi.

La synchronisation fonctionne après une sauvegarde, au retour du réseau, au retour au premier plan et toutes les 30 secondes lorsque la page est visible. Les fenêtres d'un même navigateur sont coordonnées par Web Locks lorsqu'il est disponible ; le contrôle de révision côté serveur reste obligatoire dans tous les cas.

## Conflits et migration

À la première connexion, les données locales existantes demandent une décision explicite. Avant de remplacer l'une des versions, les copies locale et distante disponibles sont sauvegardées dans IndexedDB et exportables depuis le compte. Si cette sauvegarde échoue, le remplacement ne continue pas.

Une fusion automatique à trois versions est permise uniquement pour des domaines indépendants : profil, préférences, outils et bloc métier. Objectifs, étapes, actions, habitudes, séries, récompenses, semaines et journal forment un bloc atomique pour préserver les relations et les XP. Deux changements concurrents dans ce bloc demandent un choix. Une suppression concurrente ne ressuscite pas silencieusement un élément.

Ce choix est volontairement prudent et peut demander un arbitrage même si deux changements semblent indépendants à l'intérieur du même domaine. Il n'y a pas encore de résolution élément par élément. Les sauvegardes des deux versions permettent de reprendre manuellement un détail si nécessaire.

## Authentification et sécurité

SDK Supabase 2.119.0 embarqué localement, connexion Google OAuth PKCE, conservation et renouvellement de session. Pas de dépendance CDN au lancement. URL et clé publishable publiques uniquement dans la PWA. La fonction serveur de suppression utilise son environnement privilégié et vérifie réellement le jeton utilisateur.

Les deux tables ont RLS ; le navigateur ne peut les écrire directement. Le RPC d'enregistrement vérifie le propriétaire attendu, le compte actif, le schéma et la révision avant d'écrire. La suppression bloque les écritures avant d'effacer les fichiers et l'utilisateur. Les données métier sont supprimées par cascade. Les images sont privées, immuables, sous `UID/empreinte-SHA256` et accessibles seulement au propriétaire connecté.

Les copies locales sont des données du navigateur, pas un coffre chiffré : sur un appareil partagé, déconnecte-toi et choisis de supprimer la copie locale une fois synchronisée. La suppression à distance ne peut pas effacer immédiatement un appareil hors ligne, ni les exports déjà téléchargés.

## Mises à jour

Chaque build crée un dossier `releases/IDENTIFIANT` contenant le code et les ressources de cette version. Le service worker vérifie les empreintes de tous les fichiers avant de terminer son installation. Un échec laisse la version active utilisable.

Le nouveau worker reste en attente. L'application affiche le bandeau, vérifie les saisies et attend les écritures locales et les imports d'images avant de demander l'activation. Si d'autres fenêtres sont ouvertes, elle demande de les fermer pour préserver leurs saisies. Le rechargement est déclenché seulement après le changement de contrôleur.

Les anciens caches propres à l'application ne sont supprimés que lorsque les fenêtres courantes déclarent utiliser la nouvelle version. Les données IndexedDB et les préférences ne sont pas dans le cache du service worker et ne sont pas effacées. Les ressources d'une version ne sont pas remplacées individuellement par celles de la version suivante.

Le refus « Plus tard » vaut pour l'ouverture courante. La réouverture redemande la vérification. Sans réseau ou en cas d'échec, il n'y a pas d'alerte gênante. La première transition depuis l'ancien service worker ne peut pas rétroactivement lui ajouter le bandeau : fermer les anciennes fenêtres et rouvrir connecté reste nécessaire pour installer ce mécanisme.

## Vérifications effectuées le 17 novembre 2026

| Vérification | Résultat |
|---|---|
| Syntaxe des modules et scripts JavaScript | Réussie |
| Tests automatisés Node | 40 réussis, 0 échec |
| Régressions métier : progression, XP, habitudes, planning, bilans et rendu | Réussies dans la suite existante |
| Migration, file hors ligne, reprise réseau, fusion indépendante, conflits, déconnexion | Réussies avec client Supabase simulé et IndexedDB simulé |
| SQL réel PostgreSQL via PGlite : deux utilisateurs, accès anonyme, images privées, CAS, gel de suppression et cascade | Réussi ; schémas Auth/Storage simulés, pas un projet Supabase distant |
| Service worker : précache, installation partielle, activation avec plusieurs fenêtres, purge ciblée | Réussi dans un environnement simulé |
| Build de production et ressources versionnées | Réussi |
| Parcours Chromium, fermeture/réouverture, mode hors ligne et activation réelle | Script fourni ; exécution locale bloquée par le système (`socket(): Operation not permitted`) |
| Connexion Google, suppression Edge Function, téléphone Android/iPhone | Non testées en réel : configuration et appareils nécessaires |
| Publication GitHub Pages | Non effectuée |

Le workflow exécute `npm run test:browser` avec Chromium avant de publier. Un échec empêche la publication et doit être examiné, pas contourné en supprimant le test. Ce parcours contrôle notamment la saisie initiale, l'ouverture hors ligne, « Plus tard », la réouverture, la protection des saisies, plusieurs fenêtres et la conservation des données après mise à jour.

## Limites connues

- La synchronisation en arrière-plan lorsque la PWA est fermée n'est pas garantie. Elle reprend à l'ouverture connectée.
- L'occupation du stockage local dépend du navigateur et de l'appareil. Un quota épuisé bloque la sauvegarde et déclenche un message ; une mise à jour ne poursuit pas le rechargement si l'écriture locale a échoué.
- Images limitées à 5 Mio par fichier, état cloud à 10 Mio hors images. Les anciennes images devenues inutilisées sont conservées jusqu'à la suppression du compte pour ne pas casser un appareil hors ligne ou une sauvegarde. Une purge différée pourra être ajoutée avec une politique de rétention définie.
- Les sauvegardes de sécurité sont locales. Elles ne remplacent pas une sauvegarde administrative du projet Supabase.
- Cette version n'ajoute pas d'APK ni de widget Android natif. Les raccourcis PWA dépendent du support du navigateur/système.
- Les limites, quotas, coûts et paramètres de conservation de Supabase dépendent du projet et de son offre ; ils ne sont pas configurés par cette archive.
