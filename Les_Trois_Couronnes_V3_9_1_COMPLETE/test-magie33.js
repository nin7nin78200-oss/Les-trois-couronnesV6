'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const jobs=[];const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname:__dirname,setTimeout:f=>{jobs.push(f);return jobs.length},require:n=>n==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const run=x=>vm.runInContext(x,ctx),newTable=run('newTable'),act=run('act'),startRound=run('startRound'),botMoves=run('botMoves'),chooseBot=run('chooseBot');
const tavern={code:'MAGIE1',tables:[],host:'A'},r=newTable(tavern,1,'A');tavern.tables=[r];
const player=(id,color)=>({id,name:id,bot:false,ws:{readyState:1,send(){}},color,background:'uni',icon:'de',dice:[2,3,4],diceOrigins:[color,color,color],hand:[],score:0,acted:false,ready:true,guard:false});
const p=player('A','#ff3333'),q=player('B','#ffcc00'),c=player('C','#5555ff'),d=player('D','#33aa55');r.players=[p,q,c,d];r.mode='1v1v1v1';r.phase='playing';r.order=[0,1,2,3];r.turn=0;r.actionSerial=0;
function ready(cards){jobs.length=0;r.phase='playing';r.turn=0;p.acted=false;p.blocked=false;p.hand=cards;r.discard=[];r.limitedUsed={};q.guard=false;c.guard=false;d.guard=false;}
ready(['bouclier']);act(r,p,{kind:'card',cardIndex:0,target:'A',own:1,secondTarget:'C',secondIndex:2});assert.equal(r.actionEvent.rerolls.length,2);assert.equal(r.actionEvent.targets.length,2);assert.equal(r.actionEvent.cardName,'Baguette magique');
ready(['bouclier']);assert.throws(()=>act(r,p,{kind:'card',cardIndex:0,target:'A',own:1,secondTarget:'A',secondIndex:1}),/distincts/);
ready(['bouclier']);c.guard=true;assert.throws(()=>act(r,p,{kind:'card',cardIndex:0,target:'A',own:1,secondTarget:'C',secondIndex:2}),/protégé/);c.guard=false;
ready(['malediction']);act(r,p,{kind:'card',cardIndex:0,target:'A',own:1});assert.equal(r.actionEvent.rerolls.length,1);
ready(['malediction']);act(r,p,{kind:'card',cardIndex:0,target:'B',own:2});assert.equal(r.actionEvent.rerolls[0].id,'B');
ready(['echange']);p.dice=[2,2,2];q.dice=[6,6,6];p.diceOrigins=[p.color,p.color,p.color];q.diceOrigins=[q.color,q.color,q.color];act(r,p,{kind:'card',cardIndex:0,target:'B',own:0,other:1});assert.deepEqual(p.dice,[6,2,2]);assert.deepEqual(q.dice,[6,2,6]);assert.equal(p.diceOrigins[0],q.color);assert.equal(q.diceOrigins[1],p.color);assert.equal(r.actionEvent.targets.length,2);
ready([]);startRound(r);assert.equal(p.diceOrigins.every(x=>x===p.color),true);assert.equal(q.diceOrigins.every(x=>x===q.color),true);
ready(['bouclier']);const moves=botMoves(r,p).filter(x=>x.kind==='card');assert.ok(moves.some(x=>x.target==='A'&&x.secondTarget==='B'));assert.ok(moves.every(x=>x.target!==x.secondTarget||x.own!==x.secondIndex));assert.ok(chooseBot(r,p));
assert.equal(Object.values(run('defs')).reduce((n,d)=>n+d.count,0),40);
console.log('OK V3.3 : Baguette cross-player, même joueur, protection, Malédiction, Échange couleurs, reset, bot, 40 cartes.');
