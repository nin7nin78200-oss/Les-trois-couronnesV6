'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||3000),ROOT=path.join(__dirname,'public'),REVEAL_MS=4000,TURN_DELAY_MS=1500,BOT_DELAY_MS=2000;
const defs={epee:{name:'Épée',count:4},bouclier:{name:'Bouclier',count:4},crane:{name:'Crâne',count:3},echange:{name:'Échange',count:3},calice:{name:'Calice',count:3},dague:{name:'Dague',count:3},malediction:{name:'Malédiction',count:3},couronne:{name:'Couronne',count:2},barriere:{name:'Barrière magique',count:2},joker:{name:'Joker',count:1},miroir:{name:'Miroir',count:2},benediction:{name:'Bénédiction',count:2}};
const modes={'1v1':2,'1v1v1':3,'1v1v1v1':4,'2v2':4};
const limited=new Set(['echange','miroir','barriere']),rooms=new Map();
const diceColors=['#5B9BE6','#E45C5C','#55B976','#F0C74F','#E99A4D','#A582DF','#EE8EBA','#4DBBBB','#5CCFE2','#EEEEEE','#999999','#373737','#913F57','#9A7454','#9ADABD','#C9B6ED'];
const backgrounds=new Set(['uni','arcade','bois','metal','magic','damier']);
const roll=()=>crypto.randomInt(1,7),random=n=>crypto.randomInt(n);
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function rank(a){if(a.length!==3)return [0,0,0];const d=[...a].sort((x,y)=>x-y);if(d[0]===d[2])return [4,d[0],0];if(d[0]+1===d[1]&&d[1]+1===d[2])return [3,d[2],0];if(d[0]===d[1])return [2,d[0],d[2]];if(d[1]===d[2])return [2,d[1],d[0]];return [1,d.reduce((x,y)=>x+y,0),0]}
function cmp(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}
const teamOf=(r,p)=>r.mode==='2v2'?(r.players.indexOf(p)<2?0:1):r.players.indexOf(p);
const teamName=(r,t)=>r.teamNames?.[t]||(t===0?'Équipe bleue':'Équipe rouge');
function drawTeams(r){
 if(r.mode!=='2v2'||r.players.length!==4)throw Error('Le tirage des équipes nécessite quatre joueurs en mode 2v2.');
 // Il existe seulement trois compositions possibles en 2v2.
 // La nouvelle doit changer les partenaires, pas seulement échanger les couleurs.
 const [anchor,oldPartner,...others]=r.players;
 const newPartner=others[random(others.length)];
 const team1=shuffle([anchor,newPartner]);
 const team2=shuffle([oldPartner,others.find(p=>p!==newPartner)]);
 r.players=random(2)?[...team1,...team2]:[...team2,...team1];
 r.teamsDrawn=true;
 r.teamDrawCount=(r.teamDrawCount||0)+1;
 log(r,`🎲 Tirage n°${r.teamDrawCount} : ${teamName(r,0)} (${r.players.slice(0,2).map(p=>p.name).join(' et ')}) contre ${teamName(r,1)} (${r.players.slice(2).map(p=>p.name).join(' et ')}).`);
 broadcast(r);
}
function validateTeamNames(names){if(!Array.isArray(names)||names.length!==2)throw Error('Noms d’équipes invalides.');const clean=names.map((v,i)=>String(v??'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,24)||(i===0?'Équipe bleue':'Équipe rouge'));if(clean[0].toLocaleLowerCase('fr')===clean[1].toLocaleLowerCase('fr'))throw Error('Les deux équipes doivent avoir des noms différents.');return clean;}
const canTarget=(r,actor,p,ally)=>ally?teamOf(r,actor)===teamOf(r,p):teamOf(r,actor)!==teamOf(r,p);
const send=(ws,o)=>{if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o))};
function log(r,s){r.log.push(s);if(r.log.length>70)r.log.shift()}
function view(r,p){return {type:'state',room:r.code,phase:r.phase,mode:r.mode,host:r.host,me:p.id,players:r.players.map(x=>({id:x.id,name:x.name,bot:x.bot,online:x.bot||!!x.ws&&x.ws.readyState===WebSocket.OPEN,team:teamOf(r,x),score:x.score,dice:x.dice,guard:x.guard,handCount:x.hand.length,acted:x.acted,ready:x.ready,roundReady:x.roundReady,color:x.color,background:x.background})),teamScores:r.teamScores,teamNames:r.teamNames,teamsDrawn:!!r.teamsDrawn,teamDrawCount:r.teamDrawCount||0,hand:p.hand,round:r.round,turn:r.phase==='playing'?r.players[r.order[r.turn]]?.id:null,order:r.order.map(i=>r.players[i].id),pile:r.deck.length,discard:r.discard.length,stake:r.stake,log:r.log.slice(-18),winner:r.winner,final:r.final,revealUntil:r.revealUntil,limitedUsed:r.limitedUsed,revealWinners:r.revealWinners,roundResult:r.roundResult,actionEvent:r.actionEvent||null,statistics:r.phase==='over'?r.players.map(x=>({id:x.id,name:x.name,team:teamOf(r,x),cardsPlayed:x.cardsPlayed||0,roundWins:x.roundWins||0,bestCombination:x.bestCombination||0})):null,nextRoundAt:r.nextRoundAt};}
function broadcast(r){for(const p of r.players)if(!p.bot)send(p.ws,view(r,p))}
function deck(){return shuffle(Object.entries(defs).flatMap(([k,v])=>Array(v.count).fill(k)))}
function refill(r,p){while(p.hand.length<3){if(!r.deck.length){r.deck=shuffle(r.discard.splice(0));if(!r.deck.length)break}p.hand.push(r.deck.pop())}}
function orderFor(r){if(r.final){if(r.mode==='2v2'){const left=shuffle([0,1]),right=shuffle([2,3]);return random(2)?[left[0],right[0],left[1],right[1]]:[right[0],left[0],right[1],left[1]]}return shuffle(r.players.map((_,i)=>i))}const base=r.mode==='2v2'?[0,2,1,3]:r.players.map((_,i)=>i);const offset=(r.startOffset+r.round-1)%base.length;return [...base.slice(offset),...base.slice(0,offset)]}
function startRound(r){if(r.final){r.deck=deck();r.discard=[];r.players.forEach(p=>{p.hand=[];refill(r,p)});log(r,'⚔️ Manche décisive : nouveaux dés, nouvelles cartes et nouvel ordre tiré au sort !')}r.round++;r.phase='playing';r.order=orderFor(r);r.turn=0;r.revealUntil=null;r.revealWinners=[];r.roundResult='';r.nextRoundAt=null;r.limitedUsed={};r.players.forEach(p=>{p.dice=[roll(),roll(),roll()];p.guard=false;p.acted=false;p.roundReady=false});log(r,`Manche ${r.round} : ${r.players[r.order[0]].name} commence.`);broadcast(r);scheduleBot(r)}
function restart(r){r.actionEvent=null;r.actionSerial=0;r.round=0;r.nextRoundAt=null;r.winner=null;r.final=false;r.teamScores=[0,0];r.log=[];r.deck=deck();r.discard=[];r.startOffset=random(r.players.length);r.players.forEach(p=>{p.score=0;p.cardsPlayed=0;p.roundWins=0;p.bestCombination=0;p.hand=[];p.ready=false;p.roundReady=false;refill(r,p)});log(r,'Nouvelle partie : premier joueur désigné au hasard.');startRound(r)}
function compareEntities(r){if(r.mode==='2v2'){return [0,1].map(t=>({id:t,rank:r.players.filter(p=>teamOf(r,p)===t).map(p=>rank(p.dice)).sort((a,b)=>cmp(b,a))[0]}))}return r.players.map(p=>({id:p.id,rank:rank(p.dice)}))}
function finishRound(r){
 if(r.phase!=='revealing')return;
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
 }else{
  if(!r.final&&high>=5&&leaders.length>=2){r.final=true;log(r,'⚔️ Égalité à cinq couronnes : la prochaine manche sera décisive !')}
  if(!r.final)r.players.forEach(p=>refill(r,p));
 }
 r.revealUntil=Date.now()+REVEAL_MS;
 broadcast(r);
 setTimeout(()=>{
  if(r.phase!=='revealing')return;
  if(completed){r.phase='over';r.revealUntil=null;r.players.forEach(p=>{if(p.bot)p.ready=true});broadcast(r)}
  else startRound(r);
 },REVEAL_MS);
}
function revealRound(r){
 r.phase='revealing';
 finishRound(r);
}
function advance(r){if(r.phase!=='playing')return;r.phase='transition';log(r,'Les dés restent visibles pendant 1,5 seconde.');broadcast(r);setTimeout(()=>{if(r.phase!=='transition')return;if(r.players.every(p=>p.acted)){revealRound(r);return}r.turn++;while(r.turn<r.order.length&&r.players[r.order[r.turn]].acted)r.turn++;r.phase='playing';broadcast(r);scheduleBot(r)},TURN_DELAY_MS)}
function validateIndex(v){return Number.isInteger(v)&&v>=0&&v<=2}
function act(r,p,msg){if(r.phase!=='playing'||r.players[r.order[r.turn]]!==p||p.acted)throw Error('Ce n’est pas ton tour.');if(msg.kind==='pass'){p.acted=true;log(r,`${p.name} passe.`);advance(r);return}if(msg.kind!=='card')throw Error('Action inconnue.');const idx=msg.cardIndex;if(!Number.isInteger(idx)||idx<0||idx>=p.hand.length)throw Error('Carte invalide.');const k=p.hand[idx],own=msg.own,other=msg.other,source=msg.source,destination=msg.destination;
 const allyActions=['epee','bouclier','calice','dague','couronne','joker','miroir','benediction','barriere'];const enemyActions=['crane','malediction'];const ally=allyActions.includes(k),enemy=enemyActions.includes(k),exchange=k==='echange';
 const target=r.players.find(x=>x.id===msg.target);if((ally||enemy||exchange)&&(!target||!canTarget(r,p,target,ally)))throw Error('Cible non autorisée.');
 if((ally||enemy)&&!['barriere','benediction'].includes(k)&&!validateIndex(own))throw Error('Choisis un dé valide.');if(exchange&&(!validateIndex(own)||!validateIndex(other)))throw Error('Choisis les deux dés.');
 if(k==='miroir'&&(!validateIndex(source)||source===own))throw Error('Choisis deux dés différents.');
 if(k==='benediction'&&(!validateIndex(own)||!validateIndex(destination)||own===destination))throw Error('Choisis deux dés différents.');
 if(k==='joker'&&(!Number.isInteger(msg.value)||msg.value<1||msg.value>6))throw Error('Valeur Joker invalide.');
 if(target.guard&&(enemy||exchange))throw Error('Cette cible est protégée par une Barrière magique.');
 if(limited.has(k)){const scope=r.mode==='2v2'?String(teamOf(r,p)):'table';if(r.limitedUsed[scope]?.includes(k))throw Error(`${defs[k].name} a déjà été jouée pour cette ${r.mode==='2v2'?'équipe':'table'} durant la manche.`)}
 const a=target.dice;
 if(k==='epee')a[own]=Math.min(6,a[own]+2);if(k==='bouclier')a[own]=roll();if(k==='calice')a[own]=1;if(k==='dague')a[own]=Math.max(1,a[own]-2);if(k==='couronne')a[own]=6;if(k==='joker')a[own]=msg.value;
 if(k==='miroir')a[own]=a[source];if(k==='benediction'){a[own]=Math.min(6,a[own]+1);a[destination]=Math.min(6,a[destination]+1)}
 if(k==='barriere')target.guard=true;
 if(k==='crane')a[own]=Math.max(1,a[own]-2);if(k==='malediction')a[own]=roll();
 if(exchange){const mine=p.dice;[mine[own],a[other]]=[a[other],mine[own]]}
 if(limited.has(k)){const scope=r.mode==='2v2'?String(teamOf(r,p)):'table';r.limitedUsed[scope]??=[];r.limitedUsed[scope].push(k)}
 p.hand.splice(idx,1);p.cardsPlayed=(p.cardsPlayed||0)+1;r.actionEvent={id:++r.actionSerial,playerId:p.id,targetId:target?.id||p.id,card:k,cardName:defs[k].name,playerName:p.name};r.discard.push(k);p.acted=true;log(r,`${p.name} joue ${defs[k].name}${target!==p?' sur '+target.name:''}.`);advance(r)
}
function startIfReady(r){if(r.phase==='over'&&r.players.every(p=>p.ready&&(p.bot||p.ws?.readyState===WebSocket.OPEN)))restart(r);else broadcast(r)}
function botMoves(r,p){const allies=r.players.filter(x=>canTarget(r,p,x,true));const enemies=r.players.filter(x=>canTarget(r,p,x,false));const moves=[{kind:'pass'}];for(let i=0;i<p.hand.length;i++){const k=p.hand[i],scope=r.mode==='2v2'?String(teamOf(r,p)):'table';if(limited.has(k)&&r.limitedUsed[scope]?.includes(k))continue;const add=o=>moves.push({kind:'card',cardIndex:i,...o});
 if(['epee','bouclier','calice','dague','couronne','joker','miroir','benediction','barriere'].includes(k))for(const t of allies){if(k==='barriere'){add({target:t.id});continue}if(k==='benediction'){for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)add({target:t.id,own:a,destination:b});continue}for(let a=0;a<3;a++){if(k==='joker'){for(let v=1;v<=6;v++)add({target:t.id,own:a,value:v})}else if(k==='miroir'){for(let b=0;b<3;b++)if(b!==a)add({target:t.id,own:a,source:b})}else add({target:t.id,own:a})}}
 if(['crane','malediction'].includes(k))for(const t of enemies)if(!t.guard)for(let a=0;a<3;a++)add({target:t.id,own:a});
 if(k==='echange')for(const t of enemies)if(!t.guard)for(let a=0;a<3;a++)for(let b=0;b<3;b++)add({target:t.id,own:a,other:b})}
 return moves}
