import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createNeisClient,normalizeLessons,SCHOOL} from '../lib/neis.mjs';
const root=new URL('../',import.meta.url);
const key=(process.env.NEIS_API_KEY||'').trim();
const iso=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=(value,n)=>{const date=new Date(value+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);};
const week=shift(iso,-((new Date(iso+'T00:00:00Z').getUTCDay()+6)%7));
const academicYear=value=>String(+value.slice(0,4)-(+value.slice(5,7)<3?1:0));
if(!key)throw new Error('NEIS_API_KEY 인증키가 필요합니다. GitHub Actions Secret으로 설정하세요.');
const client=createNeisClient({key});
const snapshot={version:1,school:SCHOOL,generatedAt:new Date().toISOString(),classesByYear:{},weeks:{}};
for(const offset of [-7,0,7]){
  const from=shift(week,offset),to=shift(from,4),year=academicYear(from);
  if(!snapshot.classesByYear[year])snapshot.classesByYear[year]=await client.classes(year);
  const rows=await client.schoolTimetableRows({from,to});
  const classes={};
  for(const selected of snapshot.classesByYear[year]){
    const matching=rows.filter(row=>String(row.GRADE)===selected.grade&&String(row.CLASS_NM)===selected.className&&(!selected.department||String(row.DDDEP_NM)===selected.department)&&(!selected.course||String(row.DGHT_CRSE_SC_NM)===selected.course));
    classes[selected.id]=normalizeLessons(matching);
  }
  snapshot.weeks[from]={from,to,year,classes};
  console.log(`${from} ~ ${to}: ${rows.length}개 시간표 항목 · ${Object.keys(classes).length}개 학급`);
}
const serialized=JSON.stringify(snapshot);
if(serialized.includes(key))throw new Error('인증키가 공개 데이터에 포함되어 게시를 중단합니다.');
await mkdir(new URL('.pages-data/',root),{recursive:true});
await writeFile(new URL('.pages-data/snapshot.json',root),serialized);
await import('./build-static.mjs');
const index=new URL('index.html',root);
const html=await readFile(index,'utf8');
const safe=serialized.replace(/</g,'\\u003c');
await writeFile(index,html.replace('<body>',`<body>\n<script type="application/json" id="neis-snapshot">${safe}</script>`));
console.log('실제 시간표를 포함한 GitHub Pages index.html 생성 완료 · 인증키 제외');
