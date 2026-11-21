'use strict';
// Tests sans navigateur, au niveau serveur : jeu de base 40, options par table, effets du pack Chaos.
const assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs');const tasks=[];
const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname,setTimeout:fn=>(tasks.push(fn),tasks.length),require:n=>n==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const run=x=>vm.runInContext(x,ctx);const act=run('act'),deck=run('deck'),newTable=run('newTable'),handle=run('handle'),view=run('view'),resolveMarket=run('resolveMarket');
const mkWs=(id,key)=>({room:key,pid:id,readyState:1,received:[],send(raw){this.received.push(JSON.parse(raw))}});
let seq=0;function make(n=2,mode='1v1'){
 tasks.length=0;const id=++seq,t={code:'T'+id,host:'A',tables:[]},r=newTable(t,1,'A');t.tables.push(r);r.phase='playing';r.mode=mode;r.turn=0;r.order=Array.from({length:n},(_,i)=>i);r.actionSerial=0;r.deck=['epee','couronne','joker','miroir','crane','epee'];r.discard=[];
 r.players=Array.from({length:n},(_,i)=>{const name=String.fromCharCode(65+i),color=['#dd2222','#ffdc33','#4ed47c','#3377ff'][i%4];return {id:name,name,bot:false,ws:mkWs(name,r.key),color,dice:[2+i,2+i,4+i],diceOrigins:[color,color,color],hand:[],lives:2,eliminated:false,score:0,guard:false,blocked:false,acted:false,bonusPending:false,bonusUsed:false};});return {r,t,p:r.players[0],q:r.players[1]}
}
const base=deck();assert.equal(base.length,40);assert.equal(run('Object.keys(extraDefs).length'),11);assert.equal(run('Object.values(extraDefs).reduce((n,v)=>n+v.count,0)'),17);
{
 const {r,p,q}=make();r.phase='lobby';run('rooms').set(r.key,r);
 handle(p.ws,{type:'setExtensions',cards:['potion','trounoir','marche']});assert.equal(r.enabledExtras.length,3);assert.equal(deck(r).length,45);assert.equal(deck().length,40);assert.equal(view(r,p).enabledExtras.length,3);
 handle(q.ws,{type:'setExtensions',cards:[]});assert.match(q.ws.received.at(-1).message,/maître de table/);assert.equal(r.enabledExtras.length,3);
 handle(p.ws,{type:'setExtensions',cards:run('Object.keys(extraDefs)')});assert.equal(deck(r).length,57);r.phase='playing';handle(p.ws,{type:'setExtensions',cards:[]});assert.match(p.ws.received.at(-1).message,/avant la partie/);
}
{
 const {r,p,q}=make();p.hand=['potion'];p.dice=[2,3,4];act(r,p,{kind:'card',cardIndex:0,target:'A',own:1});assert([1,6].includes(p.dice[1]));assert.equal(r.actionEvent.card,'potion');
 const {r:r2,p:p2}=make();p2.hand=['potion'];assert.throws(()=>act(r2,p2,{kind:'card',cardIndex:0,target:'B',own:0}),/Cible non autorisée|Potion instable/);
}
{
 const {r,p,q}=make();p.hand=['voleur'];q.hand=['epee','joker','crane'];act(r,p,{kind:'card',cardIndex:0,target:'B'});assert.equal(q.hand.length,2);assert.equal(r.discard.length,2);assert.equal(r.actionEvent.card,'voleur');
 const next=make();next.p.hand=['voleur'];next.q.hand=['epee','joker'];act(next.r,next.p,{kind:'card',cardIndex:0,target:'B'});assert.equal(next.q.hand.length,1);
}
{
 const {r,p}=make();p.hand=['secondechance','epee','crane'];r.deck=['joker','couronne'];act(r,p,{kind:'card',cardIndex:0});assert.equal(p.hand.length,4);assert.equal(p.hand.includes('epee'),true);assert.equal(p.bonusPending,true);assert.equal(p.secondChanceHold,true);assert.equal(p.acted,false);
 r.phase='playing';assert.throws(()=>act(r,p,{kind:'pass'}),/main contient 4 cartes/);act(r,p,{kind:'pass',discardIndex:1});assert.equal(p.hand.length,3);assert.equal(p.acted,true);assert.equal(p.secondChanceHold,false);
}
{
 const {r,p}=make();p.hand=['secondechance','epee','crane'];r.deck=['joker','couronne'];act(r,p,{kind:'card',cardIndex:0});assert.equal(p.hand.length,4);r.phase='playing';act(r,p,{kind:'card',cardIndex:0,target:p.id,own:0});assert.equal(p.hand.length,3);assert.equal(p.acted,true);assert.equal(p.bonusPending,false);
}
{
 // Pioche incomplète : passer avec seulement 3 cartes ne doit rien défausser.
 const {r,p}=make();p.hand=['secondechance','epee','crane'];r.deck=['joker'];r.discard=[];act(r,p,{kind:'card',cardIndex:0});assert.equal(p.hand.length,3);r.phase='playing';const before=[...p.hand];act(r,p,{kind:'pass'});assert.deepEqual([...p.hand],before);
}
{
 // Seconde Chance jouée en deuxième action n'autorise pas de quatrième carte.
 const {r,p}=make();p.hand=['secondechance','epee','crane'];r.deck=['joker','couronne'];p.bonusUsed=true;act(r,p,{kind:'card',cardIndex:0});assert.equal(p.hand.length,3);assert.equal(p.bonusPending,false);assert.equal(p.acted,true);
}
{
 const {r,p,q}=make();p.hand=['trounoir'];p.guard=true;q.guard=true;r.players.forEach(x=>x.dice=[2,3,4]);act(r,p,{kind:'card',cardIndex:0});assert.equal(r.actionEvent.rerolls.length,6);assert.equal(p.guard,true);assert.equal(q.guard,true);
}
{
 const {r,p,q}=make(3,'1v1v1');r.players.forEach((x,i)=>{x.dice=[i+1,i+1,i+1];x.diceOrigins=[x.color,x.color,x.color]});p.hand=['tornade'];const before=r.players.map(x=>({die:x.dice[0],color:x.color}));act(r,p,{kind:'card',cardIndex:0});const transfers=r.actionEvent.transfers;assert.equal(transfers.length,3);for(const t of transfers){const from=r.players.find(x=>x.id===t.fromId),to=r.players.find(x=>x.id===t.toId);assert.equal(to.dice[t.toIndex],before[r.players.indexOf(from)].die);assert.equal(to.diceOrigins[t.toIndex],from.color)}
}
{
 const {r,p,q}=make();p.hand=['usurpation'];p.dice=[1,2,3];q.dice=[6,6,6];act(r,p,{kind:'card',cardIndex:0,target:'B'});assert.equal(p.dice.join(','),'6,6,6');assert.equal(q.dice.join(','),'1,2,3');assert(p.diceOrigins.every(c=>c===q.color));assert(q.diceOrigins.every(c=>c===p.color));assert.equal(r.actionEvent.targets.length,6);
}
{
 const {r,p,q}=make(3,'1v1v1');p.hand=['catastrophe'];p.dice=[2,2,5];q.dice=[6,6,6];r.players[2].dice=[6,6,6];act(r,p,{kind:'card',cardIndex:0});assert.equal(r.actionEvent.targets.length,2);for(const t of r.actionEvent.targets)assert.equal(r.players.find(x=>x.id===t.id).dice[t.index],1);assert.equal(p.dice.join(','),'2,2,5');
}
{
 const {r,p,q}=make(3,'1v1v1');r.players[2].hand=['potion','dague'];p.hand=['marche','epee','crane'];q.hand=['couronne','joker'];r.deck=[];act(r,p,{kind:'card',cardIndex:0});assert.equal(r.phase,'market');assert.equal(r.marketPending.pool.length,3);assert.equal(view(r,p).marketOptions.length,3);assert.equal(view(r,q).marketOptions.length,0);assert.equal(view(r,q).marketCount,3);
 const chosen=r.marketPending.pool[1];resolveMarket(r,p,1);assert.equal(r.phase,'transition');assert(p.hand.includes(chosen));assert.equal(r.deck.length,2);assert.equal(r.marketPending,null);
}
console.log('OK Extensions V3.6 : paquet 40/57, autorisations, onze cartes, couleurs, défausse, marché privé et ciblage.');