function utility(r,p){if(r.mode==='2v2'){const v=compareEntities(r),own=v[teamOf(r,p)].rank,other=v[1-teamOf(r,p)].rank;return 500*Math.sign(cmp(own,other)) +own[0]*80+own[1]*4-other[0]*80-other[1]*4}const me=rank(p.dice),op=r.players.filter(x=>x!==p).map(x=>rank(x.dice)).sort((a,b)=>cmp(b,a))[0];return 500*Math.sign(cmp(me,op))+me[0]*80+me[1]*4-op[0]*80-op[1]*4}
function chooseBot(r,p){const moves=botMoves(r,p);let best=moves[0],bestScore=utility(r,p);for(const m of moves.slice(1)){const snapshots=r.players.map(x=>({x,d:[...x.dice],guard:x.guard}));const t=r.players.find(x=>x.id===m.target),k=p.hand[m.cardIndex];let score=0;const a=t.dice;if(k==='epee')a[m.own]=Math.min(6,a[m.own]+2);if(k==='calice')a[m.own]=1;if(k==='dague')a[m.own]=Math.max(1,a[m.own]-2);if(k==='couronne')a[m.own]=6;if(k==='joker')a[m.own]=m.value;if(k==='miroir')a[m.own]=a[m.source];if(k==='benediction'){a[m.own]=Math.min(6,a[m.own]+1);a[m.destination]=Math.min(6,a[m.destination]+1)}if(k==='barriere')t.guard=true;if(k==='crane')a[m.own]=Math.max(1,a[m.own]-2);if(k==='echange')[p.dice[m.own],a[m.other]]=[a[m.other],p.dice[m.own]];
 if(k==='bouclier'||k==='malediction'){let sum=0;for(let v=1;v<=6;v++){const original=a[m.own];a[m.own]=v;sum+=utility(r,p);a[m.own]=original}score=sum/6}else score=utility(r,p);
 if(k==='barriere')score+=(r.players.some(x=>!x.acted&&canTarget(r,p,x,false))&&cmp(rank(t.dice),compareEntities(r).map(x=>x.rank).sort((a,b)=>cmp(b,a))[0])===0)?35:0;
 snapshots.forEach(({x,d,guard})=>{x.dice=d;x.guard=guard});score-=12;if(score>bestScore+0.01){bestScore=score;best=m}}
 return best}
