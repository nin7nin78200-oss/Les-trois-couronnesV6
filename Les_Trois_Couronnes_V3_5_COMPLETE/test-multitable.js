'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/server.js','utf8');
let tasks=[];const http={createServer:()=>({listen(){}})};
class FakeWss{on(){}}
const ctx=vm.createContext({console,process:{...process,env:{PORT:'0',SCORE_FILE:'/tmp/trois-couronnes-score-test-'+process.pid+'.json'}},Buffer,Date,URL,__dirname,setTimeout:(f)=>{tasks.push(f)},require:n=>n==='http'?http:n==='ws'?{WebSocketServer:FakeWss,WebSocket:{OPEN:1}}:require(n)});
vm.runInContext(source,ctx);const get=s=>vm.runInContext(s,ctx);const handle=get('handle'),rooms=get('rooms'),taverns=get('taverns'),scores=get('leaderboard');
function client(index){return {readyState:1,frames:[],send(x){this.frames.push(JSON.parse(x))},close(){this.readyState=3},name:'ws'+index}}
function run(ws,message){handle(ws,message);const err=ws.frames.at(-1);if(err?.type==='error')throw Error(err.message);return ws.frames.at(-1)}
const id=n=>n.toString(16).padStart(24,'0');
const clients=Array.from({length:9},(_,i)=>client(i+1));
const creator=clients[0];run(creator,{type:'join',id:id(1),name:'Nin'});
const tavern=[...taverns.values()][0],r1=tavern.tables[0],code=tavern.code;
assert.strictEqual(tavern.tables.length,1);
run(creator,{type:'createTable'});assert.strictEqual(tavern.tables.length,2);assert.strictEqual(creator.room,code+':2');
run(creator,{type:'moveTable',table:1});
run(creator,{type:'createTable'});assert.strictEqual(creator.room,code+':3');run(creator,{type:'moveTable',table:1});
run(creator,{type:'createTable'});assert.strictEqual(creator.room,code+':4');run(creator,{type:'moveTable',table:1});assert.strictEqual(tavern.tables.length,4);
handle(creator,{type:'createTable'});assert.strictEqual(creator.frames.at(-1).type,'error');
// Fermeture : seule une table supplémentaire vide peut être supprimée.
handle(creator,{type:'closeTable',table:1});assert.strictEqual(creator.frames.at(-1).type,'error');
run(creator,{type:'closeTable',table:3});assert.strictEqual(tavern.tables.length,3);assert(!rooms.has(code+':3'));
run(creator,{type:'createTable'});run(creator,{type:'moveTable',table:1});assert.strictEqual(tavern.tables.length,4);assert(rooms.has(code+':3'));

run(creator,{type:'moveTable',table:2});assert.strictEqual(creator.room,code+":2");assert.strictEqual(creator.frames.at(-1).tableNo,2);
handle(creator,{type:'closeTable',table:2});assert.strictEqual(creator.frames.at(-1).type,'error');
assert.strictEqual(tavern.tables[1].players[0].name,'Nin');assert.strictEqual(r1.players.length,0);
run(creator,{type:'moveTable',table:1});assert.strictEqual(creator.frames.at(-1).tableNo,1);
run(creator,{type:'mode',mode:'1v1v1v1'});
for(let i=1;i<4;i++)run(clients[i],{type:'join',room:code,id:id(i+1),name:'H'+i});
assert.strictEqual(r1.players.length,4);
for(let i=4;i<8;i++)run(clients[i],{type:'join',room:code,id:id(i+1),name:'H'+i});
assert.strictEqual(tavern.tables[1].players.length,2); // default 1v1 table2
assert.strictEqual(tavern.tables[2].players.length,2); // table3
run(clients[8],{type:'join',room:code,id:id(9),name:'H8'});assert.strictEqual(tavern.tables[3].players.length,1);
// One table can play while another retains its lobby and still receives table updates.
handle(creator,{type:'start',stake:0});assert.strictEqual(creator.frames.at(-1).type,'error');
for(let i=0;i<4;i++)run(clients[i],{type:'tableReady'});
assert.strictEqual(creator.frames.at(-1).tables[0].players.filter(p=>p.ready).length,4);
run(clients[1],{type:'tableReady'});assert.strictEqual(creator.frames.at(-1).tables[0].players.filter(p=>p.ready).length,3);
run(clients[1],{type:'tableReady'});run(creator,{type:'start',stake:0});assert.strictEqual(r1.phase,'playing');
run(clients[4],{type:'moveTable',table:4});assert.strictEqual(tavern.tables[1].players.length,1);
assert.strictEqual(clients[4].frames.at(-1).tableNo,4);
assert.strictEqual(creator.frames.at(-1).tables.length,4);
// A player cannot leave mid-game.
handle(creator,{type:'moveTable',table:4});assert.strictEqual(creator.frames.at(-1).type,'error');
// Rank only when all slots contain humans, never bots.
let p=Array.from({length:2},(_,i)=>({id:id(i+30),name:'test'+i,bot:false,ws:{readyState:1}}));
let fake={players:p,mode:'1v1',winner:p[0].id,rankedRecorded:false};get('registerWin')(fake);
assert.strictEqual(scores.get(p[0].id).wins,1);get('registerWin')(fake);assert.strictEqual(scores.get(p[0].id).wins,1);
const before=scores.size;fake={...fake,rankedRecorded:false,players:[p[0],{...p[1],bot:true}]};get('registerWin')(fake);assert.strictEqual(scores.size,before);
console.log('OK : création progressive, limite 4 tables, déplacements, restrictions pendant les parties, classement humain.');
