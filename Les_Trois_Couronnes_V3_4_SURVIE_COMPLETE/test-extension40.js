'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const tasks=[];
class FakeWS{on(){}}
const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname:__dirname,setTimeout:f=>{tasks.push(f);return tasks.length},require:n=>n==='ws'?{WebSocketServer:FakeWS,WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const run=expr=>vm.runInContext(expr,ctx),defs=run('defs');
assert.equal(Object.keys(defs).length,16);assert.equal(Object.values(defs).reduce((s,c)=>s+c.count,0),40);
const newTable=run('newTable'),act=run('act'),startRound=run('startRound');
const tavern={code:'ABCDEF',tables:[],host:'A'};
const r=newTable(tavern,1,'A');tavern.tables.push(r);
const mk=(id)=>({id,name:id,bot:false,ws:{readyState:1,send(){}},dice:[1,2,3],hand:[],score:0,acted:false,ready:true,guard:false,color:'#ffffff',background:'uni'});
const p=mk('A'),q=mk('B');r.players=[p,q];r.mode='1v1';r.phase='playing';r.order=[0,1];r.turn=0;r.actionSerial=0;r.deck=['epee','couronne','crane'];r.discard=[];r.tavern=tavern;
const pump=()=>{while(tasks.length)tasks.shift()()};
// Pioche: still at most 3 cards, second card enabled but third forbidden.
p.hand=['pioche','epee','malediction'];act(r,p,{kind:'card',cardIndex:0});assert.equal(p.hand.length,3);assert.equal(p.acted,false);assert.equal(p.bonusPending,true);pump();assert.equal(r.phase,'playing');
act(r,p,{kind:'card',cardIndex:0,target:'A',own:0});assert.equal(p.acted,true);assert.equal(p.bonusPending,false);assert.equal(p.cardsPlayed,2);
// New round directly assembled for targeted tests (do not run timers from previous round).
tasks.length=0;r.phase='playing';r.turn=0;p.acted=false;p.bonusUsed=false;p.hand=['gambling','chaos','epee'];p.dice=[3,3,3];
act(r,p,{kind:'card',cardIndex:0});assert.equal(r.actionEvent.rerolls.length,3);assert.equal(p.bonusPending,true);pump();
act(r,p,{kind:'card',cardIndex:0});assert.equal(r.actionEvent.rerolls.length,2);assert.equal(p.acted,true);
tasks.length=0;r.phase='playing';r.turn=0;p.acted=false;p.bonusUsed=false;p.hand=['corbeau'];q.acted=false;q.blocked=false;q.guard=false;
act(r,p,{kind:'card',cardIndex:0,target:'B'});assert.equal(q.blocked,true);
// Reroll records indices even if die has same result.
tasks.length=0;r.phase='playing';r.turn=0;p.acted=false;p.hand=['bouclier'];p.bonusUsed=false;
act(r,p,{kind:'card',cardIndex:0,target:'A',own:2,secondTarget:'B',secondIndex:1});assert.equal(r.actionEvent.rerolls.length,2);assert.equal(r.actionEvent.rerolls[0].index,2);assert.equal(r.actionEvent.rerolls[1].id,'B');
console.log('OK 40 cartes / 16 types, Pioche, Gambling, Chaos, Corbeau et baguette à deux cibles.');
