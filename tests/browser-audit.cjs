const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.env.GAME_REPORT_DIR||path.resolve(__dirname, '../test-results');
fs.mkdirSync(output, { recursive: true });
const browserOptions = {headless:true};
if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) browserOptions.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const baseURL=process.env.GAME_URL||'http://127.0.0.1:8765';
const results=[];
async function scenario(name,fn){if(process.env.GAME_TEST_FILTER&&!name.includes(process.env.GAME_TEST_FILTER))return;const start=Date.now();try{await fn();results.push({name,status:'passed',ms:Date.now()-start});console.log('PASS',name);}catch(e){results.push({name,status:'failed',error:e.stack});console.error('FAIL',name,e.message);}fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(results,null,2));}
(async()=>{
 const browser=await chromium.launch(browserOptions);
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 await page.addInitScript(()=>{let seed=20261016;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const click=async text=>page.getByRole('button',{name:text,exact:true}).click();
 const state=()=>page.evaluate(()=>({round:G?.round,cur:G?.cur,players:G?.players,over:G?.over,modal:modalOpen,prepared:!!preRollResolve,heading:document.querySelector('#mcard h3')?.textContent}));
 await scenario('load real WebGL board',async()=>{
  await page.goto(baseURL);await page.locator('#startBtn').waitFor();
  await page.waitForFunction(()=>typeof renderer!=='undefined'&&renderer?.info.render.calls>0,{},{timeout:30000});
  await page.screenshot({path:path.join(output,'desktop-setup.png')});
  assert.equal(await page.locator('#countSeg button').count(),5);
 });
 await scenario('short game / active skill / private missions / resume',async()=>{
  await page.locator('#countSeg button[data-n="2"]').click();
  await page.locator('#roundSeg button[data-v="10"]').click();await click('開始遊戲 ▶');
  await page.locator('#dock').waitFor({state:'visible'});
  await click('✨ 森林補助');await click('使用技能');
  assert.equal((await state()).players[0].cash,21200);
  assert.equal(await page.locator('#skillBtn').isEnabled(),false);
  await click('🎯 任務');await click('我是本人，查看任務');
  assert.equal(await page.locator('.mission-card').count(),2);await click('好');
  await page.reload();await click('繼續遊戲');await page.locator('#dock').waitFor({state:'visible'});
  const s=await state();assert.equal(s.players[0].turns,1);assert.equal(s.players[0].skillReady,4);assert.equal(s.players[0].cash,21200);
 });
 await scenario('HUD buttons remain reachable at mobile widths',async()=>{
  for(const width of [360,390,768,1280]){
   await page.setViewportSize({width,height:800});
   const boxes=await page.locator('#dock button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {id:b.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
   for(const b of boxes){assert(b.x>=0&&b.right<=width&&b.y>=0&&b.bottom<=800,JSON.stringify(b));}
   // Check the center of each enabled action is not intercepted by another HUD panel.
   const blocked=await page.locator('#dock button:not(:disabled)').evaluateAll(bs=>bs.filter(b=>{const r=b.getBoundingClientRect();return !b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}).map(b=>b.id));
   assert.deepEqual(blocked,[],`blocked controls at ${width}`);
   await page.screenshot({path:path.join(output,`hud-${width}.png`)});
  }
 });
 await scenario('animation frame timing and renderer resource baseline',async()=>{
  const performanceSample=await page.evaluate(async()=>{
   const d=[];let last=performance.now();const until=last+3000;
   while(performance.now()<until){await new Promise(requestAnimationFrame);const now=performance.now();d.push(now-last);last=now;}
   d.sort((a,b)=>a-b);return {frames:d.length,p50:d[Math.floor(d.length*.5)],p95:d[Math.floor(d.length*.95)],max:Math.max(...d),memory:renderer.info.memory,calls:renderer.info.render.calls};
  });results.push({name:'frame sample',status:'info',...performanceSample});console.log('Frame timing',JSON.stringify(performanceSample));
  assert(performanceSample.frames>20,'render loop barely advancing');
  assert(performanceSample.p95<100,'95th percentile frame time exceeds the software-rendering budget');
 });
 const fixture=async(options={})=>{
  await page.evaluate(opts=>{
   runToken++;preRollResolve=null;modalOpen=false;document.querySelector('#modal').hidden=true;
   newGame([{char:opts.char||'bear',cpu:false,name:'測試甲'},{char:'rabbit',cpu:false,name:'測試乙'}],{diff:'normal',rounds:10});
   G.players.forEach(p=>{p.turns=1;p.prepared=true;p.missions=[];p.items=[];});
   if(opts.lands){G.tiles[1]={owner:0,level:2};G.tiles[3]={owner:1,level:1};}
   syncAll();enterGameUI();humanPreRoll(G.players[0]);
  },options);
 };
 await scenario('trade form validation / preview / counterpart acceptance',async()=>{
  await fixture({lands:true});await click('🤝 交易');await page.locator('.mbtns button').first().click();
  await click('預覽提議');assert.match(await page.locator('#tradeError').innerText(),/至少一塊土地/);
  await page.locator('#offerLand').selectOption('1');await page.locator('#requestLand').selectOption('3');
  await page.locator('#tradeCash').fill('999999');await click('預覽提議');assert.match(await page.locator('#tradeError').innerText(),/足夠現金/);
  await page.locator('#tradeCash').fill('1000');await click('預覽提議');await click('送給對方確認');await click('同意交易');
  assert.match(await page.locator('#mcard h3').innerText(),/交易成功/);await click('好');
  const s=await page.evaluate(()=>({a:G.tiles[1],b:G.tiles[3],cash:G.players.map(p=>p.cash)}));
  assert.deepEqual(s,{a:{owner:1,level:2},b:{owner:0,level:1},cash:[19000,21000]});assert.equal(await page.locator('#tradeBtn').isEnabled(),false);
 });
 await scenario('auction real purchase refusal / bidding / winner payment',async()=>{
  await fixture();await page.evaluate(()=>{G.players[0].pos=1;void landLand(G.players[0]);});
  await click('不買');await page.getByRole('button',{name:/^出價 \$/}).click();
  await page.getByRole('button',{name:/^出價 \$/}).click();await click('退出競標');
  await page.locator('#modal').waitFor({state:'hidden',timeout:10000});
  const s=await page.evaluate(()=>({owner:G.tiles[1].owner,cash:G.players.map(p=>p.cash),price:TILES[1].price}));
  assert.equal(s.owner,1);assert.equal(s.cash[0],20000);assert.equal(s.cash[1],20000-Math.ceil(s.price*.5/100)*100-200);
 });
 await scenario('turtle active power doubles actual quiz reward once',async()=>{
  await fixture({char:'turtle'});await page.locator('#skillBtn').click();await click('使用技能');
  await page.evaluate(()=>{void doQuiz(G.players[0]);});
  const answer=await page.evaluate(()=>QUIZ[G.quizUsed.at(-1)].a);
  await page.locator('.opts button').filter({hasText:answer}).click();await click('繼續');
  await page.waitForFunction(()=>G.players[0].quizR===1);
  assert.equal((await state()).players[0].cash,23000);assert.equal((await state()).players[0].quizBoost,false);
 });
 await scenario('fox construction and item-producing skills use real dialogs',async()=>{
  await fixture({char:'fox',lands:true});const cost=await page.evaluate(()=>Math.ceil(upCost(G.players[0],1)/2));
  await page.locator('#skillBtn').click();await page.locator('#mcard .mbtns button').first().click();
  await page.locator('#dock').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>G.tiles[1].level),3);assert.equal((await state()).players[0].cash,20000-cost);
  for(const [char,item] of [['rabbit','remote'],['monkey','barrier']]){
   await fixture({char});assert.equal(await page.locator('#itemBtn').isEnabled(),false);
   await page.locator('#skillBtn').click();await click('使用技能');await click('好');await page.locator('#dock').waitFor({state:'visible'});
   assert.equal((await state()).players[0].items[0],item);assert.equal(await page.locator('#itemBtn').isEnabled(),true);
  }
  await fixture({char:'peacock'});await page.locator('#skillBtn').click();await click('使用技能');assert.equal((await state()).players[0].cash,20600);
 });
 await scenario('bank deposit / withdrawal / bankruptcy',async()=>{
  await fixture();await page.evaluate(()=>{void doBank(G.players[0]);});
  await click('+5,000');assert.equal((await state()).players[0].deposit,5000);
  await click('-1,000');assert.equal((await state()).players[0].deposit,4000);await click('離開銀行');
  await page.evaluate(()=>{void pay(G.players[0],1000000);});
  await page.getByRole('heading',{name:'測試甲 破產了'}).waitFor();await click('好');
  assert.equal((await state()).players[0].out,true);
 });
 await scenario('repeated scene synchronization does not leak GPU resources',async()=>{
  await fixture({lands:true});
  const samples=await page.evaluate(async()=>{
   const sample=async()=>{syncAll();await new Promise(requestAnimationFrame);return {...renderer.info.memory};};
   const before=await sample();for(let i=0;i<12;i++)await sample();const after=await sample();return {before,after};
  });results.push({name:'resource samples',status:'info',...samples});
  assert(samples.after.geometries<=samples.before.geometries+2,JSON.stringify(samples));assert(samples.after.textures<=samples.before.textures+1,JSON.stringify(samples));
 });
 await scenario('mobile landscape / quality toggle / protected movement dialogs',async()=>{
  await fixture();await page.setViewportSize({width:640,height:360});
  for(const button of await page.locator('#topbar button').all()){
   const r=await button.boundingBox();assert(r&&r.x>=0&&r.y>=0&&r.x+r.width<=640&&r.y+r.height<=360,'toolbar clipped');
  }
  const light=await page.evaluate(()=>lightQuality);await page.locator('#qualityBtn').click();assert.equal(await page.evaluate(()=>lightQuality),!light);await page.locator('#qualityBtn').click();
  await page.locator('#rollBtn').click();assert.equal(await page.locator('#helpBtn').isEnabled(),false);assert.equal(await page.locator('#menuBtn').isEnabled(),false);
  await page.setViewportSize({width:1280,height:800});
 });
 await scenario('corrupted saves are ignored and player names cannot inject HTML',async()=>{
  // A separate document prevents this resilience check from mutating a running game.
  const other=await context.newPage();
  await other.goto(baseURL);await other.evaluate(()=>localStorage.setItem('animal-kingdom-tycoon-v1',JSON.stringify({v:2,players:'broken'})));
  await other.reload();await other.locator('#countSeg button').first().waitFor();assert.equal(await other.locator('#continuePanel').isVisible(),false);
  await other.evaluate(()=>{newGame([{char:'bear',cpu:false,name:'<b>甲</b>'},{char:'rabbit',cpu:true}],{diff:'normal',rounds:10});});
  assert.equal(await other.evaluate(()=>G.players[0].name.includes('<')),false);await other.close();
 });
 await scenario('full real ten-round game reaches ranking without a stuck turn',async()=>{
  await page.evaluate(()=>{runToken++;preRollResolve=null;modalOpen=false;document.querySelector('#modal').hidden=true;startGame([{char:'bear',cpu:false,name:'測試甲'},{char:'rabbit',cpu:true,name:'測試乙'}],{diff:'normal',rounds:10});});
  const deadline=Date.now()+300000;let actions=0,lastProgress=Date.now(),lastKey='',lastRound=0;
  while(Date.now()<deadline){
   const s=await state();
   if(s.round!==lastRound){console.log('Full game round',s.round);lastRound=s.round;}
   if(s.over){assert(s.round===10||s.players.filter(p=>!p.out).length===1);await page.getByRole('heading',{name:/成為動物王國大亨/}).waitFor();assert.equal(await page.locator('.rank tbody tr').count(),2);await page.screenshot({path:path.join(output,'completed-game.png')});return;}
   const key=[s.round,s.cur,s.heading,s.players?.map(p=>p.pos+':'+p.turns+':'+p.cash).join(',')].join('|');if(key!==lastKey){lastKey=key;lastProgress=Date.now();}
   assert(Date.now()-lastProgress<30000,'stuck without state progress: '+JSON.stringify(s));
   if(await page.locator('#modal').isVisible()){
    if(await page.locator('#modal').getAttribute('data-auto')==='true'){await page.waitForTimeout(80);continue;}
    const options=page.locator('.opts button:not(:disabled)');
    if(await options.count()){await options.first().click();actions++;continue;}
    if(await page.locator('.mini-btns').isVisible()){await page.locator('.mini-btns button').first().click();continue;}
    const buttons=page.locator('#mcard button:visible:not(:disabled)');const texts=await buttons.allTextContents();
    // The end screen can appear between the state read and the dialog read.
    // Leave it open so the next iteration verifies the ranking instead of returning to setup.
    if(texts.some(t=>t.includes('同樣設定再玩一局')))continue;
    const preferred=texts.findIndex(t=>/^(不買|退出競標|先不要|等待|離開銀行|繼續|好|付錢|開始！)$/.test(t.trim()));
    if(preferred>=0){await buttons.nth(preferred).click();actions++;continue;}
    if(texts.length){await buttons.first().click();actions++;continue;}
   }else if(await page.locator('#dock').isVisible()){await page.locator('#rollBtn').click();actions++;continue;}
   await page.waitForTimeout(80);
  }
  throw Error('Game did not finish within five minutes; '+JSON.stringify(await state()));
 });
 await page.screenshot({path:path.join(output,'latest.png')});
 results.push({name:'browser errors',status:errors.length?'failed':'passed',errors});
 fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(results,null,2));
 await browser.close();if(results.some(r=>r.status==='failed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
