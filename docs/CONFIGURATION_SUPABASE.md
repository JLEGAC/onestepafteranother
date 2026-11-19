# Activer Google et la sauvegarde cloud

## Choisir Dropbox comme fournisseur cloud

Dans Profil, l'utilisateur peut choisir Supabase ou Dropbox. Un seul fournisseur est actif à la fois. Pour activer Dropbox dans une version publiée :

1. Dans Dropbox App Console, crée une application avec l'accès **App folder**.
2. Active les scopes `files.content.read` et `files.content.write`.
3. Ajoute l'URI de redirection exacte `https://jlegac.github.io/onestepafteranother/` dans les réglages OAuth de l'application Dropbox.
4. Copie uniquement l'App key publique dans `dropboxAppKey` de `src/cloud/config.js`, puis reconstruis et publie la PWA. N'ajoute aucun App secret.

Dropbox stocke un état JSON complet dans le dossier de l'application, une copie `pas-a-pas-latest.json` et des versions datées (20 maximum). Les sauvegardes incluent les images de Vision. Une sauvegarde automatique est lancée après les modifications, avec un délai de regroupement. La restauration affiche le contenu avant confirmation et crée une copie locale de l'état remplacé. L'application vérifie la dernière sauvegarde à l'ouverture pour permettre de récupérer le travail sur un autre appareil.

Le jeton OAuth de Dropbox est conservé localement par le navigateur afin de renouveler l'autorisation. Il n'est pas inclus dans les fichiers de sauvegarde.

Cette archive contient le code et les règles de sécurité, mais aucun projet Supabase n’a été créé ou configuré à ta place. Le mode local fonctionne tant que `src/cloud/config.js` reste vide.

## 1. Créer le projet Supabase

Dans ton compte Supabase, crée un projet et choisis une région adaptée à tes utilisateurs. Conserve le mot de passe de base de données dans ton gestionnaire de mots de passe, jamais dans le dépôt.

Ouvre le SQL Editor du projet et exécute **une fois** le fichier `supabase/migrations/202611170001_cloud.sql`. Il crée :

| Élément | Utilité |
|---|---|
| `user_accounts` | Identifiant du propriétaire et verrou pendant la suppression |
| `user_app_state` | État complet de l’application, version de schéma, révision de synchronisation |
| Bucket privé `vision-images` | Images de Vision, rangées sous l’identifiant de leur propriétaire |
| RLS et fonctions `upa_*` | Accès privé, validation et refus des écritures sur une révision périmée |

L’état complet conserve la structure de l’application existante. Les images sont retirées de ce document pour être stockées dans le bucket privé. Les jetons de connexion restent gérés par Supabase Auth, pas dans ces tables.

Ne rends pas le bucket public. Ne désactive pas RLS. Les clients ne peuvent pas modifier les tables directement : la fonction `upa_save_state` impose le propriétaire attendu et la révision. Les clés publiques ne donnent pas accès aux données d’autrui.

## 2. Configurer Google

Dans Google Cloud Console, prépare l’écran de consentement OAuth (nom, adresse d’assistance, audience et domaine selon les exigences de Google), puis crée un client OAuth de type **application Web**.

L’URI de redirection autorisée de ce client Google doit être l’URL de callback affichée par Supabase, généralement :

```
https://TON-PROJET.supabase.co/auth/v1/callback
```

Dans Supabase → Authentication → Sign In / Providers → Google, active Google et renseigne le **Client ID** et le **Client Secret** Google. Ce secret va dans Supabase uniquement.

Si l’application Google est en mode test, ajoute les comptes de test autorisés. Pour une ouverture au public, termine les réglages de publication/consentement demandés par Google.

Dans Supabase → Authentication → URL Configuration :

- Site URL : `https://jlegac.github.io/onestepafteranother/`
- Redirect URLs : ajoute exactement cette même URL, avec le slash final.
- Pour tes essais locaux uniquement : ajoute `http://localhost:4173/`.

L’URL de retour à la PWA est différente du callback Google/Supabase. Évite un joker global pour les redirections de production.

## 3. Ajouter la configuration publique

Dans `src/cloud/config.js`, renseigne l’URL du projet et sa clé **publishable** fournie par Supabase :

