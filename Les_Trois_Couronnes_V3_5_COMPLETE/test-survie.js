'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const tasks=[];
const ctx=vm.createContext({console,process,Buffer,Date,URL,__dirname,setTimeout:fn=>{tasks.push(fn);return tasks.length},require:n=>n==='ws'?{WebSocketServer:class{on(){}},WebSocket:{OPEN:1}}:n==='http'?{createServer:()=>({listen(){}})}:require(n)});
vm.runInContext(fs.readFileSync(__dirname+'/server.js','utf8'),ctx);
const run=x=>vm.runInContext(x,ctx),handle=run('handle'),rooms=run('rooms'),newTable=run('newTable'),act=run('act'),finishRound=run('finishRound');
vm.runInContext('chooseBot=(r,p)=>({kind:"pass"})',ctx);
const fake=()=>({readyState:1,messages:[],send(str){this.messages.push(JSON.parse(str))}});
function pump(limit=500){let i=0;while(tasks.length){tasks.shift()();if(++i>limit)throw Error('boucle de temporisation '+limit)}}
let games=0, maxRounds=0;
for(const size of [2,3,4,5,6,7,8])for(let game=0;game<12;game++){
 tasks.length=0;
 const owner=fake(),code=(100000+size*100+game).toString(16).padStart(24,'0');
 handle(owner,{type:'join',room:'',id:code,name:'Joueur'});
 const r=[...rooms.values()].at(-1);handle(owner,{type:'mode',mode:'survie'});
 for(let i=1;i<size;i++)handle(owner,{type:'addBot'});
 handle(owner,{type:'tableReady'});handle(owner,{type:'start',stake:0});
 assert.equal(r.mode,'survie');assert.equal(r.players.length,size);assert(r.players.every(p=>p.lives===2));
 let steps=0;
 while(r.phase!=='over'){
  if(++steps>2400)throw Error('Partie interminable taille '+size+' manche '+r.round);
  if(r.phase==='playing'){
   const p=r.players[r.order[r.turn]];
   if(p.bot){pump(1200);continue}
   // Le joueur humain passe, les bots jouent leur stratégie complète.
   handle(owner,{type:'action',kind:'pass'});pump(1200);
  }else pump(1200);
  assert(r.players.every(p=>p.lives>=0&&p.lives<=2));
  assert(r.players.every(p=>p.hand.length<=3));
 }
 assert.equal(r.players.filter(p=>!p.eliminated).length,1);
 assert.equal(r.players.find(p=>p.id===r.winner)?.eliminated,false);
 assert(r.round<100);maxRounds=Math.max(maxRounds,r.round);games++;
 handle(owner,{type:'rematch'});
 assert.equal(r.phase,'playing');assert(r.players.every(p=>!p.eliminated&&p.lives===2));
 rooms.delete(r.key);
}
// Egalité totale à une vie : pas d'élimination de tous les concurrents.
{
 const t={code:'TEST',tables:[],host:'A'},r=newTable(t,1,'A');t.tables.push(r);
 r.mode='survie';r.phase='revealing';r.players=['A','B'].map(id=>({id,name:id,bot:true,ws:null,color:'#123456',dice:[2,2,2],diceOrigins:[],hand:[],lives:1,eliminated:false,score:0,acted:true}));
 finishRound(r);assert(r.players.every(p=>p.lives===1));assert.match(r.roundResult,/départage/);
}
// Anti-focus: après deux attaques offensives, la cible est automatiquement protégée.
{
 const t={code:'FOCUS',tables:[],host:'A'},r=newTable(t,1,'A');t.tables.push(r);r.mode='survie';r.phase='playing';r.order=[0,1,2];r.turn=0;r.actionSerial=0;
 r.players=['A','B','C'].map(id=>({id,name:id,bot:false,ws:fake(),color:'#123456',dice:[4,4,4],diceOrigins:['#123456','#123456','#123456'],hand:[],lives:2,eliminated:false,acted:false,guard:false,attacksReceived:0,score:0}));
 const [a,b,c]=r.players;
 a.hand=['crane'];act(r,a,{kind:'card',cardIndex:0,target:'C',own:0});assert.equal(c.attacksReceived,1);assert.equal(c.guard,false);
 // Une autre attaque lors du même tour / même manche (avec un autre participant).
 r.phase='playing';r.turn=1;b.hand=['malediction'];act(r,b,{kind:'card',cardIndex:0,target:'C',own:1});
 assert.equal(c.attacksReceived,2);assert.equal(c.guard,true);
 r.phase='playing';r.turn=0;a.acted=false;a.hand=['crane'];assert.throws(()=>act(r,a,{kind:'card',cardIndex:0,target:'C',own:0}),/protégée/);
}
console.log(`OK SURVIE : ${games} parties de 2 à 8 joueurs, max ${maxRounds} manches, revanche, égalité finale, bouclier anti-acharnement.`);
