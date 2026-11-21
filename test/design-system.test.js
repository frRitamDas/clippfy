const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
test('every page loads the shared Clippfy foundation with bundled fonts and original dark tokens',()=>{
 for(const name of fs.readdirSync('.').filter(n=>n.endsWith('.html'))){const dom=new JSDOM(fs.readFileSync(name,'utf8'));assert(dom.window.document.querySelector('link[href="/assets/clippfy-ui.css"]'),name+' missing shared UI');dom.window.close();}
 const css=fs.readFileSync('assets/clippfy-ui.css','utf8');for(const token of ['--bg:#0c0c0d','--s1:#141416','--lime:#d1fe17','--ink:#f1f2ec'])assert(css.includes(token));for(const font of ['geist-latin-wght-normal.woff2','montserrat-latin-wght-normal.woff2']){assert(css.includes(font));assert(fs.existsSync('assets/fonts/'+font));}
});
test('standalone tools share brand navigation, page landmarks, accessible feedback and legal links',()=>{
 for(const name of ['editor','reset','status','preview-info']){const dom=new JSDOM(fs.readFileSync(name+'.html','utf8')),d=dom.window.document;assert(d.body.classList.contains('utility-page'));assert.equal(d.querySelectorAll('main').length,1);assert.equal(d.querySelectorAll('h1').length,1);assert(d.querySelector('.utility-top .logo'));assert(d.querySelector('nav a[href="/app#scripts"]'));assert(d.querySelector('.utility-footer a[href="/privacy"]'));if(name!=='preview-info')assert(d.querySelector('#status[aria-live="polite"]'));dom.window.close();}
 const css=fs.readFileSync('assets/workspace.css','utf8');assert(css.includes("@import url('/assets/1_styles.css')"));assert(css.includes("@import url('/assets/clippfy-ui.css')"));assert(css.includes('prefers-reduced-motion'));
});
test('branded recovery form preserves submit, busy state and confirmation feedback',async()=>{
 const dom=new JSDOM(fs.readFileSync('reset.html','utf8'),{url:'https://clippfy.test/reset',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true})};};try{w.eval(fs.readFileSync('assets/reset.js','utf8'));w.document.getElementById('email').value='creator@example.com';w.document.getElementById('recover').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(calls[0].url,'/api/auth/recover');assert.equal(JSON.parse(calls[0].options.body).email,'creator@example.com');assert(w.document.getElementById('status').textContent.includes('recovery link will arrive'));assert.equal(w.document.querySelector('#recover button').disabled,false);}finally{w.close();}
});
test('AI Script Studio shows real request state, character count and retains draft semantics',async()=>{
 const html=fs.readFileSync('app.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),dom=new JSDOM(html,{runScripts:'outside-only'}),w=dom.window;w.document.body.classList.remove('locked');w.eval('var state={user:{id:"creator"}};function toast(){}');let reject,calls=0;w.api=()=>{calls++;return new Promise((resolve,no)=>reject=no);};
 try{w.eval(fs.readFileSync('assets/integration/script-studio.js','utf8'));const d=w.document,f=d.getElementById('scriptForm');d.querySelector('[data-idea]').click();assert.equal(d.getElementById('scriptTopicCount').textContent,f.elements.topic.value.length+' / 2,500');const pending=f.onsubmit({preventDefault(){}});assert.equal(d.getElementById('scriptLoading').hidden,false);assert.equal(d.querySelector('.script-output').getAttribute('aria-busy'),'true');assert.equal(d.getElementById('scriptGenerate').disabled,true);await f.onsubmit({preventDefault(){}});assert.equal(calls,1);reject(new Error('Provider quota reached'));await pending;assert.equal(d.getElementById('scriptLoading').hidden,true);assert.equal(d.getElementById('scriptGenerate').disabled,false);assert.equal(d.querySelector('.script-output').getAttribute('aria-busy'),'false');assert(d.getElementById('scriptError').textContent.includes('quota'));assert.equal(d.getElementById('scriptEmpty').hidden,false);}finally{w.close();}
});

test('Neon Performance specification locks the exact supplied colors and type scale',()=>{
 const css=fs.readFileSync('assets/clippfy-ui.css','utf8'),spec=fs.readFileSync('design/CLIPPFY-NEON-PERFORMANCE.md','utf8');
 for(const color of ['#d1fe17','#f1f2ec','#f5b400','#0c0c0d','#141416','#8d8f87','#ffffff12','#31e07a','#6ea8ff','#b7e600']){assert(css.includes(color),color);assert(spec.includes(color),color);}
 for(const type of ['600 78px/82.68px','600 54px/65px','600 37px/44px','600 26px/31px','400 18px/27.9px','500 17px/1.45','400 15px/1.45'])assert(css.includes(type),type);
 assert(css.includes('height:54px'));assert(css.includes('padding:19px 28px'));assert(css.includes('border-radius:16px'));
});
test('AI writer uses marketing-scale type, sentence case and tonal cards rather than microtype and paper-stack decoration',()=>{
 const css=fs.readFileSync('assets/script-studio.css','utf8'),dom=new JSDOM(fs.readFileSync('app.html','utf8'));try{
 const d=dom.window.document;assert.equal(d.querySelector('[data-view=scripts]').getAttribute('aria-label'),'Script writer');assert.equal(d.querySelector('.script-hero'),null);assert.equal(d.querySelector('.script-empty h2').textContent,'Your script');assert.equal(d.querySelector('.script-bottom-note'),null);assert.equal(d.querySelector('.script-paper'),null);
 assert(css.includes('font:600 26px/31px var(--font)'));assert(css.includes('padding:22px 24px'));assert(css.includes('font:500 17px/1.2 var(--font)'));assert(!/font-size:\s*(?:8|9|10|11)px/.test(css));assert(!css.includes('rotate('));assert(!css.includes('gradient('));
 }finally{dom.window.close();}
});

test('every page loads the refinement layer and clipping exposes real range/framing controls',()=>{
 for(const name of fs.readdirSync('.').filter(n=>n.endsWith('.html'))){const dom=new JSDOM(fs.readFileSync(name,'utf8'));assert(dom.window.document.querySelector('link[href="/assets/refinement.css"]'),name);dom.window.close();}
 const dom=new JSDOM(fs.readFileSync('app.html','utf8'));try{const d=dom.window.document;assert(d.querySelector('#sourceStart[type=number]'));assert(d.querySelector('#sourceEnd[type=number]'));assert.deepEqual([...d.querySelectorAll('#sourceFraming option')].map(o=>o.value),['center','left','right','fit']);}finally{dom.window.close();}
});
test('script reading pace recalculates duration and warns when edited narration exceeds target',async()=>{
 const dom=new JSDOM(fs.readFileSync('app.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{runScripts:'outside-only'}),w=dom.window;
 w.eval('var state={user:{id:"creator"}};function toast(){}');w.api=async()=>({brief:{topic:'Test recording',language:'English',seconds:15,tone:'educational'},model:'test',draft:{hooks:['One'],titles:['Title'],script:'word '.repeat(60),shots:['Film'],description:'Description',hashtags:['#test']}});
 try{w.eval(fs.readFileSync('assets/integration/script-studio.js','utf8'));await w.document.getElementById('scriptForm').onsubmit({preventDefault(){}});const d=w.document,pace=d.getElementById('scriptPace'),timing=d.getElementById('scriptReadTime');assert(timing.textContent.includes('Over target'));pace.value='110';pace.dispatchEvent(new w.Event('change'));assert(timing.textContent.includes('~33 seconds'));d.getElementById('generatedScript').value='Short draft';d.getElementById('generatedScript').dispatchEvent(new w.Event('input'));assert(!timing.textContent.includes('Over target'));assert(!timing.classList.contains('over-target'));}finally{w.close();}
});
