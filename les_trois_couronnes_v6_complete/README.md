[README.md](https://github.com/user-attachments/files/35197924/README.md)
# Les Trois Couronnes — V6.3.10 (version complète)

Jeu de taverne en ligne, Node.js + WebSocket (`ws`). Toutes les mises sont fictives.

## Fichiers du site

```text
server.js
package.json
test-server.js
README.md
public/
  index.html
  app.js
  style.css
```

**Important :** les fichiers ci-dessus doivent se trouver directement à la racine de ton dépôt GitHub (pas dans un dossier supplémentaire). Ne transfère pas le ZIP fermé : décompresse-le d'abord.

## Contenu

- Modes 1v1, 1v1v1, 1v1v1v1 et 2v2, avec amis ou bots.
- Composition aléatoire des équipes en 2v2, noms d'équipes personnalisables, possibilité de retirer les bots dans le salon.
- Couleur des dés et fond du plateau configurés à l'accueil, préférences enregistrées localement dans le navigateur.
- 32 cartes, 12 types ; dés animés, sons discrets pour les actions, applaudissements de victoire, option muet.
- Couronne animée, animations des cartes et des combinaisons, indicateurs de protection et du joueur en tête.
- Victoire avec au moins 3 couronnes et 2 d'avance ; mort subite à 5–5 avec nouvelles cartes, nouveaux dés et ordre tiré au sort.
- Fenêtre finale avec score réel, statistiques, revanche et retour au salon (par l'hôte).
- Correction V6.3.10 : les fenêtres de fin de partie sont masquées quand la table retourne au salon afin que les boutons redeviennent utilisables.

## Installation sur GitHub et Render

1. Sauvegarde l'ancienne version si tu souhaites pouvoir revenir en arrière.
2. Décompresse le ZIP. **Place le contenu**, et non un dossier parent, à la racine du dépôt GitHub.
3. Vérifie que `package.json` et `server.js` sont à la racine et que les trois fichiers du site sont sous `public/`.
4. Dans Render (service Node.js), utilise :
   - **Root Directory** : vide si les fichiers sont à la racine du dépôt.
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
5. Enregistre/commit les changements sur GitHub et attends que Render indique que le déploiement est terminé ; actualise ensuite le site avec `Ctrl + F5`.

## Test local

```bash
npm install
npm test
npm start
```

Puis ouvre `http://localhost:3000`.

Les tests de `npm test` simulent 160 parties sur les quatre modes. Ils ne remplacent pas une vérification des éléments visuels dans un navigateur.

## Note technique

Les salons et les parties sont stockés en mémoire du serveur ; ils sont réinitialisés si le serveur Render redémarre.
