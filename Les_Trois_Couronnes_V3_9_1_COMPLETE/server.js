'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||3000),ROOT=path.join(__dirname,'public'),REVEAL_MS=4000,TURN_DELAY_MS=2950,BOT_DELAY_MS=2000;
const defs={epee:{name:'Épée',count:4},bouclier:{name:'Baguette magique',count:4},crane:{name:'Crâne',count:3},echange:{name:'Échange',count:3},calice:{name:'Calice',count:3},dague:{name:'Dague',count:3},malediction:{name:'Malédiction',count:3},couronne:{name:'Couronne',count:2},barriere:{name:'Barrière magique',count:2},joker:{name:'Joker',count:1},miroir:{name:'Miroir',count:2},benediction:{name:'Bénédiction',count:2},pioche:{name:'Pioche',count:2},gambling:{name:'Gambling',count:2},corbeau:{name:'Corbeau de Malchance',count:2},chaos:{name:'Chaos',count:2}};
const extraDefs={potion:{name:'Potion instable',count:2},voleur:{name:'Boule de feu',count:2},secondechance:{name:'Seconde Chance',count:2},trounoir:{name:'Trou noir',count:2},tornade:{name:'Tornade',count:1},usurpation:{name:'Usurpation',count:1},catastrophe:{name:'Catastrophe',count:1},marche:{name:'Marché des Ombres',count:1},rancon:{name:'Rançon',count:1},grimoire:{name:'Grimoire interdit',count:2},petitbouclier:{name:'Bouclier',count:2}};
const extraKeys=new Set(Object.keys(extraDefs));
const modes={'1v1':2,'1v1v1':3,'1v1v1v1':4,'2v2':4,'survie':8,'survie-equipes':8,'survie-2v2v2v2':8};
const isSurvival=r=>r.mode==='survie'||r.mode==='survie-equipes'||r.mode==='survie-2v2v2v2';
// La Survie est un seul mode : 0=chacun pour soi, 2/3/4=équipes.
// Les anciens identifiants restent reconnus pour les éventuels clients déjà connectés.
const survivalTeamCount=r=>r.mode==='survie-2v2v2v2'?4:r.mode==='survie-equipes'?2:r.mode==='survie'?r.survivalTeams||0:0;
const isTeams=r=>r.mode==='2v2'||survivalTeamCount(r)>=2;
const teamCount=r=>r.mode==='2v2'?2:survivalTeamCount(r);
const validSurvivalSize=(r,n=r.players.length)=>{const t=survivalTeamCount(r);return t===0?n>=2&&n<=8:t===2?[4,6,8].includes(n):t===3?n===6:t===4?n===8:false};
const survivalSizeError=r=>{const t=survivalTeamCount(r);return t===0?'Le mode Survie nécessite de 2 à 8 joueurs.':t===2?'La Survie à deux équipes nécessite 4, 6 ou 8 joueurs (2v2, 3v3 ou 4v4).':t===3?'La Survie à trois équipes nécessite 6 joueurs (2v2v2).':'La Survie à quatre équipes nécessite 8 joueurs (2v2v2v2).'};
const defaultTeamNames=['Équipe bleue','Équipe rouge','Équipe verte','Équipe jaune'];
const limited=new Set(['echange','miroir','barriere']),rooms=new Map(),taverns=new Map();
const diceColors=['#5B9BE6','#E45C5C','#55B976','#F0C74F','#E99A4D','#A582DF','#EE8EBA','#4DBBBB','#5CCFE2','#EEEEEE','#999999','#373737','#913F57','#9A7454','#9ADABD','#C9B6ED'];
const backgrounds=new Set(['uni','arcade','bois','metal','magic','damier','tapis']);

// Une taverne possède 1 à 4 tables, créées progressivement par l'organisateur.
// Les identifiants sont locaux au navigateur et ne constituent PAS des comptes.
const leaderboard=new Map();
const SCORE_PATH=process.env.SCORE_FILE||path.join(__dirname,'scores.json');
let scoreDatabase=null;
try{for(const row of JSON.parse(fs.readFileSync(SCORE_PATH,'utf8')))if(/^[a-f0-9]{24}$/i.test(row.id))leaderboard.set(row.id,row)}catch{}
async function openScoreDatabase(){
 if(!process.env.DATABASE_URL)return;
 try{
  const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}});
  await pool.query('CREATE TABLE IF NOT EXISTS trois_couronnes_scores (player_id VARCHAR(24) PRIMARY KEY, name VARCHAR(24) NOT NULL, wins INT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW())');
  const result=await pool.query('SELECT player_id AS id,name,wins FROM trois_couronnes_scores ORDER BY wins DESC, name LIMIT 200');
  leaderboard.clear();result.rows.forEach(x=>leaderboard.set(x.id,x));scoreDatabase=pool;
  for(const t of taverns.values())broadcast(t.tables[0]);
 }catch(e){console.error('Classement : base de données indisponible, scores locaux provisoires :',e.message)}
}
function topScores(){return [...leaderboard.values()].sort((a,b)=>b.wins-a.wins||a.name.localeCompare(b.name,'fr')).slice(0,30).map(({id,name,wins})=>({id,name,wins}))}
function saveScoresLocal(){try{fs.writeFileSync(SCORE_PATH,JSON.stringify([...leaderboard.values()]))}catch(e){console.error('Écriture des scores :',e.message)}}
function updateName(p){const existing=leaderboard.get(p.id);if(!existing)return;existing.name=p.name;saveScoresLocal();if(scoreDatabase)scoreDatabase.query('UPDATE trois_couronnes_scores SET name=$2,updated_at=NOW() WHERE player_id=$1',[p.id,p.name]).catch(e=>console.error('Nom classement :',e.message))}
function registerWin(r){
 if(r.rankedRecorded||r.players.some(p=>p.bot))return;
 r.rankedRecorded=true;
 const winners=isTeams(r)?r.players.filter(p=>teamOf(r,p)===r.winner):r.players.filter(p=>p.id===r.winner);
 for(const p of winners){const old=leaderboard.get(p.id)||{id:p.id,name:p.name,wins:0};old.name=p.name;old.wins++;leaderboard.set(p.id,old);
  if(scoreDatabase)scoreDatabase.query('INSERT INTO trois_couronnes_scores(player_id,name,wins) VALUES($1,$2,1) ON CONFLICT(player_id) DO UPDATE SET name=$2,wins=trois_couronnes_scores.wins+1,updated_at=NOW()',[p.id,p.name]).catch(e=>console.error('Victoire classement :',e.message));}
 saveScoresLocal();
}
function newTable(t,n,host){return {creator:host,key:n===1?t.code:t.code+':'+n,code:t.code,tavern:t,number:n,mode:'1v1',survivalTeams:0,players:[],host,phase:'lobby',round:0,turn:0,order:[],startOffset:0,deck:[],discard:[],stake:5,log:[],winner:null,final:false,revealUntil:null,limitedUsed:{},teamScores:[0,0],teamNames:[...defaultTeamNames],teamsDrawn:false,revealWinners:[],roundResult:'',enabledExtras:[],marketPending:null,grimoirePending:null,ransomPending:null}}
function tableSummary(r){return {number:r.number,phase:r.phase,mode:r.mode,survivalTeams:survivalTeamCount(r),players:r.players.map(p=>({name:p.name,id:p.id,team:teamOf(r,p),bot:p.bot,ready:!!p.ready,online:p.bot||!!p.ws&&p.ws.readyState===WebSocket.OPEN})),capacity:isSurvival(r)?8:4,host:r.host,extensions:r.enabledExtras||[]}}
function resetLobbyReadiness(r){if(r.phase==='lobby')r.players.forEach(x=>{x.ready=!!x.bot})}
function allPlayers(t){return t.tables.flatMap(r=>r.players.filter(p=>!p.bot))}
function refreshHost(r){if(!r.players.some(p=>!p.bot&&p.id===r.host))r.host=r.players.find(p=>!p.bot)?.id||(r.players.length===0?r.creator:null)}

