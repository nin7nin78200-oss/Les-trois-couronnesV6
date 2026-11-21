'use strict';
// Tests sans réseau : simule les connexions et l'horloge, sans dépendre de ws.
const vm=require('vm'),fs=require('fs'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/server.js','utf8');
let tasks=[];const fakeHttp={createServer:()=>({listen:()=>{}})};
class FakeWss{on(){}}
const context=vm.createContext({console,process,Buffer,Date,URL,__dirname:__dirname,setTimeout:(fn,delay)=>{tasks.push(fn);return tasks.length},require:(name)=>name==='ws'?{WebSocketServer:FakeWss,WebSocket:{OPEN:1}}:name==='http'?fakeHttp:require(name)});
vm.runInContext(code,context);
const rpc=(expr)=>vm.runInContext(expr,context);
const handle=rpc('handle'),rooms=rpc('rooms'),defs=rpc('defs');
assert.strictEqual(Object.values(defs).reduce((x,y)=>x+y.count,0),32);
function client(i){return {readyState:1,received:[],send(s){this.received.push(JSON.parse(s))},close(){this.readyState=3}}}
function pump(n=2000){let count=0;while(tasks.length){const fn=tasks.shift();fn();if(++count>n)throw Error('Too many scheduled events')}}
function simulate(mode,iteration){tasks=[];const people=mode==='1v1'?2:mode==='1v1v1'?3:4,ws=client(iteration);handle(ws,{type:'join',room:'',id:(''+(iteration*123+1)).padStart(24,'0'),name:'Humain'});const r=[...rooms.values()].at(-1);const others=people-1;handle(ws,{type:'mode',mode});for(let k=0;k<others;k++)handle(ws,{type:'addBot'});handle(ws,{type:'start',stake:5});
 let loops=0;while(r.phase!=='over'&&loops++<200){if(r.phase==='playing'){const p=r.players[r.order[r.turn]];if(p.bot){pump(200);continue}const m=chooseHuman(r,p);handle(ws,{type:'action',...m});pump(200)}else if(['transition','revealing','between'].includes(r.phase))pump(200);else throw Error('bad phase '+r.phase)}
 assert.strictEqual(r.phase,'over','game unfinished '+mode);assert(r.round<80);assert(r.winner!==null);assert(r.players.every(p=>p.hand.length<=3));assert.strictEqual(r.mode,mode);if(mode==='2v2')assert(r.teamScores.some(x=>x>=3));handle(ws,{type:'rematch'});pump(200);assert.strictEqual(r.phase,'playing');assert.strictEqual(r.round,1);rooms.delete(r.code);return loops}
const chooseBot=rpc('chooseBot');function chooseHuman(r,p){return chooseBot(r,p)}
let games=0,steps=0;for(const mode of ['1v1','1v1v1','1v1v1v1','2v2'])for(let i=0;i<40;i++){steps+=simulate(mode,games+1);games++}
console.log(`OK ${games} parties complètes, ${steps} itérations, 4 modes, revan ches et 32 cartes.`);