function scheduleBot(r){if(r.phase!=='playing')return;const p=r.players[r.order[r.turn]];if(!p?.bot)return;setTimeout(()=>{if(r.phase!=='playing'||r.players[r.order[r.turn]]!==p||p.acted)return;let m;try{m=chooseBot(r,p);act(r,p,m)}catch(e){console.error('Bot action:',e);try{act(r,p,{kind:'pass'})}catch{}}},BOT_DELAY_MS)}
function join(ws,msg){const code=String(msg.room||'').trim().toUpperCase();const id=String(msg.id||'');const name=String(msg.name||'Aventurier').trim().slice(0,24).replace(/[<>]/g,'')||'Aventurier';if(!/^[A-F0-9]{24}$/i.test(id))throw Error('Identifiant de joueur invalide.');if(code&&!/^[A-F0-9]{6}$/.test(code))throw Error('Code du salon invalide.');let r=rooms.get(code);if(!r){if(code)throw Error('Salon introuvable (serveur redémarré ?).');let c;do{c=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(c));r={code:c,mode:'1v1',players:[],host:id,phase:'lobby',round:0,turn:0,order:[],startOffset:0,deck:[],discard:[],stake:5,log:[],winner:null,final:false,revealUntil:null,limitedUsed:{},teamScores:[0,0],teamNames:['Équipe bleue','Équipe rouge'],teamsDrawn:false,revealWinners:[],roundResult:''};rooms.set(c,r)}
 let p=r.players.find(x=>x.id===id);if(!p){if(r.phase!=='lobby')throw Error('Partie déjà commencée : reconnexions uniquement.');if(r.players.length>=modes[r.mode])throw Error('Salon complet pour ce mode.');p={id,name,color:diceColors[r.players.length%4],background:'uni',bot:false,ws:null,score:0,dice:[],guard:false,hand:[],acted:false,ready:false,roundReady:false};r.players.push(p);r.teamsDrawn=false;log(r,`${name} rejoint la table.`)}else{if(p.bot)throw Error('Impossible de rejoindre à la place d’un bot.');p.name=name;if(p.ws&&p.ws!==ws)try{p.ws.close()}catch{}}p.ws=ws;ws.room=r.code;ws.pid=id;broadcast(r)}