const roll=()=>crypto.randomInt(1,7),random=n=>crypto.randomInt(n);
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
const isAlive=p=>!p.eliminated&&p.lives!==0;
const alivePlayers=r=>r.players.filter(isAlive);
function rank(a){if(a.length!==3)return [0,0,0];const d=[...a].sort((x,y)=>x-y);if(d[0]===d[2])return [4,d[0],0];if(d[0]+1===d[1]&&d[1]+1===d[2])return [3,d[2],0];if(d[0]===d[1])return [2,d[0],d[2]];if(d[1]===d[2])return [2,d[1],d[0]];return [1,d.reduce((x,y)=>x+y,0),0]}
function cmp(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}
const teamOf=(r,p)=>isTeams(r)?Math.min(teamCount(r)-1,Math.floor(r.players.indexOf(p)/(r.mode==='2v2'?2:Math.max(1,Math.ceil(r.players.length/teamCount(r)))))):r.players.indexOf(p);
const cardName=k=>(defs[k]||extraDefs[k])?.name||k;
const teamName=(r,t)=>r.teamNames?.[t]||defaultTeamNames[t]||('Équipe '+(t+1));
function drawTeams(r){
 if(r.mode!=='2v2'&&(!isSurvival(r)||!isTeams(r)))throw Error('Les équipes ne sont pas activées.');
 if(r.mode==='2v2'&&r.players.length!==4)throw Error('Le 2v2 nécessite exactement quatre joueurs.');
 if(isSurvival(r)&&!validSurvivalSize(r))throw Error(survivalSizeError(r));
 const n=teamCount(r),size=r.players.length/n;
 // À chaque nouveau tirage, essayer de changer au moins un duo existant.
 const oldPartners=new Map();
 if(r.teamsDrawn)r.players.forEach((p,i)=>{oldPartners.set(p.id,r.players.filter((_,j)=>Math.floor(j/size)===Math.floor(i/size)&&j!==i).map(x=>x.id).sort().join('|'))});
 let next,tries=0;
 do{next=shuffle([...r.players]);tries++}while(r.teamsDrawn&&tries<80&&next.every((p,i)=>oldPartners.get(p.id)===next.filter((_,j)=>Math.floor(j/size)===Math.floor(i/size)&&j!==i).map(x=>x.id).sort().join('|')));
 r.players=next;r.teamsDrawn=true;r.teamDrawCount=(r.teamDrawCount||0)+1;
 log(r,`🎲 Tirage n°${r.teamDrawCount} : ${n} équipes de ${size} joueur${size>1?'s':''} (${Array.from({length:n},(_,i)=>teamName(r,i)).join(' · ')}).`);broadcast(r);
}
function validateTeamNames(names,r){const n=teamCount(r);if(!Array.isArray(names)||names.length!==n)throw Error('Il faut renseigner '+n+' noms d’équipe.');const clean=names.map((v,i)=>String(v??'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,24)||defaultTeamNames[i]);if(new Set(clean.map(x=>x.toLocaleLowerCase('fr'))).size!==clean.length)throw Error('Les équipes doivent avoir des noms différents.');return [...clean,...defaultTeamNames.slice(n)];}
const avatarIds=['crayon','couronne','epee','bouclier','crane','de','chope','flamme','loup','dragon','mage','cristal','cle','corbeau','lune','grenouille'];
function validIcon(value){return avatarIds.includes(value)?value:'crayon'}
const canTarget=(r,actor,p,ally)=>ally?teamOf(r,actor)===teamOf(r,p):teamOf(r,actor)!==teamOf(r,p);
const send=(ws,o)=>{if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o))};
function log(r,s){r.log.push(s);if(r.log.length>70)r.log.shift()}
function view(r,p){return {tavernHost:r.tavern.host,tableNo:r.number,tables:r.tavern.tables.map(tableSummary),leaderboard:topScores(),scoresPersistent:!!scoreDatabase,type:'state',room:r.code,phase:r.phase,mode:r.mode,survivalTeams:survivalTeamCount(r),host:r.host,me:p.id,players:r.players.map(x=>({id:x.id,name:x.name,bot:x.bot,lives:x.lives??2,eliminated:!!x.eliminated,attacksReceived:x.attacksReceived||0,online:x.bot||!!x.ws&&x.ws.readyState===WebSocket.OPEN,team:teamOf(r,x),score:x.score,dice:x.dice,diceOrigins:x.diceOrigins||[x.color,x.color,x.color],guard:x.guard,shieldedDice:x.shieldedDice||[],handCount:x.hand.length,acted:x.acted,blocked:!!x.blocked,crowMarked:!!x.crowMarked,bonusPending:!!x.bonusPending,secondChanceHold:!!x.secondChanceHold,ready:x.ready,roundReady:x.roundReady,color:x.color,background:x.background,icon:x.icon||'crayon'})),survivors:isSurvival(r)?alivePlayers(r).length:null,survivingTeams:isSurvival(r)&&isTeams(r)?Array.from({length:teamCount(r)},(_,t)=>alivePlayers(r).filter(p=>teamOf(r,p)===t).length):null,teamScores:r.teamScores,teamNames:r.teamNames,teamsDrawn:!!r.teamsDrawn,teamDrawCount:r.teamDrawCount||0,enabledExtras:r.enabledExtras||[],marketOwner:r.marketPending?.actorId||null,marketCount:r.marketPending?.pool.length||0,grimoireOwner:r.grimoirePending?.actorId||null,grimoireCount:r.grimoirePending?.pool.length||0,grimoireOptions:r.grimoirePending?.actorId===p.id?r.grimoirePending.pool.map((key,i)=>({index:i,key,name:cardName(key)})):[],ransomVictim:r.ransomPending?.victimId||null,ransomSource:r.ransomPending?.actorId||null,marketOptions:r.marketPending?.actorId===p.id?r.marketPending.pool.map((key,i)=>({index:i,key,name:cardName(key)})):[],hand:p.hand,round:r.round,turn:r.phase==='playing'?r.players[r.order[r.turn]]?.id:null,order:r.phase==='lobby'?[]:r.order.map(i=>r.players[i]?.id).filter(Boolean),pile:r.deck.length,discard:r.discard.length,stake:r.stake,log:r.log.slice(-18),winner:r.winner,final:r.final,revealUntil:r.revealUntil,limitedUsed:r.limitedUsed,revealWinners:r.revealWinners,roundResult:r.roundResult,actionEvent:r.actionEvent||null,statistics:r.phase==='over'?r.players.map(x=>({id:x.id,name:x.name,team:teamOf(r,x),cardsPlayed:x.cardsPlayed||0,roundWins:x.roundWins||0,bestCombination:x.bestCombination||0})):null,nextRoundAt:r.nextRoundAt};}
function broadcast(r){for(const table of r.tavern.tables)for(const p of table.players)if(!p.bot)send(p.ws,view(table,p))}
function deck(r){const extras=r?.enabledExtras||[];return shuffle([...Object.entries(defs),...extras.filter(k=>extraKeys.has(k)).map(k=>[k,extraDefs[k]])].flatMap(([k,v])=>Array(v.count).fill(k)))}
function refill(r,p){while(p.hand.length<3){if(!r.deck.length){r.deck=shuffle(r.discard.splice(0));if(!r.deck.length)break}p.hand.push(r.deck.pop())}}
function drawOne(r,p,limit=3){if(p.hand.length>=limit)return false;if(!r.deck.length){r.deck=shuffle(r.discard.splice(0));if(!r.deck.length)return false}p.hand.push(r.deck.pop());return true}
function orderFor(r){
 if(isSurvival(r)&&isTeams(r)){
  // Intercaler les camps, y compris après des éliminations inégales.
  const pools=shuffle(Array.from({length:teamCount(r)},(_,team)=>shuffle(r.players.map((p,i)=>teamOf(r,p)===team&&isAlive(p)?i:-1).filter(i=>i>=0)))).filter(g=>g.length);
  const order=[];while(pools.some(g=>g.length))for(const g of pools)if(g.length)order.push(g.shift());return order;
 }
 if(isSurvival(r))return shuffle(r.players.map((p,i)=>isAlive(p)?i:-1).filter(i=>i>=0));
 if(r.final){if(r.mode==='2v2'){const left=shuffle([0,1]),right=shuffle([2,3]);return random(2)?[left[0],right[0],left[1],right[1]]:[right[0],left[0],right[1],left[1]]}return shuffle(r.players.map((_,i)=>i))}
 const base=r.mode==='2v2'?[0,2,1,3]:r.players.map((_,i)=>i),offset=(r.startOffset+r.round-1)%base.length;
 return [...base.slice(offset),...base.slice(0,offset)]
}
function startRound(r){if(r.final){r.deck=deck(r);r.discard=[];r.players.forEach(p=>{p.hand=[];refill(r,p)});log(r,'⚔️ Manche décisive : nouveaux dés, nouvelles cartes et nouvel ordre tiré au sort !')}r.round++;r.phase='playing';r.order=orderFor(r);r.turn=0;r.revealUntil=null;r.revealWinners=[];r.roundResult='';r.nextRoundAt=null;r.limitedUsed={};r.players.forEach(p=>{p.dice=isAlive(p)?[roll(),roll(),roll()]:p.dice;p.diceOrigins=[p.color,p.color,p.color];p.attacksReceived=0;p.guard=false;p.shieldedDice=[];p.acted=false;p.roundReady=false;p.blocked=false;p.crowMarked=false;p.bonusPending=false;p.bonusUsed=false;p.secondChanceHold=false});r.marketPending=null;r.grimoirePending=null;r.ransomPending=null;log(r,`Manche ${r.round} : ${r.players[r.order[0]].name} commence.`);broadcast(r);scheduleBot(r)}
function restart(r){r.rankedRecorded=false;r.actionEvent=null;r.actionSerial=0;r.round=0;r.nextRoundAt=null;r.winner=null;r.final=false;r.teamScores=[0,0];r.log=[];r.deck=deck(r);r.discard=[];r.marketPending=null;r.grimoirePending=null;r.ransomPending=null;r.startOffset=random(r.players.length);r.players.forEach(p=>{p.lives=2;p.eliminated=false;p.shieldedDice=[];p.attacksReceived=0;p.score=0;p.cardsPlayed=0;p.roundWins=0;p.bestCombination=0;p.hand=[];p.ready=false;p.roundReady=false;p.secondChanceHold=false;refill(r,p)});log(r,'Nouvelle partie : premier joueur désigné au hasard.');startRound(r)}
function compareEntities(r){if(r.mode==='2v2'){return [0,1].map(t=>({id:t,rank:r.players.filter(p=>teamOf(r,p)===t).map(p=>rank(p.dice)).sort((a,b)=>cmp(b,a))[0]}))}return r.players.filter(p=>!isSurvival(r)||isAlive(p)).map(p=>({id:p.id,rank:rank(p.dice)}))}
function finishRound(r){
 if(r.phase!=='revealing')return;
 if(isSurvival(r)){finishSurvivalRound(r);return;}
 const entities=compareEntities(r);
 const best=entities.map(x=>x.rank).sort((a,b)=>cmp(b,a))[0];
 const winners=entities.filter(x=>cmp(x.rank,best)===0).map(x=>x.id);
 r.revealWinners=winners;
 const decisive=r.final;
 r.players.forEach(p=>{p.bestCombination=Math.max(p.bestCombination||0,rank(p.dice)[0]);if((r.mode==='2v2'?winners.includes(teamOf(r,p)):winners.includes(p.id)))p.roundWins=(p.roundWins||0)+1});
 // Dans une mort subite, une égalité relance intégralement la manche.
 const noCrown=decisive&&winners.length!==1;
 if(noCrown){r.roundResult='⚔️ Égalité en manche décisive ! Nouveau tirage pour départager les joueurs.'}
 else if(r.mode==='2v2'){
  winners.forEach(t=>r.teamScores[t]++);
  r.roundResult=winners.length===1?`${teamName(r,winners[0])} a remporté une couronne !`:`${teamName(r,0)} et ${teamName(r,1)} ont remporté une couronne chacun !`;
 }else{
  winners.forEach(id=>r.players.find(p=>p.id===id).score++);
  const names=winners.map(id=>r.players.find(p=>p.id===id).name);
  r.roundResult=names.length===1?`${names[0]} a remporté une couronne !`:`${names.slice(0,-1).join(', ')} et ${names.at(-1)} ont remporté une couronne chacun !`;
 }
 if(winners.length===1&&!noCrown){
  const showCombo=rr=>rr[0]===4?'un brelan de '+rr[1]:rr[0]===3?'une suite jusqu’à '+rr[1]:rr[0]===2?'une paire de '+rr[1]:'un total de '+rr[1];
  r.roundResult+=' Meilleure combinaison : '+showCombo(best)+'.';
 }
 log(r,r.roundResult);
 const scores=r.mode==='2v2'?r.teamScores:r.players.map(p=>p.score);
 const ordered=[...scores].sort((a,b)=>b-a),high=ordered[0],runnerUp=ordered[1]??0;
 const leaders=scores.map((v,i)=>v===high?i:-1).filter(i=>i>=0);
 // Une victoire en temps normal exige trois couronnes et deux d'avance.
 // À 5–5 (ou égalité en tête à 5+ en mêlée), une mort subite commence.
 const completed=(decisive&&winners.length===1)||(!decisive&&high>=3&&leaders.length===1&&high-runnerUp>=2);
 if(completed){
  const champion=decisive?(r.mode==='2v2'?winners[0]:r.players.findIndex(p=>p.id===winners[0])):leaders[0];
  r.winner=r.mode==='2v2'?champion:r.players[champion].id;
  log(r,`🏆 ${r.mode==='2v2'?teamName(r,r.winner):r.players[champion].name} remporte ${r.final?'la mort subite':'la partie'} avec ${high} couronne(s) et gagne ${r.stake*r.players.length} PO fictives.`);
  registerWin(r);
 }else{
  if(!r.final&&high>=5&&leaders.length>=2){r.final=true;log(r,'⚔️ Égalité à cinq couronnes : la prochaine manche sera décisive !')}
  if(!r.final)r.players.forEach(p=>drawOne(r,p));
 }
 r.revealUntil=Date.now()+REVEAL_MS;
 broadcast(r);
 setTimeout(()=>{
  if(r.phase!=='revealing')return;
  if(completed){r.phase='over';r.revealUntil=null;r.players.forEach(p=>{if(p.bot)p.ready=true});broadcast(r)}
  else startRound(r);
 },REVEAL_MS);
}

// Mode Survie : les moins bonnes combinaisons perdent une vie.
// En cas d'égalité qui éliminerait tous les survivants, manche de départage sans perte de vie.
function finishSurvivalRound(r){
 const survivors=alivePlayers(r);
 if(!survivors.length)return;
 survivors.forEach(p=>p.bestCombination=Math.max(p.bestCombination||0,rank(p.dice)[0]));
 const worst=survivors.map(p=>rank(p.dice)).sort(cmp)[0];
 const losers=survivors.filter(p=>cmp(rank(p.dice),worst)===0);
 const describe=d=>{const v=[...d].sort((a,b)=>a-b);if(v[0]===v[2])return 'un brelan de '+v[0];if(v[0]+1===v[1]&&v[1]+1===v[2])return 'une suite '+v.join('–');if(v[0]===v[1]||v[1]===v[2])return 'une paire de '+v[1];return 'un total de '+v.reduce((x,y)=>x+y,0)};
 r.revealWinners=survivors.filter(p=>!losers.includes(p)).map(p=>p.id);
 const totalWipe=losers.length===survivors.length&&survivors.every(p=>p.lives===1);
 if(totalWipe){r.roundResult='⚔️ Tous les derniers survivants sont à égalité ! Nouvelle manche de départage, sans perte de vie.';}
 else{
  losers.forEach(p=>{p.lives=Math.max(0,p.lives-1);if(p.lives===0)p.eliminated=true});
  const names=losers.map(p=>p.name).join(', ');
  r.roundResult=`💔 ${losers.map(p=>p.name+' ('+describe(p.dice)+')').join(', ')} ${losers.length>1?'perdent':'perd'} une vie !`;
  const eliminated=losers.filter(p=>p.eliminated);
  if(eliminated.length)r.roundResult+=' 💀 Éliminé(s) : '+eliminated.map(p=>p.name).join(', ')+'.';
 }
 const alive=alivePlayers(r);
 const activeTeams=new Set(alive.map(p=>teamOf(r,p)));
 const completed=isTeams(r)?activeTeams.size===1:alive.length===1;
 if(completed){
  const champion=alive[0];r.winner=isTeams(r)?teamOf(r,champion):champion.id;
  r.roundResult+=isTeams(r)?' 🏆 '+teamName(r,r.winner)+' remporte la Survie par équipes !':' 🏆 '+champion.name+' est le dernier survivant !';
  alive.filter(p=>!isTeams(r)||teamOf(r,p)===r.winner).forEach(p=>{p.roundWins=(p.roundWins||0)+1});registerWin(r);
 }else{
  alive.forEach(p=>drawOne(r,p));
 }
 log(r,r.roundResult);r.revealUntil=Date.now()+REVEAL_MS;broadcast(r);
 setTimeout(()=>{if(r.phase!=='revealing')return;if(completed){r.phase='over';r.revealUntil=null;r.players.filter(p=>p.bot).forEach(p=>p.ready=true);broadcast(r)}else startRound(r)},REVEAL_MS);
}
function revealRound(r){
 r.phase='revealing';
 finishRound(r);
}
function advance(r,delay=TURN_DELAY_MS){if(r.phase!=='playing')return;r.phase='transition';log(r,delay===TURN_DELAY_MS?'La carte jouée et ses effets restent visibles.':'Le joueur passe son tour.');broadcast(r);setTimeout(()=>{if(r.phase!=='transition')return;if(r.players.every(p=>p.acted||isSurvival(r)&&!isAlive(p))){revealRound(r);return}r.turn++;while(r.turn<r.order.length&&(r.players[r.order[r.turn]].acted||isSurvival(r)&&!isAlive(r.players[r.order[r.turn]])))r.turn++;if(r.turn>=r.order.length){revealRound(r);return}r.phase='playing';broadcast(r);const current=r.players[r.order[r.turn]];if(current?.blocked){setTimeout(()=>{if(r.phase==='playing'&&r.players[r.order[r.turn]]===current&&current.blocked){current.blocked=false;current.acted=true;log(r,`🐦‍⬛ ${current.name} est privé de carte par le Corbeau de Malchance.`);r.actionEvent={id:++r.actionSerial,card:'corbeau-bloque',cardName:'Tour bloqué',playerName:current.name,targetName:current.name,targetId:current.id,oldDice:[],newDice:[],rerolls:[]};advance(r,1250)}},1200)}else scheduleBot(r)},delay)}
function validateIndex(v){return Number.isInteger(v)&&v>=0&&v<=2}
function act(r,p,msg){if(r.phase!=='playing'||r.players[r.order[r.turn]]!==p||p.acted||isSurvival(r)&&!isAlive(p))throw Error('Ce n’est pas ton tour.');if(p.blocked&&msg.kind!=='pass')throw Error('Le Corbeau empêche de jouer une carte.');if(msg.kind==='pass'){if(p.secondChanceHold&&p.hand.length>3){if(!Number.isInteger(msg.discardIndex)||msg.discardIndex<0||msg.discardIndex>=p.hand.length)throw Error('Ta main contient 4 cartes : choisis celle à défausser si tu passes.');const removed=p.hand.splice(msg.discardIndex,1)[0];r.discard.push(removed);log(r,`${p.name} renonce à son action supplémentaire et défausse une carte.`)}p.secondChanceHold=false;p.bonusPending=false;p.acted=true;r.actionEvent=null;log(r,`${p.name} passe.`);advance(r,850);return}if(msg.kind!=='card')throw Error('Action inconnue.');const idx=msg.cardIndex;if(!Number.isInteger(idx)||idx<0||idx>=p.hand.length)throw Error('Carte invalide.');const k=p.hand[idx],own=msg.own,other=msg.other,source=msg.source,destination=msg.destination;
 const allyActions=['potion','epee','calice','dague','couronne','joker','miroir','benediction','barriere','petitbouclier'];const enemyActions=['crane','corbeau','voleur','usurpation','rancon'];const flexible=['bouclier','malediction'].includes(k);const ally=allyActions.includes(k),enemy=enemyActions.includes(k),exchange=k==='echange';
 const target=r.players.find(x=>x.id===msg.target);if(isSurvival(r)&&target&&!isAlive(target))throw Error('Ce joueur est éliminé.');if((ally||enemy||exchange||flexible)&&(!target||( !flexible&&!canTarget(r,p,target,ally))))throw Error('Cible non autorisée.');if(k==='voleur'&&!target.hand.length)throw Error('Cet adversaire n’a plus de carte à brûler.');if(k==='corbeau'&&target.acted)throw Error('Le Corbeau ne peut viser qu’un joueur qui n’a pas encore joué.');if(p.blocked)throw Error('Le Corbeau t’empêche de jouer une carte.');
 if((ally||enemy||flexible)&&!['barriere','benediction','corbeau','voleur','usurpation','rancon'].includes(k)&&!validateIndex(own))throw Error('Choisis un dé valide.');if(exchange&&(!validateIndex(own)||!validateIndex(other)))throw Error('Choisis les deux dés.');
 if(k==='bouclier'&&(!validateIndex(msg.secondIndex)||!r.players.some(x=>x.id===msg.secondTarget&&(!isSurvival(r)||isAlive(x)))|| (msg.secondTarget===msg.target&&msg.secondIndex===own)))throw Error('La Baguette doit relancer deux dés distincts.');
 if(k==='miroir'&&(!validateIndex(source)||source===own))throw Error('Choisis deux dés différents.');
 if(k==='benediction'&&(!validateIndex(own)||!validateIndex(destination)||own===destination))throw Error('Choisis deux dés différents.');
 if(k==='joker'&&(!Number.isInteger(msg.value)||msg.value<1||msg.value>6))throw Error('Valeur Joker invalide.');
 if(k==='potion'&&target!==p)throw Error('La Potion instable ne peut viser que tes dés.');
 if(k==='petitbouclier'&&target?.shieldedDice?.includes(own))throw Error('Ce dé possède déjà un Bouclier.');
 // Seconde Chance pioche deux cartes. Une quatrième carte est tolérée uniquement le temps du choix de rejouer ou passer.


 if(target?.guard&&(enemy||exchange||flexible&& !canTarget(r,p,target,true)))throw Error('Cette cible est protégée par une Barrière magique.');
 if(k==='bouclier'){const second=r.players.find(x=>x.id===msg.secondTarget);if(second.guard&&!canTarget(r,p,second,true))throw Error('Le deuxième dé est protégé par une Barrière magique.');if(!canTarget(r,p,second,true)&&second.shieldedDice?.includes(msg.secondIndex))throw Error('Ce dé est protégé par un Bouclier.');}
 // Un Bouclier protège UN dé des cartes hostiles ciblées (pas des effets globaux).
 if(target&&!canTarget(r,p,target,true)){
  const blocked=target.shieldedDice||[];
  if(['crane','malediction','bouclier'].includes(k)&&blocked.includes(own)||k==='echange'&&blocked.includes(other)||k==='usurpation'&&blocked.length)throw Error('Ce dé adverse est protégé par un Bouclier.');
 }
 if(limited.has(k)){const scope=isTeams(r)?String(teamOf(r,p)):'table';if(r.limitedUsed[scope]?.includes(k))throw Error(`${defs[k].name} a déjà été jouée pour cette ${isTeams(r)?'équipe':'table'} durant la manche.`)}
 const oldDice=r.players.map(q=>({id:q.id,dice:[...q.dice],diceOrigins:[...(q.diceOrigins||[q.color,q.color,q.color])]}));const a=target?.dice;const rerolls=[];
 if(k==='epee')a[own]=Math.min(6,a[own]+2);if(k==='bouclier'){const second=r.players.find(x=>x.id===msg.secondTarget);a[own]=roll();second.dice[msg.secondIndex]=roll();rerolls.push({id:target.id,index:own},{id:second.id,index:msg.secondIndex})}if(k==='calice')a[own]=1;if(k==='dague')a[own]=Math.max(1,a[own]-2);if(k==='couronne')a[own]=6;if(k==='joker')a[own]=msg.value;
 if(k==='miroir')a[own]=a[source];if(k==='benediction'){a[own]=Math.min(6,a[own]+1);a[destination]=Math.min(6,a[destination]+1)}
 if(k==='barriere')target.guard=true;if(k==='petitbouclier'){target.shieldedDice||=[];target.shieldedDice.push(own);}
 if(k==='crane')a[own]=Math.max(1,a[own]-2);if(k==='malediction'){a[own]=roll();rerolls.push({id:target.id,index:own})}
 if(k==='corbeau'){target.blocked=true;target.crowMarked=true;}
 if(k==='gambling')p.dice.forEach((_,i)=>{p.dice[i]=roll();rerolls.push({id:p.id,index:i})});
 if(k==='chaos')r.players.filter(q=>!isSurvival(r)||isAlive(q)).forEach(q=>{const i=random(3);q.dice[i]=roll();rerolls.push({id:q.id,index:i})});
 if(k==='potion')a[own]=random(2)?6:1;
 if(k==='voleur'){const stolen=target.hand.splice(random(target.hand.length),1)[0];r.discard.push(stolen)}
 if(k==='trounoir')r.players.filter(q=>!isSurvival(r)||isAlive(q)).forEach(q=>q.dice.forEach((_,i)=>{q.dice[i]=roll();rerolls.push({id:q.id,index:i})}));
 let transfers=[];
 if(k==='tornade'){const active=r.order.map(i=>r.players[i]).filter(q=>q&&(!isSurvival(r)||isAlive(q)));const snapshots=active.map(q=>{const i=random(3);return {player:q,index:i,value:q.dice[i],color:q.diceOrigins?.[i]||q.color}});snapshots.forEach((entry,i)=>{const receiver=snapshots[(i+1)%snapshots.length];receiver.player.dice[receiver.index]=entry.value;receiver.player.diceOrigins||=[receiver.player.color,receiver.player.color,receiver.player.color];receiver.player.diceOrigins[receiver.index]=entry.color;transfers.push({fromId:entry.player.id,fromIndex:entry.index,toId:receiver.player.id,toIndex:receiver.index});})}
 if(k==='usurpation'){for(let i=0;i<3;i++){[p.dice[i],target.dice[i]]=[target.dice[i],p.dice[i]];p.diceOrigins||=[p.color,p.color,p.color];target.diceOrigins||=[target.color,target.color,target.color];[p.diceOrigins[i],target.diceOrigins[i]]=[target.diceOrigins[i],p.diceOrigins[i]]}}
 let catastropheTargets=[];
 if(k==='catastrophe'){const active=r.players.filter(q=>!isSurvival(r)||isAlive(q)),max=active.map(q=>rank(q.dice)).sort((x,y)=>cmp(y,x))[0];active.filter(q=>cmp(rank(q.dice),max)===0).forEach(q=>{const index=random(3);q.dice[index]=1;catastropheTargets.push({id:q.id,index})})}
 
 
 // Anti-acharnement : les deux premières attaques passent ; ensuite bouclier jusqu'à la manche suivante.
 if(isSurvival(r)){
  const attacked=new Set();
  if(['crane','malediction','corbeau','echange','bouclier','voleur','usurpation','rancon'].includes(k)&&target&&target!==p&&!canTarget(r,p,target,true))attacked.add(target);
  if(k==='bouclier'){
   const second=r.players.find(x=>x.id===msg.secondTarget);
   if(second&&second!==p&&!canTarget(r,p,second,true))attacked.add(second);
  }
  attacked.forEach(v=>{v.attacksReceived=(v.attacksReceived||0)+1;if(v.attacksReceived>=2){v.guard=true;log(r,`🛡️ ${v.name} reçoit le Bouclier anti-acharnement après deux attaques.`)}});
 }
 if(exchange){const mine=p.dice;[mine[own],a[other]]=[a[other],mine[own]];p.diceOrigins||=[p.color,p.color,p.color];target.diceOrigins||=[target.color,target.color,target.color];[p.diceOrigins[own],target.diceOrigins[other]]=[target.diceOrigins[other],p.diceOrigins[own]]}
 if(limited.has(k)){const scope=isTeams(r)?String(teamOf(r,p)):'table';r.limitedUsed[scope]??=[];r.limitedUsed[scope].push(k)}
 p.hand.splice(idx,1);
 if(k==='grimoire'){
  const pool=[];
  for(let n=0;n<3;n++){
   if(!r.deck.length){r.deck=shuffle(r.discard.splice(0));if(!r.deck.length)break;}
   pool.push(r.deck.pop());
  }
  if(pool.length)r.grimoirePending={actorId:p.id,pool};
 }
 if(k==='rancon')r.ransomPending={actorId:p.id,victimId:target.id};
 if(k==='marche'){const pool=[];for(const q of r.players.filter(x=>!isSurvival(r)||isAlive(x))){if(q.hand.length)pool.push(q.hand.splice(random(q.hand.length),1)[0])}r.marketPending={actorId:p.id,pool}}if(k==='pioche')drawOne(r,p);if(k==='secondechance'){const maxHand=p.bonusUsed?3:4;drawOne(r,p,maxHand);drawOne(r,p,maxHand)}p.cardsPlayed=(p.cardsPlayed||0)+1;const extra=['pioche','gambling','secondechance'].includes(k)&&!p.bonusUsed&&p.hand.length>0;if(['pioche','gambling','secondechance'].includes(k))p.bonusUsed=true;p.secondChanceHold=k==='secondechance'&&extra;r.actionEvent={id:++r.actionSerial,playerId:p.id,targetId:target?.id||p.id,card:k,cardName:cardName(k),playerName:p.name,targetName:target?.name||p.name,oldDice,rerolls,targets:k==='bouclier'?[{id:target.id,index:own},{id:msg.secondTarget,index:msg.secondIndex}]:exchange?[{id:p.id,index:own},{id:target.id,index:other}]:k==='benediction'?[{id:target.id,index:own},{id:target.id,index:destination}]:k==='barriere'||k==='corbeau'||k==='rancon'?[{id:target.id,index:null}]:k==='gambling'?p.dice.map((_,i)=>({id:p.id,index:i})):k==='chaos'||k==='trounoir'?rerolls:k==='tornade'?transfers.map(x=>({id:x.toId,index:x.toIndex})):k==='catastrophe'?catastropheTargets:k==='usurpation'?[...p.dice.map((_,i)=>({id:p.id,index:i})),...target.dice.map((_,i)=>({id:target.id,index:i}))]:['voleur','marche'].includes(k)?[{id:target?.id||p.id,index:null}]:[{id:target?.id||p.id,index:Number.isInteger(own)?own:null}],transfers,newDice:r.players.map(q=>({id:q.id,dice:[...q.dice],diceOrigins:[...(q.diceOrigins||[q.color,q.color,q.color])]}))};r.discard.push(k);p.acted=!extra;p.bonusPending=extra;log(r,`${p.name} joue ${cardName(k)}${target&&target!==p?' sur '+target.name:''}.${extra?' Il peut jouer une seconde carte.':''}`);if(k==='marche'&&r.marketPending.pool.length){r.phase='market';broadcast(r);if(p.bot)setTimeout(()=>{if(r.phase==='market'&&r.marketPending?.actorId===p.id)resolveMarket(r,p,botMarketPick(r.marketPending.pool))},3100);return}
 if(k==='marche'){r.marketPending=null;}
 if(k==='grimoire'&&r.grimoirePending){r.phase='grimoire';broadcast(r);if(p.bot)setTimeout(()=>{if(r.phase==='grimoire'&&r.grimoirePending?.actorId===p.id)resolveGrimoire(r,p,botGrimoirePick(r.grimoirePending.pool),p.hand.length>=3?0:null)},1900);return;}
 if(k==='rancon'){r.phase='ransom';broadcast(r);if(target.bot)setTimeout(()=>{if(r.phase==='ransom'&&r.ransomPending?.victimId===target.id)resolveRansom(r,target,target.hand.length>=3?'discard':'reroll',target.hand.length>=3?0:null)},2300);return;}
 if(extra){r.phase='transition';broadcast(r);setTimeout(()=>{if(r.phase!=='transition')return;r.phase='playing';broadcast(r);scheduleBot(r)},TURN_DELAY_MS)}else advance(r)
}
function botMarketPick(pool){const premium=['couronne','joker','usurpation','trounoir','epee','bouclier','secondechance','pioche'];const options=pool.map((key,i)=>({i,score:premium.includes(key)?premium.length-premium.indexOf(key):Math.random()*2}));return options.sort((a,b)=>b.score-a.score)[0]?.i??0}
function resolveMarket(r,p,index){
 if(r.phase!=='market'||r.marketPending?.actorId!==p.id)throw Error('Aucun marché en cours pour toi.');
 const pool=r.marketPending.pool;if(!Number.isInteger(index)||index<0||index>=pool.length)throw Error('Choisis une carte du Marché des Ombres.');
 if(p.hand.length>=3)throw Error('Ta main est pleine.');
 const [chosen]=pool.splice(index,1);p.hand.push(chosen);r.deck=shuffle([...r.deck,...pool]);r.marketPending=null;
 log(r,`${p.name} récupère une carte du Marché des Ombres. Les autres retournent dans la pioche.`);
 r.phase='playing';advance(r);
}

function botGrimoirePick(pool){const premium=['joker','couronne','secondechance','usurpation','trounoir','barriere','petitbouclier','epee','pioche'];return pool.map((key,i)=>({i,score:premium.includes(key)?premium.length-premium.indexOf(key):0})).sort((a,b)=>b.score-a.score)[0]?.i??0}
function resolveGrimoire(r,p,index,discardIndex){
 if(r.phase!=='grimoire'||r.grimoirePending?.actorId!==p.id)throw Error('Tu ne peux pas choisir dans ce Grimoire.');
 const pool=r.grimoirePending.pool;
 if(!Number.isInteger(index)||index<0||index>=pool.length)throw Error('Choisis une carte du Grimoire interdit.');
 if(p.hand.length>=3&&(!Number.isInteger(discardIndex)||discardIndex<0||discardIndex>=p.hand.length))throw Error('Main pleine : choisis une carte à remplacer.');
 const [chosen]=pool.splice(index,1);
 if(p.hand.length>=3)r.discard.push(p.hand.splice(discardIndex,1)[0]);
 p.hand.push(chosen);
 r.deck.unshift(...pool.reverse()); // Les cartes non conservées vont sous le paquet.
 r.grimoirePending=null;log(r,`${p.name} conserve secrètement une carte du Grimoire interdit.`);
 r.phase='playing';advance(r);
}
function resolveRansom(r,p,choice,discardIndex){
 if(r.phase!=='ransom'||r.ransomPending?.victimId!==p.id)throw Error('Cette Rançon ne t’est pas destinée.');
 if(choice!=='discard'&&choice!=='reroll')throw Error('Choisis ton sacrifice.');
 if(choice==='discard'){
  if(p.hand.length<3)throw Error('Tes deux dernières cartes sont protégées : relance ton meilleur dé.');
  if(!Number.isInteger(discardIndex)||discardIndex<0||discardIndex>=p.hand.length)throw Error('Choisis la carte à défausser.');
  r.discard.push(p.hand.splice(discardIndex,1)[0]);log(r,`${p.name} paie la Rançon en sacrifiant une carte.`);
 }else{
  const oldDice=r.players.map(q=>({id:q.id,dice:[...q.dice]}));
  const max=Math.max(...p.dice),index=p.dice.indexOf(max);p.dice[index]=roll();
  r.actionEvent={id:++r.actionSerial,card:'rancon',cardName:'Rançon · dé relancé',playerId:r.ransomPending.actorId,targetId:p.id,playerName:p.name,targetName:p.name,oldDice,rerolls:[{id:p.id,index}],targets:[{id:p.id,index}],newDice:r.players.map(q=>({id:q.id,dice:[...q.dice]}))};
  log(r,`${p.name} refuse de payer : son meilleur dé est relancé.`);
 }
 r.ransomPending=null;r.phase='playing';advance(r);
}
function startIfReady(r){if(r.phase==='over'&&r.players.every(p=>p.ready&&(p.bot||p.ws?.readyState===WebSocket.OPEN)))restart(r);else broadcast(r)}
function botMoves(r,p){const active=r.players.filter(x=>!isSurvival(r)||isAlive(x));const allies=active.filter(x=>canTarget(r,p,x,true));const enemies=active.filter(x=>canTarget(r,p,x,false));const moves=[{kind:'pass'}];for(let i=0;i<p.hand.length;i++){const k=p.hand[i],scope=isTeams(r)?String(teamOf(r,p)):'table';if(limited.has(k)&&r.limitedUsed[scope]?.includes(k))continue;const add=o=>moves.push({kind:'card',cardIndex:i,...o});
 if(['potion','epee','calice','dague','couronne','joker','miroir','benediction','barriere','petitbouclier'].includes(k))for(const t of allies){if(k==='potion'&&t!==p)continue;if(k==='barriere'){add({target:t.id});continue}if(k==='benediction'){for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)add({target:t.id,own:a,destination:b});continue}for(let a=0;a<3;a++){if(k==='petitbouclier'&&t.shieldedDice?.includes(a))continue;if(k==='joker'){for(let v=1;v<=6;v++)add({target:t.id,own:a,value:v})}else if(k==='miroir'){for(let b=0;b<3;b++)if(b!==a)add({target:t.id,own:a,source:b})}else add({target:t.id,own:a})}}
 if(['voleur','usurpation','rancon'].includes(k))for(const t of enemies)if(!t.guard&&(k!=='voleur'||t.hand.length>=1)&& (k!=='usurpation'||!(t.shieldedDice||[]).length))add({target:t.id});
 if(k==='corbeau')for(const t of enemies)if(!t.acted&&!t.guard)add({target:t.id});
 if(['pioche','gambling','chaos','trounoir','tornade','catastrophe','marche','grimoire'].includes(k))add({});if(k==='secondechance')add({});
 if(['crane'].includes(k))for(const t of enemies)if(!t.guard)for(let a=0;a<3;a++)if(!t.shieldedDice?.includes(a))add({target:t.id,own:a});
 if(k==='malediction')for(const t of active)if(!t.guard||canTarget(r,p,t,true))for(let a=0;a<3;a++)if(canTarget(r,p,t,true)||!t.shieldedDice?.includes(a))add({target:t.id,own:a});
 if(k==='bouclier'){const targets=active.filter(t=>!t.guard||canTarget(r,p,t,true));for(let i=0;i<targets.length;i++)for(let j=i;j<targets.length;j++)for(let a=0;a<3;a++)for(let b=0;b<3;b++){if(i===j&&a>=b)continue;if(!canTarget(r,p,targets[i],true)&&targets[i].shieldedDice?.includes(a))continue;if(!canTarget(r,p,targets[j],true)&&targets[j].shieldedDice?.includes(b))continue;add({target:targets[i].id,own:a,secondTarget:targets[j].id,secondIndex:b})}}
 if(k==='echange')for(const t of enemies)if(!t.guard)for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(!t.shieldedDice?.includes(b))add({target:t.id,own:a,other:b})}
 return moves}
