'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const queue=[];
const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname,setTimeout:fn=>{queue.push(fn);return queue.length},require:n=>n==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const get=x=>vm.runInContext(x,ctx),handle=get('handle'),rooms=get('rooms'),finishSurvivalRound=get('finishSurvivalRound'),teamOf=get('teamOf');
function fake(){return {readyState:1,messages:[],send(x){this.messages.push(JSON.parse(x))}}}
function pump(limit=6000){let steps=0;while(queue.length){queue.shift()();if(++steps>limit)throw Error('Timer infini '+limit)}}
for(const size of [4,6,8]){
 for(let run=0;run<3;run++){
  queue.length=0;const ws=fake();const id=(1000+size*10+run).toString(16).padStart(24,'0');handle(ws,{type:'join',room:'',id,name:'Capitaine'});
  const table=[...rooms.values()].at(-1);handle(ws,{type:'mode',mode:'survie-equipes'});
  for(let i=1;i<size;i++)handle(ws,{type:'addBot'});
  handle(ws,{type:'tableReady'});handle(ws,{type:'teamNames',names:['Les Loups','Les Dragons']});
  handle(ws,{type:'start',stake:0});assert.equal(table.mode,'survie-equipes');assert.equal(table.players.length,size);
  assert.equal(table.players.filter(p=>teamOf(table,p)===0).length,size/2);
  assert.equal(table.players.filter(p=>teamOf(table,p)===1).length,size/2);
  const order=table.order.map(i=>teamOf(table,table.players[i]));assert(order.slice(0,4).every((t,i)=>i===0||t!==order[i-1]),'Les équipes doivent alterner au premier tour');
  let ticks=0;while(table.phase!=='over'){
   if(++ticks>800)throw Error('Partie sans fin');
   if(table.phase==='playing'&&!table.players[table.order[table.turn]].bot){handle(ws,{type:'action',kind:'pass'})}
   pump();
   assert(table.players.every(p=>p.lives>=0&&p.lives<=2));
  }
  assert([0,1].includes(table.winner));assert(table.players.some(p=>teamOf(table,p)===table.winner&&!p.eliminated));
  assert(table.players.every(p=>teamOf(table,p)===table.winner||p.eliminated));
  assert.match(table.roundResult,/Les (Loups|Dragons)/);
  handle(ws,{type:'rematch'});assert.equal(table.phase,'playing');assert(table.players.every(p=>p.lives===2&&!p.eliminated));
  rooms.delete(table.key);
 }
}
// Derniers survivants à égalité et tous à une vie : pas de victoire arbitraire.
{const t={code:'DRAW',host:'A',tables:[]},r=get('newTable')(t,1,'A');t.tables.push(r);r.mode='survie-equipes';r.phase='revealing';r.players=['A','B','C','D'].map(id=>({id,name:id,bot:true,color:'#123456',dice:[2,2,2],hand:[],lives:id==='A'||id==='C'?1:0,eliminated:id==='B'||id==='D',score:0,acted:true}));
 finishSurvivalRound(r);assert.equal(r.winner,null);assert.equal(r.players[0].lives,1);assert.equal(r.players[2].lives,1);assert.match(r.roundResult,/départage/);}
console.log('OK SURVIE PAR ÉQUIPES : 9 parties 2v2/3v3/4v4, alternance, 2 vies, vainqueur et revanche, égalité finale.');
