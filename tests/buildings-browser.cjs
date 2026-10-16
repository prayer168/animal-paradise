const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});let checks=0;const errors=[];try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await page.locator('#countSeg button').first().waitFor();
 const setup=()=>page.evaluate(()=>{runToken++;modalOpen=false;document.querySelector('#modal').hidden=true;newGame([{char:'bear',cpu:false},{char:'rabbit',cpu:false}],{rounds:10,diff:'normal'});G.players.forEach(p=>{p.cash=200000;p.missions=[];p.turns=1;p.prepared=true;});G.players[0].pos=TILES.findIndex(t=>t.type==='land');syncAll();enterGameUI();});
 await setup();await page.evaluate(()=>{window.buildDone=false;void landLand(G.players[0]).then(()=>window.buildDone=true);});await page.getByRole('button',{name:/買下 \$/}).click();await page.waitForFunction(()=>window.buildDone);
 assert.equal(await page.evaluate(()=>W.flags[G.players[0].pos].userData.logo),'🐻');checks++;
 const rents=[await page.evaluate(()=>rentOf(G.players[0].pos,G.players[1]))];
 for(let level=1;level<=6;level++){
  const cost=await page.evaluate(()=>upCost(G.players[0],G.players[0].pos));
  const cash=await page.evaluate(()=>G.players[0].cash);
  await page.evaluate(()=>{window.buildDone=false;void landLand(G.players[0]).then(()=>window.buildDone=true);});
  if(level===6)assert.match(await page.locator('#mcard').innerText(),/5 棟房子.*摩天大樓/s);
  await page.getByRole('button',{name:/升級 \$/}).click();await page.waitForFunction(()=>window.buildDone);
  const state=await page.evaluate(()=>{const p=G.players[0],i=p.pos;return {cash:p.cash,level:G.tiles[i].level,model:W.buildings[i].userData,rent:rentOf(i,G.players[1]),up:TILES[i].up,value:landValue(i),price:TILES[i].price,valid:validSave(G)};});
  assert.equal(state.level,level);assert.equal(state.cash,cash-cost);assert.equal(state.model.kind,level===6?'skyscraper':'houses');assert.equal(state.model.houseCount,level===6?0:level);assert(state.valid);assert(state.rent>rents.at(-1));assert.equal(state.value,state.price+(level===6?8:level)*state.up);if(level===6)assert.equal(cost,state.up*3);rents.push(state.rent);checks+=7;
 }
 await page.evaluate(()=>{const p=G.players[0],i=p.pos;for(let n=1;n<=5;n++){const j=TILES.map((t,k)=>t.type==='land'?k:-1).filter(k=>k>=0)[n];G.tiles[j].owner=n%2;G.tiles[j].level=n;syncTile(j);}view.idleSpin=false;});
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/buildings-desktop.png'});
 // Another player really pays the skyscraper rent to the owner.
 const before=await page.evaluate(()=>{const [a,b]=G.players;b.pos=a.pos;return [a.cash,b.cash,rentOf(a.pos,b)];});
 await page.evaluate(()=>{window.buildDone=false;void landLand(G.players[1]).then(()=>window.buildDone=true);});await page.getByRole('button',{name:'付錢',exact:true}).click();await page.waitForFunction(()=>window.buildDone);
 assert.deepEqual(await page.evaluate(()=>G.players.map(p=>p.cash)),[before[0]+before[2],before[1]-before[2]]);checks++;
 // Ownership badges follow transfer; sale downgrades skyscraper to five houses.
 const result=await page.evaluate(()=>{const [a,b]=G.players,i=a.pos;G.tiles.forEach((s,j)=>{if(j!==i){s.owner=-1;s.level=0;syncTile(j);}});G.tiles[i].owner=b.id;syncTile(i);const badge={...W.flags[i].userData};const cash=b.cash;sellOne(b);return {badge,refund:b.cash-cash,up:TILES[i].up,level:G.tiles[i].level,count:W.buildings[i].userData.houseCount};});
 assert.equal(result.badge.logo,'🐰');assert.equal(result.refund,Math.round(result.up*1.5));assert.equal(result.level,5);assert.equal(result.count,5);checks+=4;
 for(const [width,height] of [[320,568],[568,320],[768,1024],[3840,2160]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{G.players[1].cash=0;void landLand(G.players[1]);});await page.getByRole('button',{name:'錢不夠',exact:true}).waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const r=await page.locator('#mcard').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);await page.getByRole('button',{name:'先不要',exact:true}).click();checks+=2;
 }
 assert.deepEqual(errors,[]);console.log(checks+' building browser checks passed; rents: '+rents.join(', '));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
