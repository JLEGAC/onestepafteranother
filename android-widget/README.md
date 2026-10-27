# Widget Android — prototype d'accès rapide

Ce compagnon Android ajoute un widget Mon jour / Habitudes / Cap hebdo.
Il ouvre les URL publiques de la PWA avec le gestionnaire de liens du téléphone (PWA installée ou navigateur). Il ne lit et ne modifie aucune donnée de la PWA.

## Compiler et essayer
1. Charger le dépôt complet sur GitHub.
2. Actions > Compiler le widget Android (prototype) > Run workflow.
3. Télécharger l'artefact pas-a-pas-widget-test, extraire et installer l'APK sur le téléphone.
4. Ouvrir une fois l'application compagnon. Sur l'accueil Android, appui long > Widgets > Pas à Pas — widget.
5. Tester les trois boutons, le redimensionnement et le thème du téléphone.

Compilation locale : Java 17, SDK Android 35, Gradle 8.9, puis `gradle assembleDebug` dans ce dossier.

## Limites explicites
Ce prototype n'est pas une TWA intégrée et ne propose pas encore les habitudes ou actions en direct. Android ne donne pas au compagnon accès à IndexedDB du navigateur. Une synchronisation explicite avec le paquet Android reste à concevoir avant le widget dynamique.
L'APK de test est signé avec une clé debug temporaire du runner : les compilations successives peuvent nécessiter de désinstaller le compagnon précédent. Ne pas désinstaller la PWA ni effacer ses données.
Ce paquet n'est pas prêt pour publication Play Store. Il reste à définir une clé de signature pérenne, intégrer la TWA et vérifier les associations du domaine.
