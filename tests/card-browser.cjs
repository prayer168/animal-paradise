const {chromium}=require('playwright');const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});let checks=0;const errors=[];
try{const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await p.locator('#countSeg button').first().waitFor();
async function bounds(){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const rect=await p.locator('#mcard').boundingBox(),v=p.viewportSize();assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=v.width+1&&rect.y+rect.height<=v.height+1,JSON.stringify(rect));checks++;}
for(const size of [{width:320,height:568},{width:568,height:320}]){await p.setViewportSize(size);
 for(const type of ['chance','fate'])for(const mode of ['good','bad','quiz-right','quiz-wrong']){
  const expected=await p.evaluate(({type,mode})=>{runToken++;preRollResolve=null;modalOpen=false;document.querySelector('#modal').hidden=true;newGame([{char:'bear',cpu:false},{char:'rabbit',cpu:true}],{rounds:10,diff:'normal'});G.players.forEach(p=>{p.missions=[];p.turns=1;p.prepared=true;});syncAll();enterGameUI();const deck=type==='chance'?CHANCE:FATE;const index=deck.findIndex(c=>mode.startsWith('quiz')?c.fx.quiz:mode==='good'?c.fx.money>0:c.fx.money<0);G.cardDecks={[type]:[index]};void drawCard(G.players[0],type,0);const c=deck[index];return c.fx.quiz?{answer:c.fx.quiz.o[mode==='quiz-right'?0:1],cash:20000+(mode==='quiz-right'?c.fx.quiz.reward:-c.fx.quiz.penalty)}:{cash:20000+c.fx.money};},{type,mode});
  await p.locator('.cardface').waitFor();await bounds();assert.match(await p.locator('.card-note').innerText(),/遊戲設定/);await p.getByRole('button',{name:'好',exact:true}).click();
  if(expected.answer){await p.locator('.opts button').filter({hasText:expected.answer}).click();await bounds();await p.getByRole('button',{name:'繼續',exact:true}).click();}
  await p.waitForFunction(cash=>G.players[0].cash===cash,expected.cash);checks++;
 }
}
await p.evaluate(()=>{G.players[0].prepared=true;G.cardDecks={chance:[8,1,0]};void drawCard(G.players[0],'chance',0);});await p.locator('.cardface').waitFor();await p.getByRole('button',{name:'好',exact:true}).click();await p.waitForFunction(()=>G.lastCard.chance===0&&!modalOpen);await p.evaluate(()=>save());await p.reload();await p.locator('#continueBtn').click();await p.locator('#dock').waitFor({state:'visible'});assert.deepEqual(await p.evaluate(()=>G.cardDecks.chance),[8,1]);checks++;
await p.evaluate(()=>{void drawCard(G.players[0],'chance',0);});await p.locator('.cardface').waitFor();await p.getByRole('button',{name:'好',exact:true}).click();await p.waitForFunction(()=>G.lastCard.chance===1&&!modalOpen);assert.deepEqual(await p.evaluate(()=>G.cardDecks.chance),[8]);checks++;
assert.deepEqual(errors,[]);console.log(checks+' real-browser card, saved-deck and viewport checks passed; errors: 0');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
