# Les Trois Couronnes — V3.9 · Pack Chaos enrichi et élimination recentrée

**Cinq modes au menu** : 1v1, 1v1v1, 1v1v1v1, 2v2, et Survie configurable en individuel ou en 2 à 4 équipes (2v2, 3v3, 4v4, 2v2v2, 2v2v2v2). Chaque survivant possède deux vies individuelles.

## Les nouveautés de la V3.9

- **Rançon ×1 (extension optionnelle)** : cible un adversaire. Ce joueur choisit en privé de **défausser une carte de son choix** s'il en possède au moins 3, ou de **relancer son dé le plus élevé**. À 1 ou 2 cartes, la relance est obligatoire. La Rançon est bloquée par une Barrière magique déjà active.
- **Grimoire interdit ×2 (extension optionnelle)** : l'acteur voit en privé jusqu'à trois prochaines cartes de la pioche, en conserve une et renvoie les deux autres **sous le paquet**. Si sa main contient déjà trois cartes après avoir joué le Grimoire, il en choisit une à remplacer. Il n'obtient pas d'action supplémentaire.
- **Bouclier ×2 (extension optionnelle)** : protège **un seul dé allié** jusqu'à la fin de la manche contre les effets adverses **ciblés**. Il est plus faible que **Barrière magique**, qui protège les trois dés du joueur. Le Bouclier n'empêche pas les effets globaux tels que Trou noir, Chaos, Tornade et Catastrophe ; une Usurpation ciblée sur un joueur possédant un dé protégé est bloquée.
- **Effets plus lisibles** : Chaos, Tornade, Trou noir et Usurpation n'affichent plus de longue liste « ancien dé → nouveau dé ». Les valeurs restent directement visibles sur les plateaux et leurs animations continuent.
- **Animation d'élimination recentrée** : l'entaille passe exactement par le centre géométrique du plateau éliminé, sans décalage lié à la rotation ou au changement de position des joueurs. Le marqueur « ÉLIMINÉ » est centré également. Les animations restent dans le plateau du joueur.
- **Choix privés** : le Grimoire et la Rançon possèdent leurs interfaces centrées, accessibles aux joueurs concernés et aux bots. Une déconnexion prise en charge par le maître de table ne bloque plus ces choix.

**Composition** : 40 cartes classiques inchangées. Le Pack Chaos comporte maintenant **11 types de cartes optionnelles pour 17 cartes supplémentaires**, soit **57 cartes maximum** lorsque toutes sont activées. Comme auparavant, les extensions sont activables individuellement, par table, dans le salon.

## Installation GitHub / Render

La **version complète** contient le jeu avec `server.js`, `package.json`, `public/` et les tests. Dépose le contenu du ZIP à la **racine du dépôt**, sans créer de sous-dossier supplémentaire.

Le **correctif rapide** contient uniquement `server.js`, `public/app.js`, `public/index.html` et `public/style.css` ; remplace ces quatre fichiers dans ton dépôt. Aucun changement de variables d'environnement n'est nécessaire.

## Vérification

Commandes : `node --check server.js`, `node --check public/app.js`, `node test-v39-cards.js`, `node test-extensions-v36.js`, `node test-extension-games-v36.js`, `node test-survie-unifiee.js`. Les tests automatisés ne remplacent pas un test multijoueur réel. Le rendu HTML/CSS et les scripts clients ont été inspectés dans Chromium, sans partie serveur en direct, les dépendances Node du serveur n'étant pas installées dans cet environnement.

---

## Historique des versions précédentes

# Les Trois Couronnes — V3.8 : un seul mode Survie configurable

Dans le salon, le menu comporte cinq modes : 1v1, 1v1v1, 1v1v1v1, 2v2 et **💀 Survie**.

Dans **Survie**, l'hôte peut activer **⚔️ Jouer par équipes**. Il démarre avec **2 équipes**, puis utilise **+ Ajouter une équipe** ou **− Retirer** pour choisir de **2 à 4 équipes**. Il peut désactiver le mode équipes à tout moment pour revenir au chacun-pour-soi. Ce réglage est indépendant à chaque table et remis à zéro en changeant de mode.

| Configuration | Nombre exact de joueurs |
|---|---|
| Survie sans équipe | 2 à 8 |
| 2 équipes | 4, 6 ou 8 (2v2, 3v3, 4v4) |
| 3 équipes | 6 (2v2v2) |
| 4 équipes | 8 (2v2v2v2) |

