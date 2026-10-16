const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve(__dirname,'../test-results/viewport');fs.mkdirSync(output,{recursive:true});
const sizes=[[320,568],[390,844],[568,320],[844,390],[768,1024],[1024,768],[1366,768],[1920,1080],[3840,2160]];
const base=process.env.GAME_URL||'http://127.0.0.1:8765/';
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});const results=[],errors=[];
try{const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function check(label,w,h,screenshot=false){
 await settle();
 const result=await page.evaluate(()=>{
  const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  const zone=!document.querySelector('#modal').hidden?document.querySelector('#mcard'):!document.querySelector('#setup').hidden?document.querySelector('#setup'):document.querySelector('#hud');
  const bounds=[];for(const el of zone.querySelectorAll('button,input,select,.pchip,h1,h2,h3,.seat-skill,.mbody,.mbtns')){if(!visible(el))continue;const r=el.getBoundingClientRect();if(r.width&&r.height&&(r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5))bounds.push({tag:el.tagName,id:el.id,text:el.textContent.slice(0,50),box:{x:r.x,y:r.y,w:r.width,h:r.height}});}
  const scroll=[...document.querySelectorAll('*')].filter(e=>{if(!visible(e))return false;const s=getComputedStyle(e);return (/(auto|scroll)/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+1)||(/(auto|scroll)/.test(s.overflowX)&&e.scrollWidth>e.clientWidth+1);}).map(e=>e.id||e.className);
  const clipped=[...zone.querySelectorAll('button,input,select')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&!e.disabled&&!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}).map(e=>e.id||e.textContent.slice(0,30));
  return {bounds,scroll,clipped,root:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},setupZoom:document.querySelector('.setup-inner').style.zoom,modalZoom:document.querySelector('#mcard').style.zoom};
 });
 assert.deepEqual(result.bounds,[],`${label} ${w}x${h} outside viewport: ${JSON.stringify(result.bounds)}`);assert.deepEqual(result.scroll,[],`${label} scroll: ${JSON.stringify(result.scroll)}`);assert.deepEqual(result.clipped,[],`${label} blocked controls: ${JSON.stringify(result.clipped)}`);assert(result.root.w<=w&&result.root.h<=h,`${label} document overflow`);
 if(screenshot){await page.evaluate(()=>renderer.render(scene,camera));await page.screenshot({path:path.join(output,`${w}x${h}-${label}.png`)});}
 results.push({label,w,h,...result});
}
async function fixture(){await page.evaluate(()=>{runToken++;preRollResolve=null;modalOpen=false;document.querySelector('#modal').hidden=true;newGame(CHARS.map((c,i)=>({char:c.id,cpu:false,name:'玩家'+(i+1)})),{rounds:10,diff:'normal'});G.players.forEach(p=>{p.turns=1;p.prepared=true;p.items=Object.keys(ITEMS).slice(0,6);p.facts=TILES.map(t=>t.fact).filter(Boolean).slice(0,10);});G.tiles[1]={owner:0,level:2};G.tiles[3]={owner:1,level:1};syncAll();enterGameUI();humanPreRoll(G.players[0]);});await settle();}
for(const [w,h]of sizes){
 await page.setViewportSize({width:w,height:h});await page.goto(base);await page.locator('#countSeg button').first().waitFor();await page.evaluate(()=>renderer.setAnimationLoop(null));
 await page.locator('#countSeg [data-n="6"]').click();await page.locator('#seatNav [data-edit-seat="5"]').click();await page.locator('#name5').fill('第六位玩家');await check('setup-six',w,h,true);
 await page.locator('#seatNav [data-edit-seat="0"]').click();await page.locator('#seatNav [data-edit-seat="5"]').click();assert.equal(await page.locator('#name5').inputValue(),'第六位玩家');
 await page.evaluate(()=>{newGame(CHARS.map(c=>({char:c.id,cpu:false})),{diff:'normal',rounds:10});save();});await page.reload();await page.locator('#continueBtn').waitFor();await page.evaluate(()=>renderer.setAnimationLoop(null));await check('setup-resume',w,h);
 await fixture();await check('hud-six',w,h,true);assert.equal(await page.locator('.pchip:visible').count(),6);
 await page.locator('#helpBtn').click();const count=await page.locator('.rules-select option').count();for(let i=0;i<count;i++){await page.locator('.rules-select').selectOption(String(i));await check('rules-'+i,w,h);}await page.getByRole('button',{name:'我知道了',exact:true}).click();
 await page.locator('#missionBtn').click();await page.getByRole('button',{name:'我是本人，查看任務',exact:true}).click();await check('missions',w,h);await page.getByRole('button',{name:'好',exact:true}).click();
 await page.locator('#tradeBtn').click();await check('trade-opponent',w,h);await page.locator('#mcard .mbtns button').first().click();await check('trade-form',w,h,true);await page.getByRole('button',{name:'取消',exact:true}).click();
 await page.locator('#log').click();await check('history',w,h);await page.locator('.log-range').press('Home');await check('history-first',w,h);await page.getByRole('button',{name:'好',exact:true}).click();
 await page.locator('#itemBtn').click();await check('items-six',w,h);await page.getByRole('button',{name:'關閉',exact:true}).click();
 await page.evaluate(()=>{const p=G.players[0];void doQuiz(p);});await check('quiz',w,h);await page.locator('.opts button').first().click();await check('quiz-feedback',w,h,true);await page.getByRole('button',{name:'繼續',exact:true}).click();
 await page.evaluate(()=>{void modal({title:'選擇土地',body:'<p>選擇要操作的保護區。</p>',buttons:TILES.map((t,i)=>t.type==='land'?{label:t.name+'（國家公園）',value:i}:null).filter(Boolean).concat([{label:'取消',value:null}])});});await check('many-lands',w,h);await page.locator('#modalChoice').selectOption({index:12});await page.getByRole('button',{name:'確認選擇',exact:true}).click();
 await page.evaluate(()=>{void endGame();});await check('ranking-six',w,h,true);const picks=page.locator('[data-fact]');if(await picks.count()){await picks.last().click();await check('ranking-fact',w,h);}await page.getByRole('button',{name:'回到主畫面',exact:true}).click();
 console.log('PASS',w+'x'+h);
}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({cases:results.length,sizes,errors,results},null,2));console.log('PASS',results.length,'one-screen states; no scroll, clipped panels or blocked controls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
