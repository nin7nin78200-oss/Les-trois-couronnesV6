# Les Trois Couronnes — V3 (édition Taverne)

Version complète à déposer **à la racine** du dépôt GitHub (aucun dossier supplémentaire).

## Démarrage

`npm install` puis `npm start` — Render : Build `npm install`, Start `npm start`, Root Directory vide.

## Nouveautés V3.1.2

- Tables : bouton ✕ de fermeture visible pour l’organisateur sur les tables supplémentaires. Fermeture autorisée uniquement si la table est vide et hors partie ; la table 1 est permanente. Une nouvelle table reprend le premier numéro disponible.
- Conserve les modifications de V3.1 (prêt par table) et V3.1.1 (textes simplifiés).

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


## Extension 40 cartes — 16 types

Deux cartes **Pioche** (piocher 1 carte puis une action supplémentaire), deux **Gambling** (relancer ses 3 dés puis une action supplémentaire), deux **Corbeau de Malchance** (empêcher un adversaire qui doit encore jouer de poser une carte), deux **Chaos** (relancer un dé aléatoire de chaque joueur, lanceur inclus). Une seule action supplémentaire maximum par tour ; elle est facultative. Main de trois maximum ; après la distribution initiale, une seule nouvelle carte est piochée par manche (sauf mort subite, où une nouvelle main de 3 cartes est distribuée). Les dés relancés s'animent même quand leur valeur reste identique.
