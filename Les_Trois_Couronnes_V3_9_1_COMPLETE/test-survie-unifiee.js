'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const tasks=[];
const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname,setTimeout:fn=>{tasks.push(fn);return tasks.length},require:n=>n==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const get=x=>vm.runInContext(x,ctx),handle=get('handle'),rooms=get('rooms'),teamOf=get('teamOf');
const socket=()=>({readyState:1,messages:[],send(x){this.messages.push(JSON.parse(x))}});
function pump(limit=30000){let n=0;while(tasks.length){tasks.shift()();if(++n>limit)throw Error('Boucle de timers '+limit)}}
let total=0;
for(const [teams,sizes] of [[0,[2,5,8]],[2,[4,6,8]],[3,[6]],[4,[8]]]){
 for(const size of sizes){
  for(let run=0;run<6;run++){
   tasks.length=0;
   const ws=socket(),id=(500000+teams*10000+size*100+run).toString(16).padStart(24,'0');
   handle(ws,{type:'join',room:'',id,name:'Hôte'});
   const r=[...rooms.values()].at(-1);assert(r);
   handle(ws,{type:'mode',mode:'survie'});
   handle(ws,{type:'survivalTeams',count:teams});
   assert.equal(r.mode,'survie');assert.equal(r.survivalTeams,teams);
   for(let i=1;i<size;i++)handle(ws,{type:'addBot'});
   if(teams){
    const names=['Loups','Dragons','Végétaux','Pêcheurs'].slice(0,teams);
    handle(ws,{type:'teamNames',names});
    handle(ws,{type:'shuffleTeams'});
    assert.equal(r.teamNames.slice(0,teams).join(' / '),names.join(' / '));
    assert.deepEqual(Array.from({length:teams},(_,t)=>r.players.filter(p=>teamOf(r,p)===t).length),Array(teams).fill(size/teams));
   }
   const before=ws.messages.filter(m=>m.type==='state').at(-1);
   assert.equal(before.survivalTeams,teams);assert.equal(before.tables[0].survivalTeams,teams);
   handle(ws,{type:'tableReady'});handle(ws,{type:'start',stake:0});
   assert.equal(r.phase,'playing');assert.equal(r.players.every(p=>p.lives===2),true);
   assert.equal(r.order.length,size);
   if(teams){
    const order=r.order.map(i=>teamOf(r,r.players[i]));
    assert.equal(new Set(order.slice(0,teams)).size,teams,'Les équipes doivent être alternées');
    assert.equal(new Set(order.slice(teams,teams*2)).size,teams,'Deuxième tour intercalé');
   }
   let ticks=0;
   while(r.phase!=='over'){
    if(++ticks>1500)throw Error('Partie infinie');
    if(r.phase==='playing'&&r.players[r.order[r.turn]].id===id)handle(ws,{type:'action',kind:'pass'});
    pump();
    assert(r.players.every(p=>p.lives>=0&&p.lives<=2));
   }
   assert(teams?r.winner>=0&&r.winner<teams:r.players.some(p=>p.id===r.winner));
   if(teams){assert(r.players.every(p=>teamOf(r,p)===r.winner||p.eliminated));assert(r.players.some(p=>teamOf(r,p)===r.winner&&!p.eliminated));}
   handle(ws,{type:'rematch'});assert.equal(r.phase,'playing');assert(r.players.every(p=>p.lives===2&&!p.eliminated));
   rooms.delete(r.key);total++;
  }
 }
}
{
 tasks.length=0;const ws=socket(),id='0'.repeat(23)+'a';handle(ws,{type:'join',room:'',id,name:'Hôte'});const r=[...rooms.values()].at(-1);
 handle(ws,{type:'mode',mode:'survie'});for(let i=1;i<5;i++)handle(ws,{type:'addBot'});
 for(const [teamCount,msg] of [[2,'4, 6 ou 8'],[3,'6 joueurs'],[4,'8 joueurs']]){
  handle(ws,{type:'survivalTeams',count:teamCount});handle(ws,{type:'tableReady'});handle(ws,{type:'start'});
  assert.equal(r.phase,'lobby');assert(ws.messages.at(-1).message?.includes(msg),'Taille invalide bloquée '+teamCount);
  handle(ws,{type:'tableReady'});
 }
 handle(ws,{type:'survivalTeams',count:0});handle(ws,{type:'tableReady'});handle(ws,{type:'start'});assert.equal(r.phase,'playing');
 rooms.delete(r.key);
}
const html=fs.readFileSync(__dirname+'/public/index.html','utf8');
assert.equal((html.match(/<option value="survie"/g)||[]).length,1);
assert.equal((html.match(/<option value="survie-equipes"/g)||[]).length,0);
assert.equal((html.match(/<option value="survie-2v2v2v2"/g)||[]).length,0);
assert.match(html,/id="survival-team-toggle"/);assert.match(html,/id="add-survival-team"/);
console.log('OK SURVIE UNIFIÉE : '+total+' parties, solo + 2/3/4 équipes, validations, alternance, deux vies, victoire, revanche, menu unique.');
