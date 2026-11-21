'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/server.js','utf8');
const server={listen(){}};class FakeWss{on(){}}
const ctx=vm.createContext({console,process:{env:{PORT:'0',SCORE_FILE:'/tmp/tc-v35-'+process.pid+'.json'}},Buffer,Date,URL,__dirname,setTimeout:()=>{},require:n=>n==='http'?{createServer:()=>server}:n==='ws'?{WebSocketServer:FakeWss,WebSocket:{OPEN:1}}:require(n)});
vm.runInContext(source,ctx);const get=s=>vm.runInContext(s,ctx),handle=get('handle');
const id=n=>n.toString(16).padStart(24,'0');
function client(){return {readyState:1,frames:[],send(x){this.frames.push(JSON.parse(x))},close(){this.readyState=3}}}
function send(ws,o){handle(ws,o);const v=ws.frames.at(-1);if(v?.type==='error')throw Error(v.message);return v}
const a=client(),b=client(),c=client();
send(a,{type:'join',id:id(1),name:'Nin'});const code=a.frames.at(-1).room;
send(a,{type:'createTable'});assert.strictEqual(a.frames.at(-1).tableNo,2);let t=get('taverns').get(code);assert.strictEqual(t.tables[1].host,id(1));assert.strictEqual(t.tables[1].players[0].name,'Nin');
send(b,{type:'join',id:id(2),room:code,name:'Arthur'});assert.strictEqual(t.tables[0].host,id(2));
send(b,{type:'moveTable',table:2});assert.strictEqual(t.tables[1].players.length,2);assert.strictEqual(t.tables[1].host,id(1));send(a,{type:'mode',mode:'survie'});
send(a,{type:'addBot'});assert.strictEqual(t.tables[1].players.length,3);
handle(b,{type:'kickPlayer',id:id(1)});assert.strictEqual(b.frames.at(-1).type,'error');
handle(a,{type:'kickPlayer',id:id(1)});assert.strictEqual(a.frames.at(-1).type,'error');
send(a,{type:'kickPlayer',id:id(2)});assert.strictEqual(b.frames.at(-1).type,'kicked');assert.strictEqual(b.room,null);assert.strictEqual(t.tables[1].players.length,2);
const bot=t.tables[1].players.find(p=>p.bot);send(a,{type:'removeBot',id:bot.id});assert.strictEqual(t.tables[1].players.length,1);
send(c,{type:'join',id:id(3),room:code,name:'Bilbon'});assert.strictEqual(t.tables[0].host,id(3));
send(a,{type:'moveTable',table:1});assert.strictEqual(t.tables[1].host,id(1));
send(a,{type:'moveTable',table:2});assert.strictEqual(t.tables[1].host,id(1));
// Gameplay must still rank 5-5-5 above 4-4-4.
assert(get('cmp')(get('rank')([5,5,5]),get('rank')([4,4,4]))>0);
console.log('OK V3.5 : maîtres de table, création/déplacement, expulsion contrôlée, bots et classement des brelans.');
