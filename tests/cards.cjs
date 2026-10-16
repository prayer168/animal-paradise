const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let src=[...fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][1][1];
src=src.replace(/if\(window.THREE\) boot\(\); else window.addEventListener\('three-ready',boot,\{once:true\}\);/,'');
const ctx=vm.createContext({console,setTimeout,clearTimeout,performance,window:{},document:{},localStorage:{setItem(){}}});vm.runInContext(src,ctx);
vm.runInContext(`(async()=>{
 let n=0;const ok=(v,m)=>{if(!v)throw Error(m);n++;};
 renderPlayers=()=>{};renderLog=()=>{};floatText=()=>{};syncTile=()=>{};SND.play=()=>{};modal=async()=>true;growBuilding=async()=>{};
 moveTo=async(p,i)=>{p.pos=i;};jumpTo=async(p,i)=>{p.pos=i;};moveSteps=async(p,n,d)=>{p.pos=(p.pos+n*d+N)%N;};landOn=async()=>{};
 pay=async(p,amt,to)=>{p.cash-=amt;if(to)to.cash+=amt;return amt;};
 const fresh=()=>{newGame([{char:'bear',cpu:true},{char:'rabbit',cpu:true}],{rounds:10,diff:'normal'});G.players.forEach(p=>{p.cash=500000;p.deposit=10000;p.missions=[];});return G.players[0];};
 const allowed=['money','moveTo','collectEach','item','spirit','move','interest','downgrade','goto','repair','payEach','jumpTo','loseItem','upgrade','cleanse','quiz'];
 for(const [type,deck]of [['chance',CHANCE],['fate',FATE]]){
  ok(deck.length===48,type+' count');ok(new Set(deck.map(c=>c.t)).size===48,type+' unique texts');ok(deck.filter(c=>c.fx.quiz).length===8,type+' quiz count');
  for(const c of deck){ok(c.t&&c.f&&c.fx,'complete card');ok(Object.keys(c.fx).every(k=>allowed.includes(k)),'known effects');if(c.fx.quiz){const q=c.fx.quiz;ok(q.o.length===4&&new Set(q.o).size===4&&q.o.includes(q.a)&&q.e,'valid question');ok(q.reward>0&&q.penalty===(type==='chance'?0:300),'quiz stakes');}}
  let p=fresh();const drawn=[];for(let i=0;i<48;i++){await drawCard(p,type,0);drawn.push(G.lastCard[type]);}
  ok(new Set(drawn).size===48,type+' no repeat before exhaustion');ok(G.cardDecks[type].length===0,type+' cycle exhausted');await drawCard(p,type,0);ok(G.lastCard[type]!==drawn.at(-1),type+' no boundary immediate repeat');
  for(let i=0;i<deck.length;i++){p=fresh();G.tiles[1]={owner:p.id,level:1};G.cardDecks={[type]:[i]};await drawCard(p,type,0);ok(Number.isFinite(p.cash)&&p.pos>=0&&p.pos<N,type+' effect '+i);}
 }
 let p=fresh();const chanceQ=CHANCE.find(c=>c.fx.quiz).fx.quiz,fateQ=FATE.find(c=>c.fx.quiz).fx.quiz;
 Math.random=()=>0;await doQuiz(p,chanceQ);ok(p.cash===501200&&p.quizR===1,'chance correct award');
 Math.random=()=>.999;await doQuiz(p,chanceQ);ok(p.cash===501200,'chance wrong no deduction');await doQuiz(p,fateQ);ok(p.cash===500900,'fate wrong deduction');
 p=fresh();const up=CHANCE.findIndex(c=>c.fx.upgrade);G.cardDecks={chance:[up]};await drawCard(p,'chance',0);ok(p.cash===500600,'upgrade no land fallback');
 G.tiles[1]={owner:p.id,level:1};G.cardDecks={chance:[up]};await drawCard(p,'chance',0);ok(G.tiles[1].level===2,'free upgrade works');
 const clean=FATE.findIndex(c=>c.fx.cleanse);p.spirit={type:'pollution',left:3};G.cardDecks={fate:[clean]};await drawCard(p,'fate',0);ok(p.spirit===null,'cleanse bad spirit');
 ok(CHANCE.filter(c=>c.fx.money<0).length<CHANCE.length/2,'chance mostly beneficial');ok(FATE.filter(c=>c.fx.money>0||c.fx.upgrade||c.fx.cleanse||c.fx.item).length>=15,'fate has multiple positive outcomes');
 return n;
})()`,ctx).then(n=>console.log(n+' card checks passed')).catch(e=>{console.error(e);process.exitCode=1;});