function utility(r,p){if(r.mode==='2v2'){const v=compareEntities(r),own=v[teamOf(r,p)].rank,other=v[1-teamOf(r,p)].rank;return 500*Math.sign(cmp(own,other)) +own[0]*80+own[1]*4-other[0]*80-other[1]*4}const me=rank(p.dice),op=r.players.filter(x=>x!==p&&(!isSurvival(r)||isAlive(x))).map(x=>rank(x.dice)).sort((a,b)=>cmp(b,a))[0];if(isSurvival(r)){const ranks=alivePlayers(r).map(x=>rank(x.dice)).sort(cmp),low=ranks[0];return 400*Math.sign(cmp(me,low))+me[0]*80+me[1]*4}return 500*Math.sign(cmp(me,op))+me[0]*80+me[1]*4-op[0]*80-op[1]*4}
function chooseBot(r,p){const possibilities=botMoves(r,p);if(p.secondChanceHold&&p.hand.length>3&&possibilities[0]?.kind==='pass')possibilities[0]={kind:'pass',discardIndex:0};const moves=isSurvival(r)&&possibilities.length>100?[possibilities[0],...shuffle(possibilities.slice(1)).slice(0,99)]:possibilities;let best=moves[0],bestScore=utility(r,p);for(const m of moves.slice(1)){const snapshots=r.players.map(x=>({x,d:[...x.dice],guard:x.guard,blocked:x.blocked}));const t=r.players.find(x=>x.id===m.target),k=p.hand[m.cardIndex];let score=0;const a=t?.dice;if(k==='epee')a[m.own]=Math.min(6,a[m.own]+2);if(k==='calice')a[m.own]=1;if(k==='dague')a[m.own]=Math.max(1,a[m.own]-2);if(k==='couronne')a[m.own]=6;if(k==='joker')a[m.own]=m.value;if(k==='miroir')a[m.own]=a[m.source];if(k==='benediction'){a[m.own]=Math.min(6,a[m.own]+1);a[m.destination]=Math.min(6,a[m.destination]+1)}if(k==='barriere')t.guard=true;if(k==='corbeau')t.blocked=true;if(k==='gambling')p.dice=p.dice.map(()=>roll());if(k==='chaos')r.players.forEach(q=>q.dice[random(3)]=roll());if(k==='crane')a[m.own]=Math.max(1,a[m.own]-2);if(k==='echange')[p.dice[m.own],a[m.other]]=[a[m.other],p.dice[m.own]];
 if(k==='bouclier'){const other=r.players.find(x=>x.id===m.secondTarget);const d=other.dice;let sum=0;const v0=a[m.own],v1=d[m.secondIndex];for(let v=1;v<=6;v++)for(let w=1;w<=6;w++){a[m.own]=v;d[m.secondIndex]=w;sum+=utility(r,p)}a[m.own]=v0;d[m.secondIndex]=v1;score=sum/36}else if(k==='malediction'){let sum=0;for(let v=1;v<=6;v++){const original=a[m.own];a[m.own]=v;sum+=utility(r,p);a[m.own]=original}score=sum/6}else score=utility(r,p);
 if(k==='potion'){const original=a[m.own];a[m.own]=1;const lo=utility(r,p);a[m.own]=6;const hi=utility(r,p);a[m.own]=original;score=(lo+hi)/2}
 if(k==='petitbouclier')score+=30;if(k==='rancon')score+=70;if(k==='grimoire')score+=90;if(k==='voleur')score+=80;if(k==='usurpation'){const oldMine=[...p.dice],oldThem=[...t.dice];p.dice=[...oldThem];t.dice=[...oldMine];score=utility(r,p);p.dice=oldMine;t.dice=oldThem}
 if(k==='trounoir')score+=35;if(k==='tornade')score+=30;if(k==='catastrophe')score+=55;if(k==='marche')score+=90;if(k==='secondechance')score+=95;
 if(k==='corbeau')score+=(!t.acted?125:0);if(k==='pioche')score+=85;if(k==='gambling')score+=35;if(k==='chaos')score+=20;
 if(k==='barriere')score+=(r.players.some(x=>!x.acted&&canTarget(r,p,x,false))&&cmp(rank(t.dice),compareEntities(r).map(x=>x.rank).sort((a,b)=>cmp(b,a))[0])===0)?35:0;
 snapshots.forEach(({x,d,guard,blocked})=>{x.dice=d;x.guard=guard;x.blocked=blocked});score-=12;if(score>bestScore+0.01){bestScore=score;best=m}}
 return best}