function handle(ws,msg){if(!msg||typeof msg!=='object')return;try{if(msg.type==='join'){join(ws,msg);return}const r=rooms.get(ws.room);if(!r)throw Error('Salon introuvable.');const p=r.players.find(x=>x.id===ws.pid);if(!p||p.ws!==ws||p.bot)throw Error('Connexion invalide.');
 if(msg.type==='customize'){if(r.phase!=='lobby')throw Error('La personnalisation se fait dans le salon avant la partie.');const color=String(msg.color||'').toUpperCase();const bg=String(msg.background||'');if(!/^#[0-9A-F]{6}$/.test(color))throw Error('Couleur invalide.');if(!backgrounds.has(bg))throw Error('Fond invalide.');if(r.players.some(x=>x!==p&&x.color.toUpperCase()===color))throw Error('Cette couleur est déjà utilisée. Choisis-en une autre.');p.color=color;p.background=bg;broadcast(r);return}
 if(msg.type==='teamNames'){if(r.phase!=='lobby'||p.id!==r.host)throw Error('Seul l’hôte peut modifier les noms des équipes dans le salon.');if(r.mode!=='2v2')throw Error('Les noms d’équipe sont réservés au mode 2v2.');r.teamNames=validateTeamNames(msg.names);broadcast(r);return}
 if(msg.type==='mode'){if(r.phase!=='lobby'||p.id!==r.host)throw Error('Action réservée à l’hôte du salon.');if(!modes[msg.mode])throw Error('Mode inconnu.');if(r.players.length>modes[msg.mode])throw Error('Trop de joueurs pour ce mode : retire les bots ou choisis un autre mode.');r.mode=msg.mode;r.teamsDrawn=false;log(r,`Mode sélectionné : ${r.mode}.`);broadcast(r);return}
 if(msg.type==='addBot'){if(r.phase!=='lobby'||r.host!==p.id)throw Error('Seul l’hôte peut ajouter un bot au salon.');if(r.players.length>=modes[r.mode])throw Error('Le salon est complet.');const id='bot-'+crypto.randomBytes(8).toString('hex');const bot={id,name:`Bot ${r.players.filter(x=>x.bot).length+1}`,color:diceColors[r.players.length%4],background:'uni',bot:true,ws:null,score:0,dice:[],guard:false,hand:[],acted:false,ready:true,roundReady:true};r.players.push(bot);r.teamsDrawn=false;log(r,`${bot.name} rejoint le salon.`);broadcast(r);return}
 if(msg.type==='removeBot'){if(r.phase!=='lobby'||r.host!==p.id)throw Error('Action réservée à l’hôte en salon.');const b=r.players.find(x=>x.id===msg.id&&x.bot);if(!b)throw Error('Bot introuvable.');r.players=r.players.filter(x=>x!==b);r.teamsDrawn=false;broadcast(r);return}
 if(msg.type==='shuffleTeams'){if(r.phase!=='lobby'||r.host!==p.id)throw Error('Seul l’hôte peut tirer les équipes dans le salon.');drawTeams(r);return}
 if(msg.type==='start'){if(r.phase!=='lobby'||r.host!==p.id)throw Error('Seul l’hôte peut lancer la partie.');if(r.players.length!==modes[r.mode])throw Error(`Le mode ${r.mode} nécessite ${modes[r.mode]} joueurs (humains ou bots).`);if(r.players.some(x=>!x.bot&&!x.ws))throw Error('Un joueur est déconnecté.');if(r.mode==='2v2'&&msg.teamNames!==undefined)r.teamNames=validateTeamNames(msg.teamNames);if(r.mode==='2v2'&&!r.teamsDrawn)drawTeams(r);r.stake=Math.min(9999,Math.max(0,Math.trunc(Number(msg.stake)||0)));restart(r);return}
 if(msg.type==='action'){act(r,p,msg);return}
 
 if(msg.type==='backToLobby'){if(r.phase!=='over')throw Error('Le retour au salon est disponible à la fin de la partie.');if(p.id!==r.host)throw Error('Seul l’hôte peut ramener la table au salon.');r.phase='lobby';r.teamsDrawn=true;r.winner=null;r.final=false;r.round=0;r.revealUntil=null;r.revealWinners=[];r.roundResult='';r.nextRoundAt=null;r.teamScores=[0,0];r.limitedUsed={};r.deck=[];r.discard=[];r.log=[];r.players.forEach(x=>{x.score=0;x.dice=[];x.hand=[];x.guard=false;x.acted=false;x.ready=x.bot;x.roundReady=false});log(r,'Retour au salon : choisissez les équipes, les couleurs ou le mode avant de rejouer.');broadcast(r);return}
 if(msg.type==='rematch'){if(r.phase!=='over')throw Error('La partie n’est pas terminée.');p.ready=!p.ready;r.players.filter(x=>x.bot).forEach(x=>x.ready=true);startIfReady(r);return}
 if(msg.type==='replaceOffline'){if(r.host!==p.id||r.phase==='lobby')throw Error('Action réservée à l’hôte pendant une partie.');const gone=r.players.find(x=>x.id===msg.id&&!x.bot&&!x.ws);if(!gone)throw Error('Joueur non déconnecté.');gone.bot=true;gone.name+=' (bot)';gone.ready=true;gone.roundReady=true;log(r,`${gone.name} reprend le jeu automatiquement.`);if(r.phase==='playing'&&r.players[r.order[r.turn]]===gone)scheduleBot(r);if(r.phase==='between'||r.phase==='over')startIfReady(r);broadcast(r);return}
 if(msg.type==='leave'){if(r.phase!=='lobby')throw Error('En cours de partie, utilise Accueil puis éventuellement un bot de remplacement.');r.players=r.players.filter(x=>x!==p);r.teamsDrawn=false;ws.room=null;ws.pid=null;if(!r.players.some(x=>!x.bot)){rooms.delete(r.code)}else{if(r.host===p.id)r.host=r.players.find(x=>!x.bot).id;broadcast(r)}send(ws,{type:'left'});return}
 }catch(e){send(ws,{type:'error',message:e.message||'Erreur inconnue'})}}
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=pathname==='/'?'/index.html':pathname;if(!['/index.html','/app.js','/style.css'].includes(file)){res.writeHead(404);res.end('Not found');return}fs.readFile(path.join(ROOT,file),(e,data)=>{if(e){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)})});
const wss=new WebSocketServer({server,maxPayload:4096});wss.on('connection',ws=>{ws.on('message',raw=>{try{handle(ws,JSON.parse(raw.toString()))}catch{send(ws,{type:'error',message:'Message invalide.'})}});ws.on('close',()=>{const r=rooms.get(ws.room),p=r?.players.find(p=>p.id===ws.pid);if(p&&p.ws===ws){p.ws=null;if(r.host===p.id){const successor=r.players.find(x=>!x.bot&&x.ws?.readyState===WebSocket.OPEN);if(successor){r.host=successor.id;log(r,`${successor.name} devient hôte après une déconnexion.`)}}broadcast(r)}})});server.listen(PORT,'0.0.0.0',()=>console.log(`Trois Couronnes : http://localhost:${PORT}`));
