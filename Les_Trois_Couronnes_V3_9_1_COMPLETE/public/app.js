(()=>{'use strict';
const $=id=>document.getElementById(id),defs={epee:['Épée','⚔️','+2 sur un dé allié'],bouclier:['Baguette magique','🪄','Relance 2 dés distincts, même chez 2 joueurs'],crane:['Crâne','💀','−2 sur un dé ennemi'],echange:['Échange','🔄','Échange un de tes dés avec un dé ennemi'],calice:['Calice','💎','Un dé allié devient 1'],dague:['Dague','🗡️','−2 sur un dé allié'],malediction:['Malédiction','🎲','Relance 1 dé, chez toi ou un adversaire'],couronne:['Couronne','👑','Un dé allié devient 6'],barriere:['Barrière magique','✨','Protège un joueur allié'],joker:['Joker','🃏','Choisis une valeur de 1 à 6'],miroir:['Miroir','🪞','Copie un dé sur un autre dé allié'],benediction:['Bénédiction','🌟','+1 sur deux dés alliés différents'],pioche:['Pioche','🃏','Pioche une carte, puis rejoue (3 max)'],gambling:['Gambling','🎰','Relance tes trois dés, puis rejoue'],corbeau:['Corbeau de Malchance','🐦‍⬛','Bloque le tour d’un adversaire'],chaos:['Chaos','🌀','Relance un dé aléatoire de chaque joueur'],potion:['Potion instable','🧪','Ton dé devient 1 ou 6 au hasard'],voleur:['Boule de feu','🔥','Brûle une carte au hasard chez un adversaire, même sa dernière !'],secondechance:['Seconde Chance','🔁','Pioche 2 cartes, puis rejoue. Défausse seulement si tu passes avec 4 cartes'],trounoir:['Trou noir','🕳️','Relance tous les dés de tous les joueurs'],tornade:['Tornade','🌪️','Chaque joueur donne un dé aléatoire au suivant'],usurpation:['Usurpation','🎭','Échange tes trois dés contre ceux d’un adversaire'],catastrophe:['Catastrophe','🔥','Les meilleurs joueurs voient un dé devenir 1'],marche:['Marché des Ombres','🌑','Récupère une carte parmi les défausses aléatoires'],rancon:['Rançon','💰','Un adversaire choisit : défausser 1 carte ou relancer son meilleur dé'],grimoire:['Grimoire interdit','📖','Regarde secrètement 3 cartes, garde-en 1 et replace les autres sous la pioche'],petitbouclier:['Bouclier','🛡️','Protège un seul dé allié contre les attaques ciblées jusqu’à la fin de la manche']};
const extraCards=['potion','voleur','secondechance','trounoir','tornade','usurpation','catastrophe','marche','rancon','grimoire','petitbouclier'];const extraCounts={potion:2,voleur:2,secondechance:2,trounoir:2,tornade:1,usurpation:1,catastrophe:1,marche:1,rancon:1,grimoire:2,petitbouclier:2};
const avatars={crayon:'Crayon',couronne:'Couronne',epee:'Épée',bouclier:'Bouclier',crane:'Crâne',de:'Dé',chope:'Choppe',flamme:'Flamme',loup:'Loup',dragon:'Dragon',mage:'Chapeau de mage',cristal:'Cristal',cle:'Clé',corbeau:'Corbeau',lune:'Lune',grenouille:'Grenouille'};
const avatarImg=(key,cls='avatar-icon')=>{const i=document.createElement('img');i.className=cls;i.src='/icons/'+(avatars[key]?key:'crayon')+'.svg';i.alt=avatars[key]||'Crayon';i.width=34;i.height=34;return i};
const counts={'1v1':2,'1v1v1':3,'1v1v1v1':4,'2v2':4,'survie':8,'survie-equipes':8,'survie-2v2v2v2':8};
const isSurvivalMode=m=>['survie','survie-equipes','survie-2v2v2v2'].includes(m);
const configuredTeams=(m,teams)=>(m==='survie-2v2v2v2'?4:m==='survie-equipes'?2:m==='survie'?Number(teams)||0:m==='2v2'?2:0);
const isTeamMode=(m,teams=state?.survivalTeams)=>configuredTeams(m,teams)>0;
const numTeams=(m,teams=state?.survivalTeams)=>configuredTeams(m,teams)||2;
const readyCount=(m,teams=state?.survivalTeams)=>m==='survie'?(configuredTeams(m,teams)===0?2:configuredTeams(m,teams)===2?4:configuredTeams(m,teams)*2):m==='survie-equipes'?4:counts[m];
const canStartSurvival=(count,teams)=>teams===0?count>=2&&count<=8:teams===2?[4,6,8].includes(count):teams===3?count===6:teams===4?count===8:false;
const survivalFormat=teams=>teams===2?'2v2 · 3v3 · 4v4':teams===3?'2v2v2':'2v2v2v2';
const teamColors=['🔵','🔴','🟢','🟡'];const teamInputNames=m=>Array.from({length:numTeams(m)},(_,i)=>$('team-name-'+i).value);let ws=null,state=null,selected=null,directTargets=[],connecting=false,leaving=false,revealInterval=null,audioCtx=null,prefsSyncedRoom=null;
const prefKey='trois-couronnes-preferences-v1';function getPrefs(){try{return JSON.parse(localStorage.getItem(prefKey)||'{}')||{}}catch{return {}}}function savePrefs(data){try{localStorage.setItem(prefKey,JSON.stringify({...getPrefs(),...data}))}catch{}}const storedPrefs=getPrefs();let pickedAvatar=avatars[storedPrefs.icon]?storedPrefs.icon:'crayon';
let soundEnabled=storedPrefs.sound!==undefined?!!storedPrefs.sound:localStorage.getItem('diceSound')!=='off';
function refreshSound(){$('sound').textContent=soundEnabled?'🔊 Son activé':'🔇 Son coupé'}refreshSound();$('sound').onclick=()=>{soundEnabled=!soundEnabled;localStorage.setItem('diceSound',soundEnabled?'on':'off');savePrefs({sound:soundEnabled});refreshSound()};document.addEventListener('pointerdown',()=>{try{audioCtx ||=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume()}catch{}},{once:true});
// Sons courts et feutrés, générés localement : aucun fichier audio à télécharger.
// Un seul gestionnaire fonctionne aussi avec les cartes créées dynamiquement.
let lastUiSoundAt=0;
function uiSound(kind='button'){
 if(!soundEnabled)return;
 const now=performance.now(),gap=kind==='card'?110:85;
 if(now-lastUiSoundAt<gap)return; // Anti-spam, même pour des clics très rapides.
 lastUiSoundAt=now;
 try{
  audioCtx ||=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  const t=audioCtx.currentTime;
  const osc=audioCtx.createOscillator(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
  const card=kind==='card';
  osc.type=card?'triangle':'sine';
  osc.frequency.setValueAtTime(card?690:480,t);
  osc.frequency.exponentialRampToValueAtTime(card?440:335,t+(card?.085:.055));
  filter.type='lowpass';filter.frequency.value=card?950:760;
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(card?.028:.013,t+.008);
  gain.gain.exponentialRampToValueAtTime(.0001,t+(card?.11:.075));
  osc.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);
  osc.start(t);osc.stop(t+(card?.12:.085));
 }catch{} // Audio non disponible : le jeu continue normalement.
}
// On écoute le clic avant les handlers des boutons, sans bloquer leurs actions.
document.addEventListener('click',event=>{
 const button=event.target.closest?.('button');
 if(!button||button.disabled||button.id==='sound')return;
 uiSound(button.classList.contains('card')?'card':'button');
});
function playCardFxSound(card){
 if(!soundEnabled)return;
 try{
  audioCtx ||=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  const t=audioCtx.currentTime;
  if(card==='corbeau'){
   // Bruissement feutré d'ailes puis un cri bref, sans fichier audio.
   const sr=audioCtx.sampleRate,len=Math.round(sr*.43),buffer=audioCtx.createBuffer(1,len,sr),samples=buffer.getChannelData(0);
   for(let i=0;i<len;i++)samples[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/len)**2*(.4+.6*Math.sin(i/sr*46)**2);
   const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),g=audioCtx.createGain();src.buffer=buffer;filter.type='lowpass';filter.frequency.value=750;g.gain.value=.075;src.connect(filter);filter.connect(g);g.connect(audioCtx.destination);src.start(t);src.stop(t+.44);
  }
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=['epee','dague','echange'].includes(card)?'triangle':'sine';const start=card==='corbeau'?800:card==='bouclier'?560:card==='couronne'?660:card==='chaos'?250:card==='trounoir'?115:card==='potion'?720:card==='voleur'?320:card==='usurpation'?530:card==='catastrophe'?190:card==='marche'?360:420;
  o.frequency.setValueAtTime(start,t+.04);o.frequency.exponentialRampToValueAtTime(card==='corbeau'?380:start*1.45,t+.27);
  g.gain.setValueAtTime(.0001,t+.04);g.gain.exponentialRampToValueAtTime(card==='corbeau'?.034:.025,t+.09);g.gain.exponentialRampToValueAtTime(.0001,t+.34);o.connect(g);g.connect(audioCtx.destination);o.start(t+.04);o.stop(t+.35);
   // Couche discrète propre aux extensions : vortex, feu, fiole, larcin ou cartes.
   if(['trounoir','potion','catastrophe','tornade','voleur','secondechance','usurpation','marche'].includes(card)){
     const sr=audioCtx.sampleRate,dur=card==='trounoir'?.75:.27,len=Math.round(sr*dur),buf=audioCtx.createBuffer(1,len,sr),data=buf.getChannelData(0);
     for(let i=0;i<len;i++){const x=i/len,env=Math.sin(Math.PI*x)**2;data[i]=(Math.random()*2-1)*env*(card==='trounoir'?.65:.4)}
     const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g2=audioCtx.createGain();src.buffer=buf;f.type='lowpass';f.frequency.setValueAtTime(card==='trounoir'?220:card==='catastrophe'?1200:850,t);f.frequency.exponentialRampToValueAtTime(card==='trounoir'?980:300,t+dur);g2.gain.value=card==='trounoir'?.055:.032;src.connect(f);f.connect(g2);g2.connect(audioCtx.destination);src.start(t);src.stop(t+dur+.02)
   }
 }catch{}
}
function diceSound(){if(!soundEnabled)return;try{audioCtx ||=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const sr=audioCtx.sampleRate,len=Math.round(sr*.055),buf=audioCtx.createBuffer(1,len,sr),data=buf.getChannelData(0);for(let j=0;j<len;j++)data[j]=(Math.random()*2-1)*(1-j/len)**2;[0,.07,.16,.25,.36,.45].forEach((dt,i)=>{const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();src.buffer=buf;filter.type='bandpass';filter.frequency.value=900+150*i;filter.Q.value=.7;src.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);const t=audioCtx.currentTime+dt;gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.075*(1-.1*i),t+.003);gain.gain.exponentialRampToValueAtTime(.0001,t+.055);src.start(t);src.stop(t+.06)})}catch{}}
// Applaudissements légers à la fin d'une partie : petite foule synthétique, sans fichier MP3.
// Un seul son à l'entrée dans la phase "over" (pas à chaque mise à jour du salon).
function victoryApplause(){
 if(!soundEnabled)return;
 try{
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  const sr=audioCtx.sampleRate,duration=1.7,length=Math.ceil(sr*duration);
  const buffer=audioCtx.createBuffer(1,length,sr),samples=buffer.getChannelData(0);
  // Petites claques irrégulières en plusieurs salves, chacune avec un double impact.
  // Le volume de sortie est volontairement inférieur à celui des dés.
  for(let clap=0;clap<31;clap++){
   const start=.06+clap*.050+Math.random()*.035;
   const strength=.35+Math.random()*.45;
   for(const offset of [0,.012]){
    const begin=Math.floor((start+offset)*sr);
    const n=Math.floor(sr*(offset===0?.027:.022));
    for(let j=0;j<n&&begin+j<length;j++){
     const shape=Math.pow(1-j/n,2.2);
     samples[begin+j]+=(Math.random()*2-1)*strength*shape*(offset===0?1:.55);
    }
   }
  }
  const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
  source.buffer=buffer;
  filter.type='bandpass';filter.frequency.value=1250;filter.Q.value=.55;
  const t=audioCtx.currentTime;
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.linearRampToValueAtTime(.085,t+.16);
  gain.gain.setValueAtTime(.085,t+1.2);
  gain.gain.linearRampToValueAtTime(.0001,t+duration);
  source.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);
  source.start(t);source.stop(t+duration+.02);
 }catch{} // Pas de périphérique audio : la partie reste jouable.
}

