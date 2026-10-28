import test from 'node:test';
import assert from 'node:assert/strict';
process.env.ENABLE_PAID_VIDEO_GENERATION='true';
process.env.KLING_API_KEY='test-only';
const {default: handler}=await import('./api/engines.js');
async function call(method, body={}, query={}) { const res={setHeader(){},status(n){this.code=n;return this},json(value){this.value=value;return this}};await handler({method,body,query},res);return res; }
test('Kling is listed first and ready',async()=>{const r=await call('GET');assert.equal(r.value.engines[0].id,'kling');assert.equal(r.value.engines[0].available,true)});
test('billing gate prevents provider requests',async()=>{process.env.ENABLE_PAID_VIDEO_GENERATION='false';assert.equal((await call('POST',{engine:'kling',prompt:'Scene'})).code,503);process.env.ENABLE_PAID_VIDEO_GENERATION='true'});
test('Kling forwards aspect and returns real job id',async()=>{const old=global.fetch;try{global.fetch=async(url,init)=>{assert.match(url,/text2video$/);assert.equal(JSON.parse(init.body).aspect_ratio,'9:16');return {ok:true,json:async()=>({code:0,data:{task_id:'job-1'}})}};assert.equal((await call('POST',{engine:'kling',prompt:'Scene',aspectRatio:'9:16'})).value.id,'job-1')}finally{global.fetch=old}});
test('missing Kling output is failure',async()=>{const old=global.fetch;try{global.fetch=async()=>({ok:true,json:async()=>({code:0,data:{task_status:'succeed'}})});assert.equal((await call('GET',{}, {engine:'kling',id:'job-1'})).code,502)}finally{global.fetch=old}});
