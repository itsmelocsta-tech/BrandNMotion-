// BrandNMotion Automatic Storyboard-to-Commercial Production Controller
// Adapters are injected; this does NOT activate paid KlingAI calls.
export function validateStoryboard(input) {
  if (!input || !Array.isArray(input.shots) || input.shots.length < 1 || input.shots.length > 30) throw Error("Storyboard must contain 1-30 shots");
  const shots=input.shots.map((s,i)=>{
    const durationSeconds=Number(s.durationSeconds);
    if(!String(s.description||"").trim()||!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>30) throw Error("Invalid shot "+(i+1));
    return {id:String(s.id||"shot-"+(i+1)),description:String(s.description),durationSeconds,referenceImage:s.referenceImage||null,voiceover:s.voiceover||null};
  });
  if(new Set(shots.map(s=>s.id)).size!==shots.length) throw Error("Duplicate shot IDs");
  return {title:String(input.title||"Commercial"),shots,totalSeconds:shots.reduce((n,s)=>n+s.durationSeconds,0)};
}
export function createProduction(input,{provider,assembler,store,estimateCost}) {
  const plan=validateStoryboard(input);
  if(!provider?.generate||!assembler?.assemble||!store?.load||!store?.save||!estimateCost) throw Error("Missing adapters");
  const id=String(input.productionId||"production-"+Date.now()),key="storyboard:"+id;
  let cancelled=false;
  const fresh=()=>({id,title:plan.title,status:"planned",totalSeconds:plan.totalSeconds,estimatedCost:estimateCost(plan),shots:plan.shots.map(s=>({...s,status:"pending",url:null,error:null,attempts:0})),output:null});
  const load=async()=>await store.load(key)||fresh();
  const save=async state=>{await store.save(key,state);return state};
  return {id,plan,load,cancel(){cancelled=true},
    async retryShot(shotId){const state=await load(),shot=state.shots.find(s=>s.id===shotId);if(!shot)throw Error("Shot not found");Object.assign(shot,{status:"pending",url:null,error:null});state.status="planned";state.output=null;return save(state)},
    async run({approved=false,onProgress=()=>{}}={}){
      const state=await load();
      if(!approved){state.status="awaiting_approval";return save(state)}
      if(state.status==="complete")return state;
      cancelled=false;state.status="generating";await save(state);
      for(const shot of state.shots){
        if(cancelled){state.status="cancelled";return save(state)}
        if(shot.status==="complete")continue;
        shot.status="generating";shot.attempts++;shot.error=null;await save(state);onProgress({shot:shot.id,status:shot.status});
        try{const result=await provider.generate(shot,{productionId:id});if(!result?.url)throw Error("No video URL");shot.url=result.url;shot.status="complete";await save(state);onProgress({shot:shot.id,status:shot.status})}
        catch(e){shot.status="failed";shot.error=String(e?.message||e);state.status="failed";return save(state)}
      }
      if(cancelled){state.status="cancelled";return save(state)}
      state.status="assembling";await save(state);
      try{const output=await assembler.assemble(state.shots.map(s=>({url:s.url,durationSeconds:s.durationSeconds,voiceover:s.voiceover})),{title:plan.title});if(!output?.url||!String(output.url).toLowerCase().includes(".mp4"))throw Error("Assembler did not return MP4");state.output=output.url;state.status="complete"}
      catch(e){state.status="assembly_failed";state.error=String(e?.message||e)}
      return save(state);
    }
  };
}
export function memoryStore(){const map=new Map();return {load:async k=>structuredClone(map.get(k)),save:async(k,v)=>map.set(k,structuredClone(v))}}
