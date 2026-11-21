'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const timers=[];
const context=vm.createContext({console,process,Buffer,Date,URL,__dirname,setTimeout:fn=>timers.push(fn),require:name=>name==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:name==='http'?{createServer:()=>({listen(){}})}:require(name)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),context);
const run=s=>vm.runInContext(s,context),act=run('act'),newTable=run('newTable');
function session(handSize,teamMode=false){
 const tavern={code:'TEST',host:'P',tables:[]};const r=newTable(tavern,1,'P');tavern.tables.push(r);r.mode=teamMode?'survie':'1v1';r.survivalTeams=0;r.phase='playing';r.order=[0,1];r.turn=0;r.actionSerial=0;r.players=['P','E'].map((id,i)=>({id,name:id,bot:false,ws:{readyState:1,send(){}},dice:[1,2,3],diceOrigins:['#fff','#fff','#fff'],color:'#ffffff',hand:i?Array.from({length:handSize},()=> 'epee'):['voleur'],score:0,lives:2,eliminated:false,acted:false,guard:false,shieldedDice:[]}));
 return {r,actor:r.players[0],victim:r.players[1]};
}
for(const handSize of [1,2,3]){
 const {r,actor,victim}=session(handSize);act(r,actor,{kind:'card',cardIndex:0,target:'E'});
 assert.equal(victim.hand.length,handSize-1);assert.equal(r.discard.filter(k=>k==='epee').length,1);
 assert.equal(actor.hand.length,0,'Fireball is a discard, not a steal');
 assert.equal(r.actionEvent.card,'voleur');
}
{
 const {r,actor,victim}=session(0);
 assert.throws(()=>act(r,actor,{kind:'card',cardIndex:0,target:'E'}),/plus de carte à brûler/);
 assert.equal(actor.hand[0],'voleur','A rejected play must not consume the card');
}
{
 const {r,actor,victim}=session(1,true);victim.guard=true;
 assert.throws(()=>act(r,actor,{kind:'card',cardIndex:0,target:'E'}),/Barrière/);
}
{
 const app=fs.readFileSync(__dirname+'/public/app.js','utf8');
 const html=fs.readFileSync(__dirname+'/public/index.html','utf8');
 assert.match(app,/function showBlackHoleSequence\(ev\)/);
 assert.match(app,/\},1500\);\n\}/);
 assert.match(app,/renderTargetConfirmation\(s,key,myTurn/);
 assert.match(html,/id="target-confirm"/);
 assert.match(html,/id="confirm-play"/);
 assert.match(html,/id="confirm-cancel"/);
 assert.match(app,/p\.handCount>=1/);
}
console.log('OK V3.9.1 : Boule de feu à 1, 2, 3 cartes, refus à zéro, protection, annonce 1,5s, confirmation privée.');
