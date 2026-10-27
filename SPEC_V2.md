# Cadrage fonctionnel — V2

La V2 conserve le périmètre et les principes de la [V1](SPEC_V1.md), puis ajoute des outils de suivi et de motivation facultatifs. Elle reste une PWA mobile-first, hors ligne pour ses fonctions locales, sans compte ni synchronisation.

## Habitudes

- Ajouter, modifier et archiver des habitudes ; l’archivage conserve le journal passé.
- Cocher une habitude pour la date du jour, corriger librement les dates passées depuis sa création, consulter le calendrier mensuel et filtrer par habitude ou par jour.
- Une correction historique ne recalcule pas les XP. Le mécanisme de suivi sur 10 jours consécutifs est reporté à une phase ultérieure.
- Voir les séries individuelles et les journées où toutes les habitudes actives ont été réalisées (Grand Chelem).
- Une validation rapporte 1 XP, une seule fois par habitude et par date. Pour une habitude liée à un objectif, ce point est doublé.
- Le Grand Chelem rapporte 10 XP ; après sept jours de Grand Chelem consécutifs, son bonus passe à 20 XP. Ce bonus est doublé une fois si au moins une habitude liée à un objectif participe au Grand Chelem.
- Une série individuelle rapporte 30 XP au 21e jour et 60 XP au 60e jour. Le bonus est doublé lorsque l’habitude concernée est liée à un objectif.
- Une journée vide ne retire aucun XP. Elle interrompt seulement la série de Grand Chelem.

## Défis

- Un défi personnel actif à la fois, sur une période de sept jours ; choisir un objectif de 1 à 7 jours.
- Partir d’une proposition ou saisir son propre défi ; rattacher éventuellement le défi à une habitude ou à un objectif.
- Valider sa participation pour la journée. Chaque jour validé rapporte 3 XP, et l’objectif atteint rapporte 15 XP supplémentaires.
- Mettre le défi de côté sans pénalité. Il n’y a ni retrait d’XP ni perte des gains déjà obtenus.

## Capsules vidéo

- Constituer une collection locale à partir de liens HTTPS que l’utilisateur ajoute lui-même.
- Renseigner un titre, une description, une catégorie et une durée indicative ; modifier ou retirer chaque capsule.
- Filtrer par Sérénité, Focus, Inspiration ou Coup de boost.
- Marquer une capsule comme regardée pour la retrouver dans son historique ; cette action rapporte 3 XP une seule fois par capsule.
- La lecture du lien nécessite une connexion Internet.

## Badges et ambiances

- Décerner automatiquement des badges pour des jalons (actions, habitudes, séries, Grand Chelem, défi, capsule, rétrospective).
- Débloquer des ambiances visuelles aux niveaux 3 et 5, en plus de l’ambiance de départ.
- Les XP ne sont jamais dépensés et aucun outil essentiel n’est verrouillé derrière un niveau.

## Écrans et navigation

- La barre principale donne accès à Accueil, Vision, Objectifs, Cap Hebdo, Outils et Réserve. Le logo fourni apparaît dans l’en-tête ; XP, profil et calendrier d’historique restent accessibles en haut.
- L’accueil présente la batterie et l’humeur côte à côte, avec les sélecteurs alignés et leurs légendes accessibles à la demande, puis la phrase de Vision, les habitudes avec les sept jours de la semaine, les actions du jour et les victoires. Une victoire peut être reliée à un objectif ou à une action.
- L’humeur utilise cinq niveaux météo : « Rien ne va », « C’est très compliqué », « C’est dur mais y’a du positif », « Les émotions sont équilibrées » et « Ça va à merveille, je me sens au top ! ».
- Objectifs réunit les habitudes et les objectifs. Les habitudes liées à un objectif portent une étoile ; leurs séries affichent « Premier jour », « Deuxième jour » ou « Série de X jours ». Le champ « Déclencheur » remplace « Repère ou intention ».
- Un objectif contient des étapes et des actions. Une action peut être liée directement à l’objectif ou à une étape ; la progression compte toutes les actions, y compris celles en Réserve. L’emoji initial du titre sert d’icône, sans champ de symbole distinct. Le formulaire utilise « Bénéfice » et une date d’échéance.
- Vision présente « Mes importants », « La vie que je veux bâtir » et « Ce qui résonne ». Les boutons d’ajout de mots et d’images précèdent les éléments ajoutés. Les images locales s’ouvrent en grand au toucher ou au clic.
- Cap Hebdo montre le numéro de semaine, un cap prioritaire en texte libre, les actions et le planning horizontal. Le planning affiche d’abord lundi à jeudi et permet de faire défiler vers vendredi à dimanche. Chaque journée montre « Toute la journée » ; seuls les moments explicitement choisis pour cette journée sont affichés. Les bilans et l’aperçu Réserve ne figurent pas sur cette page.
- Réserve est une page dédiée qui liste les actions dont le statut est « reserve ».
- La Réserve permet de réordonner les actions par priorité en les faisant glisser ou avec des boutons accessibles.
- Le profil permet de choisir un thème sombre ; ce choix est conservé sur l’appareil.
- Les actions peuvent être déplacées à la souris ou au toucher ; un formulaire jour/moment sert d’alternative accessible au clavier. Un créneau peut contenir plusieurs actions S et les actions S peuvent cohabiter avec une action de taille supérieure. Une seconde action supérieure à S dans le même créneau invite à en choisir un autre. Une case permet de marquer l’action faite.
- L’historique permet de revoir une journée et sa semaine ; les victoires ont une page dédiée.

## Comportement du planning

Le glisser-déposer est inclus dans cette version. Il gère le glissement tactile sur mobile, la souris sur ordinateur, une sélection jour/moment accessible au clavier, les capacités de créneaux définies ci-dessus, puis sauvegarde la date et le bloc de temps de l’action.

## Barème d’XP

- Action terminée : 5 XP de base + bonus d’effort — S 10, M 20, L 35, XL 50, XXL 70.
- Les gains V1 (humeur, énergie, victoire, Vision, respiration, rétrospective) restent tels qu’ils étaient.
- Habitude validée : 1 XP, doublé si elle est reliée à un objectif. Grand Chelem : 10 XP ou 20 XP à partir de sept jours consécutifs, doublé une fois si une habitude liée participe. Paliers individuels : +30 XP au jour 21 et +60 XP au jour 60, doublés pour une habitude liée.
- Jour de défi validé : 3 XP ; objectif atteint : 15 XP supplémentaires.
- Capsule marquée comme regardée : 3 XP, une seule fois.
- Le total de XP historique n’est pas recalculé lors de la mise à niveau.

## Données et migration

- Le schéma local passe à la version 4. Il ajoute les habitudes, les journaux d’habitudes, les défis et les capsules, les images de repères, le cap hebdomadaire et les étapes d’objectif.
- Les données V1 sont normalisées à la lecture sans perte des profils, actions ou XP déjà enregistrés.
- Les exports V4 contiennent les nouvelles données et l’import accepte les exports V1, V2 et V3.
- Toutes les données restent sur l’appareil, dans IndexedDB, et sont incluses dans l’export JSON.

## Hors périmètre

- Défis communautaires, classements, synchronisation entre appareils et comptes.
- Capsules vidéo fournies ou hébergées par l’application.
- Alertes de surcharge hebdomadaire.
