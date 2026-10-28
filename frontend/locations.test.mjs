import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './api/locations.js';
async function call(body){const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};await handler({method:'POST',body},res);return res}
test('rejects empty address',async()=>assert.equal((await call({address:''})).code,400));
test('missing Maps key is clear and does not fabricate location',async()=>{delete process.env.GOOGLE_MAPS_API_KEY;assert.equal((await call({address:'New York'})).code,503)});
test('maps results preserve place identity and never expose key',async()=>{process.env.GOOGLE_MAPS_API_KEY='private-test';const old=global.fetch;try{global.fetch=async url=>{assert.match(url,/address=350/);return {ok:true,json:async()=>({status:'OK',results:[{formatted_address:'350 Fifth Avenue, New York',place_id:'place-1',geometry:{location:{lat:40.7484,lng:-73.9857},location_type:'ROOFTOP'}}]})}};const r=await call({address:'350 Fifth Avenue'});assert.equal(r.data.locations[0].lat,40.7484);assert.match(r.data.locations[0].mapsUrl,/query_place_id=place-1/);assert.equal(JSON.stringify(r.data).includes('private-test'),false)}finally{global.fetch=old}});
test('no results stays empty',async()=>{const old=global.fetch;try{global.fetch=async()=>({ok:true,json:async()=>({status:'ZERO_RESULTS',results:[]})});assert.deepEqual((await call({address:'Unknown'})).data.locations,[])}finally{global.fetch=old}});
test('provider denial is surfaced',async()=>{const old=global.fetch;try{global.fetch=async()=>({ok:true,json:async()=>({status:'REQUEST_DENIED'})});assert.equal((await call({address:'New York'})).code,502)}finally{global.fetch=old}});
