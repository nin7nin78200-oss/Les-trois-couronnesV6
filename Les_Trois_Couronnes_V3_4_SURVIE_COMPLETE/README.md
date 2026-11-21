# Les Trois Couronnes — V3.4 « Mode Survie »

Version complète, prête à déployer sur GitHub et Render. **40 cartes / 16 types**, cinq modes (1v1, 1v1v1, 1v1v1v1, 2v2, Survie), 1 à 4 tables par taverne, bots, classement entre joueurs réels et personnalisation.

## V3.3 — nouveautés

- **Baguette magique ×4** (remplace Bouclier) : relance deux dés **distincts**. Sélection indépendante du joueur et de l'indice de chaque dé : soi-même, coéquipier ou adversaire, y compris deux joueurs différents. Les Barrières magiques protègent les cibles contre les cartes adverses. Les bots connaissent également cette nouvelle action.
- **Malédiction ×3** : relance un seul dé choisi chez soi, son allié ou un adversaire. Même protection contre les effets adverses.
- **Échange** : les dés échangent leur valeur **et leur couleur propre** pour le reste de la manche. Une animation les fait traverser visuellement le plateau. Les nouvelles manches rétablissent les trois dés de la couleur personnalisée de chaque joueur.
- **Effets visuels sur les dés** : auras colorées, rotations et mise en évidence des cibles des cartes, même quand la valeur du dé reste identique. Les cartes d'effet sont toujours affichées près de trois secondes.
- **Corbeau de malchance** : cible assombrie de violet tant que le blocage est actif, son bref de battement d'ailes et cri synthétique. Les autres cartes ont un accompagnement sonore léger. Le bouton muet coupe tout.
- Les animations respectent la préférence système « Réduire les animations ».

Les règles de score, le classement, les autres 14 cartes et les quatre tables sont inchangés.

## Installation

Dans un dépôt GitHub existant, remplacer les fichiers avec **le contenu du ZIP directement à la racine**, sans dossier supplémentaire :

```text
server.js
package.json
README.md
test-server.js
test-multitable.js
test-extension40.js
test-magie33.js
public/
  index.html
  app.js
  style.css
  icons/ (16 fichiers SVG)
```

Sur Render, garder « Root Directory » vide si server.js et package.json sont à la racine, « Build Command » = `npm install` et « Start Command » = `npm start`. **Aucun nouveau service Render n'est nécessaire.**

## Tests

Depuis le dossier du projet : `npm install` puis `npm test`.

Les tests couvrent 160 parties de base, les tables multiples et les nouvelles règles de Baguette, Malédiction et Échange. Les animations et leur volume sonore doivent encore être vérifiés manuellement sur navigateur et téléphone.

## Classement

Seules les parties exclusivement composées de joueurs réels sont comptabilisées. Pour conserver les scores entre redémarrages de Render, configurer `DATABASE_URL` vers une base PostgreSQL persistante. Sans cette option, les scores locaux au serveur peuvent disparaître lors d'un redéploiement.


## Correctif V3.3.1
- Corbeau de Malchance : la teinte violette reste visible sur le joueur jusqu’à la fin de la manche, même après son tour bloqué. Le blocage de jeu ne s’applique toujours qu’à son tour.
- Joker : aura rouge et noire animée sur le dé ciblé, compatible avec les préférences de réduction des animations.


## V3.4 — Survie / Élimination

- **2 à 8 joueurs** sur une table en mode Survie. Les autres modes conservent leurs limites de 2 à 4 joueurs.
- **Deux vies par joueur** au départ. À chaque manche, le ou les joueurs possédant la plus faible combinaison perdent une vie ; à zéro ils sont éliminés, restent spectateurs, et ne peuvent plus cibler ni jouer de cartes.
- **Dernier survivant** : victoire, comptabilisée au classement uniquement si tous les participants sont des joueurs réels.
- **Égalité finale** : si tous les survivants devraient être éliminés simultanément, personne ne perd de vie pour cette manche et un nouveau tirage de dés permet de les départager.
- **Protection anti-acharnement** : les deux premières cartes offensives ciblant le même joueur durant une manche sont appliquées. Après la deuxième, il reçoit une Barrière magique automatique, qui protège des effets ennemis supplémentaires jusqu'à la manche suivante. Chaos ne compte pas comme une attaque ciblée ; Baguette magique compte pour chaque adversaire visé, une seule fois par carte.
- **Plateau ordinateur** : joueurs disposés en ronde et cercle qui se resserre à mesure des éliminations ; les éliminés sont affichés comme spectateurs.
- **Téléphone** : plateaux verticaux tactiles, ton plateau prioritaire, les autres joueurs dessous, sans dépendance à la ronde.
- Le paquet demeure à **40 cartes / 16 types**. Tous les autres modes, les tables, le classement et les effets V3.3.1 sont préservés.

### Vérification

`npm test` exécute les 160 parties classiques, les tests multitable, les cartes V3.3 et les tests de Survie (2 à 8 joueurs, bots, revanches, anti-focus, égalités).

La taille du salon et du plateau dépend désormais du mode : 8 places en Survie, 4 maximum dans les autres modes. L'interface doit encore être vérifiée visuellement sur ordinateur et téléphone après déploiement.