function scheduleBot(r){if(r.phase!=='playing')return;const p=r.players[r.order[r.turn]];if(!p?.bot)return;setTimeout(()=>{if(r.phase!=='playing'||r.players[r.order[r.turn]]!==p||p.acted)return;let m;try{m=chooseBot(r,p);act(r,p,m)}catch(e){console.error('Bot action:',e);try{act(r,p,{kind:'pass'})}catch{}}},BOT_DELAY_MS)}
function resetTableToLobby(r){
 r.phase='lobby';r.teamsDrawn=true;r.winner=null;r.final=false;r.round=0;r.revealUntil=null;
 r.revealWinners=[];r.roundResult='';r.nextRoundAt=null;r.teamScores=[0,0];r.limitedUsed={};
 r.deck=[];r.discard=[];r.marketPending=null;r.grimoirePending=null;r.ransomPending=null;r.log=[];r.order=[];r.turn=0;r.startOffset=0;
 r.players.forEach(x=>{x.lives=2;x.eliminated=false;x.attacksReceived=0;x.score=0;x.dice=[];x.diceOrigins=[];x.hand=[];x.guard=false;x.acted=false;x.blocked=false;x.crowMarked=false;x.bonusPending=false;x.bonusUsed=false;x.secondChanceHold=false;x.ready=x.bot;x.roundReady=false});
 log(r,'Retour au salon : la table est prête pour une nouvelle partie.');
}
function join(ws,msg){
 const code=String(msg.room||'').trim().toUpperCase(),id=String(msg.id||''),name=String(msg.name||'Aventurier').trim().slice(0,24).replace(/[<>]/g,'')||'Aventurier',icon=validIcon(msg.icon);
 if(!/^[A-F0-9]{24}$/i.test(id))throw Error('Identifiant de joueur invalide.');
 if(code&&!/^[A-F0-9]{6}$/.test(code))throw Error('Code du salon invalide.');
 let t=taverns.get(code);
 if(!t){if(code)throw Error('Taverne introuvable (serveur redémarré ?).');let c;do{c=crypto.randomBytes(3).toString('hex').toUpperCase()}while(taverns.has(c));t={code:c,host:id,tables:[]};const first=newTable(t,1,id);t.tables.push(first);taverns.set(c,t);rooms.set(first.key,first)}
 let r=t.tables.find(r=>r.players.some(p=>p.id===id));
 let p=r?.players.find(p=>p.id===id);
 if(!p){
  // Une invitation rejoint la première table disponible. Les autres tables restent visibles.
  r=t.tables.find(x=>x.phase==='lobby'&&x.players.length<modes[x.mode]);
  if(!r)throw Error('Toutes les tables sont occupées ou en partie. Demande à l’organisateur d’ajouter une table.');
  if(allPlayers(t).some(x=>x.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr')))throw Error('Ce pseudo est déjà utilisé dans cette taverne.');
  p={id,name,icon,color:diceColors[r.players.length%4],background:'uni',bot:false,ws:null,score:0,dice:[],guard:false,hand:[],acted:false,ready:false,roundReady:false};
  r.players.push(p);r.teamsDrawn=false;refreshHost(r);log(r,`${name} rejoint la table ${r.number}.`)
 }else{
  if(p.bot)throw Error('Impossible de reprendre la place d’un bot.');
  if(allPlayers(t).some(x=>x!==p&&x.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr')))throw Error('Ce pseudo est déjà utilisé.');
  p.name=name;p.icon=icon;updateName(p);
  if(p.ws&&p.ws!==ws)try{p.ws.close()}catch{}
 }
 p.ws=ws;ws.room=r.key;ws.pid=id;broadcast(r)
}
function handle(ws,msg){if(!msg||typeof msg!=='object')return;try{if(msg.type==='join'){join(ws,msg);return}const r=rooms.get(ws.room);if(!r)throw Error('Salon introuvable.');const p=r.players.find(x=>x.id===ws.pid);if(!p||p.ws!==ws||p.bot)throw Error('Connexion invalide.');
 if(msg.type==='createTable'){
  if(r.tavern.host!==p.id||r.phase!=='lobby')throw Error('Seul l’organisateur peut ajouter une table depuis le salon.');
  const t=r.tavern;if(t.tables.length>=4)throw Error('La taverne possède déjà quatre tables.');
  const nextNumber=[1,2,3,4].find(n=>!t.tables.some(table=>table.number===n));const next=newTable(t,nextNumber,p.id);t.tables.push(next);t.tables.sort((a,b)=>a.number-b.number);rooms.set(next.key,next);
  // Le créateur s'installe automatiquement à sa nouvelle table et en devient maître.
  r.players=r.players.filter(q=>q!==p);r.teamsDrawn=false;r.order=[];refreshHost(r);resetLobbyReadiness(r);
  p.score=0;p.dice=[];p.hand=[];p.ready=false;p.roundReady=false;
  next.players.push(p);next.host=p.id;ws.room=next.key;
  log(next,p.name+' crée la table '+next.number+' et en devient le maître.');broadcast(next);return
 }
 if(msg.type==='closeTable'){
  const t=r.tavern;
  if(t.host!==p.id||r.phase!=='lobby')throw Error('Seul l’organisateur peut fermer une table depuis le salon.');
  const number=Number(msg.table),target=t.tables.find(table=>table.number===number);
  if(!target)throw Error('Cette table n’existe plus.');
  if(target.number===1)throw Error('La table 1 doit toujours rester ouverte.');
  if(target.phase!=='lobby'||target.players.length!==0)throw Error('Une table doit être vide et hors partie pour être fermée.');
  t.tables=t.tables.filter(table=>table!==target);
  rooms.delete(target.key);
  broadcast(r);
  return;
 }
 if(msg.type==='moveTable'){
  if(!['lobby','over'].includes(r.phase))throw Error('Attends la fin de ta partie pour changer de table.');
  const t=r.tavern,number=Number(msg.table),dest=t.tables.find(x=>x.number===number);
  if(!dest)throw Error('Cette table n’existe pas.');
  if(dest===r)return;
  if(dest.phase!=='lobby')throw Error('Cette table est déjà en partie.');
  if(dest.players.length>=modes[dest.mode])throw Error('Cette table est complète pour son mode de jeu.');
  if(r.phase==='over')resetTableToLobby(r); // Une rotation clôt la revanche à l'ancienne table.
  r.players=r.players.filter(x=>x!==p);r.teamsDrawn=false;r.order=[];refreshHost(r);
  resetLobbyReadiness(r);p.score=0;p.dice=[];p.hand=[];p.guard=false;p.shieldedDice=[];p.acted=false;p.ready=false;p.roundReady=false;
  const destinationWasEmpty=dest.players.length===0;dest.players.push(p);dest.teamsDrawn=false;dest.order=[];if(destinationWasEmpty)dest.host=p.id;refreshHost(dest);
  resetLobbyReadiness(dest);ws.room=dest.key;log(dest,`${p.name} arrive de la table ${r.number}.`);broadcast(dest);return
 }
 if(msg.type==='customize'){if(r.phase!=='lobby')throw Error('La personnalisation se fait dans le salon avant la partie.');const color=String(msg.color||'').toUpperCase();const bg=String(msg.background||'');if(!/^#[0-9A-F]{6}$/.test(color))throw Error('Couleur invalide.');if(!backgrounds.has(bg))throw Error('Fond invalide.');if(r.players.some(x=>x!==p&&x.color.toUpperCase()===color))throw Error('Cette couleur est déjà utilisée. Choisis-en une autre.');p.color=color;p.background=bg;p.icon=validIcon(msg.icon||p.icon);broadcast(r);return}
 if(msg.type==='setExtensions'){if(r.phase!=='lobby'||p.id!==r.host)throw Error('Seul le maître de table peut modifier les extensions avant la partie.');if(!Array.isArray(msg.cards)||msg.cards.length>11||msg.cards.some(k=>typeof k!=='string'||!extraKeys.has(k))||new Set(msg.cards).size!==msg.cards.length)throw Error('Sélection d’extensions invalide.');r.enabledExtras=Object.keys(extraDefs).filter(k=>msg.cards.includes(k));resetLobbyReadiness(r);log(r,`Extensions : ${r.enabledExtras.length?r.enabledExtras.map(cardName).join(', '):'aucune'}.`);broadcast(r);return}
 if(msg.type==='marketPick'){resolveMarket(r,p,msg.index);return}
 if(msg.type==='grimoirePick'){resolveGrimoire(r,p,msg.index,msg.discardIndex);return}
 if(msg.type==='ransomPick'){resolveRansom(r,p,msg.choice,msg.discardIndex);return}
 if(msg.type==='teamNames'){if(r.phase!=='lobby'||p.id!==r.host)throw Error('Seul l’hôte peut modifier les noms des équipes dans le salon.');if(!isTeams(r))throw Error('Les noms d’équipe sont réservés aux modes en équipes.');r.teamNames=validateTeamNames(msg.names,r);broadcast(r);return}
 if(msg.type==='tableReady'){if(r.phase!=='lobby')throw Error('La préparation est réservée au salon.');p.ready=!p.ready;broadcast(r);return}
 if(msg.type==='mode'){if(r.phase!=='lobby'||p.id!==r.host)throw Error('Action réservée à l’hôte du salon.');if(!modes[msg.mode])throw Error('Mode inconnu.');if(r.players.length>modes[msg.mode])throw Error('Trop de joueurs pour ce mode : retire les bots ou choisis un autre mode.');r.mode=msg.mode;r.survivalTeams=0;r.teamsDrawn=false;r.teamDrawCount=0;resetLobbyReadiness(r);log(r,`Mode sélectionné : ${r.mode}.`);broadcast(r);return}
 if(msg.type==='survivalTeams'){
  if(r.phase!=='lobby'||p.id!==r.host||r.mode!=='survie')throw Error('Seul l’hôte peut configurer les équipes de Survie depuis le salon.');
  if(![0,2,3,4].includes(msg.count))throw Error('Nombre d’équipes invalide.');
  r.survivalTeams=msg.count;r.teamsDrawn=false;r.teamDrawCount=0;resetLobbyReadiness(r);
  log(r,msg.count?`⚔️ Survie : ${msg.count} équipes activées.`:'💀 Survie : chacun pour soi.');broadcast(r);return
 }
 if(msg.type==='addBot'){if(r.phase!=='lobby'||r.host!==p.id)throw Error('Seul l’hôte peut ajouter un bot au salon.');if(r.players.length>=modes[r.mode])throw Error('Le salon est complet.');const id='bot-'+crypto.randomBytes(8).toString('hex');const bot={id,name:`Bot ${r.players.filter(x=>x.bot).length+1}`,icon:'de',color:diceColors[r.players.length%4],background:'uni',bot:true,ws:null,score:0,dice:[],guard:false,hand:[],acted:false,ready:true,roundReady:true};r.players.push(bot);r.teamsDrawn=false;resetLobbyReadiness(r);log(r,`${bot.name} rejoint le salon.`);broadcast(r);return}
 if(msg.type==='kickPlayer'){
  if(r.phase!=='lobby'||r.host!==p.id)throw Error('Seul le maître de table peut retirer un joueur avant la partie.');
  const kicked=r.players.find(x=>x.id===msg.id&&!x.bot);
  if(!kicked||kicked===p)throw Error('Ce joueur ne peut pas être retiré.');
  r.players=r.players.filter(x=>x!==kicked);r.teamsDrawn=false;resetLobbyReadiness(r);refreshHost(r);
  const remote=kicked.ws;kicked.ws=null;
  if(remote){remote.room=null;remote.pid=null;send(remote,{type:'kicked',message:'Le maître de table t’a retiré de cette table.'});}
  log(r,kicked.name+' quitte la table sur décision du maître.');broadcast(r);return;
 }
 if(msg.type==='removeBot'){if(r.phase!=='lobby'||r.host!==p.id)throw Error('Action réservée à l’hôte en salon.');const b=r.players.find(x=>x.id===msg.id&&x.bot);if(!b)throw Error('Bot introuvable.');r.players=r.players.filter(x=>x!==b);r.teamsDrawn=false;resetLobbyReadiness(r);broadcast(r);return}
 if(msg.type==='shuffleTeams'){if(r.phase!=='lobby'||r.host!==p.id)throw Error('Seul l’hôte peut tirer les équipes dans le salon.');drawTeams(r);return}
 if(msg.type==='start'){if(r.phase!=='lobby'||r.host!==p.id)throw Error('Seul l’hôte peut lancer la partie.');if(isSurvival(r)?!validSurvivalSize(r):r.players.length!==modes[r.mode])throw Error(isSurvival(r)?survivalSizeError(r):`Le mode ${r.mode} nécessite ${modes[r.mode]} joueurs.`);if(r.players.some(x=>!x.bot&&(!x.ws||x.ws.readyState!==WebSocket.OPEN)))throw Error('Un joueur est déconnecté.');if(!r.players.every(x=>x.bot||x.ready))throw Error('Tous les joueurs doivent être prêts pour lancer la partie.');if(isTeams(r)&&msg.teamNames!==undefined)r.teamNames=validateTeamNames(msg.teamNames,r);if(isTeams(r)&&!r.teamsDrawn)drawTeams(r);r.stake=Math.min(9999,Math.max(0,Math.trunc(Number(msg.stake)||0)));restart(r);return}
 if(msg.type==='action'){act(r,p,msg);return}
 
 if(msg.type==='backToLobby'){if(r.phase!=='over')throw Error('Le retour au salon est disponible à la fin de la partie.');if(p.id!==r.host)throw Error('Seul l’hôte peut ramener la table au salon.');resetTableToLobby(r);broadcast(r);return}
 if(msg.type==='rematch'){if(r.phase!=='over')throw Error('La partie n’est pas terminée.');p.ready=!p.ready;r.players.filter(x=>x.bot).forEach(x=>x.ready=true);startIfReady(r);return}
 if(msg.type==='replaceOffline'){if(r.host!==p.id||r.phase==='lobby')throw Error('Action réservée à l’hôte pendant une partie.');const gone=r.players.find(x=>x.id===msg.id&&!x.bot&&!x.ws);if(!gone)throw Error('Joueur non déconnecté.');gone.bot=true;gone.name+=' (bot)';gone.ready=true;gone.roundReady=true;log(r,`${gone.name} reprend le jeu automatiquement.`);if(r.phase==='playing'&&r.players[r.order[r.turn]]===gone)scheduleBot(r);if(r.phase==='market'&&r.marketPending?.actorId===gone.id)setTimeout(()=>{if(r.phase==='market'&&r.marketPending?.actorId===gone.id)resolveMarket(r,gone,botMarketPick(r.marketPending.pool))},BOT_DELAY_MS);if(r.phase==='grimoire'&&r.grimoirePending?.actorId===gone.id)setTimeout(()=>{if(r.phase==='grimoire'&&r.grimoirePending?.actorId===gone.id)resolveGrimoire(r,gone,botGrimoirePick(r.grimoirePending.pool),gone.hand.length>=3?0:null)},BOT_DELAY_MS);if(r.phase==='ransom'&&r.ransomPending?.victimId===gone.id)setTimeout(()=>{if(r.phase==='ransom'&&r.ransomPending?.victimId===gone.id)resolveRansom(r,gone,gone.hand.length>=3?'discard':'reroll',gone.hand.length>=3?0:null)},BOT_DELAY_MS);if(r.phase==='between'||r.phase==='over')startIfReady(r);broadcast(r);return}
 if(msg.type==='leave'){if(r.phase!=='lobby')throw Error('En cours de partie, utilise Accueil puis éventuellement un bot de remplacement.');r.players=r.players.filter(x=>x!==p);r.teamsDrawn=false;resetLobbyReadiness(r);ws.room=null;ws.pid=null;if(r.tavern.host===p.id){r.tavern.host=allPlayers(r.tavern)[0]?.id||null}refreshHost(r);broadcast(r);if(!allPlayers(r.tavern).length){for(const table of r.tavern.tables)rooms.delete(table.key);taverns.delete(r.code)}send(ws,{type:'left'});return}
 }catch(e){send(ws,{type:'error',message:e.message||'Erreur inconnue'})}}
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/api/leaderboard'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({scores:topScores(),persistent:!!scoreDatabase}));return}const file=pathname==='/'?'/index.html':pathname;if(!['/index.html','/app.js','/style.css'].includes(file)&&!/^\/icons\/[a-z]+\.svg$/.test(file)){res.writeHead(404);res.end('Not found');return}fs.readFile(path.join(ROOT,file),(e,data)=>{if(e){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)})});
const wss=new WebSocketServer({server,maxPayload:4096});wss.on('connection',ws=>{ws.on('message',raw=>{try{handle(ws,JSON.parse(raw.toString()))}catch{send(ws,{type:'error',message:'Message invalide.'})}});ws.on('close',()=>{const r=rooms.get(ws.room),p=r?.players.find(p=>p.id===ws.pid);if(p&&p.ws===ws){p.ws=null;if(r.host===p.id){const successor=r.players.find(x=>!x.bot&&x.ws?.readyState===WebSocket.OPEN);if(successor){r.host=successor.id;log(r,`${successor.name} devient hôte après une déconnexion.`)}}if(r.tavern.host===p.id){const successor=allPlayers(r.tavern).find(x=>x.ws?.readyState===WebSocket.OPEN);if(successor)r.tavern.host=successor.id}broadcast(r)}})});openScoreDatabase();server.listen(PORT,'0.0.0.0',()=>console.log(`Trois Couronnes : http://localhost:${PORT}`));
