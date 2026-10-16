const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..');
const html=fs.readFileSync(root+'/index.html','utf8');
let src=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][1][1];
src=src.replace(/if\(window.THREE\) boot\(\); else window.addEventListener\('three-ready',boot,\{once:true\}\);/,'');
const ctx=vm.createContext({console,setTimeout,clearTimeout,performance,window:{},document:{},localStorage:{setItem(){},getItem(){return null}}});
vm.runInContext(src,ctx);
const tests=`(async()=>{
 let count=0;const ok=(v,msg)=>{if(!v)throw Error(msg);count++;};
 renderPlayers=()=>{};renderLog=()=>{};floatText=()=>{};syncTile=()=>{};growBuilding=async()=>{};SND.play=()=>{};
 let answers=[];modal=async o=>answers.length?answers.shift():true;
 const fresh=()=>{newGame([{char:'bear',cpu:true},{char:'rabbit',cpu:true}],{diff:'normal',rounds:10});G.players.forEach(p=>{p.turns=1;p.missions=[];});return G.players;};
 let [p,q]=fresh();
 ok(G.v===2,'state version');initExpansion();ok(p.missions.length===0,'migration preserves assigned missions');
 p.missions=[{id:'lands',done:false}];const ids=TILES.map((t,i)=>t.type==='land'?i:-1).filter(i=>i>=0);
 ids.slice(0,3).forEach(i=>G.tiles[i].owner=p.id);checkMissions(p);ok(p.cash===22000,'mission pays');checkMissions(p);ok(p.cash===22000,'mission pays once');
 for(const char of Object.keys(ACTIVE)){
  [p,q]=fresh();p.char=char;p.deposit=10000;G.tiles[ids[0]].owner=p.id;
  ok(skillAvailable(p),char+' skill available');await useActive(p);ok(p.skillReady===4,char+' cooldown starts');ok(!skillAvailable(p),char+' blocks repeat');
  if(char==='bear')ok(p.cash===21200,'bear award');
  if(char==='rabbit')ok(p.items.includes('remote'),'rabbit card');
  if(char==='monkey')ok(p.items.includes('barrier'),'monkey card');
  if(char==='peacock')ok(p.cash===20800,'peacock award');
  if(char==='turtle')ok(p.quizBoost,'turtle pending boost');
  if(char==='fox')ok(G.tiles[ids[0]].level===1,'fox construction');
  p.turns=4;if(char!=='turtle')ok(skillAvailable(p),char+' cooldown expires');
 }
 [p,q]=fresh();p.char='rabbit';p.items=Array(6).fill('free');ok(!skillAvailable(p),'full hand blocked');
 [p,q]=fresh();G.tiles[ids[0]].owner=p.id;G.tiles[ids[0]].level=2;G.tiles[ids[1]].owner=q.id;
 const sum=p.cash+q.cash;ok(validTrade(p,q,ids[0],ids[1],1000),'valid trade');
 ok(!validTrade(p,q,ids[1],ids[0],1000),'wrong owners blocked');ok(!validTrade(p,q,-1,-1,0),'empty blocked');ok(!validTrade(p,q,ids[0],-1,999999),'insufficient funds blocked');ok(!validTrade(p,q,ids[0],-1,1.5),'fraction blocked');
 q.cpu=false;answers=[true,true];await proposeTrade(p,q,ids[0],ids[1],1000);
 ok(G.tiles[ids[0]].owner===q.id&&G.tiles[ids[0]].level===2,'land and building transferred');ok(p.cash===19000&&q.cash===21000&&p.cash+q.cash===sum,'cash conserved');ok(p.tradeCount===1&&q.tradeCount===1,'both trade counters');ok(!validTrade(p,q,ids[1],-1,0),'one completed trade per turn');
 [p,q]=fresh();q.cpu=false;G.tiles[ids[0]].owner=p.id;answers=[false,true];await proposeTrade(p,q,ids[0],-1,-1000);ok(G.tiles[ids[0]].owner===p.id&&p.cash===20000,'rejection leaves assets');
 [p,q]=fresh();q.cpu=false;answers=[false,true];await auctionLand(ids[0]);ok(G.tiles[ids[0]].owner===p.id,'auction awards winner');ok(p.cash<20000&&q.cash===20000,'only winner pays');
 [p,q]=fresh();p.cash=0;q.cash=0;await auctionLand(ids[0]);ok(G.tiles[ids[0]].owner===-1,'no funds auction ends unsold');
 [p,q]=fresh();p.cpu=false;q.cpu=false;answers=[false,false,true];await auctionLand(ids[0]);ok(G.tiles[ids[0]].owner===-1,'all pass auction ends');
 // Simulate a complete ten-round game through the actual loop, including settlement.
 [p,q]=fresh();let actions=0,finished=false;playTurn=async player=>{actions++;};newRound=async()=>{};endGame=async()=>{G.over=true;finished=true;};
 await gameLoop(runToken);ok(actions===20&&finished&&G.round===10,'ten rounds executes every seat then finishes');
 return count;
})()`;
vm.runInContext(tests,ctx).then(n=>console.log(`${n} gameplay checks passed`)).catch(e=>{console.error(e);process.exitCode=1;});
