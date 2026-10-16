const {chromium}=require('playwright');
const assert=require('node:assert/strict'); require('node:fs').mkdirSync(require('node:path').resolve(__dirname,'../test-results'),{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try{const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.GAME_URL||'http://127.0.0.1:8765/';await page.goto(base+'social/facebook.html');
await page.locator('.preview').waitFor();await page.waitForFunction(()=>document.querySelector('.preview').naturalWidth>0);
const dims=await page.locator('.preview').evaluate(i=>({width:i.naturalWidth,height:i.naturalHeight}));
for(const lang of ['zh','en','both']){await page.locator(`[data-copy="${lang}"]`).click();const value=await page.evaluate(()=>navigator.clipboard.readText());const zh=await page.locator('#zh').inputValue(),en=await page.locator('#en').inputValue();assert.equal(value.replace(/\r\n/g,'\n'),lang==='both'?zh+'\n\n────────── English ──────────\n\n'+en:lang==='zh'?zh:en);}
await page.locator('#copyImage').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已複製縮圖'));assert((await page.evaluate(async()=>(await navigator.clipboard.read()).flatMap(x=>x.types))).includes('image/png'));
const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('下載縮圖 PNG',{exact:true}).click()]);assert.equal(download.suggestedFilename(),'animal-kingdom-tycoon-facebook.png');
await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:require('node:path').resolve(__dirname,'../test-results/facebook-pack.png')});
await page.goto(base);assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),'https://prayer168.github.io/animal-paradise/social/thumbnail.png');assert.deepEqual(errors,[]);console.log(JSON.stringify({copy:['Chinese','English','Bilingual','PNG'],download:'passed',mobile:'passed',metadata:'passed',dims,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