**Chaque joueur conserve 2 vies individuelles**, et l'équipe gagne quand elle est la seule à compter un ou plusieurs survivants. La préparation autorise le tirage au sort, la personnalisation des noms d'équipes et les revanches. Les autres modes et toutes les extensions sont inchangés.

L'hôte choisit le nombre d'équipes **avant** de lancer la partie. La table vérifie le nombre de joueurs nécessaire et alterne les équipes aussi longtemps que possible.

**Installation :** remplace `server.js`, `public/app.js`, `public/index.html` et `public/style.css` par les fichiers de cette version à la racine du dépôt (l'arborescence `public/` doit rester intacte). Render se redéploie avec la configuration existante.

**Tests :** `node test-survie-unifiee.js` couvre 48 parties réparties entre survie individuelle, deux, trois et quatre équipes. `npm test` exécute également les anciens tests de non-régression.

---

# Les Trois Couronnes — V3.7 : Survie en équipes et correctifs

Cette version conserve les **40 cartes de base** et les **8 extensions facultatives** (jusqu’à **52 cartes**).

## Nouveau : Survie en équipes

- **2v2, 3v3 ou 4v4** (4, 6 ou 8 joueurs), avec deux équipes tirées au sort avant le match.
- **Deux vies individuelles par joueur.** À chaque manche, le ou les joueurs possédant la combinaison la plus faible perdent une vie. À zéro vie, ils sont éliminés et restent spectateurs.
- Les coéquipiers peuvent s'entraider avec les cartes de soutien. Les cartes offensives continuent de cibler les adversaires.
- **La dernière équipe avec au moins un survivant gagne**, même si elle n'a plus qu'un seul membre debout. En cas d'égalité qui ferait disparaître tous les survivants, on rejoue sans perte de vie.
- L'ordre alterne les équipes autant que possible, et le bouclier anti-acharnement reste en vigueur.
- Les équipes peuvent recevoir des noms personnalisés, et les victoires comptent pour chaque joueur de l'équipe gagnante seulement si la partie est entièrement entre vrais joueurs.

## Correctifs regroupés

- **Boule de feu** remplace le nom Voleur : elle défausse aléatoirement une carte adverse seulement si la cible possède au moins 3 cartes. Elle ne récupère pas cette carte.
- **Seconde Chance** : pioche 2, puis permet de rejouer ; une main temporairement à 4 cartes doit être réduite à 3 seulement si le joueur passe.
- **Trou noir** : conserve son vortex noir et violet sans afficher les dizaines de valeurs modifiées.
- **Marché des Ombres** : les cartes restent affichées au centre pendant le choix, même quand un bot choisit.
- **Élimination** : effet d'entaille diagonale joué sur une copie du plateau avant sa disparition, pour éviter que le changement de mise en page ne masque l'animation.
- **Annonces de cartes** : centrées dans l'espace libre du plateau sur ordinateur ; intégrées dans la bannière de tour sur mobile, sans masquer les joueurs.
- **Disposition classique** : plus d'espace au centre entre les joueurs pour accueillir les annonces.

# Les Trois Couronnes — V3.7 · Pack Chaos (extensions facultatives)

Cette version complète repart de **V3.5.1** (Survie, confort mobile, 4 tables, 40 cartes de base et 16 types classiques). Elle ajoute **8 types de cartes optionnelles**, soit jusqu'à **12 cartes supplémentaires et 52 cartes au total**. Aucune extension n'est activée par défaut.

## Comment activer les extensions

1. Créez un salon et installez-vous à une table.
2. Avant le début de la partie, le **maître de cette table** ouvre **« 🧩 Extensions de cartes (facultatives) »** dans la préparation.
3. Il coche ou décoche les cartes souhaitées. La composition est **indépendante pour chaque table** et visible par tous ; toute modification remet les joueurs en « pas prêt ».
4. Lancez la partie normalement quand tout le monde est prêt. Le paquet de base est inchangé si rien n'est coché.

## Les 8 nouvelles cartes, leurs règles et effets

| Extension | Copies | Règle précise | Animation / son |
|---|---:|---|---|
| **🧪 Potion instable** | 2 | Choisis **un de tes dés** : il devient aléatoirement **1 ou 6**. | Explosion alchimique verte et petit « pop ». |
| **🥷 Boule de feu** | 2 | Un adversaire **ayant une carte en main** défausse **une carte aléatoire**. Le boule de feu ne la récupère pas. | Petit boule de feu, carte face cachée qui disparaît, son discret de larcin. |
| **🔁 Seconde Chance** | 2 | Sacrifie une autre carte de ta main (si tu en as une), pioche jusqu'à **2 cartes** sans dépasser **3 cartes en main**, puis **tu peux rejouer une carte**. Si tu renonces à la seconde action, tu dois **défausser une carte choisie** (s'il t'en reste). Une seule action supplémentaire par tour, comme Pioche et Gambling. | Cartes remélangées, bruit de papier. |
| **🕳️ Trou noir** | 2 | Relance **les trois dés** de **tous les joueurs encore en jeu**, y compris toi. Les boucliers ne bloquent pas cet effet global. | Tous les dés tournoient ; vortex noir et violet intense ; son grave d'aspiration. |
| **🌪️ Tornade** | 1 | Chaque joueur encore en jeu transmet **un dé choisi aléatoirement** au suivant dans l'ordre du tour. Tous les échanges sont simultanés ; chaque dé garde **valeur et couleur d'origine** pour la manche. | Dés volants et rotation, souffle tourbillonnant. |
| **🎭 Usurpation** | 1 | Échange **tes trois dés** avec les trois dés d'un adversaire ; les valeurs et couleurs suivent les dés jusqu'à la fin de la manche. Une Barrière magique ennemie peut bloquer l'échange. | Masque sur l'avatar de l'usurpateur, six dés qui se croisent, souffle mystérieux. |
| **🔥 Catastrophe** | 1 | Chaque joueur possédant à cet instant **la meilleure combinaison individuelle** voit **un de ses dés, choisi au hasard, devenir 1** (y compris en cas d'égalité). | Flammes sur les dés touchés, impact brûlant. |
| **🌑 Marché des Ombres** | 1 | Chaque joueur encore en jeu ayant des cartes donne **une carte aléatoire** (après que l'acteur a joué le Marché). **Seul l'acteur voit** la liste des cartes recueillies et en prend **une**. Les autres sont remélangées dans la pioche. L'acteur ne rejoue pas immédiatement. | Cartes face cachée vers le centre, choix privé, bruit de cartes. |

**Protections :** les effets explicitement dirigés contre un adversaire (Boule de feu, Usurpation) respectent sa Barrière magique et comptent pour l'anti-acharnement en mode Survie. Les catastrophes générales (Trou noir, Tornade, Catastrophe, Marché) touchent tous les joueurs éligibles, même protégés.

**Visuel supplémentaire :** en mode Survie, lorsqu'un joueur est éliminé, une entaille diagonale rapide traverse son plateau, qui reste ensuite grisé.

**Sons :** générés dans le navigateur, à volume modéré, avec interrupteur muet ; les animations honorent le réglage système « Réduire les animations ».

## Installation et vérification

Décompressez le ZIP et téléversez **son contenu** à la racine du dépôt GitHub (ne créez pas un dossier supplémentaire). Le service Render existant reste inchangé : `npm install`, puis `npm start`.

Pour la mise à jour rapide depuis **V3.5.1**, remplacez `server.js`, `public/app.js`, `public/index.html`, `public/style.css`. Le ZIP complet contient en plus les avatars SVG, le README et les tests.

`npm test` vérifie les parties classiques, la Survie, les règles des 8 extensions et **30 parties complètes avec toutes les extensions activées** dans les 5 modes.

Note : pour un classement persistant après les redéploiements Render, la configuration `DATABASE_URL` reste nécessaire ; le pack d'extensions ne change pas cette exigence.

---

# Les Trois Couronnes — V3.5.1 · Confort mobile et cercle Survie

Cette version reprend **la V3.5 complète** sans modifier les règles, les 40 cartes ou le serveur.

## Améliorations

- Sur le salon : petite croix carrée (28 × 28 px) au niveau de chaque place occupée, visible seulement pour le maître de table, sans grand bouton étiré.
- La section « Préparation » ne répète plus les bots : ils restent dans les cartes des tables et peuvent être retirés depuis celles-ci. Les vrais joueurs restent visibles dans « Préparation ».
- Sur téléphone (largeur ≤ 750 px) : main de cartes ancrée en bas pendant le jeu, défilement horizontal au doigt, sélection conservée pendant le ciblage, boutons Jouer / Passer / Annuler accessibles ; la page reste défilable pour viser les plateaux.
- Mode Survie sur ordinateur : cercle redimensionné (590 px de hauteur à 8 joueurs, 580 px à 5–7 joueurs) et positions resserrées sans se chevaucher ; taille et hauteur identiques pour tous les plateaux grâce à une ligne d'icônes réservée aux effets.
- À chaque manche, le cercle continue à se resserrer selon le nombre de survivants.

## Installation

Décompresser et téléverser **le contenu** du ZIP à la racine du dépôt GitHub : `server.js`, `package.json` et `public/` restent à leur place. Render garde sa configuration actuelle.

## Vérifications

La syntaxe JavaScript et les tests automatisés fournis sont vérifiés. Les clics réels, les tailles d'écran particulières et le confort du slider sont à valider dans le navigateur.

---

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


## Version 3.5 — lisibilité et contrôle des tables

- **Table personnelle** : lorsque l’organisateur crée une table, il s’y installe et en devient le maître. Chaque maître de table peut retirer les bots ou joueurs de **sa table**, uniquement avant le début d’une partie. Les joueurs reçoivent une notification s’ils sont retirés. Le maître ne peut pas se retirer lui-même par la croix.
- **Mode Survie** : répartition des 2 à 8 joueurs autour de positions séparées sur ordinateur et regroupement en colonne sur petit écran. La zone centrale se réduit visuellement à mesure des éliminations. Le ou les derniers au classement portent une alerte « ☠️ Perd 1 vie » en cours de manche. Les égalités sont signalées à tous les derniers.
- **Ciblage direct** : sélectionnez une carte puis touchez les dés admissibles directement sur les plateaux, ou le bandeau d’un joueur pour le Corbeau et la Barrière. Deux clics pour Baguette magique, Échange, Miroir et Bénédiction. Le bouton « Effacer les cibles » permet de recommencer. La valeur du Joker reste sélectionnable dans le petit champ numérique.
- **Résultats** : en manche ordinaire, annonce de la meilleure combinaison du gagnant ; en Survie, le ou les joueurs qui perdent une vie et leur combinaison sont indiqués.
- **Protection anti-acharnement** : les deux premières attaques ciblées subies par un joueur passent ; le bouclier bloque les attaques suivantes jusqu’à la nouvelle manche.

**Test avant déploiement** : faites une partie à 8 joueurs sur ordinateur, puis essayez depuis un téléphone les cartes Baguette, Échange, Joker et Corbeau. Vérifiez le comportement des croix en salon. La suite de tests `npm test` couvre le moteur et les autorisations des maîtres de table, pas le rendu visuel de tous les navigateurs.


## Correctifs V3.7.1
- **Trou noir** : le bandeau ne détaille plus chaque changement de chiffre, afin de laisser profiter du vortex et des dés animés.
- **Marché des Ombres** : cartes visibles au centre durant toute la phase de sélection ; un bot attend environ 3,1 secondes avant de faire son choix. Le contenu des cartes reste secret pour les autres joueurs.
- **Seconde Chance** : pioche deux cartes après avoir joué Seconde Chance, avec une tolérance temporaire de 4 cartes en main. Le joueur peut ensuite rejouer une carte (la main revient à 3) ou passer. Il ne défausse une carte de son choix **que s'il passe avec 4 cartes**. Si le paquet n'a pas deux cartes disponibles, aucune défausse n'est exigée avec 3 cartes ou moins.


## Nouveau dans la V3.7.1 — Survie 2v2v2v2
- Nouveau choix de mode à huit places : quatre équipes de deux joueurs.
- Quatre noms et couleurs distincts (bleue, rouge, verte, jaune) configurables depuis le salon.
- Tirage aléatoire de la composition des quatre équipes avant de démarrer.
- Chaque joueur conserve ses deux vies individuelles ; ses coéquipiers restent en lice s'il est éliminé.
- L'ordre de jeu alterne les équipes encore vivantes autant que possible.
- La dernière équipe possédant au moins un survivant remporte la partie.
- Les autres modes, les 40 cartes de base et les extensions restent inchangés.


## V3.9.1 — derniers réglages

- **Trou noir** : annonce centrale « [joueur] utilise Trou noir » pendant 1,5 seconde ; les valeurs restent visuellement anciennes pendant cette annonce, puis le vortex et les dés relancés s’animent sans listes de chiffres.
- **Boule de feu** : peut brûler une carte aléatoire chez tout adversaire qui en possède au moins une, même si c’est sa dernière carte. Ne récupère jamais la carte brûlée. Une cible avec zéro carte reste impossible, faute de carte à détruire. Les barrières et l’anti-acharnement continuent de s’appliquer.
- **Cartes ciblées** : après avoir choisi toutes les cibles sur les plateaux, un petit dialogue de confirmation **privé** apparaît au centre de l’écran : « Jouer cette carte » ou « Annuler ». Les cartes sans cible gardent le bouton de jeu habituel sous la main. Le Joker choisit sa valeur directement dans ce dialogue.
- Les formats de Survie et les extensions de la V3.9 sont inchangés.
