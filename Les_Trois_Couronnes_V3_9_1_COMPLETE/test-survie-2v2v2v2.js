'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const tasks=[];
const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname,setTimeout:fn=>{tasks.push(fn);return tasks.length},require:n=>n==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const get=x=>vm.runInContext(x,ctx),handle=get('handle'),rooms=get('rooms'),teamOf=get('teamOf'),finishSurvivalRound=get('finishSurvivalRound');
const fake=()=>({readyState:1,messages:[],send(x){this.messages.push(JSON.parse(x))}});
function pump(limit=30000){let n=0;while(tasks.length){tasks.shift()();if(++n>limit)throw Error('timer runaway '+limit)}}
const names=['Loups','Dragons','Crapauds','Corbeaux'];
for(let run=0;run<32;run++){
 tasks.length=0;
 const ws=fake(),id=(100000+run).toString(16).padStart(24,'0');
 handle(ws,{type:'join',room:'',id,name:'Hôte'});
 const r=[...rooms.values()].at(-1);
 handle(ws,{type:'mode',mode:'survie-2v2v2v2'});
 for(let i=1;i<8;i++)handle(ws,{type:'addBot'});
 handle(ws,{type:'teamNames',names});
 assert.deepEqual(Array.from(r.teamNames),names);
 handle(ws,{type:'shuffleTeams'});
 const groupPairs=()=>Array.from({length:4},(_,t)=>r.players.filter(p=>teamOf(r,p)===t).map(p=>p.id));
 assert(groupPairs().every(group=>group.length===2));
 handle(ws,{type:'tableReady'});
 handle(ws,{type:'start',stake:0,teamNames:names});
 assert.equal(r.mode,'survie-2v2v2v2');assert.equal(r.players.length,8);
 assert.equal(r.players.every(p=>p.lives===2),true);
 assert.equal(r.teamNames.length,4);
 const order=r.order.map(i=>teamOf(r,r.players[i]));
 assert.equal(new Set(order.slice(0,4)).size,4,'Chaque camp joue une fois avant son deuxième joueur');
 assert.equal(new Set(order.slice(4,8)).size,4,'Chaque camp joue une deuxième fois');
 const last=ws.messages.filter(m=>m.type==='state').at(-1);
 assert.equal(last.survivingTeams.length,4);
 assert.equal(last.survivingTeams.every(n=>n===2),true);
 let ticks=0;
 while(r.phase!=='over'){
  if(++ticks>1200)throw Error('Partie sans fin');
  if(r.phase==='playing'&&r.players[r.order[r.turn]]===r.players.find(p=>p.id===id))handle(ws,{type:'action',kind:'pass'});
  pump();
  assert(r.players.every(p=>p.lives>=0&&p.lives<=2));
 }
 assert(r.winner>=0&&r.winner<4,'Une des 4 équipes gagne');
 assert(r.players.some(p=>teamOf(r,p)===r.winner&&!p.eliminated));
 assert(r.players.every(p=>teamOf(r,p)===r.winner||p.eliminated));
 assert(r.roundResult.includes(names[r.winner]));
 handle(ws,{type:'rematch'});
 assert.equal(r.phase,'playing');assert(r.players.every(p=>p.lives===2&&!p.eliminated));
 rooms.delete(r.key);
}
// Quand plusieurs camps restent en lice, aucune victoire prématurée.
{
 tasks.length=0;
 const t={code:'DRAW4',host:'A',tables:[]},r=get('newTable')(t,1,'A');t.tables.push(r);r.mode='survie-2v2v2v2';r.phase='revealing';
 r.players=Array.from({length:8},(_,i)=>({id:String(i),name:'J'+i,bot:true,color:'#123456',dice:[i===0||i===2?2:6,2,2],hand:[],lives:i===0||i===2?1:0,eliminated:i!==0&&i!==2,score:0,acted:true}));
 finishSurvivalRound(r);assert.equal(r.winner,null);assert.match(r.roundResult,/départage/);
}
console.log('OK : 32 parties Survie 2v2v2v2, 4 noms, équipes 2+2+2+2, alternance, élimination, revanche et égalité finale.');
