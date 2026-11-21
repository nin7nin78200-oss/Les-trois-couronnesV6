# Les Trois Couronnes — La Taverne (version multitable)

Jeu de dés et de cartes de Valbois : 32 cartes, quatre modes, parties privées en WebSocket, bots, mort subite, effets visuels et sons.

## Nouveau : une taverne, jusqu'à quatre tables

1. Un joueur crée **un salon**, qui contient **la table 1 uniquement**.
2. Dans le salon, l'organisateur utilise **« + Ajouter une table »** pour ouvrir la table 2, puis 3, puis 4 (maximum 4).
3. Le même lien et le même code permettent à tous les invités de rejoindre la **taverne**.
4. Les participants voient toutes les tables et leurs occupants. Ils peuvent changer de table depuis le salon, ou, après une partie, depuis la fenêtre de victoire.
5. On ne peut pas quitter une partie en cours pour rejoindre une autre table. Seules les tables en attente, avec une place compatible avec leur mode de jeu, acceptent un nouveau joueur.
6. Chaque table organise **ses propres parties**, modes, équipes, bots et rematches sans interrompre les autres tables.

Une table peut accueillir de 2 à 4 joueurs selon le mode choisi et jusqu'à 4 places physiques ; la taverne contient au plus 16 places. L'organisateur général crée les nouvelles tables ; chaque table peut avoir un hôte différent pour lancer ses parties.

## Classement sans comptes

Le navigateur conserve un identifiant aléatoire dans `localStorage` (indépendamment du pseudo). Changer de pseudo depuis l'accueil garde le score de ce navigateur, mais changer d'appareil, de navigateur ou effacer les données locales crée une nouvelle identité.

**Seules les victoires de parties exclusivement humaines comptent**. Une partie avec un seul bot, même coéquipier, n'est pas comptabilisée. En 2v2, chaque membre humain de l'équipe gagnante reçoit une victoire. Une revanche compte comme une nouvelle partie. Une victoire n'est enregistrée qu'une fois par partie.

### Important : persistance du classement sur Render

- **Sans configuration**, le classement est écrit dans `scores.json` sur le serveur. C'est utile pour tester en local, mais le stockage du service Render peut être **éphémère** : les victoires risquent de disparaître au redémarrage ou au redéploiement. L'interface le signale.
- Pour un **classement durable sur Render**, utiliser une base PostgreSQL persistante (p. ex. Neon, Supabase, Render PostgreSQL) et ajouter dans les variables d'environnement du **Web Service Render** : `DATABASE_URL` = URL de connexion PostgreSQL. Ne jamais mettre cette URL dans GitHub ni dans les fichiers publics.
- Le serveur crée automatiquement la table SQL `trois_couronnes_scores`, charge les meilleurs joueurs au démarrage puis enregistre les victoires. Les permissions SQL doivent autoriser `CREATE TABLE`, `SELECT`, `INSERT`, `UPDATE`.
- **Attention :** choisir une base externe durable. Certaines offres de base de données gratuites peuvent expirer ou être supprimées après une certaine période.
- En alternative, sur une infrastructure avec disque persistant, définir `SCORE_FILE` vers un chemin conservé entre les redéploiements.

Le classement est **convivial**, pas un classement antifraude : sans comptes ni authentification, l'identifiant du navigateur peut être copié ou modifié.

## Déploiement GitHub → Render

Le ZIP est à décompresser et **son contenu** doit être placé directement à la racine du dépôt :

```text
public/
  app.js
  index.html
  style.css
server.js
package.json
README.md
test-server.js
test-multitable.js
```

Render : **Root Directory vide**, **Build Command** `npm install`, **Start Command** `npm start`. Le serveur écoute le port `PORT` fourni par Render. La variable `DATABASE_URL` est facultative pour tester, mais nécessaire pour rendre le classement durable sans disque persistant.

## Tests

```bash
npm install
npm test
npm start
```

Les tests incluent 160 parties simulées sur les quatre modes, plus les créations et changements de tables et les restrictions sur le classement.
