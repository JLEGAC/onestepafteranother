# Terminer la configuration

## 1. GitHub Pages
Remplacer `index.html` et `scripts/build.mjs`, ajouter `presentation.html` et `confidentialite.html` à la racine du dépôt. Attendre le succès du déploiement GitHub Pages. Les pages sont publiques, sans connexion, et intégrées au cache de chaque version.

Avant publication publique, relire la politique : identité et contact de Jérémy Le Gac repris du projet. Vérifier les durées effectives des journaux/sauvegardes et les garanties de transfert auprès des prestataires ; la page ne promet pas de délai non vérifié. Cette notice doit rester cohérente avec l’exploitation réelle.

## 2. Fonction Supabase (déploiement séparé)
Dans le projet `qmhhhxhwrlhdtfipbdul`, ouvrir Edge Functions → Deploy a new function → Via Editor. Nom exact : `delete-account`. Remplacer le contenu du fichier `index.ts` par celui de `supabase/functions/delete-account/index.ts` fourni, puis déployer.

Dans les paramètres de cette fonction, désactiver « Verify JWT with legacy secret » (vérification JWT de la passerelle). La fonction vérifie elle-même le jeton avec `auth.getUser(token)` et vérifie que le compte confirmé correspond à la session. Ne pas retirer ces contrôles du code. Les variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournies côté serveur par Supabase ; ne rien copier dans la PWA.

Alternative depuis le dossier du projet avec la CLI :

```sh
supabase login
supabase functions deploy delete-account --project-ref qmhhhxhwrlhdtfipbdul --no-verify-jwt
```

Ne pas réexécuter la migration SQL si elle est déjà installée et que la synchronisation fonctionne.

## 3. Vérification réelle
Avec un compte Google réservé aux essais, créer une donnée et une image, synchroniser, puis supprimer le compte depuis Profil. Vérifier la disparition de cet utilisateur dans Authentication → Users, de ses lignes dans user_accounts et user_app_state et de son dossier dans vision-images. Une requête sans session doit être rejetée (401). Le compte Google ne doit pas être supprimé.

Le déploiement et ce test réel ne sont pas effectués par la livraison des fichiers. Ne pas utiliser le compte principal pour ce test destructif.

## 4. Google Auth Platform → Branding
Nom : Pas à Pas
Assistance et contact : legacjeremypro@gmail.com
Page d’accueil : https://jlegac.github.io/onestepafteranother/presentation.html
Confidentialité : https://jlegac.github.io/onestepafteranother/confidentialite.html

Ouvrir les deux URL sans connexion pour vérifier qu’elles sont accessibles avant de les enregistrer. Conserver le callback Google vers Supabase et la Site URL Supabase vers la racine de la PWA : ces adresses ne changent pas.

Pour les domaines autorisés, utiliser les domaines correspondant aux URL et suivre les demandes de vérification de propriété de Google. Ne pas déclarer être propriétaire de github.io ou supabase.co. Si Google bloque la validation sur un domaine partagé, examiner le message exact ; un domaine personnalisé vérifiable peut être nécessaire. La création des pages ne garantit pas la validation du branding.

Terminer les champs demandés, puis Audience → Publier l’application. Si Google demande la validation du branding, suivre cette étape dans le Centre de validation. En attendant, le mode Test reste utilisable avec les comptes autorisés.
