(()=>{'use strict';
const $=id=>document.getElementById(id),defs={epee:['Épée','⚔️','+2 sur un dé allié'],bouclier:['Bouclier','🛡️','Relance un dé allié'],crane:['Crâne','💀','−2 sur un dé ennemi'],echange:['Échange','🔄','Échange un de tes dés avec un dé ennemi'],calice:['Calice','💎','Un dé allié devient 1'],dague:['Dague','🗡️','−2 sur un dé allié'],malediction:['Malédiction','🎲','Relance un dé ennemi'],couronne:['Couronne','👑','Un dé allié devient 6'],barriere:['Barrière magique','✨','Protège un joueur allié'],joker:['Joker','🃏','Choisis une valeur de 1 à 6'],miroir:['Miroir','🪞','Copie un dé sur un autre dé allié'],benediction:['Bénédiction','🌟','+1 sur deux dés alliés différents']};
const counts={'1v1':2,'1v1v1':3,'1v1v1v1':4,'2v2':4};let ws=null,state=null,selected=null,connecting=false,leaving=false,revealInterval=null,audioCtx=null,prefsSyncedRoom=null;
const prefKey='trois-couronnes-preferences-v1';function getPrefs(){try{return JSON.parse(localStorage.getItem(prefKey)||'{}')||{}}catch{return {}}}function savePrefs(data){try{localStorage.setItem(prefKey,JSON.stringify({...getPrefs(),...data}))}catch{}}const storedPrefs=getPrefs();
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
function cardPlayedEffect(prev,s){
 const ev=s.actionEvent;if(!ev||ev.id===seenAction||!prev)return;
 seenAction=ev.id;
 // On ne rejoue pas une ancienne animation à l'arrivée dans une partie.
 if(prev.round!==s.round)return;
 const target=[...document.querySelectorAll('[data-dice-player]')].find(x=>x.dataset.dicePlayer===ev.targetId);
 const signs={epee:'⚔️',bouclier:'🛡️',crane:'💀',echange:'🔄',calice:'💎',dague:'🗡️',malediction:'🎲',couronne:'👑',barriere:'🛡️',joker:'🃏',miroir:'🪞',benediction:'🌟'};
 ephemeralEffect('card-effect',(signs[ev.card]||'✦')+' '+ev.cardName,target,1050);
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
function animateDice(prev,s){if(!prev||s.phase==='lobby')return;const isNewRound=prev.round!==s.round&&s.phase==='playing';let changed=false;for(const p of s.players){const old=prev.players.find(x=>x.id===p.id),panel=[...document.querySelectorAll('[data-dice-player]')].find(el=>el.dataset.dicePlayer===p.id);p.dice.forEach((v,i)=>{if(!isNewRound&&old?.dice?.[i]===v)return;const el=panel?.querySelectorAll('.die')[i];if(!el)return;changed=true;el.classList.add('rolling');const interval=setInterval(()=>{el.textContent=String(1+Math.floor(Math.random()*6))},65);setTimeout(()=>{clearInterval(interval);el.textContent=String(v);el.classList.remove('rolling')},750)})}if(changed)diceSound()}
const identityKey='trois-couronnes-id';let id=localStorage.getItem(identityKey);if(!id||!/^[a-f0-9]{24}$/i.test(id)){id=[...crypto.getRandomValues(new Uint8Array(12))].map(x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(identityKey,id)}$('name').value=storedPrefs.name||localStorage.getItem('trois-couronnes-name')||'';if(/^#[0-9a-fA-F]{6}$/.test(storedPrefs.color||''))$('dice-color').value=storedPrefs.color;if(['uni','arcade','bois','metal','magic','damier'].includes(storedPrefs.background))$('board-bg').value=storedPrefs.background;
const requested=new URLSearchParams(location.search).get('salon');if(requested){$('room-info').textContent='Invitation au salon '+requested.toUpperCase();$('join').hidden=false;$('create').hidden=true}
function notice(x){$('notice').textContent=x||''}function send(o){if(ws?.readyState===1)ws.send(JSON.stringify(o));else notice('Connexion perdue. Reconnexion en cours…')}
function connect(room){if(connecting)return;const name=$('name').value.trim();if(!name){notice('Entre un pseudo.');return}localStorage.setItem('trois-couronnes-name',name);savePrefs({name});connecting=true;if(ws){const old=ws;ws=null;old.onclose=null;old.close()}const proto=location.protocol==='https:'?'wss':'ws';const socket=new WebSocket(proto+'://'+location.host);ws=socket;socket.onopen=()=>{connecting=false;send({type:'join',room,id,name})};socket.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='error'){pendingCustom=null;notice(d.message);return}if(d.type==='state'){const prev=state;state=d;notice('');const own=d.players.find(p=>p.id===d.me);if(location.search!=='?salon='+d.room)history.replaceState(null,'','?salon='+d.room);render();animateDice(prev,d);cardPlayedEffect(prev,d);crownEarnedEffect(prev,d);decisiveIntro(prev,d);addComboEffects(d);if(prev?.phase!=='over'&&d.phase==='over')victoryApplause();if(d.phase==='lobby'&&prefsSyncedRoom!==d.room){prefsSyncedRoom=d.room;const pref=getPrefs();if(/^#[0-9a-fA-F]{6}$/.test(pref.color||'')&&['uni','arcade','bois','metal','magic','damier'].includes(pref.background||'')){const own=d.players.find(p=>p.id===d.me);if(own&&(own.color.toUpperCase()!==pref.color.toUpperCase()||own.background!==pref.background))send({type:'customize',color:pref.color,background:pref.background})}}}if(d.type==='left')location.assign('/')};socket.onclose=()=>{connecting=false;if(!leaving&&state&&ws===socket){notice('Connexion interrompue : reconnexion automatique…');setTimeout(()=>{if(!leaving&&ws===socket)connect(state.room)},2300)}};socket.onerror=()=>notice('Serveur indisponible. Vérifie le déploiement Render.')}
function home(){if(!state){location.assign('/');return}if(state.phase!=='lobby'&&!confirm('Quitter la partie ? Ta place sera réservée pour une reconnexion, ou l’hôte pourra te remplacer par un bot.'))return;leaving=true;if(state.phase==='lobby'&&ws?.readyState===1){send({type:'leave'});setTimeout(()=>location.assign('/'),300)}else{try{ws?.close()}catch{}location.assign('/')}}
$('home').onclick=home;$('create').onclick=()=>connect('');$('join').onclick=()=>connect(requested);$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('link').value);$('copy').textContent='Copié !'}catch{$('link').select();notice('Copie le lien sélectionné.')}};
$('mode').onchange=()=>send({type:'mode',mode:$('mode').value});$('save-teams').onclick=()=>send({type:'teamNames',names:[$('team-name-0').value,$('team-name-1').value]});$('shuffle-teams').onclick=()=>send({type:'shuffleTeams'});$('add-bot').onclick=()=>send({type:'addBot'});$('remove-bot').onclick=()=>{const bot=state?.players.filter(x=>x.bot).at(-1);if(bot)send({type:'removeBot',id:bot.id})};$('start').onclick=()=>send({type:'start',stake:Number($('stake').value)||0,...(state?.mode==='2v2'?{teamNames:[$('team-name-0').value,$('team-name-1').value]}:{})});$('pass').onclick=()=>send({type:'action',kind:'pass'});$('rematch').onclick=()=>send({type:'rematch'});$('return-lobby').onclick=()=>send({type:'backToLobby'});
function rank(d){if(d.length!==3)return '';const x=[...d].sort((a,b)=>a-b);if(x[0]===x[2])return 'Brelan de '+x[0];if(x[0]+1===x[1]&&x[1]+1===x[2])return 'Suite '+x.join('–');if(x[0]===x[1]||x[1]===x[2])return 'Paire de '+x[1];return 'Total '+x.reduce((a,b)=>a+b,0)}
function strength(d){if(!d||d.length!==3)return [0,0,0];const x=[...d].sort((a,b)=>a-b);if(x[0]===x[2])return [4,x[0],0];if(x[0]+1===x[1]&&x[1]+1===x[2])return [3,x[2],0];if(x[0]===x[1])return [2,x[0],x[2]];if(x[1]===x[2])return [2,x[1],x[0]];return [1,x[0]+x[1]+x[2],0]}
function compareStrength(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}
function leaders(s){if(s.phase==='lobby'||!s.players.every(p=>p.dice.length===3))return {players:new Set(),teams:new Set()};const top=[...s.players].sort((a,b)=>compareStrength(strength(b.dice),strength(a.dice)))[0];if(s.mode!=='2v2')return {players:new Set(s.players.filter(p=>compareStrength(strength(p.dice),strength(top.dice))===0).map(p=>p.id)),teams:new Set()};const bestByTeam=[0,1].map(t=>s.players.filter(p=>p.team===t).map(p=>strength(p.dice)).sort((a,b)=>compareStrength(b,a))[0]);const topTeam=compareStrength(bestByTeam[0],bestByTeam[1]);const teams=new Set(topTeam===0?[0,1]:[topTeam>0?0:1]);return {teams,players:new Set(s.players.filter(p=>teams.has(p.team)&&compareStrength(strength(p.dice),bestByTeam[p.team])===0).map(p=>p.id))}}
function options(el,items,keep=true){const before=keep?el.value:null;el.replaceChildren(...items.map(([v,n])=>{const o=document.createElement('option');o.value=String(v);o.textContent=n;return o}));if(before!==null&&items.some(([v])=>String(v)===before))el.value=before}
const allies=new Set(['epee','bouclier','calice','dague','couronne','joker','miroir','benediction','barriere']),enemy=new Set(['crane','malediction','echange']);
function limitedBlocked(s,key,me){return ['echange','miroir','barriere'].includes(key)&&!!s.limitedUsed[s.mode==='2v2'?String(me.team):'table']?.includes(key)}
function updateChoices(){if(!state||selected===null)return;const s=state,k=s.hand[selected],me=s.players.find(x=>x.id===s.me);if(!k)return;const targetCandidates=enemy.has(k)?s.players.filter(p=>p.team!==me.team):s.players.filter(p=>p.team===me.team);options($('target'),targetCandidates.map(p=>[p.id,p.name+(p.guard?' · Protégé':'')]));const target=s.players.find(p=>p.id===$('target').value)||targetCandidates[0];if(!target)return;options($('own'),target.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]));options($('mydie'),me.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]));options($('other'),target.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]));const own=Number($('own').value);options($('source'),target.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]).filter(([i])=>i!==own));options($('destination'),target.dice.map((d,i)=>[i,`Dé ${i+1} (${d})`]).filter(([i])=>i!==own));
 $('target-label').hidden=false;$('own-label').hidden=['barriere','echange'].includes(k);$('exchange-label').hidden=k!=='echange';$('other-label').hidden=k!=='echange';$('source-label').hidden=k!=='miroir';$('destination-label').hidden=k!=='benediction';$('joker-label').hidden=k!=='joker';$('target-label').firstChild.textContent=enemy.has(k)?'Adversaire ':'Joueur à aider ';}
