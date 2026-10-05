import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const port=14317,base=`http://127.0.0.1:${port}`;
test('HTTP contract: labeled sample, live key requirement, input validation, and private-file protection',async t=>{
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NEIS_API_KEY:''},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('Test server did not start');}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Server startup timeout')),5000);timer.unref();})]);
  const config=await (await fetch(base+'/api/config')).json();assert.equal(config.keyConfigured,false);assert.equal(config.school.schoolCode,'7150597');assert.equal('key' in config,false);
  const query='from=2026-10-05&to=2026-10-09&grade=1&className=1';
  const sample=await (await fetch(base+'/api/timetable?'+query+'&mode=sample')).json();assert.equal(sample.source,'sample');assert(sample.lessons.length>5);assert(sample.lessons.every(item=>item.date>='2026-10-05'&&item.date<='2026-10-09'));
  const live=await fetch(base+'/api/timetable?'+query+'&mode=live');assert.equal(live.status,503);assert.equal((await live.json()).error.code,'KEY_REQUIRED');
  const bad=await fetch(base+'/api/timetable?from=2026-02-30&to=2026-03-01&grade=1&className=1');assert.equal(bad.status,400);
  const january=await fetch(base+'/api/classes?year=2024&mode=sample');assert.equal(january.status,200);
  for(const route of ['/.env','/.env.example','/server.mjs','/lib/neis.mjs'])assert.equal((await fetch(base+route)).status,404);
  assert.equal((await fetch(base+'/api/config',{method:'POST'})).status,405);
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
