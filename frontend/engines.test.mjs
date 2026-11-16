import test from 'node:test';
import assert from 'node:assert/strict';
import engines from './api/engines.js';
import cinematic from './api/cinematic.js';
import download from './api/cinematic-download.js';
import planner from './api/generate.js';
import locations from './api/locations.js';
const token='test-only-owner-token-with-at-least-32-characters';
async function call(handler, method, authorization, body={}, query={}) {
  const res={setHeader(){},status(code){this.code=code;return this},json(value){this.value=value;return this},end(){return this}};
  await handler({method,headers:{authorization},body,query},res);return res;
}
test('all provider endpoints reject missing and incorrect owner credentials without upstream calls',async()=>{
 process.env.BNM_OWNER_TOKEN=token;
 const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('Unexpected provider call')};
 try { for(const handler of [engines,cinematic,download,planner,locations]) for(const auth of [undefined,'Bearer wrong']) assert.equal((await call(handler,'POST',auth,{engine:'kling',prompt:'scene'})).code,401);assert.equal(calls,0); }finally{global.fetch=old}
});
test('owner setup fails closed',async()=>{delete process.env.BNM_OWNER_TOKEN;assert.equal((await call(engines,'GET')).code,503);process.env.BNM_OWNER_TOKEN=token});
test('enable flags and client approvals cannot override zero budget',async()=>{
 process.env.BNM_OWNER_TOKEN=token;process.env.ENABLE_PAID_VIDEO_GENERATION='true';process.env.KLING_API_KEY='test-only';
 const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('Unexpected provider call')};
 try {for(const handler of [engines,cinematic]) for(const engine of ['kling','veo','runway']) {const res=await call(handler,'POST','Bearer '+token,{engine,prompt:'scene',approved:true,budget:100});assert.equal(res.code,403);assert.equal(res.value.code,'ZERO_SPEND_LIMIT')}assert.equal(calls,0)}finally{global.fetch=old}
});
test('engine listing distinguishes configuration from availability',async()=>{const res=await call(engines,'GET','Bearer '+token);assert.equal(res.code,200);assert.equal(res.value.budgetUsd,0);assert.equal(res.value.paidGenerationEnabled,false);assert.ok(res.value.engines.every(e=>!e.available));assert.equal(JSON.stringify(res.value).includes(token),false)});
test('read-only credential check never generates or claims billing verification',async()=>{
 const {default:status}=await import('./api/provider-status.js');process.env.GEMINI_API_KEY='test-only';
 const old=global.fetch;try{global.fetch=async(url,init)=>{assert.match(url,/\/models\?pageSize=100$/);assert.equal(init.method,undefined);return {ok:true,status:200}};const res=await call(status,'GET','Bearer '+token);assert.equal(res.value.googleModelListingAccepted,true);assert.equal(res.value.balanceVerified,false);assert.equal(res.value.exactCostVerified,false);assert.equal(res.value.videoPlaybackVerified,false)}finally{global.fetch=old}
});
