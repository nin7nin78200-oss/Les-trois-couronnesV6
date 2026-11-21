# Les Trois Couronnes — édition multijoueur finale (V5)

Mini-jeu de taverne en ligne, réalisé en Node.js + WebSocket (`ws`). 100 % de mises fictives.

## Contenu

- 4 modes : 1v1, 1v1v1, 1v1v1v1, 2v2.
- Dans chaque salon : lien à partager, sélection du mode par l'hôte, bots ajoutables et retirables avant la partie (jouable seul contre 1 à 3 bots).
- 2v2 : joueurs A/B ensemble, C/D ensemble, ordre alterné A-C-B-D en cycle rotatif. Le site tire au hasard le premier joueur au début de chaque partie et à chaque revanche ; chaque joueur occupe chaque position une fois par cycle de 4 manches. Les cartes de soutien peuvent viser soi-même ou un coéquipier ; la meilleure combinaison de chaque équipe compte.
- 32 cartes / 12 types : Épée ×4, Bouclier ×4, Crâne ×3, Échange ×3, Calice ×3, Dague ×3, Malédiction ×3, Couronne ×2, Barrière magique ×2, Joker ×1, Miroir ×2, Bénédiction ×2.
- Une carte par joueur et par manche (ou passer). Échange, Miroir, Barrière sont limités à une utilisation par TABLE en chacun-pour-soi, ou par ÉQUIPE en 2v2.
- Résultat figé 5 secondes puis annonce de la manche ; confirmation « prêt » entre manches ; revanche quand tous sont prêts ; bouton Accueil avec confirmation en cours de partie ; sons et animations des dés avec option muet.
- Si un joueur est déconnecté, l'hôte peut le remplacer par un bot. Si l'hôte se déconnecte, le rôle est transmis à un humain encore connecté.

## Mise à jour de Render (même URL)

1. Décompresser l'archive.
2. Dans le dépôt GitHub, ouvrir le dossier utilisé actuellement comme `Root Directory` sur Render (souvent `les_trois_couronnes_multijoueur`).
3. Remplacer **server.js**, **package.json**, **README.md** et les **trois fichiers dans `public/`** (`index.html`, `app.js`, `style.css`) par ceux de l'archive. Garder l'arborescence.
4. Cliquer **Commit changes**. Render déploie automatiquement (ou `Manual Deploy` → `Deploy latest commit`).
5. Config : **Web Service**, Node, `npm install`, `npm start`, `Root Directory` = dossier qui contient `package.json`.
6. Sur le site, actualiser avec Ctrl+F5 après le déploiement pour éviter un ancien script.

Pour jouer seul : créer un salon → choisir un mode → cliquer sur « Ajouter un bot » jusqu'à ce que toutes les places soient occupées → démarrer. En 2v2, la **position** dans le salon définit l'équipe : places 1/2 bleues, places 3/4 rouges.

## Tester localement

```bash
npm install
npm test
npm start
```

Puis ouvrir `http://localhost:3000` (ouvrir une autre fenêtre privée pour un deuxième joueur humain).

`npm test` effectue 160 parties de test hors réseau, avec 1 humain simulé et des bots, dans les quatre modes, et teste les revanches et le nombre de cartes. La vérification de syntaxe JS a également été réalisée. Ce n'est **pas** un test d'interface sur Render avec plusieurs navigateurs : il faut encore en faire un sur le site public.

## Limites connues

- Les salons, scores, mains et statistiques ne sont conservés qu'en mémoire du serveur : ils disparaissent lors des redémarrages/veilles Render.
- Les bots choisissent leurs coups selon une heuristique simple (ce ne sont pas des adversaires parfaits).
- Le son nécessite parfois un premier clic dans la page pour que le navigateur autorise l'audio.
- En cas de déconnexion prolongée d'un joueur pendant son tour, le jeu attend son retour ou le remplacement par un bot par l'hôte.


## Ajustements de rythme (V6)
- 1,5 seconde de pause synchronisée côté serveur après chaque action/passe avant de passer au joueur suivant.
- Le délai de 5 secondes pour regarder les dés en fin de manche est conservé.
- Une fois le résultat annoncé, la manche suivante démarre automatiquement après 3 secondes, sans vote « prêt ».
- Une revanche après la fin de la partie demande toujours l'accord des joueurs.
- Dés avec quatre couleurs fixes (une par joueur/place) pour suivre facilement les modifications.


## V6 complète — personnalisation et confort
- Chaque joueur choisit librement sa couleur de dés (code hexadécimal via sélecteur) et parmi 6 fonds CSS indépendants, dans le salon. Deux joueurs ne peuvent choisir exactement la même couleur.
- Les joueurs sont en grille de 2 colonnes (2×2 à quatre), adaptative sur téléphone. Dés strictement carrés (aspect-ratio 1/1).
- Progression en 3 couronnes grisées/dorées pour chaque joueur ; couronnes communes pour les membres de la même équipe en 2v2.
- Le résultat annonce le vainqueur de la manche et la victoire finale « a obtenu les Trois Couronnes ! ».
- Pauses : 1,5 s après chaque action, 5 s d'observation de la manche, 3 s d'affichage des résultats avant la manche suivante.
- Pour actualiser Render : remplacez les fichiers de la racine du dépôt GitHub (sans sous-dossier supplémentaire), committez puis vérifiez le déploiement.