```js
export const cloudConfig = {
  url: 'https://TON-PROJET.supabase.co',
  publishableKey: 'sb_publishable_...'
};
```

Cette clé est publique par conception. La sécurité repose sur les règles RLS et la session de l’utilisateur. **N’utilise jamais `service_role`, `sb_secret_...`, le secret Google ou un mot de passe dans ce fichier.** Le code refuse les principaux formats de clés secrètes, mais il faut aussi vérifier le fichier avant publication.

Après toute modification de configuration, relance le build ou pousse les fichiers sur GitHub pour déclencher le workflow.

## 4. Déployer la suppression de compte

Le fichier `supabase/functions/delete-account/index.ts` doit être déployé dans **le même projet**. Avec la CLI Supabase installée :

```bash
supabase login
supabase link --project-ref TON-PROJECT-REF
supabase functions deploy delete-account
```

`supabase/config.toml` désactive la vérification JWT de la passerelle pour cette fonction ; **la fonction vérifie elle-même le bearer token avec `auth.getUser(token)` avant toute opération**, y compris avec les nouveaux formats de clés. Aucun identifiant utilisateur transmis dans le corps de la requête n’est accepté comme autorité.

Les variables serveur `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies par l’environnement Supabase hébergé. La clé privilégiée n’est utilisée que dans cette fonction, jamais dans les fichiers servis au navigateur. Ne copie pas ces variables dans le dépôt.

La suppression :

1. exige une session valide et une confirmation explicite ;
2. bloque les écritures et accès cloud du compte ;
3. supprime ses images privées par lots ;
4. supprime son utilisateur Auth, ce qui supprime ses lignes par cascade ;
5. efface sa copie et ses sauvegardes de sécurité sur l’appareil qui a demandé la suppression.

Si une étape échoue, le compte reste bloqué et le bouton permet de retenter la suppression. Les autres appareils hors connexion peuvent encore posséder leur copie jusqu’à leur retour en ligne ; on ne peut pas effacer à distance un appareil éteint. Les exports JSON téléchargés par l’utilisateur ne sont pas supprimables à distance. Le compte Google n’est jamais supprimé.

## 5. Premier démarrage et migration

Avant de déployer, exporte une sauvegarde JSON de l’application actuelle.

Après connexion, le profil demande quoi faire des données locales existantes. Si le cloud contient une autre version :

- **Garder cet appareil et remplacer le cloud** envoie la version locale ;
- **Utiliser les données du compte** charge la version cloud.

Les versions remplacées sont d’abord sauvegardées sur cet appareil et peuvent être exportées depuis **Mes sauvegardes de sécurité**. Tu peux aussi exporter les deux versions avant de décider. Il n’y a pas de fusion aveugle des habitudes et des XP.

Une fois le transfert approuvé, l’ancienne copie sans compte est libérée, pour éviter de proposer les mêmes données personnelles au compte suivant. La copie associée au compte et les sauvegardes de sécurité restent disponibles. Lors d’une déconnexion, la suppression de la copie locale n’est proposée que si aucun changement ne reste à envoyer ; le moteur vérifie à nouveau avant de l’effacer.

## 6. Recette à effectuer sur ton projet

- Connexion Google sur téléphone ; fermeture complète et réouverture ; session retrouvée.
- Même compte sur ordinateur : Vision, actions, habitudes, images et préférences retrouvées.
- Téléphone hors connexion : modifier une habitude et ajouter une victoire ; rouvrir hors connexion ; revenir en ligne et vérifier l’indicateur puis l’autre appareil.
- Deux appareils modifient le même domaine hors connexion : vérifier la demande de choix et les sauvegardes.
- Deux comptes distincts : vérifier qu’aucune donnée ni image du premier n’apparaît dans le second. L’accès direct aux données du premier doit être refusé.
- Déconnexion avec changements non envoyés : conserver la copie ; reconnexion au même compte et synchronisation.
- Sur un **compte de test**, vérifier la suppression des données et images. Ne teste pas cette action avec ton compte principal sans export préalable.
- Publier une seconde version : vérifier le bandeau sur PWA installée, « Plus tard », la réouverture et la protection des saisies avant activation.

Cette recette réelle reste nécessaire : les tests livrés ne remplacent pas les réglages OAuth et les essais sur tes appareils.

## Documentation officielle

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/functions/auth
