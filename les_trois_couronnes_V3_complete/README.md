# Les Trois Couronnes — V3 (édition Taverne)

Version complète à déposer **à la racine** du dépôt GitHub (aucun dossier supplémentaire).

## Démarrage

`npm install` puis `npm start` — Render : Build `npm install`, Start `npm start`, Root Directory vide.

## Nouveautés V3

- 16 avatars « gribouillis » au format SVG dans `public/icons`, au choix à l'accueil (mémorisés sur le navigateur).
- Cartes plus visuelles et colorées, avec type de cible et restriction de manche.
- Nouvelle option « Tapis vert (feutrine) » pour le fond du plateau, dés centrés et informations placées autour. Les anciens fonds personnalisés restent disponibles.
- Compteur de couronnes : score actuel doré, objectif lumineux, couronnes supplémentaires grisées.
- Actions de cartes lisibles pendant environ 3 secondes (toast indiquant auteur, carte, cible et changements de dés) ; passer le tour est plus rapide.
- Base multitable : 1 table à la création, jusqu'à 4 tables, bouton rejoindre salon par code, changement de table après un match, tirage aléatoire, bots, classements humains uniquement, etc.

## Classement

Sans compte : identifiant local au navigateur. Les scores serveur nécessitent PostgreSQL avec la variable d'environnement `DATABASE_URL` sur Render. Sinon classement provisoire (effacé au redémarrage).

## Test

`node test-server.js` et `node test-multitable.js` ; pour les visuels, tester avec deux navigateurs ou des bots.
