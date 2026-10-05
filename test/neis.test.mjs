import test from 'node:test';
import assert from 'node:assert/strict';
import {createNeisClient,normalizeLessons,validateTimetableQuery,ApiError} from '../lib/neis.mjs';
const success=(endpoint,rows,total=rows.length)=>new Response(JSON.stringify({[endpoint]:[{head:[{list_total_count:total},{RESULT:{CODE:'INFO-000'}}]},{row:rows}]}));
const row=(period=1,subject='공통국어')=>({ALL_TI_YMD:'20261006',PERIO:String(period),ITRT_CNTNT:subject,DDDEP_NM:'전기전자과'});

test('NEIS sends the school and issued key server-side; bounded dates handle academic-year changes',async()=>{
  let captured;
  const client=createNeisClient({key:'unit-test-only',fetchImpl:async url=>{captured=new URL(url);return success('hisTimetable',[row()]);}});
  const query=validateTimetableQuery(new URLSearchParams({from:'2027-02-26',to:'2027-03-04',grade:'1',className:'1',department:'전기전자과'}));
  await client.timetable(query);
  assert.equal(captured.hostname,'open.neis.go.kr');assert.equal(captured.searchParams.get('KEY'),'unit-test-only');
  assert.equal(captured.searchParams.get('ATPT_OFCDC_SC_CODE'),'C10');assert.equal(captured.searchParams.get('SD_SCHUL_CODE'),'7150597');
  assert.equal(captured.searchParams.get('TI_FROM_YMD'),'20270226');assert.equal(captured.searchParams.get('TI_TO_YMD'),'20270304');
  assert.equal(captured.searchParams.has('AY'),false);assert.equal(captured.searchParams.get('DDDEP_NM'),'전기전자과');
});
test('Invalid dates, reversed ranges and unbounded ranges fail before an API request',()=>{
  for(const [from,to] of [['2026-02-30','2026-03-02'],['2026-10-09','2026-10-05'],['2026-10-05','2026-11-05']]){
    assert.throws(()=>validateTimetableQuery(new URLSearchParams({from,to,grade:'1',className:'1'})),error=>error instanceof ApiError&&error.status===400);
  }
});
test('Duplicate section rows combine by date and period without losing subject text',()=>{
  const rows=normalizeLessons([row(2,'계측장비 활용'),row(1),row(2,'하드웨어 측정분석'),row(2,'계측장비 활용'),{...row(),PERIO:'x'}]);
  assert.equal(rows.length,2);assert.equal(rows[0].period,1);assert.equal(rows[1].subject,'계측장비 활용 / 하드웨어 측정분석');
});
test('No-data result produces an empty timetable',async()=>{
  const client=createNeisClient({key:'unit-test-only',fetchImpl:async()=>new Response(JSON.stringify({RESULT:{CODE:'INFO-200'}}))});
  assert.deepEqual(await client.timetable({year:'2026',grade:'1',className:'1',from:'2026-10-05',to:'2026-10-09'}),[]);
});
test('Invalid key response and transport exceptions never disclose the key',async()=>{
  for(const fetchImpl of [async()=>new Response(JSON.stringify({RESULT:{CODE:'ERROR-290',MESSAGE:'unit-test-only'}})),async()=>{throw new Error('https://open.neis.go.kr?KEY=unit-test-only');}]){
    const client=createNeisClient({key:'unit-test-only',fetchImpl});
    await assert.rejects(client.classes('2026'),error=>error instanceof ApiError&&!error.message.includes('unit-test-only'));
  }
});
test('Incomplete 5-row sample response is rejected instead of presented as a complete week',async()=>{
  const client=createNeisClient({key:'sample',fetchImpl:async()=>success('hisTimetable',Array.from({length:5},(_,i)=>row(i+1)),32)});
  await assert.rejects(client.timetable({year:'2026',grade:'1',className:'1',from:'2026-10-05',to:'2026-10-09'}),error=>error.code==='INCOMPLETE_RESPONSE');
});
test('Class API paginates, keeps department distinctions and caches completed responses',async()=>{
  let calls=0;
  const rows=Array.from({length:1000},()=>({GRADE:'1',CLASS_NM:'1',DDDEP_NM:'전기전자과',DGHT_CRSE_SC_NM:'주간'}));
  const client=createNeisClient({key:'unit-test-only',fetchImpl:async url=>{calls++;return new URL(url).searchParams.get('pIndex')==='1'?success('classInfo',rows,1001):success('classInfo',[{GRADE:'1',CLASS_NM:'1',DDDEP_NM:'AI소프트웨어과',DGHT_CRSE_SC_NM:'주간'}],1001);}});
  const classes=await client.classes('2026');assert.equal(classes.length,2);assert.equal(calls,2);await client.classes('2026');assert.equal(calls,2);
});
