# Un pas après l'autre

Une application pour clarifier ce qui compte pour toi, transformer tes objectifs en petites étapes et installer des habitudes à ton rythme.

**[Ouvrir l'application](https://jlegac.github.io/onestepafteranother/)**

## À l'origine du projet

Un grand merci à ma femme, **Délia Le Gac**, qui est à l'origine de ce projet. C'est son idée qui a donné naissance à l'application : aider chacun à trouver ce qui compte pour lui et à avancer à son rythme, par de petits pas concrets.

Retrouve ses articles, ses livres et ses outils sur son site [Un pas après l'autre](https://unpasapreslautre.fr/).

## Ce que tu peux faire

- Définir ta vision et les identités que tu souhaites incarner.
- Découper tes objectifs en étapes concrètes et choisir tes priorités de la semaine dans **Cap Hebdo**.
- Suivre tes habitudes et garder une trace de tes victoires.
- Personnaliser tes identités, piliers, étapes et habitudes avec des émojis ou des symboles recolorables.

[Installer l’application sur cet appareil](https://jlegac.github.io/onestepafteranother/?installer=1) · [Modifier les exemples de visite](src/data/README.md)

Dans **Profil → Aide et découverte**, retrouve le lexique, relance la visite ou reprends-la à la dernière étape.

## Installation et données

Tu peux utiliser l'application directement sur mobile ou ordinateur. Si ton navigateur le propose, tu peux aussi l'installer depuis son menu ou l'ajouter à ton écran d'accueil. Après un premier chargement en ligne, les fonctions locales sont accessibles hors connexion.

Aucun compte n'est nécessaire pour utiliser le mode local. Dans **Profil**, tu peux exporter une copie JSON de tes données et, si tu le souhaites, utiliser **Supabase avec une connexion Google** ou **Dropbox**. Un seul service cloud est actif à la fois. L'accès Dropbox est limité au dossier dédié à l'application.

[Lire la politique de confidentialité](https://jlegac.github.io/onestepafteranother/confidentialite.html)

## Retours et contributions

[🐛 Signaler un bug](https://github.com/JLEGAC/onestepafteranother/issues/new?template=bug.yml) · [💡 Proposer une amélioration](https://github.com/JLEGAC/onestepafteranother/issues/new?template=enhancement.yml)

Pour savoir quoi joindre à un signalement ou comment proposer un changement, consulte le [guide de contribution](CONTRIBUTING.md).

## Développement local

Avec Node.js 24 :

```bash
npm ci
npm run check
npm test
npm run build
python3 -m http.server 4173 --directory _site
```

Ouvre [localhost:4173](http://localhost:4173). Pour vérifier l'installation et le fonctionnement hors connexion, utilise le site généré dans `_site/` : le build y produit le service worker et ses fichiers de cache.

Pour les tests navigateur, après le build :

```bash
npx playwright install --with-deps chromium
npm run test:browser
```

- [Mise en ligne sur GitHub Pages](docs/MISE_EN_LIGNE.md)
- [Configuration de Supabase](docs/CONFIGURATION_SUPABASE.md) et [migration des identités pour une installation existante](docs/VERSION_0.4.0.md)
- [Audit et validation](docs/AUDIT_ET_VALIDATION.md)

Le mode local permet de développer sans configurer de service cloud. Ne place jamais de clé secrète ou de jeton d'accès dans `src/cloud/config.js` ou dans le dépôt.

## Publication

Un push sur `main` (ou un lancement manuel) démarre trois jobs indépendants : contrôles locaux, tests Chromium, production des captures. Chaque job dispose de son propre runner. Le job de captures régénère le manifeste et le précache après les captures, en réutilisant le bundle fournisseur déjà construit. Le déploiement attend les trois succès et publie uniquement cet artefact final. Un nouveau lancement annule le précédent.

## Vie du projet

[Code de conduite](CODE_OF_CONDUCT.md) · [Signaler une faille en privé](SECURITY.md) · [Conditions de réutilisation](LICENSE.md)
