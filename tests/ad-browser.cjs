'use strict';
// Optional local browser regression: requires an already installed Playwright/Chrome.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

(async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'identitygen-ad-browser-'));
    let browser, child;
    try {
        for (const file of ['server.js','bin-lookup.js','ad-code.js','index.html','admin.html','style.css','app.js','data.js','bin-ui.js','VERSION']) {
            fs.copyFileSync(path.join(__dirname,'..',file),path.join(directory,file));
        }
        fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify({password:'fixture-ad-password'}));
        child = spawn(process.execPath,[path.join(directory,'server.js'),'0'],{
            env:{HOST:'127.0.0.1',HOME:directory,TMPDIR:directory},stdio:['ignore','pipe','pipe']
        });
        const origin = await new Promise((resolve,reject) => {
            let output='';
            const timer=setTimeout(()=>reject(new Error('Fixture server startup timeout')),5000);
            child.stdout.on('data',chunk=>{
                output+=chunk;
                const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
                if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}
            });
            child.once('error',error=>{clearTimeout(timer);reject(error);});
        });
        browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
        for (const width of [1440,390,320]) {
            const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
            const errors=[];
            let requests=0;
            await context.route('**/*',async route=>{
                const url=route.request().url();
                if(!url.startsWith(origin+'/'))return route.abort();
                const pathname=new URL(url).pathname;
                if(pathname==='/slow-ad.js'){
                    requests++;
                    await new Promise(resolve=>setTimeout(resolve,3500));
                    return route.fulfill({contentType:'application/javascript',body:'document.write("<div id=fixture-banner>","slow-"+atOptions.width,"</div>");'});
                }
                if(pathname==='/second-ad.js')return route.fulfill({contentType:'application/javascript',body:'document.write("<div id=fixture-banner>second-"+atOptions.width+"</div>");'});
                if(pathname==='/failed-ad.js')return route.fulfill({status:404,body:'fixture not found'});
                return route.continue();
            });
            const admin=await context.newPage();admin.on('pageerror',e=>errors.push(e.message));
            await admin.goto(origin+'/admin.html#settings-ads');
            await admin.fill('#pwd-input','fixture-ad-password');await admin.click('button[onclick="doLogin()"]');
            await admin.waitForSelector('#admin-panel:not(.hidden)');
            await admin.waitForFunction(()=>getComputedStyle(document.getElementById('login-screen')).visibility==='hidden');
            const toggleAd = async (slot, enabled) => {
                const input = admin.locator(`#ad-${slot}-enabled`);
                if (await input.isChecked() !== enabled) await input.locator('..').click();
            };
            const saveAds = async () => {
                await admin.locator('#ads-delivery-status').evaluate(e=>{e.textContent='';});
                const response = admin.waitForResponse(res=>res.url().includes('/api?action=save')&&res.request().method()==='POST');
                await admin.click('button[onclick="saveAds()"]');
                assert.equal((await response).status(),200);
                await admin.waitForFunction(()=>document.getElementById('ads-delivery-status').textContent.includes('检查的是已保存配置'));
            };
            const fillAd = async (slot,code,format='auto',mode='auto') => {
                await toggleAd(slot,true);
                await admin.fill(`#ad-${slot}-html`,code);
                await admin.selectOption(`#ad-${slot}-format`,format);
                if(slot!=='head')await admin.selectOption(`#ad-${slot}-mode`,mode);
            };
            await fillAd('head','window.fixtureHead="head-ok";','js');
            await fillAd('top','<script>var atOptions={width:320,height:80};</script><script async src="/slow-ad.js"></script>');
            await fillAd('inline','<script>var atOptions={width:180,height:60};</script><script defer src="/second-ad.js"></script>');
            await fillAd('footer','document.write("<div id=fixture-banner>","footer-广告","</div>");','js');
            await saveAds();
            await admin.waitForFunction(()=>document.getElementById('ads-delivery-status').textContent.includes('Head 代码已注入'));
            assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'admin overflow '+width);
            const publicConfig=await (await context.request.get(origin+'/api')).json();
            assert.equal(publicConfig.data.ads.top.mode,'auto');
            assert.ok(publicConfig.data.ads.top.html.startsWith('identitygen-ad:v1:'));
            const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
            await page.goto(origin+'/index.html?ad_debug=1',{waitUntil:'domcontentloaded'});
            assert.equal(await page.evaluate(()=>window.fixtureHead),'head-ok');
            await page.frameLocator('#ad-top iframe').locator('#fixture-banner').waitFor();
            assert.equal(await page.frameLocator('#ad-top iframe').locator('#fixture-banner').textContent(),'slow-320');
            assert.equal(await page.frameLocator('#ad-inline iframe').locator('#fixture-banner').textContent(),'second-180');
            assert.equal(await page.frameLocator('#ad-footer iframe').locator('#fixture-banner').textContent(),'footer-广告');
            await page.waitForFunction(()=>document.getElementById('ad-top').dataset.adState==='ready');
            assert.equal(await page.locator('#ad-top').evaluate(e=>e.hidden),false);
            const frame=await page.locator('#ad-top iframe').elementHandle();
            for(const language of ['zh-CN','ja','en'])await page.selectOption('#lang-select',language);
            await page.click('#btn-de');await page.click('#btn-tr');
            await page.waitForTimeout(200);
            assert.equal(await page.locator('#ad-top iframe').evaluate((e,original)=>e===original,frame),true);
            assert.equal(requests,1,'unchanged ads must not reload on country/language change');
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'frontend overflow '+width);
            assert.ok(await page.locator('#ad-top iframe').evaluate(e=>e.getBoundingClientRect().height>=48));
            // A known page-integrated library must remain outside the independent documents.
            await fillAd('footer','<ins class="adsbygoogle" id="fixture-sense"></ins><script>window.fixtureSense=(window.fixtureSense||0)+1;document.getElementById("fixture-sense").textContent="sense-ok";</script>');
            await saveAds();
            await admin.waitForFunction(()=>document.getElementById('ads-delivery-status').textContent.includes('footer:')&&document.getElementById('ads-delivery-status').textContent.includes('页面内'));
            await page.reload({waitUntil:'domcontentloaded'});
            await page.locator('#fixture-sense').waitFor();
            assert.equal(await page.locator('#fixture-sense').textContent(),'sense-ok');
            assert.equal(await page.locator('#ad-footer iframe').count(),0);
            await page.selectOption('#lang-select','zh-CN');await page.waitForTimeout(200);
            assert.equal(await page.evaluate(()=>window.fixtureSense),1);
            // Preserve an empty placeholder while the provider fills it after page load.
            await fillAd('footer','<div id="late-placeholder"></div><script>setTimeout(function(){document.getElementById("late-placeholder").textContent="late-ok"},3500);</script>');
            await saveAds();
            await page.reload({waitUntil:'domcontentloaded'});
            await page.frameLocator('#ad-footer iframe').locator('#late-placeholder').waitFor({state:'attached'});
            await page.waitForTimeout(2800);
            assert.equal(await page.locator('#ad-footer').evaluate(e=>e.hidden),false);
            await page.frameLocator('#ad-footer iframe').locator('#late-placeholder').filter({hasText:'late-ok'}).waitFor();
            await page.waitForFunction(()=>document.getElementById('ad-footer').dataset.adState==='ready');
            await fillAd('head','window.fixtureHead="head-ok";setTimeout(function(){var node=document.getElementById("page-placeholder");if(node)node.textContent="head-filled"},3500);','js');
            await fillAd('footer','<div id="page-placeholder"></div>');
            await saveAds();
            await page.reload({waitUntil:'domcontentloaded'});
            await page.locator('#page-placeholder').waitFor({state:'attached'});
            await page.locator('#page-placeholder').filter({hasText:'head-filled'}).waitFor();
            await page.waitForFunction(()=>document.getElementById('ad-footer').dataset.adState==='ready');
            assert.equal(await page.locator('#ad-footer iframe').count(),0);
            await fillAd('top',origin+'/failed-ad.js','url');
            await saveAds();
            await admin.waitForFunction(()=>document.getElementById('ads-delivery-status').textContent.includes('Head 代码已注入'));
            await page.reload({waitUntil:'domcontentloaded'});
            await page.waitForFunction(()=>document.getElementById('ad-top').dataset.adState==='error');
            assert.match(await page.locator('#ad-top-diagnostic').textContent(),/加载失败/);
            assert.ok(await page.locator('#site-logo').isVisible(),'failed ad must not break homepage');
            await toggleAd('top',false);await saveAds();
            await admin.waitForFunction(()=>document.getElementById('ads-delivery-status').textContent.includes('top: 未启用'));
            await page.reload({waitUntil:'domcontentloaded'});
            await page.waitForFunction(()=>document.getElementById('ad-top').dataset.adState==='disabled');
            assert.equal(await page.locator('#ad-top').isVisible(),false);
            assert.deepEqual(errors,[]);
            await context.close();
        }
        console.log('PASS ads browser: actual admin/API/Head/homepage, slow async legacy loader, multi-argument write, per-slot globals, retained renders, AdSense page mode, errors/debug, disabled slots, mobile 1440/390/320; external traffic blocked');
    } finally {
        if(browser)await browser.close();
        if(child&&child.exitCode===null){child.kill();await once(child,'exit');}
        fs.rmSync(directory,{recursive:true,force:true});
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