// Effets légers, sans librairie et sans interruption du tour.
let effectTimer=0,seenAction=null,seenFinalRound=null;
function ephemeralEffect(className,content,host,duration=950){
 if(!host)return;
 const el=document.createElement('span');el.className=className;el.textContent=content;
 host.append(el);setTimeout(()=>el.remove(),duration);
}
function flyExchangedDice(ev){
 const pair=ev.targets||[];if(pair.length!==2||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const positions=pair.map(t=>{
  const board=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===t.id);
  const die=board?.querySelectorAll('.die')[t.index];
  const original=ev.oldDice?.find(x=>x.id===t.id);
  if(!die||!original)return null;
  return {rect:die.getBoundingClientRect(),value:original.dice[t.index],color:original.diceOrigins?.[t.index]||board?.querySelector('.die')?.style.background||'#777'};
 });
 if(positions.some(x=>!x))return;
 positions.forEach((from,i)=>{
  const to=positions[1-i];const ghost=document.createElement('div');
  ghost.className='die exchange-ghost';ghost.textContent=from.value;
  Object.assign(ghost.style,{position:'fixed',left:from.rect.left+'px',top:from.rect.top+'px',width:from.rect.width+'px',height:from.rect.height+'px',background:from.color,color:inkFor(from.color),zIndex:'110',pointerEvents:'none',display:'grid',placeItems:'center'});
  document.body.append(ghost);
  const dx=to.rect.left-from.rect.left,dy=to.rect.top-from.rect.top;
  const animation=ghost.animate([{transform:'translate(0, 0) rotate(0deg)',opacity:1},{transform:`translate(${dx/2}px,${dy/2-25}px) rotate(${i?30:-30}deg) scale(1.18)`,opacity:1,offset:.5},{transform:`translate(${dx}px,${dy}px) rotate(360deg)`,opacity:.1}],{duration:900,easing:'ease-in-out',fill:'forwards'});
  animation.onfinish=()=>ghost.remove();setTimeout(()=>ghost.remove(),1200);
 });
}
function moveDiceGhosts(items,ev){
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 for(const item of items){
  const from=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===item.fromId)?.querySelectorAll('.die')[item.fromIndex];
  const to=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===item.toId)?.querySelectorAll('.die')[item.toIndex];
  const original=ev.oldDice?.find(x=>x.id===item.fromId),start=from?.getBoundingClientRect(),end=to?.getBoundingClientRect();if(!start||!end||!original)continue;
  const color=original.diceOrigins?.[item.fromIndex]||'#777',ghost=document.createElement('div');ghost.className='die exchange-ghost';ghost.textContent=original.dice[item.fromIndex];
  Object.assign(ghost.style,{position:'fixed',left:start.left+'px',top:start.top+'px',width:start.width+'px',height:start.height+'px',background:color,color:inkFor(color),display:'grid',placeItems:'center',zIndex:'120',pointerEvents:'none'});document.body.append(ghost);
  const dx=end.left-start.left,dy=end.top-start.top;
  ghost.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${dx/2}px,${dy/2-32}px) scale(1.16) rotate(125deg)`,offset:.5},{transform:`translate(${dx}px,${dy}px) rotate(360deg)`,opacity:.1}],{duration:1050,easing:'ease-in-out',fill:'forwards'}).onfinish=()=>ghost.remove();setTimeout(()=>ghost.remove(),1300);
 }
}
function thiefAnimation(ev){
 // Boule de feu : une flamme traverse la table et consume une carte adverse.
 const player=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===ev.playerId);
 const victim=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===ev.targetId);
 if(!player||!victim)return;
 ephemeralEffect('thief-sigil','🔥',victim,1150);
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const start=player.getBoundingClientRect(),end=victim.getBoundingClientRect();
 const flare=document.createElement('span');flare.className='thief-floating';flare.textContent='🔥';
 Object.assign(flare.style,{left:start.left+start.width/2+'px',top:start.top+start.height/2+'px'});
 document.body.append(flare);const dx=end.left+end.width/2-start.left-start.width/2,dy=end.top+end.height/2-start.top-start.height/2;
 flare.animate([{transform:'translate(-50%,-50%) scale(.7)',opacity:.25},{transform:`translate(calc(-50% + ${dx*.55}px),calc(-50% + ${dy*.55-26}px)) scale(1.65)`,opacity:1,offset:.6},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(2.1)`,opacity:0}],{duration:920,easing:'ease-in',fill:'forwards'}).onfinish=()=>flare.remove();
 setTimeout(()=>{const ash=document.createElement('span');ash.className='thief-floating';ash.textContent='🂠 💨';Object.assign(ash.style,{left:end.left+end.width/2+'px',top:end.top+end.height/2+'px'});document.body.append(ash);ash.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.9)'},{opacity:0,transform:'translate(-50%,-100%) scale(.5)'}],{duration:850,fill:'forwards'}).onfinish=()=>ash.remove();setTimeout(()=>ash.remove(),950)},780);
 setTimeout(()=>flare.remove(),1150);
}
function marketDropAnimation(ev){
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const boards=[...document.querySelectorAll('[data-dice-player]')];const arena=$('boards')?.getBoundingClientRect();if(!arena)return;
 const cx=arena.left+arena.width/2,cy=arena.top+arena.height/2;
 for(const [i,b] of boards.entries()){
  if(b.classList.contains('eliminated'))continue;
  const r=b.getBoundingClientRect(),ghost=document.createElement('span');ghost.className='market-card-ghost';ghost.textContent='🂠';
  ghost.style.left=(r.left+r.width/2)+'px';ghost.style.top=(r.top+r.height/2)+'px';document.body.append(ghost);
  const dx=cx-r.left-r.width/2,dy=cy-r.top-r.height/2;
  ghost.animate([{transform:'translate(-50%,-50%) rotate(-12deg)',opacity:.1},{transform:`translate(calc(-50% + ${dx/2}px),calc(-50% + ${dy/2-24}px)) rotate(18deg)`,opacity:1,offset:.45},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(360deg) scale(.45)`,opacity:0}],{duration:840+i*40,easing:'ease-in-out',fill:'forwards'}).onfinish=()=>ghost.remove();setTimeout(()=>ghost.remove(),1400);
 }
}
function prepareEliminationGhosts(prev,s){
 if(!prev||!isSurvivalMode(s.mode)||!['revealing','over'].includes(s.phase))return [];
 return s.players.filter(person=>person.eliminated&&!prev.players.find(p=>p.id===person.id)?.eliminated).map(person=>{
  const board=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===person.id);
  if(!board)return null;const rect=board.getBoundingClientRect(),ghost=board.cloneNode(true);
  ghost.classList.add('elimination-ghost');Object.assign(ghost.style,{position:'fixed',top:rect.top+'px',left:rect.left+'px',width:rect.width+'px',height:rect.height+'px',transform:'none',margin:'0',pointerEvents:'none',zIndex:'190',boxSizing:'border-box'});
  return ghost;
 }).filter(Boolean)
}
function eliminationSlash(prev,s,ghosts=[]){
 if(!ghosts.length)return;
 ghosts.forEach(ghost=>{document.body.append(ghost);const slash=document.createElement('div');slash.className='elimination-slash';ghost.append(slash);setTimeout(()=>ghost.remove(),1700)});
 playCardFxSound('epee');
}
// Trou noir : annonce 1,5 s, puis seulement le vortex et les relances.
// Le serveur a déjà calculé le résultat ; on garde visuellement les anciens dés
// jusqu'au démarrage de l'animation pour ne pas gâcher la révélation.
function showBlackHoleSequence(ev){
 const arena=$('boards');if(!arena)return;
 const announcement=document.createElement('div');announcement.className='card-action-toast blackhole-announcement';announcement.setAttribute('role','status');
 const heading=document.createElement('strong');heading.textContent='🕳️ '+ev.playerName+' utilise Trou noir';
 announcement.append(heading);arena.append(announcement);
 const touched=new Map();for(const rr of ev.rerolls||[])touched.set(rr.id+':'+rr.index,rr);
 const findDie=(id,index)=>[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===id)?.querySelectorAll('.die')[index];
 for(const rr of touched.values()){
  const before=ev.oldDice?.find(x=>x.id===rr.id),die=findDie(rr.id,rr.index);
  if(die&&before)die.textContent=String(before.dice[rr.index]);
 }
 setTimeout(()=>{
  announcement.remove();
  if(!arena.isConnected||state?.actionEvent?.id!==ev.id)return;
  playCardFxSound('trounoir');diceSound();
  ephemeralEffect('blackhole-vortex','◉',arena,1450);
  for(const rr of touched.values()){
   const die=findDie(rr.id,rr.index),after=ev.newDice?.find(x=>x.id===rr.id);
   if(!die||!after)continue;
   const final=after.dice[rr.index];die.classList.add('rolling','fx-trounoir');
   let step=0;const spin=setInterval(()=>{if(die.isConnected)die.textContent=String(1+Math.floor(Math.random()*6));if(++step>11)clearInterval(spin)},65);
   setTimeout(()=>{clearInterval(spin);if(die.isConnected){die.textContent=String(final);die.classList.remove('rolling','fx-trounoir')}},850);
  }
 },1500);
}
function cardPlayedEffect(prev,s){
 const ev=s.actionEvent;if(!ev||ev.id===seenAction)return;
 seenAction=ev.id;
 if(!prev||prev.round!==s.round)return;
 if(ev.card==='trounoir'){showBlackHoleSequence(ev);return;}
 const target=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===ev.targetId);
 const signs={potion:'🧪',voleur:'🔥',secondechance:'🔁',trounoir:'🕳️',tornade:'🌪️',usurpation:'🎭',catastrophe:'🔥',marche:'🌑',rancon:'💰',grimoire:'📖',petitbouclier:'🛡️',epee:'⚔️',bouclier:'🪄',crane:'💀',echange:'🔄',calice:'💎',dague:'🗡️',malediction:'🎲',couronne:'👑',barriere:'🛡️',joker:'🃏',miroir:'🪞',benediction:'🌟',pioche:'🃏',gambling:'🎰',corbeau:'🐦‍⬛',chaos:'🌀','corbeau-bloque':'🐦‍⬛'};
 const message=document.createElement('div');message.className='card-action-toast';message.setAttribute('role','status');
 const heading=document.createElement('strong');heading.textContent=(signs[ev.card]||'✦')+' '+ev.cardName;
 const subtitle=document.createElement('small');subtitle.textContent=({trounoir:'Tous les dés sont aspirés dans le vortex !',tornade:'Tous les joueurs échangent un dé avec leur voisin.',catastrophe:'Les meilleures combinaisons prennent feu !',marche:'Les cartes secrètes rejoignent le Marché des Ombres.',secondechance:'Deux cartes piochées : rejoue ou conserve ta main !',chaos:'Un dé de chaque joueur est relancé !',usurpation:'Les trois dés des deux joueurs sont échangés !',grimoire:'Trois cartes mystérieuses à découvrir.',rancon:'La cible choisit son sacrifice.',petitbouclier:'Un dé allié est protégé.'}[ev.card]||ev.playerName+' → '+(ev.targetName||'ses dés'));
 message.append(heading,subtitle);
 const changed=[];
 for(const after of ev.newDice||[]){const before=ev.oldDice?.find(x=>x.id===after.id);if(!before)continue;
  after.dice.forEach((v,i)=>{if(v!==before.dice[i])changed.push({id:after.id,index:i,from:before.dice[i],to:v})});
 }
 const rerolled=ev.rerolls||[];for(const rr of rerolled){if(!changed.some(c=>c.id===rr.id&&c.index===rr.index)){const before=ev.oldDice?.find(x=>x.id===rr.id);const after=ev.newDice?.find(x=>x.id===rr.id);changed.push({id:rr.id,index:rr.index,from:before?.dice[rr.index],to:after?.dice[rr.index],unchanged:true})}}
 if(changed.length&&!['trounoir','tornade','chaos','usurpation'].includes(ev.card)){const changes=document.createElement('div');changes.className='card-action-dice';changes.textContent=changed.map(x=>x.from+' → '+x.to+(x.unchanged?' (relancé)':'')).join('  ·  ');message.append(changes)}
 else if(ev.card==='barriere'){const badge=document.createElement('small');badge.textContent='🛡️ Protection activée';message.append(badge)}
 const host=window.matchMedia('(max-width:750px)').matches?$('turn-banner'):$('boards');host.append(message);
 for(const touched of ev.targets||[]){if(touched.index===null)continue;if(!changed.some(c=>c.id===touched.id&&c.index===touched.index)){const before=ev.oldDice?.find(x=>x.id===touched.id);const after=ev.newDice?.find(x=>x.id===touched.id);changed.push({id:touched.id,index:touched.index,from:before?.dice?.[touched.index],to:after?.dice?.[touched.index],unchanged:true})}}
 playCardFxSound(ev.card);if(ev.card==='echange')flyExchangedDice(ev);
 if(ev.card==='tornade')moveDiceGhosts(ev.transfers||[],ev);
 if(ev.card==='usurpation')moveDiceGhosts([...Array.from({length:3},(_,i)=>({fromId:ev.playerId,fromIndex:i,toId:ev.targetId,toIndex:i})),...Array.from({length:3},(_,i)=>({fromId:ev.targetId,fromIndex:i,toId:ev.playerId,toIndex:i}))],ev);
 if(ev.card==='voleur')thiefAnimation(ev);
 if(ev.card==='usurpation'){const board=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===ev.playerId);ephemeralEffect('usurpation-mask','🎭',board?.querySelector('.identity'),2550)}
 if(ev.card==='trounoir')ephemeralEffect('blackhole-vortex','◉',$('boards'),1650);
 if(ev.card==='petitbouclier')ephemeralEffect('single-shield-fx','🛡️',target?.querySelectorAll('.die')[ev.targets?.[0]?.index],1200);
 if(ev.card==='marche'){marketDropAnimation(ev)}
 if(ev.card==='secondechance')ephemeralEffect('second-chance-visual','🔁  +2 cartes',$('game'),1100);
 for(const change of changed){const board=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===change.id);const die=board?.querySelectorAll('.die')[change.index];if(die){if(ev.card==='potion')ephemeralEffect('potion-burst','✳',die,1050);if(ev.card==='catastrophe')ephemeralEffect('catastrophe-fire','🔥',die,1150);die.classList.add('changed-die','fx-'+ev.card);setTimeout(()=>die.classList.remove('changed-die'),2600)}}
 if(target)target.classList.add('card-target');if(ev.card==='corbeau'){target?.classList.add('fx-crow-cursed')}if(ev.card==='barriere'){target?.classList.add('fx-barrier')}if(ev.card==='echange'){const a=ev.targets||[];for(const t of a){const board=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===t.id);board?.querySelectorAll('.die')[t.index]?.classList.add('fx-swap')}}
 setTimeout(()=>{message.remove();target?.classList.remove('card-target','fx-crow-cursed','fx-barrier')},2650);
}

function crownEarnedEffect(prev,s){
 if(!prev||prev.phase==='lobby'||prev.round!==s.round)return;
 for(const p of s.players){
  const before=prev.players.find(x=>x.id===p.id);
  const oldScore=prev.mode==='2v2'?prev.teamScores?.[p.team]:before?.score;
  const newScore=s.mode==='2v2'?s.teamScores?.[p.team]:p.score;
  if(newScore>oldScore){
   const board=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===p.id);
   ephemeralEffect('earned-crown','♛ +1',board,1200);
  }
 }
}
function decisiveIntro(prev,s){
 if(!s.final||s.phase!=='playing'||!prev||prev.round===s.round||seenFinalRound===s.round)return;
 seenFinalRound=s.round;
 const intro=$('final-intro');intro.hidden=false;intro.classList.remove('final-intro-active');void intro.offsetWidth;intro.classList.add('final-intro-active');
 setTimeout(()=>{intro.hidden=true;intro.classList.remove('final-intro-active')},1700);
}
function addComboEffects(s){
 if(!['playing','transition','revealing'].includes(s.phase))return;
 document.querySelectorAll('[data-dice-player]').forEach(board=>{
  const p=s.players.find(x=>x.id===board.dataset.dicePlayer);
  if(!p)return;
  const level=strength(p.dice)[0];
  board.classList.toggle('combo-triple',level===4);
  board.classList.toggle('combo-straight',level===3);
 });
}
function showFinalStatistics(s){
 const el=$('victory-stats');if(!el)return;
 el.replaceChildren();
 const stats=s.statistics||[];if(!stats.length)return;
 const title=document.createElement('h4');title.textContent='📜 Bilan de la partie';el.append(title);
 const typeNames={4:'Brelan',3:'Suite',2:'Paire',1:'Total'};
 for(const p of stats){
  const row=document.createElement('div');row.className='stat-row';
  const name=document.createElement('strong');name.textContent=p.name;
  const info=document.createElement('span');info.textContent=`${p.cardsPlayed} cartes · ${p.roundWins} manche${p.roundWins>1?'s':''} gagnée${p.roundWins>1?'s':''} · Meilleur : ${typeNames[p.bestCombination]||'—'}`;
  row.append(name,info);el.append(row);
 }
}
function animateDice(prev,s){if(!prev||s.phase==='lobby')return;if(s.actionEvent?.card==='trounoir'&&prev.actionEvent?.id!==s.actionEvent.id)return;const isNewRound=prev.round!==s.round&&s.phase==='playing';let changed=false;for(const p of s.players){const old=prev.players.find(x=>x.id===p.id),panel=[...document.querySelectorAll('[data-dice-player]')].find(el=>el.dataset.dicePlayer===p.id);p.dice.forEach((v,i)=>{const rerolled=s.actionEvent?.rerolls?.some(rr=>rr.id===p.id&&rr.index===i)&&prev.actionEvent?.id!==s.actionEvent.id;if(!isNewRound&&old?.dice?.[i]===v&&!rerolled)return;const el=panel?.querySelectorAll('.die')[i];if(!el)return;changed=true;el.classList.add('rolling');const interval=setInterval(()=>{el.textContent=String(1+Math.floor(Math.random()*6))},65);setTimeout(()=>{clearInterval(interval);el.textContent=String(v);el.classList.remove('rolling')},750)})}if(changed)diceSound()}
const identityKey='trois-couronnes-id';let id=localStorage.getItem(identityKey);if(!id||!/^[a-f0-9]{24}$/i.test(id)){id=[...crypto.getRandomValues(new Uint8Array(12))].map(x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(identityKey,id)}$('name').value=storedPrefs.name||localStorage.getItem('trois-couronnes-name')||'';if(/^#[0-9a-fA-F]{6}$/.test(storedPrefs.color||''))$('dice-color').value=storedPrefs.color;if(['uni','arcade','bois','metal','magic','damier','tapis'].includes(storedPrefs.background))$('board-bg').value=storedPrefs.background;
const requested=new URLSearchParams(location.search).get('salon');if(requested){$('room-info').textContent='Invitation au salon '+requested.toUpperCase();$('join-code').value=requested.toUpperCase()}
function notice(x){$('notice').textContent=x||''}function send(o){if(ws?.readyState===1)ws.send(JSON.stringify(o));else notice('Connexion perdue. Reconnexion en cours…')}
function connect(room){if(connecting)return;const name=$('name').value.trim();if(!name){notice('Entre un pseudo.');return}localStorage.setItem('trois-couronnes-name',name);savePrefs({name});connecting=true;if(ws){const old=ws;ws=null;old.onclose=null;old.close()}const proto=location.protocol==='https:'?'wss':'ws';const socket=new WebSocket(proto+'://'+location.host);ws=socket;socket.onopen=()=>{connecting=false;send({type:'join',room,id,name,icon:pickedAvatar})};socket.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='error'){notice(d.message);return}if(d.type==='state'){const prev=state;state=d;if(prev&&(prev.round!==d.round||prev.tableNo!==d.tableNo||prev.me!==d.me)){selected=null;directTargets=[]}notice('');const eliminationGhosts=prepareEliminationGhosts(prev,d);const own=d.players.find(p=>p.id===d.me);if(location.search!=='?salon='+d.room)history.replaceState(null,'','?salon='+d.room);render();animateDice(prev,d);cardPlayedEffect(prev,d);crownEarnedEffect(prev,d);decisiveIntro(prev,d);addComboEffects(d);eliminationSlash(prev,d,eliminationGhosts);if(prev?.phase!=='over'&&d.phase==='over')victoryApplause();if(d.phase==='lobby'&&prefsSyncedRoom!==d.room){prefsSyncedRoom=d.room;const pref=getPrefs();if(/^#[0-9a-fA-F]{6}$/.test(pref.color||'')&&['uni','arcade','bois','metal','magic','damier','tapis'].includes(pref.background||'')){const own=d.players.find(p=>p.id===d.me);if(own&&(own.color.toUpperCase()!==pref.color.toUpperCase()||own.background!==pref.background))send({type:'customize',color:pref.color,background:pref.background,icon:pickedAvatar})}}}if(d.type==='left')location.assign('/');if(d.type==='kicked'){alert(d.message||'Tu as été retiré de cette table.');location.assign('/')}};socket.onclose=()=>{connecting=false;if(!leaving&&state&&ws===socket){notice('Connexion interrompue : reconnexion automatique…');setTimeout(()=>{if(!leaving&&ws===socket)connect(state.room)},2300)}};socket.onerror=()=>notice('Serveur indisponible. Vérifie le déploiement Render.')}
function home(){if(!state){location.assign('/');return}if(state.phase!=='lobby'&&!confirm('Quitter la partie ? Ta place sera réservée pour une reconnexion, ou l’hôte pourra te remplacer par un bot.'))return;leaving=true;if(state.phase==='lobby'&&ws?.readyState===1){send({type:'leave'});setTimeout(()=>location.assign('/'),300)}else{try{ws?.close()}catch{}location.assign('/')}}
function joinFromHome(){const code=$('join-code').value.trim().toUpperCase();if(!/^[A-F0-9]{6}$/.test(code)){notice('Entre un code de salon valide de 6 caractères (de 0 à 9 et de A à F).');$('join-code').focus();return}connect(code)}
$('home').onclick=home;$('create').onclick=()=>connect('');$('join').onclick=joinFromHome;$('join-code').oninput=()=>{$('join-code').value=$('join-code').value.toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6)};$('join-code').onkeydown=e=>{if(e.key==='Enter')joinFromHome()};$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('link').value);$('copy').textContent='Copié !'}catch{$('link').select();notice('Copie le lien sélectionné.')}};
$('mode').onchange=()=>send({type:'mode',mode:$('mode').value});
$('survival-team-toggle').onchange=()=>send({type:'survivalTeams',count:$('survival-team-toggle').checked?2:0});
$('add-survival-team').onclick=()=>send({type:'survivalTeams',count:Math.min(4,(state?.survivalTeams||2)+1)});
$('remove-survival-team').onclick=()=>send({type:'survivalTeams',count:Math.max(2,(state?.survivalTeams||2)-1)});
$('save-teams').onclick=()=>send({type:'teamNames',names:teamInputNames(state?.mode)});$('shuffle-teams').onclick=()=>send({type:'shuffleTeams'});$('add-bot').onclick=()=>send({type:'addBot'});$('remove-bot').onclick=()=>{const bot=state?.players.filter(x=>x.bot).at(-1);if(bot)send({type:'removeBot',id:bot.id})};$('start').onclick=()=>send({type:'start',stake:Number($('stake').value)||0,...(state?.mode==='2v2'?{teamNames:[$('team-name-0').value,$('team-name-1').value]}:{})});$('create-table').onclick=()=>send({type:'createTable'});$('victory-change-table').onclick=()=>send({type:'moveTable',table:Number($('victory-table-select').value)});$('pass').onclick=()=>{const me=state?.players.find(p=>p.id===state.me),msg={type:'action',kind:'pass'};if(me?.secondChanceHold&&state.hand.length>3)msg.discardIndex=Number($('skip-discard-card').value);send(msg)};$('rematch').onclick=()=>send({type:'rematch'});$('return-lobby').onclick=()=>send({type:'backToLobby'});
function rank(d){if(d.length!==3)return '';const x=[...d].sort((a,b)=>a-b);if(x[0]===x[2])return 'Brelan de '+x[0];if(x[0]+1===x[1]&&x[1]+1===x[2])return 'Suite '+x.join('–');if(x[0]===x[1]||x[1]===x[2])return 'Paire de '+x[1];return 'Total '+x.reduce((a,b)=>a+b,0)}
function strength(d){if(!d||d.length!==3)return [0,0,0];const x=[...d].sort((a,b)=>a-b);if(x[0]===x[2])return [4,x[0],0];if(x[0]+1===x[1]&&x[1]+1===x[2])return [3,x[2],0];if(x[0]===x[1])return [2,x[0],x[2]];if(x[1]===x[2])return [2,x[1],x[0]];return [1,x[0]+x[1]+x[2],0]}
function compareStrength(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}
function leaders(s){if(s.phase==='lobby'||!s.players.filter(p=>!isSurvivalMode(s.mode)||!p.eliminated).every(p=>p.dice.length===3))return {players:new Set(),teams:new Set()};const top=s.players.filter(p=>!isSurvivalMode(s.mode)||!p.eliminated).sort((a,b)=>compareStrength(strength(b.dice),strength(a.dice)))[0];if(s.mode!=='2v2')return {players:new Set(s.players.filter(p=>(!isSurvivalMode(s.mode)||!p.eliminated)&&compareStrength(strength(p.dice),strength(top.dice))===0).map(p=>p.id)),teams:new Set()};const bestByTeam=[0,1].map(t=>s.players.filter(p=>p.team===t).map(p=>strength(p.dice)).sort((a,b)=>compareStrength(b,a))[0]);const topTeam=compareStrength(bestByTeam[0],bestByTeam[1]);const teams=new Set(topTeam===0?[0,1]:[topTeam>0?0:1]);return {teams,players:new Set(s.players.filter(p=>teams.has(p.team)&&compareStrength(strength(p.dice),bestByTeam[p.team])===0).map(p=>p.id))}}
function options(el,items,keep=true){const before=keep?el.value:null;el.replaceChildren(...items.map(([v,n])=>{const o=document.createElement('option');o.value=String(v);o.textContent=n;return o}));if(before!==null&&items.some(([v])=>String(v)===before))el.value=before}
const allies=new Set(['potion','epee','calice','dague','couronne','joker','miroir','benediction','barriere','petitbouclier']),enemy=new Set(['crane','echange','corbeau','voleur','usurpation','rancon']),noTarget=new Set(['pioche','gambling','chaos','secondechance','trounoir','tornade','catastrophe','marche','grimoire']);
function limitedBlocked(s,key,me){return ['echange','miroir','barriere'].includes(key)&&!!s.limitedUsed[isTeamMode(s.mode)?String(me.team):'table']?.includes(key)}
function updateChoices(){if(!state||selected===null)return;const s=state,k=s.hand[selected],me=s.players.find(x=>x.id===s.me);if(!k)return;const active=s.players.filter(p=>!isSurvivalMode(s.mode)||!p.eliminated);const targetCandidates=noTarget.has(k)?[me]:['bouclier','malediction'].includes(k)?active:enemy.has(k)?active.filter(p=>p.team!==me.team&&(k!=='corbeau'||!p.acted)):active.filter(p=>p.team===me.team);options($('target'),targetCandidates.map(p=>[p.id,p.name+(p.guard?' · Protégé':'')]));if(k==='bouclier'){options($('wand-second-player'),active.map(p=>[p.id,p.name+(p.guard?' · Protégé':'')]));const alt=active.find(p=>p.id===$('wand-second-player').value)||active[0];options($('wand-second-die'),alt.dice.map((v,i)=>[i,`Dé ${i+1} (${v})`]));}const target=s.players.find(p=>p.id===$('target').value)||targetCandidates[0];if(!target)return;options($('own'),target.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]));options($('mydie'),me.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]));options($('other'),target.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]));const own=Number($('own').value);options($('source'),target.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]).filter(([i])=>i!==own));options($('destination'),target.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]).filter(([i])=>i!==own));
 $('wand-second-player-label').hidden=k!=='bouclier';$('wand-second-die-label').hidden=k!=='bouclier';$('target-label').hidden=noTarget.has(k);$('own-label').hidden=['barriere','echange','corbeau','voleur','usurpation','rancon','pioche','gambling','chaos','secondechance','trounoir','tornade','catastrophe','marche','grimoire'].includes(k);$('exchange-label').hidden=k!=='echange';$('other-label').hidden=k!=='echange';$('source-label').hidden=k!=='miroir';$('destination-label').hidden=k!=='benediction';$('joker-label').hidden=k!=='joker';$('target-label').firstChild.textContent=['bouclier','malediction'].includes(k)?'Joueur ciblé ':enemy.has(k)?'Adversaire ':'Joueur à aider ';}

// Ciblage tactile / souris des cartes directement sur les plateaux.
function requiredTargets(k){return ['bouclier','echange','miroir','benediction'].includes(k)?2:noTarget.has(k)?0:1}
function canPickPlayer(s,p){if(s.phase!=='playing'||s.turn!==s.me||selected===null)return false;const me=s.players.find(q=>q.id===s.me),k=s.hand[selected];if(!me||me.blocked||p.eliminated)return false;
 return ((k==='corbeau'&&p.team!==me.team&&!p.acted&&!p.guard)||(['voleur','usurpation','rancon'].includes(k)&&p.team!==me.team&&!p.guard&&(k!=='voleur'||p.handCount>=1))||(k==='barriere'&&p.team===me.team))
}
function canPickDie(s,p,index){if(s.phase!=='playing'||s.turn!==s.me||selected===null)return false;
 const me=s.players.find(q=>q.id===s.me),k=s.hand[selected];if(!me||me.blocked||p.eliminated||noTarget.has(k)||k==='corbeau'||k==='barriere'||k==='voleur'||k==='usurpation'||k==='rancon')return false;
 const friend=p.team===me.team;
 if(k==='potion')return p.id===s.me;
 if(k==='echange')return directTargets.length===0?p.id===s.me:p.id!==s.me&&!p.guard;
 if(k==='bouclier'||k==='malediction')return friend||!p.guard&&!p.shieldedDice?.includes(index);
 if(enemy.has(k))return !friend&&!p.guard&&!p.shieldedDice?.includes(index);
 if(allies.has(k))return friend;
 return false
}
function selectDirectTarget(playerId,index){if(!state||selected===null)return;
 const k=state.hand[selected],p=state.players.find(p=>p.id===playerId),me=state.players.find(p=>p.id===state.me);if(!p||!me)return;
 if(index===null?!canPickPlayer(state,p):!canPickDie(state,p,index))return;
 const val={id:playerId,index};let next=[...directTargets];
 const match=t=>t.id===val.id&&t.index===val.index;
 if(next.some(match))next=next.filter(t=>!match(t));
 else if((k==='miroir'||k==='benediction')&&next.length&&next[0].id!==playerId){notice('Sélectionne les deux dés du même joueur.');return}
 else if(k==='bouclier'&&next.length&&next[0].id===playerId&&next[0].index===index)return;
 else if(k==='echange'&&next.length&&next[0].id!==state.me){next=[val]}
 else if(next.length>=requiredTargets(k))next=[val];else next.push(val);
 directTargets=next;notice('');render();
}
function renderTargetHint(s,k,enabled){
 const box=$('direct-target-hint');if(!box)return;
 box.hidden=!enabled||noTarget.has(k);if(box.hidden){$('target-controls').hidden=true;return}
 const n=requiredTargets(k),texts={rancon:'Touche le nom d’un adversaire pour lui demander une Rançon.',petitbouclier:'Touche le dé allié que tu veux protéger.',potion:'Touche un de tes dés : il deviendra 1 ou 6.',voleur:'Touche le nom d’un adversaire qui possède au moins une carte.',usurpation:'Touche le nom de l’adversaire avec lequel échanger tous tes dés.',echange:'Touche ton dé, puis un dé adverse.',bouclier:'Touche deux dés différents, même chez deux joueurs différents.',miroir:'Touche le dé à copier puis celui à modifier (même joueur).',benediction:'Touche deux dés à améliorer chez le même allié.',corbeau:'Touche le nom de l’adversaire à bloquer.',barriere:'Touche le nom du joueur à protéger.'};
 $('direct-target-text').textContent=(texts[k]||'Touche le dé que tu souhaites cibler.')+' · '+directTargets.length+'/'+n+' sélectionné'+(n>1?'s':'');
 // Valeur Joker toujours librement sélectionnable, sans menus de ciblage.
 $('target-controls').hidden=true;
 for(const child of $('target-controls').querySelectorAll('label'))child.hidden=child.id!=='joker-label';
 $('play').disabled=directTargets.length!==n;
}
function renderTargetConfirmation(s,k,enabled){
 const panel=$('target-confirm');
 const ready=!!enabled&&!noTarget.has(k)&&directTargets.length===requiredTargets(k);
 panel.hidden=!ready;if(!ready)return;
 $('confirm-card-name').textContent=(defs[k]?.[1]||'🎴')+' '+(defs[k]?.[0]||'Carte');
 $('confirm-target-details').textContent=directTargets.map(t=>{
  const p=s.players.find(x=>x.id===t.id);return(p?.name||'Joueur')+(t.index===null?'':' · dé '+(t.index+1));
 }).join('  →  ');
 const joker=k==='joker';$('confirm-joker-wrap').hidden=!joker;
 if(joker)$('confirm-joker-value').value=$('joker-value').value;
}
$('confirm-play').onclick=()=>{if(!$('target-confirm').hidden)$('play').click()};
$('confirm-cancel').onclick=()=>{directTargets=[];render()};
$('confirm-joker-value').onchange=()=>{$('joker-value').value=$('confirm-joker-value').value};
$('clear-targets').onclick=()=>{directTargets=[];render()};
$('target').onchange=updateChoices;$('own').onchange=updateChoices;$('wand-second-player').onchange=updateChoices;
function inkFor(hex){const c=hex.replace('#','');const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);return (r*.299+g*.587+b*.114)>154?'#202020':'#ffffff'}
function drawPreview(){const preview=$('avatar-preview-name');if(preview){preview.replaceChildren(avatarImg(pickedAvatar,'avatar-preview-icon'),document.createTextNode(' Mon carré'))}const v=$('custom-preview');v.className='custom-preview bg-'+$('board-bg').value;v.querySelectorAll('.die').forEach(d=>{d.style.background=$('dice-color').value;d.style.borderColor='rgba(255,255,255,.35)';d.style.color=inkFor($('dice-color').value)})}
function saveHomeStyle(){const color=$('dice-color').value,background=$('board-bg').value;savePrefs({color,background,icon:pickedAvatar});drawPreview();$('custom-status').textContent='✓ Préférences enregistrées sur cet appareil.';}$('dice-color').oninput=saveHomeStyle;$('board-bg').onchange=saveHomeStyle;const picker=$('avatar-options');for(const [key,label] of Object.entries(avatars)){const btn=document.createElement('button');btn.type='button';btn.className='avatar-choice';btn.title=label;btn.setAttribute('aria-label',label);btn.append(avatarImg(key));btn.onclick=()=>{pickedAvatar=key;savePrefs({icon:key});syncAvatarPicker();drawPreview()};picker.append(btn)}function syncAvatarPicker(){[...picker.children].forEach((b,i)=>{const isChosen=Object.keys(avatars)[i]===pickedAvatar;b.classList.toggle('picked',isChosen);b.setAttribute('aria-pressed',String(isChosen))})}syncAvatarPicker();drawPreview();
function renderLeaderboard(container,items,persistent){
 if(!container)return;
 container.replaceChildren();
 const note=document.createElement('p');note.className='muted';note.textContent=persistent?'Victoires enregistrées sur le serveur.':'Classement provisoire : les scores seront perdus si le serveur Render redémarre sans base de données.';container.append(note);
 if(!items?.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Aucune victoire enregistrée pour le moment.';container.append(empty);return}
 const table=document.createElement('table');table.className='scoreboard';const header=document.createElement('tr');for(const label of ['Rang','Joueur','Victoires']){const th=document.createElement('th');th.textContent=label;header.append(th)}table.append(header);
 items.forEach((item,i)=>{const row=document.createElement('tr');for(const value of [i===0?'🥇':i===1?'🥈':i===2?'🥉':String(i+1),item.name,String(item.wins)]){const td=document.createElement('td');td.textContent=value;row.append(td)}table.append(row)});container.append(table);
}
function renderTables(s){
 const target=$('tavern-tables');target.replaceChildren();
 $('current-table-title').textContent=`Table ${s.tableNo} — Préparation`;
 $('create-table').hidden=s.tavernHost!==s.me||s.tables.length>=4;
 $('tavern-hint').textContent=`${s.tables.length} table${s.tables.length>1?'s':''} ouverte${s.tables.length>1?'s':''} · ${s.tables.reduce((n,t)=>n+t.players.filter(p=>!p.bot).length,0)} joueur${s.tables.reduce((n,t)=>n+t.players.filter(p=>!p.bot).length,0)>1?'s':''} dans la taverne · 4 tables maximum`;
 const modes={'1v1':'1 contre 1','1v1v1':'3 joueurs','1v1v1v1':'4 joueurs','2v2':'2 contre 2','survie':'💀 Survie','survie-equipes':'⚔️ Survie par équipes','survie-2v2v2v2':'⚔️ Survie 2v2v2v2'};
 for(const table of s.tables){
  const card=document.createElement('section');card.className='tavern-table'+(table.number===s.tableNo?' is-current':'');
  const top=document.createElement('div');top.className='table-top';const title=document.createElement('h4');title.textContent='🎲 Table '+table.number;const status=document.createElement('span');status.className='tavern-status';status.textContent=table.phase==='lobby'?'Disponible':table.phase==='over'?'Partie terminée':'En partie';top.append(title,status);
  if(s.tavernHost===s.me&&table.number!==1){
   const close=document.createElement('button');close.type='button';close.className='table-close';close.textContent='×';close.setAttribute('aria-label','Fermer la table '+table.number);close.title=table.players.length?'Retire tous les joueurs et bots pour fermer cette table':'Fermer la table '+table.number;close.disabled=table.players.length!==0||table.phase!=='lobby';
   close.onclick=()=>send({type:'closeTable',table:table.number});top.append(close)
  }
  card.append(top);
  const meta=document.createElement('div');meta.className='table-meta';const required=isSurvivalMode(table.mode)?Math.max(readyCount(table.mode,table.survivalTeams),table.players.length):counts[table.mode]||4;const ready=table.players.filter(p=>p.bot||p.ready).length;meta.textContent=(modes[table.mode]||table.mode)+(table.mode==='survie'&&table.survivalTeams?' · '+table.survivalTeams+' équipes':'')+' · '+table.players.length+'/'+(isSurvivalMode(table.mode)?8:4)+' places occupées · '+ready+'/'+required+' prêts'+(table.extensions?.length?' · 🧩 '+table.extensions.length+' extensions':'');card.append(meta);
  const seats=document.createElement('div');seats.className='table-seats';for(let i=0;i<(isSurvivalMode(table.mode)?8:4);i++){const seat=document.createElement('div');seat.className='table-seat'+(table.players[i]?'':' empty');const occupant=table.players[i];const seatName=document.createElement('span');seatName.className='seat-person';seatName.textContent=occupant?(isTeamMode(table.mode,table.survivalTeams)?(teamColors[occupant.team]+' '):'')+(occupant.bot?'🤖 ':'👤 ')+occupant.name+(occupant.bot||occupant.ready?' · ✓ Prêt':' · En attente'):'◌ Place libre';seat.append(seatName);
   if(occupant&&s.me===table.host&&s.tableNo===table.number&&table.phase==='lobby'&&occupant.id!==s.me){
    const kick=document.createElement('button');kick.type='button';kick.className='seat-kick';kick.textContent='✕';kick.title='Retirer '+occupant.name+' de la table';kick.setAttribute('aria-label','Retirer '+occupant.name);
    kick.onclick=()=>{if(occupant.bot||confirm('Retirer '+occupant.name+' de la table ?'))send({type:occupant.bot?'removeBot':'kickPlayer',id:occupant.id})};seat.append(kick)
   }
   if(occupant&&(occupant.bot||occupant.ready))seat.classList.add('seat-ready');seats.append(seat)}card.append(seats);
  const button=document.createElement('button');button.type='button';button.className='secondary';const current=table.number===s.tableNo;const allowed=!current&&table.phase==='lobby'&&table.players.length<counts[table.mode];const myself=table.players.find(p=>p.id===s.me);const allReady=(isSurvivalMode(table.mode)?canStartSurvival(table.players.length,configuredTeams(table.mode,table.survivalTeams)):table.players.length===required)&&table.players.every(p=>p.bot||p.ready);if(current&&table.phase==='lobby'){
    if(allReady&&s.host===s.me){button.textContent='🎲 Lancer la partie !';button.className='table-launch';button.onclick=()=>send({type:'start',stake:Number($('stake').value)||0,...(isTeamMode(s.mode)?{teamNames:teamInputNames(s.mode)}:{})})}
    else{button.textContent=myself?.ready?(s.host===s.me?'✓ Tu es prêt · En attente des autres':'✓ Prêt · Annuler'):'✓ Je suis prêt';button.className=myself?.ready?'table-ready secondary':'table-ready';button.onclick=()=>send({type:'tableReady'});if(myself?.ready&&s.host===s.me)button.title='Les autres joueurs doivent se déclarer prêts'}
  }else{button.disabled=!allowed;button.textContent=current?'✓ Ta table':table.phase!=='lobby'?'Partie en cours':!allowed?'Table complète':'↔ Rejoindre la table';button.onclick=()=>send({type:'moveTable',table:table.number})}card.append(button);target.append(card)
 }
 const summary=$('extensions-summary');if(summary)summary.textContent=s.enabledExtras?.length?'🧩 Extensions : '+s.enabledExtras.map(k=>defs[k][0]).join(' · ')+' ('+ (40+s.enabledExtras.reduce((n,k)=>n+extraCounts[k],0))+' cartes)':'🎴 Paquet classique : 40 cartes.';
 const container=$('extension-options');if(container){container.replaceChildren(...extraCards.map(k=>{const row=document.createElement('label');row.className='extension-option';const check=document.createElement('input');check.type='checkbox';check.checked=(s.enabledExtras||[]).includes(k);check.onchange=()=>{const added=new Set(s.enabledExtras||[]);if(check.checked)added.add(k);else added.delete(k);send({type:'setExtensions',cards:extraCards.filter(x=>added.has(x))})};const label=document.createElement('span');label.textContent=defs[k][1]+' '+defs[k][0]+' ×'+extraCounts[k]+' · '+defs[k][2];row.append(check,label);return row}))}
 renderLeaderboard($('lobby-leaderboard'),s.leaderboard,s.scoresPersistent);
}
function renderVictorySwitch(s){
 const container=$('victory-table-switch');const choices=s.tables.filter(t=>t.number!==s.tableNo&&t.phase==='lobby'&&t.players.length<counts[t.mode]);container.hidden=!choices.length;
 const sel=$('victory-table-select');sel.replaceChildren(...choices.map(t=>{const o=document.createElement('option');o.value=String(t.number);o.textContent='Table '+t.number+' ('+t.players.length+'/'+(isSurvivalMode(t.mode)?8:4)+')';return o}));
}
function render(){if(!state)return;const s=state,me=s.players.find(p=>p.id===s.me),host=s.host===s.me;document.body.classList.toggle('hand-docked',s.phase==='playing'||s.phase==='transition'||s.phase==='market'||s.phase==='grimoire'||s.phase==='ransom');if(s.phase==='lobby'){/* Fermer les calques du jeu avant de rendre le salon interactif. */$('rematch-panel').hidden=true;$('reveal').hidden=true;$('between').hidden=true;$('final-intro').hidden=true;if(revealInterval){clearInterval(revealInterval);revealInterval=null}}$('entry').hidden=true;$('home').hidden=false;$('lobby').hidden=s.phase!=='lobby';if(s.phase==='lobby')renderTables(s);$('game').hidden=s.phase==='lobby';$('link').value=location.origin+'/?salon='+s.room;$('code').textContent='Code du salon : '+s.room;
 $('members').replaceChildren(...s.players.filter(p=>!p.bot).map((p,i)=>{
   const e=document.createElement('div');e.className='player'+(p.bot?' bot':'');
   e.style.display='flex';e.style.alignItems='center';e.style.justifyContent='space-between';e.style.gap='10px';
   const name=document.createElement('span');name.style.minWidth='0';name.style.overflowWrap='anywhere';
   name.textContent=(p.online?'🟢 ':'⚪ ')+(isTeamMode(s.mode)?`${teamColors[p.team]} ${s.teamNames[p.team]} · `:'')+p.name+(p.bot?' 🤖':'')+(p.id===s.host?' 👑 Hôte':'');
   e.prepend(avatarImg(p.icon));e.append(name);
   if(host&&p.bot&&s.phase==='lobby'){
     const remove=document.createElement('button');remove.type='button';remove.className='secondary';
     remove.textContent='✕ Retirer';remove.title='Retirer '+p.name+' du salon';
     remove.style.flexShrink='0';remove.style.padding='7px 10px';remove.style.fontSize='12px';
     remove.onclick=()=>send({type:'removeBot',id:p.id});
     e.append(remove);
   }
   return e;
 }));$('host-config').hidden=!host;$('remove-bot').hidden=true;$('mode').value=s.mode;
 $('survival-config').hidden=s.mode!=='survie';$('survival-team-toggle').checked=s.mode==='survie'&&s.survivalTeams>=2;
 $('survival-team-options').hidden=!$('survival-team-toggle').checked;
 $('survival-team-count').textContent=(s.survivalTeams||2)+' équipes';
 $('survival-team-format').textContent=survivalFormat(s.survivalTeams||2)+' · 2 vies par joueur';
 $('remove-survival-team').disabled=s.survivalTeams<=2;$('add-survival-team').disabled=s.survivalTeams>=4;
$('team-hint').textContent=isTeamMode(s.mode)?(s.teamDrawCount?'✅ Tirage n°'+s.teamDrawCount+' effectué : les partenaires ont changé.':'Les équipes sont tirées au sort automatiquement au lancement (ou avec le bouton ci-dessous).'):'';$('team-names-config').hidden=!host||!isTeamMode(s.mode);$('shuffle-teams').disabled=s.mode==='2v2'?s.players.length!==4:!canStartSurvival(s.players.length,configuredTeams(s.mode,s.survivalTeams));document.querySelectorAll('.four-team-extra').forEach((el,i)=>el.hidden=numTeams(s.mode)<=i+2);const preview=$('team-preview');preview.replaceChildren();if(isTeamMode(s.mode)){if(s.teamDrawCount){const confirmation=document.createElement('strong');confirmation.className='team-draw-confirmation';confirmation.textContent='🎲 Composition tirée au sort n°'+s.teamDrawCount+' :';preview.append(confirmation)}for(let ti=0;ti<numTeams(s.mode);ti++){const line=document.createElement('p');line.className='team-preview-line';line.textContent=(teamColors[ti]+' ')+s.teamNames[ti]+' : '+(s.players.filter(p=>p.team===ti).map(p=>p.name).join(' + ')||'Places libres');preview.append(line)}}if(s.phase==='lobby')for(let ti=0;ti<4;ti++){const el=$('team-name-'+ti);if(document.activeElement!==el)el.value=s.teamNames[ti]||''}$('add-bot').disabled=s.players.length>=counts[s.mode];$('remove-bot').disabled=!s.players.some(p=>p.bot);const validSize=isSurvivalMode(s.mode)?canStartSurvival(s.players.length,configuredTeams(s.mode,s.survivalTeams)):s.players.length===counts[s.mode];
 $('start').disabled=!validSize||!s.players.every(p=>p.bot||p.ready);
 $('waiting').textContent=!validSize?(isSurvivalMode(s.mode)?(configuredTeams(s.mode,s.survivalTeams)===0?'Encore un joueur pour la Survie.':configuredTeams(s.mode,s.survivalTeams)===2?'Survie en équipes : 4, 6 ou 8 joueurs requis (2v2, 3v3, 4v4).':configuredTeams(s.mode,s.survivalTeams)===3?'Il faut 6 joueurs pour jouer en 2v2v2.':'Il faut 8 joueurs pour jouer en 2v2v2v2.'):`Encore ${counts[s.mode]-s.players.length} place(s) à remplir avec des amis ou des bots.`):!s.players.every(p=>p.bot||p.ready)?'Tous les joueurs doivent cliquer sur « Je suis prêt » depuis leur table.':host?'Tout le monde est prêt : lance la partie depuis ta table !':'Tous les joueurs sont prêts : l’hôte peut lancer la partie.';if(s.phase==='lobby')return;
 $('round').textContent=(s.final?'⚔️ MANCHE DÉCISIVE':'Manche '+s.round)+' · '+(s.mode==='2v2'?'2 contre 2':isTeamMode(s.mode)?'⚔️ Survie par équipes · '+s.survivors+' survivants':isSurvivalMode(s.mode)?'💀 Survie · '+s.survivors+' survivants':s.mode);$('pot').textContent='🪙 '+s.stake*s.players.length+' PO fictives';const acting=s.players.find(p=>p.id===s.turn),turnName=acting?.name;const banner=$('turn-banner');banner.className='turn-banner '+(s.phase==='revealing'?'banner-result':s.phase==='playing'?'banner-active':'banner-wait');const message=s.phase==='grimoire'?'📖 Le Grimoire interdit est ouvert…':s.phase==='ransom'?'💰 '+(s.ransomVictim===s.me?'Choisis comment payer la Rançon !':'La Rançon est en cours…'):s.phase==='market'?'🌑 '+(s.marketOwner===s.me?'Choisis ta carte au Marché des Ombres !':'Le Marché des Ombres est en cours…'):s.phase==='playing'&&s.final?'⚔️ Manche décisive — '+(s.turn===s.me?'à toi de jouer !':`au tour de ${turnName} !`):s.phase==='playing'?(s.turn===s.me?'C’est à toi de jouer !':`C’est au tour de ${turnName} !`):s.phase==='transition'?`${turnName||'Le joueur'} vient de jouer…`:s.phase==='revealing'?(s.roundResult||'Résultat de la manche'):s.phase==='over'?'Partie terminée !':'Nouvelle manche imminente';$('turn-banner-title').textContent=message;const currentTurnIndex=s.phase==='playing'?s.order.indexOf(s.turn):-1;
 const upcomingId=currentTurnIndex>=0?s.order[currentTurnIndex+1]:null;
 const upcoming=s.players.find(p=>p.id===upcomingId);
 const upcomingText=s.phase==='playing'?(upcoming?'⏭️ Ensuite : '+upcoming.name+(upcoming.bot?' 🤖':''):'🏁 Dernier joueur : fin de manche après ce coup.') : '';
 $('turn-banner-subtitle').textContent=s.phase==='playing'?upcomingText:s.phase==='transition'?'Les dés restent visibles avant le prochain tour.':s.phase==='revealing'?(s.final?'⚔️ Mort subite : une seule couronne décide de la victoire.':'Observez les dés finaux pendant 4 secondes.'):s.phase==='over'?(isSurvivalMode(s.mode)?(isTeamMode(s.mode)?'La dernière équipe survivante remporte la partie.':'Le dernier survivant remporte la partie.'):'Les Trois Couronnes ont été remportées.'):'';$('turn').textContent=s.phase==='playing'?'Au tour de '+turnName:s.phase==='revealing'?'Fin de manche':s.phase==='over'?'Partie terminée':'Manche en cours';const leading=leaders(s);
 $('boards').className='mode-'+s.mode+(isSurvivalMode(s.mode)?' mode-survie':'');
 const survivors=s.players.filter(p=>!p.eliminated);
 const surviveCount=survivors.length;
 // Cases de la ronde suffisamment séparées pour huit plateaux. Les rayons
 // raccourcissent lorsque le nombre de survivants diminue.
 const ringLayouts={
  2:[[29,50],[71,50]],
  3:[[50,26],[27,72],[73,72]],
  4:[[28,27],[72,27],[72,73],[28,73]],
  5:[[50,23],[75,36],[66,77],[34,77],[25,36]],
  6:[[50,18],[76,33],[76,67],[50,82],[24,67],[24,33]],
  7:[[50,14],[76,24],[80,54],[64,82],[36,82],[20,54],[24,24]],
  8:[[50,15],[75,20],[81,50],[75,80],[50,85],[25,80],[19,50],[25,20]]
 };
 if(isSurvivalMode(s.mode)){
  const height=surviveCount>=8?590:surviveCount>=5?580:surviveCount===4?455:surviveCount===3?420:340;
  $('boards').style.setProperty('--arena-height',height+'px');
  $('boards').style.setProperty('--arena-scale',String(.62+.38*surviveCount/8));
 }else{$('boards').style.removeProperty('--arena-height');$('boards').style.removeProperty('--arena-scale')}
 const danger=new Set();
 if(isSurvivalMode(s.mode)&&['playing','transition'].includes(s.phase)&&survivors.length){
  const ranks=survivors.map(q=>strength(q.dice)).sort(compareStrength),worst=ranks[0];
  survivors.forEach(q=>{if(compareStrength(strength(q.dice),worst)===0)danger.add(q.id)})
 }
 $('boards').replaceChildren(...s.players.map((p,i)=>{const e=document.createElement('section');e.dataset.dicePlayer=p.id;e.className='panel player'+(p.eliminated?' eliminated':'')+(p.bot?' bot':'')+(p.id===s.me?' me':'')+(danger.has(p.id)?' survival-danger':'')+(p.crowMarked?' crow-cursed':'')+(p.id===s.turn&&s.phase==='playing'?' active':'')+(leading.players.has(p.id)?' strongest':'')+(leading.teams.has(p.team)&&s.mode==='2v2'?' team-leading':'')+(isTeamMode(s.mode)?[' team-blue',' team-red',' team-green',' team-yellow'][p.team]||'':'')+' bg-'+(p.background||'uni');if(isSurvivalMode(s.mode)&&!p.eliminated){
   const idx=survivors.findIndex(x=>x.id===p.id);const point=ringLayouts[surviveCount]?.[idx]||[50,50];
   e.style.left=point[0]+'%';e.style.top=point[1]+'%';
 }
 const head=document.createElement('div');head.className='player-head';if(canPickPlayer(s,p)){head.classList.add('target-player-available');head.tabIndex=0;head.setAttribute('role','button');head.title='Toucher pour cibler '+p.name;head.onclick=()=>selectDirectTarget(p.id,null);head.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectDirectTarget(p.id,null)}}}const name=document.createElement('strong');name.className='identity';name.append(avatarImg(p.icon));const nameText=document.createElement('span');nameText.className='identity-name';nameText.textContent=(s.mode==='2v2'?String.fromCharCode(65+i)+' · ':isTeamMode(s.mode)?teamColors[p.team]+' ':'')+p.name+(p.bot?' 🤖':'')+(p.id===s.me?' (toi)':'');name.append(nameText);const score=s.mode==='2v2'?s.teamScores[p.team]:p.score;const crowns=document.createElement('span');crowns.className='crowns';crowns.setAttribute('aria-label',score+' couronne(s)');const rivalMax=s.mode==='2v2'?s.teamScores[1-p.team]:Math.max(0,...s.players.filter(x=>x.id!==p.id).map(x=>x.score));const targetScore=s.final?6:Math.max(3,rivalMax+2);const shown=Math.max(3,Math.min(7,Math.max(score,targetScore)));for(let j=0;j<shown;j++){const crown=document.createElement('span');crown.className=j<score?'crown-full':j===targetScore-1?'crown-goal':'crown-empty'+(j>=3?' crown-locked':'');crown.textContent='♛';crown.title=j<score?'Couronne acquise':j===targetScore-1?'Objectif pour gagner':'Couronne encore nécessaire';crowns.append(crown)}const tags=document.createElement('span');tags.className='tag';tags.textContent=rank(p.dice)+(isSurvivalMode(s.mode)?'':(p.guard?' · ✨ Protégé':'')+(p.blocked?' · 🐦‍⬛ Bloqué':p.crowMarked?' · 🐦‍⬛ Maudit':'')+(p.acted?' · A joué':''))+' · '+p.handCount+' cartes';head.append(name,tags);const crowning=document.createElement('div');crowning.className='board-crowns';crowning.append(crowns);if(isSurvivalMode(s.mode)){
   const hearts=document.createElement('div');hearts.className='survival-hearts';
   hearts.setAttribute('aria-label',(p.lives||0)+' vie(s) restante(s)');
   for(let v=0;v<2;v++){const h=document.createElement('span');h.textContent=v<(p.lives||0)?'♥':'♡';h.className=v<(p.lives||0)?'heart-live':'heart-lost';hearts.append(h)}
   e.append(hearts);
 }else e.append(crowning);
 const effects=document.createElement('div');effects.className='board-effects';effects.setAttribute('aria-label','Effets en cours');
 const putEffect=(label,cls,detail)=>{const badge=document.createElement('span');badge.className=cls;badge.textContent=label;badge.title=detail||label;badge.setAttribute('aria-label',detail||label);effects.append(badge)};
 if(p.guard){if(isSurvivalMode(s.mode))putEffect('🛡️','effect-compact shield-compact','Bouclier magique actif');else {const guard=document.createElement('span');guard.className='effect-icon effect-shield';guard.textContent='🛡️ Bouclier magique';guard.title='Protégé des cartes adverses pour cette manche';head.append(guard)}}
 if(p.crowMarked||p.blocked){if(isSurvivalMode(s.mode))putEffect('🐦‍⬛','effect-compact crow-compact','Corbeau de malchance actif')}
 if(leading.players.has(p.id)){if(isSurvivalMode(s.mode))putEffect('👑','effect-compact leader-compact','Meilleurs dés');else {const leader=document.createElement('span');leader.className='leader-mark';leader.textContent=s.mode==='2v2'?'👑 Meilleurs dés · Équipe en tête':'👑 Meilleurs dés';head.append(leader)}}
 if(isSurvivalMode(s.mode)&&danger.has(p.id))putEffect('☠️ -1 vie','effect-compact risk-compact','Perd une vie si la manche se termine maintenant');
 e.append(head);if(isSurvivalMode(s.mode))e.append(effects);
 const dice=document.createElement('div');dice.className='dice';p.dice.forEach((v,dieIndex)=>{const d=document.createElement('div');d.className='die';d.dataset.seat=String(i);d.textContent=v;const dieColor=p.diceOrigins?.[dieIndex]||p.color||'#5B9BE6';d.dataset.dieIndex=String(dieIndex);if(canPickDie(s,p,dieIndex)){
   d.classList.add('die-targetable');d.setAttribute('role','button');d.tabIndex=0;d.title='Cibler le dé '+(dieIndex+1)+' de '+p.name;d.onclick=()=>selectDirectTarget(p.id,dieIndex);d.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectDirectTarget(p.id,dieIndex)}}
  }if(p.shieldedDice?.includes(dieIndex)){d.classList.add('shielded-die');d.title=(d.title?d.title+' · ':'')+'Protégé par un Bouclier';}if(directTargets.some(t=>t.id===p.id&&t.index===dieIndex))d.classList.add('die-target-selected');d.style.background=dieColor;d.style.borderColor='rgba(255,255,255,.35)';d.style.color=inkFor(dieColor);dice.append(d)});e.append(dice);const bottom=document.createElement('div');bottom.className='board-status';const turnState=document.createElement('span');turnState.textContent=p.id===s.turn&&s.phase==='playing'?(p.id===s.me?'⚔️ À toi de jouer':'⌛ À '+p.name+' de jouer'):p.acted?'✓ A joué':'🎲 En attente';const side=document.createElement('span');side.textContent=isSurvivalMode(s.mode)?(p.eliminated?'💀 Éliminé':(p.attacksReceived||0)+'/2 attaques'+(p.guard?' · 🛡️ Protégé':'')):score+' couronne'+(score>1?'s':'')+' · Objectif '+targetScore;bottom.append(turnState,side);e.append(bottom);if(directTargets.some(t=>t.id===p.id&&t.index===null))e.classList.add('player-target-selected');if(!p.online){const off=document.createElement('p');off.className='muted';off.textContent='Déconnecté';e.append(off)}return e}));
 if(isSurvivalMode(s.mode)){
  const center=document.createElement('div');center.className='survival-center';
  const skull=document.createElement('span');skull.className='survival-emblem';skull.textContent='☠';
  const count=document.createElement('strong');count.textContent=s.survivors+' survivant'+(s.survivors>1?'s':'');
  const subtitle=document.createElement('small');subtitle.textContent=isTeamMode(s.mode)?'Dernière équipe en lice : victorieuse':'Dernier en vie : vainqueur';
  center.append(skull,count,subtitle);if(isTeamMode(s.mode)){const remaining=document.createElement('small');remaining.className='survival-team-count';if(numTeams(s.mode)>=3){remaining.classList.add('four-teams-count');s.survivingTeams.forEach((n,i)=>{const tag=document.createElement('span');tag.textContent=teamColors[i]+' '+n;tag.title=s.teamNames[i]+' : '+n+' survivant'+(n>1?'s':'');remaining.append(tag)})}else remaining.textContent=s.teamNames.slice(0,numTeams(s.mode)).map((n,i)=>teamColors[i]+' '+n+' : '+s.survivingTeams[i]).join(' · ');center.append(remaining)}$('boards').append(center);
  const eliminated=s.players.filter(p=>p.eliminated);
  if(eliminated.length){const grave=document.createElement('div');grave.className='survival-graveyard';grave.textContent='💀 Spectateurs : '+eliminated.map(p=>p.name).join(' · ');$('boards').append(grave)}
 }
 $('reveal-title').textContent=s.roundResult||'Résultat de la manche';$('reveal').hidden=s.phase!=='revealing';if(revealInterval){clearInterval(revealInterval);revealInterval=null}if(s.phase==='revealing'){const tick=()=>{$('reveal-count').textContent=Math.max(0,Math.ceil((s.revealUntil-Date.now())/1000))+' seconde(s)'};tick();revealInterval=setInterval(tick,180)}
 $('between').hidden=s.phase!=='between';if(s.phase==='between'){$('round-result').textContent=s.roundResult||'Manche terminée';const until=s.nextRoundAt||Date.now()+3000;const tickNext=()=>{$('ready-count').textContent='Prochaine manche automatique dans '+Math.max(0,Math.ceil((until-Date.now())/1000))+' seconde(s)…'};tickNext();revealInterval=setInterval(tickNext,180)}
 $('rematch-panel').hidden=s.phase!=='over';if(s.phase==='over'){renderVictorySwitch(s);showFinalStatistics(s);const winner=isTeamMode(s.mode)?s.teamNames[s.winner]:s.players.find(p=>p.id===s.winner)?.name;const score=s.mode==='2v2'?s.teamScores[s.winner]:isSurvivalMode(s.mode)?0:s.players.find(p=>p.id===s.winner)?.score||0;const nombre={3:'Trois',4:'Quatre',5:'Cinq'}[score];$('victory').textContent=s.mode==='2v2'?'👑 '+winner+' remporte les Trois Couronnes !':isTeamMode(s.mode)?'⚔️ '+winner+' est la dernière équipe survivante !':isSurvivalMode(s.mode)?'💀 '+winner+' est le dernier survivant !':s.final?'⚔️ '+winner+' remporte la mort subite !':nombre?'👑 '+winner+' a obtenu les '+nombre+' Couronnes !':'👑 '+winner+' remporte la partie !';$('victory-score').textContent=isSurvivalMode(s.mode)?'🏆 Victoire en mode Survie · '+s.round+' manches':score+' couronne'+(score>1?'s':'')+' remportée'+(score>1?'s':'');const crownBox=$('victory-crowns');crownBox.replaceChildren(...Array.from({length:isSurvivalMode(s.mode)?0:score},()=>{const c=document.createElement('span');c.textContent='♛';return c}));$('return-lobby').hidden=!host;$('return-lobby-hint').hidden=host;$('rematch-status').textContent=s.players.filter(p=>p.ready).length+' / '+s.players.length+' joueurs prêts à rejouer';$('rematch-members').replaceChildren(...s.players.map(p=>{const e=document.createElement('div');e.className='status-line';e.textContent=(p.ready?'✅ ':'⌛ ')+p.name+(p.ready?' — prêt':' — en attente');return e}));$('rematch').textContent=me.ready?'Annuler ma demande':'🔄 Je veux rejouer'}
 $('pile').textContent='· '+s.pile+' dans la pioche';if(selected!==null&&selected>=s.hand.length)selected=null;const myTurn=s.phase==='playing'&&s.turn===s.me&&!me.acted;$('limited-hint').textContent='Limites déjà utilisées : '+(s.limitedUsed[isTeamMode(s.mode)?String(me.team):'table']||[]).map(k=>defs[k][0]).join(', ');if(!$('limited-hint').textContent.endsWith(' : ')){}else $('limited-hint').textContent='Aucune carte limitée jouée dans cette manche.';
 // Sélection privée du Marché : seul le propriétaire du tour reçoit les noms des cartes.
 const market=$('market-panel'),marketOpts=$('market-options');market.hidden=s.phase!=='market';if(s.phase==='market'){
  marketOpts.replaceChildren();
  const mine=s.marketOwner===s.me;
  $('market-status').textContent=mine?'Choisis une des cartes révélées : les autres retourneront dans la pioche.':`Le marché est ouvert : ${s.marketCount} carte${s.marketCount>1?'s':''} face cachée${s.marketCount>1?'s':''}. Un joueur choisit…`;
  if(mine){for(const item of s.marketOptions){const b=document.createElement('button');b.type='button';b.className='market-choice card card-magic';b.append(document.createTextNode(defs[item.key]?.[1]+' '+item.name));b.onclick=()=>send({type:'marketPick',index:item.index});marketOpts.append(b)}}
  else for(let i=0;i<s.marketCount;i++){const b=document.createElement('span');b.className='market-card-back';b.textContent='🂠';b.setAttribute('aria-label','Carte face cachée');marketOpts.append(b)}
 }

 const choicePanel=$('choice-panel'),choiceOpts=$('choice-options');choicePanel.hidden=!['grimoire','ransom'].includes(s.phase);choiceOpts.replaceChildren();
 if(s.phase==='grimoire'){
  const mine=s.grimoireOwner===s.me; $('choice-heading').textContent='📖 Grimoire interdit';
  $('choice-status').textContent=mine?'Choisis une carte à conserver. Les deux autres retournent sous la pioche.':'Un joueur consulte secrètement son Grimoire interdit…';
  if(mine){for(const item of s.grimoireOptions){const b=document.createElement('button');b.type='button';b.className='market-choice card card-magic';b.textContent=(defs[item.key]?.[1]||'📜')+' '+item.name;b.onclick=()=>send({type:'grimoirePick',index:item.index,discardIndex:s.hand.length>=3?Number($('grimoire-replace').value):null});choiceOpts.append(b)}
   const replacement=$('grimoire-replace-wrap');replacement.hidden=s.hand.length<3;if(!replacement.hidden)options($('grimoire-replace'),s.hand.map((key,i)=>[i,defs[key]?.[0]||key]));
  }else{$('grimoire-replace-wrap').hidden=true;for(let i=0;i<s.grimoireCount;i++){const back=document.createElement('span');back.className='market-card-back';back.textContent='🂠';choiceOpts.append(back)}}
 }else if(s.phase==='ransom'){
  $('grimoire-replace-wrap').hidden=true;$('choice-heading').textContent='💰 Rançon';
  const mine=s.ransomVictim===s.me;$('choice-status').textContent=mine?'Choisis ton sacrifice : donner une carte ou relancer ton dé le plus élevé.':'Un adversaire choisit comment payer la Rançon…';
  if(mine){if(s.hand.length>=3){const discard=document.createElement('button');discard.className='market-choice card card-attack';discard.textContent='💰 Défausser une carte';discard.onclick=()=>send({type:'ransomPick',choice:'discard',discardIndex:Number($('ransom-discard').value)});choiceOpts.append(discard);const sel=$('ransom-discard-wrap');sel.hidden=false;options($('ransom-discard'),s.hand.map((key,i)=>[i,defs[key]?.[0]||key]));}else $('ransom-discard-wrap').hidden=true;
   const reroll=document.createElement('button');reroll.className='market-choice card card-magic';reroll.textContent='🎲 Relancer mon meilleur dé';reroll.onclick=()=>send({type:'ransomPick',choice:'reroll'});choiceOpts.append(reroll);
  }else $('ransom-discard-wrap').hidden=true;
 }else{$('grimoire-replace-wrap').hidden=true;$('ransom-discard-wrap').hidden=true;}
 const chancePick=$('seconde-choice'),chanceSkip=$('seconde-pass-choice');const isMyPlay=s.phase==='playing'&&s.turn===s.me&&!me.acted;
 chancePick.hidden=true; // Seconde Chance ne sacrifie plus de carte avant la pioche.
 chanceSkip.hidden=!(isMyPlay&&me.secondChanceHold&&s.hand.length>3);
 if(!chanceSkip.hidden)options($('skip-discard-card'),s.hand.map((key,i)=>[i,defs[key][0]]));
 const handScroll=$('cards').scrollLeft;$('cards').replaceChildren(...s.hand.map((k,i)=>{const b=document.createElement('button');const block=limitedBlocked(s,k,me);b.className='card card-'+k+' '+(['crane','echange','corbeau','voleur','usurpation','rancon'].includes(k)?'card-attack ':['bouclier','barriere','petitbouclier'].includes(k)?'card-defence ':['couronne','joker'].includes(k)?'card-rare ':['miroir','benediction','chaos','gambling','trounoir','tornade','catastrophe','marche','grimoire'].includes(k)?'card-magic ':'card-support ')+(selected===i?' selected':'')+(block?' blocked':'')+(extraCards.includes(k)?' card-extension':'');b.disabled=!myTurn||block||!!me.blocked;const symbol=document.createElement('span');symbol.className='symbol';symbol.textContent=defs[k][1];const t=document.createElement('strong');t.textContent=defs[k][0];const d=document.createElement('small');d.textContent=block?'Déjà utilisée dans cette manche':defs[k][2];const foot=document.createElement('span');foot.className='card-footer';foot.textContent=extraCards.includes(k)?'🧩 Extension':['crane','echange','corbeau'].includes(k)?'↗ Adversaire':['couronne','joker'].includes(k)?'✦ Précieuse':'✦ Allié';if(['echange','miroir','barriere'].includes(k))foot.textContent+='  · 1/manche';b.append(symbol,t,d,foot);b.onclick=()=>{if(selected!==i)directTargets=[];selected=i;render()};return b}));$('cards').scrollLeft=handScroll;const key=selected===null?null:s.hand[selected],validCard=key&&!limitedBlocked(s,key,me);$('target-controls').hidden=!myTurn||!validCard;$('play').hidden=s.phase!=='playing';$('pass').hidden=s.phase!=='playing';$('play').disabled=!myTurn||!validCard||!!me.blocked;$('pass').disabled=!myTurn;if(myTurn&&validCard)updateChoices();renderTargetHint(s,key,myTurn&&validCard);renderTargetConfirmation(s,key,myTurn&&validCard&&!me.blocked);if(myTurn&&validCard&&!noTarget.has(key))$('play').hidden=true;
 const offline=s.players.filter(x=>!x.online&&!x.bot);$('offline').hidden=!host||!offline.length;$('offline-buttons').replaceChildren(...offline.map(p=>{const b=document.createElement('button');b.className='secondary';b.textContent='🤖 Remplacer '+p.name+' par un bot';b.onclick=()=>{if(confirm('Remplacer définitivement ce joueur par un bot pour cette partie ?'))send({type:'replaceOffline',id:p.id})};return b}));
 $('info').textContent=s.final&&s.phase==='playing'?'⚔️ Manche décisive : nouveaux dés, nouvelle main et ordre de jeu retiré au sort.':s.phase==='transition'?'Observez le dernier dé modifié : le prochain tour arrive dans 1,5 seconde.':s.phase==='revealing'?'Résultat affiché pendant 4 secondes, puis nouvelle manche automatiquement.':s.phase==='between'?'Prochaine manche automatique.':s.phase==='over'?'Partie terminée : proposez une revanche !':myTurn?(me.blocked?'🐦‍⬛ Le Corbeau t’empêche de jouer une carte : passe ton tour.':me.bonusPending?(me.secondChanceHold&&s.hand.length>3?'Seconde Chance : joue une carte ou défausse-en une si tu passes (4 cartes en main).':'Action supplémentaire : joue une autre carte ou passe pour la conserver.'):'À toi : joue une carte ou passe.'):'En attente du prochain joueur.';
 $('history').replaceChildren(...s.log.slice().reverse().map(t=>{const e=document.createElement('div');e.textContent=t;return e}))}
$('play').onclick=()=>{const s=state,k=s?.hand[selected];if(!k)return;
 const msg={type:'action',kind:'card',cardIndex:selected,value:Number($('joker-value').value)};
 if(!noTarget.has(k)){
  if(directTargets.length!==requiredTargets(k)){notice('Choisis les cibles directement sur les dés ou le joueur.');return}
  const a=directTargets[0],b=directTargets[1];
  if(k==='echange'){msg.target=b.id;msg.own=a.index;msg.other=b.index}
  else if(k==='bouclier'){msg.target=a.id;msg.own=a.index;msg.secondTarget=b.id;msg.secondIndex=b.index}
  else if(k==='miroir'){msg.target=a.id;msg.source=a.index;msg.own=b.index}
  else if(k==='benediction'){msg.target=a.id;msg.own=a.index;msg.destination=b.index}
  else{msg.target=a.id;if(a.index!==null)msg.own=a.index}
 }
 send(msg);selected=null;directTargets=[];$('target-confirm').hidden=true;
};fetch('/api/leaderboard').then(r=>r.ok?r.json():null).then(data=>{if(data)renderLeaderboard($('entry-leaderboard'),data.scores,data.persistent)}).catch(()=>{});if(requested&&localStorage.getItem('trois-couronnes-name'))connect(requested);
})();