$('target').onchange=updateChoices;$('own').onchange=updateChoices;
function inkFor(hex){const c=hex.replace('#','');const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);return (r*.299+g*.587+b*.114)>154?'#202020':'#ffffff'}
function drawPreview(){const v=$('custom-preview');v.className='custom-preview bg-'+$('board-bg').value;v.querySelectorAll('.die').forEach(d=>{d.style.background=$('dice-color').value;d.style.borderColor='rgba(255,255,255,.35)';d.style.color=inkFor($('dice-color').value)})}
function saveHomeStyle(){const color=$('dice-color').value,background=$('board-bg').value;savePrefs({color,background});drawPreview();$('custom-status').textContent='✓ Préférences enregistrées sur cet appareil.';}$('dice-color').oninput=saveHomeStyle;$('board-bg').onchange=saveHomeStyle;drawPreview();
function render(){if(!state)return;const s=state,me=s.players.find(p=>p.id===s.me),host=s.host===s.me;if(s.phase==='lobby'){/* Fermer les calques du jeu avant de rendre le salon interactif. */$('rematch-panel').hidden=true;$('reveal').hidden=true;$('between').hidden=true;$('final-intro').hidden=true;if(revealInterval){clearInterval(revealInterval);revealInterval=null}}$('entry').hidden=true;$('home').hidden=false;$('lobby').hidden=s.phase!=='lobby';$('game').hidden=s.phase==='lobby';$('link').value=location.origin+'/?salon='+s.room;$('code').textContent='Code du salon : '+s.room;
 $('members').replaceChildren(...s.players.map((p,i)=>{
   const e=document.createElement('div');e.className='player'+(p.bot?' bot':'');
   e.style.display='flex';e.style.alignItems='center';e.style.justifyContent='space-between';e.style.gap='10px';
   const name=document.createElement('span');name.style.minWidth='0';name.style.overflowWrap='anywhere';
   name.textContent=(p.online?'🟢 ':'⚪ ')+(s.mode==='2v2'?`${i<2?'🔵':'🔴'} ${s.teamNames[p.team]} · `:'')+p.name+(p.bot?' 🤖':'')+(p.id===s.host?' 👑 Hôte':'');
   e.append(name);
   if(host&&p.bot&&s.phase==='lobby'){
     const remove=document.createElement('button');remove.type='button';remove.className='secondary';
     remove.textContent='✕ Retirer';remove.title='Retirer '+p.name+' du salon';
     remove.style.flexShrink='0';remove.style.padding='7px 10px';remove.style.fontSize='12px';
     remove.onclick=()=>send({type:'removeBot',id:p.id});
     e.append(remove);
   }
   return e;
 }));$('host-config').hidden=!host;$('mode').value=s.mode;$('team-hint').textContent=s.mode==='2v2'?(s.teamDrawCount?'✅ Tirage n°'+s.teamDrawCount+' effectué : les partenaires ont changé.':'Les équipes sont tirées au sort automatiquement au lancement (ou avec le bouton ci-dessous).'):'';$('team-names-config').hidden=!host||s.mode!=='2v2';$('shuffle-teams').disabled=s.players.length!==4;const preview=$('team-preview');preview.replaceChildren();if(s.mode==='2v2'){if(s.teamDrawCount){const confirmation=document.createElement('strong');confirmation.className='team-draw-confirmation';confirmation.textContent='🎲 Composition tirée au sort n°'+s.teamDrawCount+' :';preview.append(confirmation)}for(let ti=0;ti<2;ti++){const line=document.createElement('p');line.className='team-preview-line';line.textContent=(ti===0?'🔵 ':'🔴 ')+s.teamNames[ti]+' : '+(s.players.filter(p=>p.team===ti).map(p=>p.name).join(' + ')||'Places libres');preview.append(line)}}if(s.phase==='lobby'){if(document.activeElement!==$('team-name-0'))$('team-name-0').value=s.teamNames[0];if(document.activeElement!==$('team-name-1'))$('team-name-1').value=s.teamNames[1]}$('add-bot').disabled=s.players.length>=counts[s.mode];$('remove-bot').disabled=!s.players.some(p=>p.bot);$('start').disabled=s.players.length!==counts[s.mode];$('waiting').textContent=s.players.length<counts[s.mode]?`Encore ${counts[s.mode]-s.players.length} place(s) à remplir avec des amis ou des bots.`:host?'Tous les joueurs sont là : tu peux démarrer.':'En attente du lancement par l’hôte.';if(s.phase==='lobby')return;
 $('round').textContent=(s.final?'⚔️ MANCHE DÉCISIVE':'Manche '+s.round)+' · '+(s.mode==='2v2'?'2 contre 2':s.mode);$('pot').textContent='🪙 '+s.stake*s.players.length+' PO fictives';const acting=s.players.find(p=>p.id===s.turn),turnName=acting?.name;const banner=$('turn-banner');banner.className='turn-banner '+(s.phase==='revealing'?'banner-result':s.phase==='playing'?'banner-active':'banner-wait');const message=s.phase==='playing'&&s.final?'⚔️ Manche décisive — '+(s.turn===s.me?'à toi de jouer !':`au tour de ${turnName} !`):s.phase==='playing'?(s.turn===s.me?'C’est à toi de jouer !':`C’est au tour de ${turnName} !`):s.phase==='transition'?`${turnName||'Le joueur'} vient de jouer…`:s.phase==='revealing'?(s.roundResult||'Résultat de la manche'):s.phase==='over'?'Partie terminée !':'Nouvelle manche imminente';$('turn-banner-title').textContent=message;$('turn-banner-subtitle').textContent=s.phase==='playing'?(acting?.bot?'Le bot prépare son coup…':s.turn===s.me?'Choisis une carte ou passe ton tour.':'En attente de son action…'):s.phase==='transition'?'Les dés restent visibles avant le prochain tour.':s.phase==='revealing'?(s.final?'⚔️ Mort subite : une seule couronne décide de la victoire.':'Observez les dés finaux pendant 4 secondes.'):s.phase==='over'?'Les Trois Couronnes ont été remportées.':'';$('turn').textContent=s.phase==='playing'?'Au tour de '+turnName:s.phase==='revealing'?'Fin de manche':s.phase==='over'?'Partie terminée':'Manche en cours';const leading=leaders(s);
 $('boards').className='mode-'+s.mode;$('boards').replaceChildren(...s.players.map((p,i)=>{const e=document.createElement('section');e.dataset.dicePlayer=p.id;e.className='panel player'+(p.bot?' bot':'')+(p.id===s.me?' me':'')+(p.id===s.turn&&s.phase==='playing'?' active':'')+(leading.players.has(p.id)?' strongest':'')+(leading.teams.has(p.team)&&s.mode==='2v2'?' team-leading':'')+(s.mode==='2v2'?(p.team===0?' team-blue':' team-red'):'')+' bg-'+(p.background||'uni');const head=document.createElement('div');head.className='player-head';const name=document.createElement('strong');name.className='identity';name.textContent=(s.mode==='2v2'?String.fromCharCode(65+i)+' · ':'')+p.name+(p.bot?' 🤖':'')+(p.id===s.me?' (toi)':'');const score=s.mode==='2v2'?s.teamScores[p.team]:p.score;const crowns=document.createElement('span');crowns.className='crowns';crowns.setAttribute('aria-label',score+' couronne(s)');for(let j=0;j<Math.max(3,Math.min(5,score));j++){const crown=document.createElement('span');crown.className=j<score?'crown-full':'crown-empty';crown.textContent='♛';crowns.append(crown)}const tags=document.createElement('span');tags.className='tag';tags.textContent=rank(p.dice)+(p.guard?' · ✨ Protégé':'')+(p.acted?' · A joué':'')+' · '+p.handCount+' cartes';head.append(name,crowns,tags);if(p.guard){const guard=document.createElement('span');guard.className='effect-icon effect-shield';guard.textContent='🛡️ Bouclier magique';guard.title='Protégé des cartes adverses pour cette manche';head.append(guard)}if(leading.players.has(p.id)){const leader=document.createElement('span');leader.className='leader-mark';leader.textContent=s.mode==='2v2'?'👑 Meilleurs dés · Équipe en tête':'👑 Meilleurs dés';head.append(leader)}e.append(head);const dice=document.createElement('div');dice.className='dice';p.dice.forEach(v=>{const d=document.createElement('div');d.className='die';d.dataset.seat=String(i);d.textContent=v;d.style.background=p.color||'#5B9BE6';d.style.borderColor='rgba(255,255,255,.35)';d.style.color=inkFor(p.color||'#5B9BE6');dice.append(d)});e.append(dice);if(!p.online){const off=document.createElement('p');off.className='muted';off.textContent='Déconnecté';e.append(off)}return e}));
 $('reveal-title').textContent=s.roundResult||'Résultat de la manche';$('reveal').hidden=s.phase!=='revealing';if(revealInterval){clearInterval(revealInterval);revealInterval=null}if(s.phase==='revealing'){const tick=()=>{$('reveal-count').textContent=Math.max(0,Math.ceil((s.revealUntil-Date.now())/1000))+' seconde(s)'};tick();revealInterval=setInterval(tick,180)}
 $('between').hidden=s.phase!=='between';if(s.phase==='between'){$('round-result').textContent=s.roundResult||'Manche terminée';const until=s.nextRoundAt||Date.now()+3000;const tickNext=()=>{$('ready-count').textContent='Prochaine manche automatique dans '+Math.max(0,Math.ceil((until-Date.now())/1000))+' seconde(s)…'};tickNext();revealInterval=setInterval(tickNext,180)}
 $('rematch-panel').hidden=s.phase!=='over';if(s.phase==='over'){showFinalStatistics(s);const winner=s.mode==='2v2'?s.teamNames[s.winner]:s.players.find(p=>p.id===s.winner)?.name;const score=s.mode==='2v2'?s.teamScores[s.winner]:s.players.find(p=>p.id===s.winner)?.score||0;const nombre={3:'Trois',4:'Quatre',5:'Cinq'}[score];$('victory').textContent=s.final?'⚔️ '+winner+' remporte la mort subite !':nombre?'👑 '+winner+' a obtenu les '+nombre+' Couronnes !':'👑 '+winner+' remporte la partie !';$('victory-score').textContent=score+' couronne'+(score>1?'s':'')+' remportée'+(score>1?'s':'');const crownBox=$('victory-crowns');crownBox.replaceChildren(...Array.from({length:score},()=>{const c=document.createElement('span');c.textContent='♛';return c}));$('return-lobby').hidden=!host;$('return-lobby-hint').hidden=host;$('rematch-status').textContent=s.players.filter(p=>p.ready).length+' / '+s.players.length+' joueurs prêts à rejouer';$('rematch-members').replaceChildren(...s.players.map(p=>{const e=document.createElement('div');e.className='status-line';e.textContent=(p.ready?'✅ ':'⌛ ')+p.name+(p.ready?' — prêt':' — en attente');return e}));$('rematch').textContent=me.ready?'Annuler ma demande':'🔄 Je veux rejouer'}
 $('pile').textContent='· '+s.pile+' dans la pioche';if(selected!==null&&selected>=s.hand.length)selected=null;const myTurn=s.phase==='playing'&&s.turn===s.me&&!me.acted;$('limited-hint').textContent='Limites déjà utilisées : '+(s.limitedUsed[s.mode==='2v2'?String(me.team):'table']||[]).map(k=>defs[k][0]).join(', ');if(!$('limited-hint').textContent.endsWith(' : ')){}else $('limited-hint').textContent='Aucune carte limitée jouée dans cette manche.';
 $('cards').replaceChildren(...s.hand.map((k,i)=>{const b=document.createElement('button');const block=limitedBlocked(s,k,me);b.className='card'+(selected===i?' selected':'')+(block?' blocked':'');b.disabled=!myTurn||block;const symbol=document.createElement('span');symbol.className='symbol';symbol.textContent=defs[k][1];const t=document.createElement('strong');t.textContent=defs[k][0];const d=document.createElement('small');d.textContent=block?'Déjà utilisée dans cette manche':defs[k][2];b.append(symbol,t,d);b.onclick=()=>{selected=i;render()};return b}));const key=selected===null?null:s.hand[selected],validCard=key&&!limitedBlocked(s,key,me);$('target-controls').hidden=!myTurn||!validCard;$('play').hidden=s.phase!=='playing';$('pass').hidden=s.phase!=='playing';$('play').disabled=!myTurn||!validCard;$('pass').disabled=!myTurn;if(myTurn&&validCard)updateChoices();
 const offline=s.players.filter(x=>!x.online&&!x.bot);$('offline').hidden=!host||!offline.length;$('offline-buttons').replaceChildren(...offline.map(p=>{const b=document.createElement('button');b.className='secondary';b.textContent='🤖 Remplacer '+p.name+' par un bot';b.onclick=()=>{if(confirm('Remplacer définitivement ce joueur par un bot pour cette partie ?'))send({type:'replaceOffline',id:p.id})};return b}));
 $('info').textContent=s.final&&s.phase==='playing'?'⚔️ Manche décisive : nouveaux dés, nouvelle main et ordre de jeu retiré au sort.':s.phase==='transition'?'Observez le dernier dé modifié : le prochain tour arrive dans 1,5 seconde.':s.phase==='revealing'?'Résultat affiché pendant 4 secondes, puis nouvelle manche automatiquement.':s.phase==='between'?'Prochaine manche automatique.':s.phase==='over'?'Partie terminée : proposez une revanche !':myTurn?'À toi : joue une carte ou passe.':'En attente du prochain joueur.';
 $('history').replaceChildren(...s.log.slice().reverse().map(t=>{const e=document.createElement('div');e.textContent=t;return e}))}
$('play').onclick=()=>{const s=state,k=s?.hand[selected];if(!k)return;const target=$('target').value;const msg={type:'action',kind:'card',cardIndex:selected,target,own:Number($('own').value),source:Number($('source').value),destination:Number($('destination').value),value:Number($('joker-value').value)};if(k==='echange'){msg.own=Number($('mydie').value);msg.other=Number($('other').value)}send(msg);selected=null};if(requested&&localStorage.getItem('trois-couronnes-name'))connect(requested);
})();
