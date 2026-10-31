import test from 'node:test';
import assert from 'node:assert/strict';
process.env.ENABLE_PAID_VIDEO_GENERATION='true';
process.env.KLING_API_KEY='fixture-not-a-credential';
const {default: handler}=await import('./api/engines.js');
async function call(method,body={},query={}) {
 const res={setHeader(){},status(n){this.code=n;return this},json(value){this.value=value;return this}};
 await handler({method,body,query},res);return res;
}
async function mocked(reply,run){const original=global.fetch;try{global.fetch=reply;await run()}finally{global.fetch=original}}
test('disabled paid gate makes zero provider requests',async()=>{
 process.env.ENABLE_PAID_VIDEO_GENERATION='false';let calls=0;
 try{await mocked(async()=>{calls++;throw Error('must not call provider')},async()=>{
  assert.equal((await call('POST',{engine:'kling',prompt:'fixture'})).code,503);
  assert.equal((await call('GET',{}, {engine:'kling',id:'fixture'})).code,503);
  assert.equal(calls,0);
 })}finally{process.env.ENABLE_PAID_VIDEO_GENERATION='true'}
});
test('invalid input never reaches provider',async()=>mocked(async()=>{throw Error('unexpected provider request')},async()=>{
 assert.equal((await call('POST',{engine:'unknown',prompt:'x'})).code,400);
 assert.equal((await call('POST',{engine:'kling',prompt:' '})).code,400);
 assert.equal((await call('POST',{engine:'kling',prompt:'x'.repeat(1501)})).code,400);
 assert.equal((await call('GET',{}, {engine:'kling',id:'../other'})).code,400);
 assert.equal((await call('DELETE')).code,405);
}));
test('Kling submission contract is five seconds, silent pro v2.6',async()=>mocked(async(url,init)=>{
 assert.equal(url,'https://api-singapore.klingai.com/v1/videos/text2video');
 assert.equal(init.headers.Authorization,'Bearer fixture-not-a-credential');
 assert.deepEqual(JSON.parse(init.body),{model_name:'kling-v2-6',prompt:'scene',mode:'pro',duration:'5',aspect_ratio:'16:9',sound:'off'});
 return {ok:true,json:async()=>({code:0,data:{task_id:'fixture-job'}})};
},async()=>assert.equal((await call('POST',{engine:'kling',prompt:' scene '})).code,202)));
test('completed job returns video URL',async()=>mocked(async()=>({ok:true,json:async()=>({code:0,data:{task_status:'succeed',task_result:{videos:[{url:'https://example.test/fixture.mp4'}]}}})}),async()=>{
 assert.deepEqual((await call('GET',{}, {engine:'kling',id:'fixture-job'})).value,{status:'completed',videoUrl:'https://example.test/fixture.mp4'});
}));
test('provider rate limit stays actionable',async()=>mocked(async()=>({ok:false,status:429,json:async()=>({code:1302})}),async()=>assert.equal((await call('POST',{engine:'kling',prompt:'scene'})).code,429)));
test('provider authentication denial fails closed',async()=>mocked(async()=>({ok:false,status:401,json:async()=>({code:1002})}),async()=>{
 const r=await call('POST',{engine:'kling',prompt:'scene'});assert.equal(r.code,502);assert.equal(r.value.providerStatus,401);
}));
test('successful submission without job ID fails',async()=>mocked(async()=>({ok:true,json:async()=>({code:0,data:{}})}),async()=>assert.equal((await call('POST',{engine:'kling',prompt:'scene'})).code,502)));
