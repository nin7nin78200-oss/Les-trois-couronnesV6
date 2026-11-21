'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');let tasks=[];
const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname,setTimeout:fn=>(tasks.push(fn),tasks.length),require:n=>n==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const run=x=>vm.runInContext(x,ctx),act=run('act'),deck=run('deck'),newTable=run('newTable'),view=run('view'),resolveGrimoire=run('resolveGrimoire'),resolveRansom=run('resolveRansom'),handle=run('handle');
let counter=0;
function mk(mode='1v1',n=2){tasks=[];const t={code:'V39'+ ++counter,host:'A',tables:[]},r=newTable(t,1,'A');t.tables.push(r);r.mode=mode;r.phase='playing';r.order=Array.from({length:n},(_,i)=>i);r.turn=0;r.actionSerial=0;r.deck=['epee','couronne','joker','dague','crane','barriere'];r.discard=[];r.players=Array.from({length:n},(_,i)=>{const id=String.fromCharCode(65+i),color=['#112233','#445566','#778899','#AABBCC'][i%4];return {id,name:id,bot:false,ws:{room:r.key,pid:id,readyState:1,send(){}},color,dice:[3,4,5],diceOrigins:[color,color,color],hand:[],lives:2,eliminated:false,guard:false,shieldedDice:[],score:0,acted:false,bonusPending:false,bonusUsed:false};});return {r,p:r.players[0],q:r.players[1]};}
function resetTurn(r){r.phase='playing';r.turn=0;r.players[0].acted=false;}
assert.equal(deck().length,40);assert.equal(run('Object.keys(extraDefs).length'),11);assert.equal(run('Object.values(extraDefs).reduce((a,x)=>a+x.count,0)'),17);
{const x=mk();x.r.enabledExtras=run('Object.keys(extraDefs)');assert.equal(deck(x.r).length,57)}
// Shield: one die only, persists through the same round, does not protect neighboring dice.
{
 const {r,p,q}=mk();p.hand=['petitbouclier'];act(r,p,{kind:'card',cardIndex:0,target:'A',own:1});assert.deepEqual([...p.shieldedDice],[1]);assert.deepEqual([...view(r,p).players[0].shieldedDice],[1]);
 resetTurn(r);r.turn=1;q.hand=['crane'];assert.throws(()=>act(r,q,{kind:'card',cardIndex:0,target:'A',own:1}),/Bouclier/);assert.equal(q.hand.length,1);
 act(r,q,{kind:'card',cardIndex:0,target:'A',own:0});assert.equal(p.dice[0],1);assert.equal(p.dice[1],4);
}
// Shield: spells, swaps, usurpation, hostile second target of magic wand blocked.
{
 const {r,p,q}=mk();q.shieldedDice=[2];p.hand=['bouclier'];assert.throws(()=>act(r,p,{kind:'card',cardIndex:0,target:'A',own:0,secondTarget:'B',secondIndex:2}),/Bouclier/);
 const x=mk();x.q.shieldedDice=[0];x.p.hand=['echange'];assert.throws(()=>act(x.r,x.p,{kind:'card',cardIndex:0,target:'B',own:1,other:0}),/Bouclier/);
 const y=mk();y.q.shieldedDice=[0];y.p.hand=['usurpation'];assert.throws(()=>act(y.r,y.p,{kind:'card',cardIndex:0,target:'B'}),/Bouclier/);
 const z=mk();z.q.shieldedDice=[0];z.p.hand=['malediction'];assert.throws(()=>act(z.r,z.p,{kind:'card',cardIndex:0,target:'B',own:0}),/Bouclier/);
}
// Global effects intentionally affect shielded dice, like the existing full magical barrier.
{const {r,p,q}=mk();q.shieldedDice=[0];p.hand=['trounoir'];act(r,p,{kind:'card',cardIndex:0});assert.equal(r.actionEvent.rerolls.length,6)}
// Grimoire privacy and preservation of deck order; require choice of replacement if full.
{
 const {r,p,q}=mk();p.hand=['grimoire','epee'];r.deck=['crane','joker','couronne'];act(r,p,{kind:'card',cardIndex:0});
 assert.equal(r.phase,'grimoire');assert.equal(view(r,p).grimoireOptions.length,3);assert.equal(view(r,q).grimoireOptions.length,0);
 const chosen=r.grimoirePending.pool[1];resolveGrimoire(r,p,1,null);assert.equal(p.hand.includes(chosen),true);assert.equal(r.deck.length,2);assert.equal(r.phase,'transition');
}
{
 const {r,p}=mk();p.hand=['grimoire','epee','crane','dague'];r.deck=['joker','couronne','pioche'];p.bonusUsed=true;act(r,p,{kind:'card',cardIndex:0});assert.equal(r.phase,'grimoire');assert.equal(p.hand.length,3);
 assert.throws(()=>resolveGrimoire(r,p,0,null),/Main pleine/);resolveGrimoire(r,p,0,1);assert.equal(p.hand.length,3);assert.equal(r.phase,'transition');
}
// Ransom discard protection: at 3+ victim may select one card; below 3 only reroll.
{
 const {r,p,q}=mk();p.hand=['rancon'];q.hand=['epee','crane','joker'];act(r,p,{kind:'card',cardIndex:0,target:'B'});
 assert.equal(r.phase,'ransom');assert.equal(view(r,q).ransomVictim,q.id);
 assert.throws(()=>resolveRansom(r,p,'discard',0),/Rançon/);resolveRansom(r,q,'discard',1);assert.equal(q.hand.length,2);assert.equal(r.phase,'transition');assert.equal(r.discard.includes('crane'),true);
}
{
 const {r,p,q}=mk();p.hand=['rancon'];q.hand=['epee','joker'];q.dice=[3,6,2];act(r,p,{kind:'card',cardIndex:0,target:'B'});assert.throws(()=>resolveRansom(r,q,'discard',0),/protégées/);resolveRansom(r,q,'reroll');assert.equal(q.hand.length,2);assert.equal(r.actionEvent.card,'rancon');assert.equal(r.actionEvent.rerolls[0].index,1);
}
// Server must reject unauthorized commands and new additions work with the old public modes.
{
 const x=mk();x.p.hand=['rancon'];x.q.guard=true;assert.throws(()=>act(x.r,x.p,{kind:'card',cardIndex:0,target:'B'}),/Barrière magique/);
 const y=mk('survie',4);y.r.survivalTeams=0;y.p.hand=['petitbouclier'];act(y.r,y.p,{kind:'card',cardIndex:0,target:'A',own:0});assert.equal(y.p.shieldedDice[0],0);
}
const css=fs.readFileSync(__dirname+'/public/style.css','utf8');assert(css.includes('top:50%!important;left:50%!important;width:165%!important'));assert(css.includes('transform-origin:center center!important'));
const client=fs.readFileSync(__dirname+'/public/app.js','utf8');assert(client.includes("!['trounoir','tornade','chaos','usurpation'].includes(ev.card)"));
console.log('OK V3.9 : paquet 57, Bouclier ciblé, Rançon avec choix protégé, Grimoire privé, position centrale de l’entaille et annonces allégées.');
