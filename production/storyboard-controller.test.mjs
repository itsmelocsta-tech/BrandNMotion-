import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStoryboard,createProduction,memoryStore} from './storyboard-controller.mjs';
const board={productionId:'ad1',title:'40-second commercial',shots:Array.from({length:5},(_,i)=>({id:'s'+i,description:'Shot '+i,durationSeconds:8}))};
function setup(provider={generate:async s=>({url:'https://example.com/'+s.id+'.mp4'})},assembler={assemble:async()=>({url:'https://example.com/final.mp4'})},store=memoryStore()){return createProduction(board,{provider,assembler,store,estimateCost:()=>12})}
test('validates 40-second storyboard',()=>assert.equal(validateStoryboard(board).totalSeconds,40));
test('rejects empty shots',()=>assert.throws(()=>validateStoryboard({shots:[]})));
test('rejects duplicate IDs',()=>assert.throws(()=>validateStoryboard({shots:[board.shots[0],board.shots[0]]})));
test('requires cost approval',async()=>{let calls=0;const p=setup({generate:async()=>{calls++}});assert.equal((await p.run()).status,'awaiting_approval');assert.equal(calls,0)});
test('assembles MP4',async()=>{const s=await setup().run({approved:true});assert.equal(s.status,'complete');assert.equal(s.shots.length,5);assert.match(s.output,/mp4$/)});
test('resumes without repeating successful shots',async()=>{let attempts=0;const provider={generate:async s=>{attempts++;if(s.id==='s2'&&attempts===3)throw Error('temporary');return {url:'https://x/'+s.id+'.mp4'}}};const p=setup(provider);assert.equal((await p.run({approved:true})).status,'failed');assert.equal((await p.run({approved:true})).status,'complete');assert.equal(attempts,6)});
test('rejects non-MP4 assembly',async()=>assert.equal((await setup(undefined,{assemble:async()=>({url:'https://x/file.webm'})}).run({approved:true})).status,'assembly_failed'));
test('retry resets selected shot',async()=>{const p=setup();await p.run({approved:true});const s=await p.retryShot('s2');assert.equal(s.shots[2].status,'pending');assert.equal(s.shots[1].status,'complete')});
