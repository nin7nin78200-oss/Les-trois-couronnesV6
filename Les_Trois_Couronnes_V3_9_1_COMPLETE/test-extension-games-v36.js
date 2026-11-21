'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');let tasks=[];
const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname,setTimeout:fn=>(tasks.push(fn),tasks.length),require:n=>n==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const run=expr=>vm.runInContext(expr,ctx),handle=run('handle'),rooms=run('rooms'),chooseBot=run('chooseBot'),extra=run('extraDefs');
function client(){return {readyState:1,received:[],send(s){this.received.push(JSON.parse(s))}}}
function pump(max=5000){let calls=0;while(tasks.length){tasks.shift()();if(++calls>max)throw Error('Timer loop: '+calls)}}
let games=0,played=new Set(),mostRounds=0;
for(const mode of ['1v1','1v1v1','1v1v1v1','2v2','survie'])for(let i=0;i<6;i++){
 tasks=[];const w=client();handle(w,{type:'join',room:'',id:(games+1).toString(16).padStart(24,'0'),name:'Joueur'});const r=[...rooms.values()].at(-1);handle(w,{type:'mode',mode});handle(w,{type:'setExtensions',cards:Object.keys(extra)});for(let j=1;j<(mode==='survie'?6:mode==='1v1'?2:mode==='1v1v1'?3:4);j++)handle(w,{type:'addBot'});handle(w,{type:'tableReady'});handle(w,{type:'start',stake:0});assert.equal(r.deck.length+r.players.reduce((n,p)=>n+p.hand.length,0),57);
 let steps=0;while(r.phase!=='over'&&steps++<1200){if(r.actionEvent?.card&&Object.keys(extra).includes(r.actionEvent.card))played.add(r.actionEvent.card);
  if(r.phase==='market'){
   const owner=r.marketPending?.actorId,p=r.players.find(x=>x.id===owner);
   if(p.bot)pump();else {handle(w,{type:'marketPick',index:0});pump()}
  }else if(r.phase==='grimoire'){
   const actor=r.players.find(x=>x.id===r.grimoirePending?.actorId);
   if(actor.bot)pump();else{handle(w,{type:'grimoirePick',index:0,discardIndex:actor.hand.length>=3?0:null});pump()}
  }else if(r.phase==='ransom'){
   const victim=r.players.find(x=>x.id===r.ransomPending?.victimId);
   if(victim.bot)pump();else {handle(w,{type:'ransomPick',choice:victim.hand.length>=3?'discard':'reroll',discardIndex:victim.hand.length>=3?0:null});pump()}
  }else if(r.phase==='playing'){
   const p=r.players[r.order[r.turn]];
   if(p.bot)pump();else{const move=chooseBot(r,p);handle(w,{type:'action',...move});if(w.received.at(-1)?.type==='error')throw Error('Action rejected '+JSON.stringify(w.received.at(-1))+' : '+JSON.stringify(move));pump()}
  }else pump();
  assert(r.players.every(p=>p.hand.length<=3||(p.hand.length===4&&p.secondChanceHold&&p.bonusPending&&!p.acted)), 'Main trop grande hors du choix Seconde Chance');
 }
 assert.equal(r.phase,'over','Game not finished '+mode+', phase '+r.phase+' round '+r.round);
 assert(r.winner!==null);mostRounds=Math.max(mostRounds,r.round);games++;
 rooms.delete(r.key);
}
console.log('OK',games,'parties complètes AVEC extensions sur 5 modes, maximum',mostRounds,'manches. Cartes bonus jouées :', [...played].join(', ')||'(aucune)');
