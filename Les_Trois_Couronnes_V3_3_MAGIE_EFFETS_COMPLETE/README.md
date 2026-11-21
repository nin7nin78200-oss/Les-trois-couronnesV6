# Les Trois Couronnes — V3.3 « Magie & Effets »

Version complète, prête à déployer sur GitHub et Render. **40 cartes / 16 types**, quatre modes (1v1, 1v1v1, 1v1v1v1, 2v2), 1 à 4 tables par taverne, bots, classement entre joueurs réels et personnalisation.

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
