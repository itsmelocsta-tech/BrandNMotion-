const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../frontend/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let submissions=0;
 await page.route('**/api/engines**',route=>{
  if(route.request().method()==='POST') submissions++;
  return route.fulfill({json:{engines:[{id:'kling',label:'Kling',available:false,configured:true,unavailableReason:'Generation is paused. No credits will be used.'}]}});
 });
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173');
 await page.locator('textarea').first().fill('A polished auto detailing commercial');
 await page.getByRole('button',{name:'Plan my B-roll · Free'}).click();
 if(!await page.getByText('Planned runtime: 40 seconds').isVisible()) throw Error('Wrong runtime');
 await page.evaluate(()=>{
 const plan={description:'test',continuity:'same person',totalSeconds:5,shots:[{id:1,prompt:'test',seconds:5,title:'Shot 1',camera:'Wide',sound:'none'}]};
 const production={engine:'kling',aspectRatio:'16:9',fingerprint:JSON.stringify([[1,'test',5]]),finished:true,shots:[{id:1,prompt:'test',status:'ready',jobId:'saved-job',videoUrl:'https://example.test/video.mp4'}]};
 localStorage.setItem('bnm-production-v1',JSON.stringify({plan,production}));
 });
 await page.reload();
 await page.getByRole('button',{name:'Download progress backup'}).waitFor();
 await page.getByRole('button',{name:'Load generated clips into editor'}).waitFor();
 if(!await page.getByRole('button',{name:'Resume saved production'}).isDisabled())throw Error('Paid disabled gate not preserved');
 if(submissions!==0)throw Error('Unexpected paid submission');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Phone layout overflow');
 await browser.close();console.log('PASS: 40-second planning, reload recovery, editor handoff, paused-generation gate, zero submissions, phone bounds');
})().catch(e=>{console.error(e);process.exit(1)});
