import test from 'node:test';
import assert from 'node:assert/strict';
import { produceShots } from './src/productionController.ts';
const plan = {shots:[{id:1,prompt:'first',seconds:5},{id:2,prompt:'second',seconds:5}]};
const reply = data => new Response(JSON.stringify(data));
const wait = async () => {};
test('reload resumes saved provider ID without resubmitting or repeating completed clips', async () => {
 let saved, posts=0, fail=true;
 const api=async (url,init) => {
  if(init?.method==='POST'){posts++;return reply({id:'job-'+posts});}
  if(fail){fail=false;throw Error('network interrupted');}
  return reply({status:'completed',videoUrl:'https://example.test/clip.mp4'});
 };
 const first=await produceShots(plan,'kling',s=>saved=s,api,undefined,'9:16',null,wait);
 assert.equal(first.shots[0].jobId,'job-1');
 const second=await produceShots(plan,'kling',s=>saved=s,api,undefined,'9:16',JSON.parse(JSON.stringify(saved)),wait);
 assert.equal(second.finished,true);assert.equal(posts,2);
 const final=await produceShots(plan,'kling',()=>{},api,undefined,'9:16',second,wait);
 assert.equal(final.finished,true);assert.equal(posts,2);
});
test('unknown submission outcome cannot generate a duplicate job', async () => {
 let posts=0;
 const api=async()=>{posts++;throw Error('lost response');};
 const first=await produceShots(plan,'kling',()=>{},api,undefined,'16:9',null,wait);
 await assert.rejects(produceShots(plan,'kling',()=>{},api,undefined,'16:9',first,wait),/outcome is unknown/);
 assert.equal(posts,1);
});
test('different aspect or plan cannot resume a previously approved production', async()=>{
 const first=await produceShots(plan,'kling',()=>{},async()=>{throw Error('offline')},undefined,'16:9',null,wait);
 await assert.rejects(produceShots(plan,'kling',()=>{},fetch,undefined,'9:16',first,wait),/original plan/);
});
