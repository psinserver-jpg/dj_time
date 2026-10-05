const $=selector=>document.querySelector(selector);
const icons={
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  settings:'<path d="m9.2 3-.8 2.1-2 .8-2.1-.5L2.8 8l1.5 1.7-.1 2.2L3 13.8l1.8 3 2.2-.3 1.8 1.2.4 2.3h3.6l.8-2.2 2-.8 2.1.5 1.7-3-1.5-1.7.1-2.2L21 8.7l-1.8-3-2.2.3-1.8-1.2-.4-2.3H11Z"/><circle cx="12" cy="11" r="3"/>',
  school:'<path d="m3 10 9-7 9 7v11H3Zm6 11v-6h6v6M7 11h.01M17 11h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',chevronRight:'<path d="m9 5 7 7-7 7"/>',chevronLeft:'<path d="m15 5-7 7 7 7"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5m-4.5-4a8 8 0 0 1 13-3L20 8M4 16l2.5 3a8 8 0 0 0 13-3"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  book:'<path d="M12 5v16M3 4h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v15h-4a5 5 0 0 0-5 2 5 5 0 0 0-5-2H3Z"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.info}</svg>`;}
document.querySelectorAll('[data-icon]').forEach(node=>{if(node.classList.length)node.innerHTML=icon(node.dataset.icon);else node.outerHTML=icon(node.dataset.icon);});
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateObj=iso=>new Date(iso+'T00:00:00Z');
function addDays(iso,amount){const date=dateObj(iso);date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);}
function monday(iso){return addDays(iso,-((dateObj(iso).getUTCDay()+6)%7));}
const prettyDate=iso=>new Intl.DateTimeFormat('ko-KR',{timeZone:'UTC',month:'long',day:'numeric',weekday:'long'}).format(dateObj(iso));
const shortDate=iso=>`${+iso.slice(5,7)}.${+iso.slice(8)}`;
const academicYear=iso=>String(+iso.slice(0,4)-(+iso.slice(5,7)<3?1:0));
function storageGet(){try{return JSON.parse(localStorage.getItem('daejin-class')||'null');}catch{return null;}}
function storeClass(value){try{localStorage.setItem('daejin-class',JSON.stringify(value));}catch{/* Storage disabled: keep the preference for this session. */}}
const state={config:null,mode:'sample',selectedDate:today(),weekStart:monday(today()),view:'week',classes:[],classYear:'',selectedClass:storageGet()||{grade:'1',className:'1',department:'',course:''},lessons:[],loading:true,error:null,updatedAt:null};
let requestVersion=0,toastTimer;
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),3500);}
const staticConfig=()=>({keyConfigured:false,defaultMode:'sample',static:true});
async function readConfig(){
  const embedded=document.getElementById('neis-snapshot');
  if(embedded){const snapshot=JSON.parse(embedded.textContent);if(snapshot.version!==1||!snapshot.weeks||!snapshot.classesByYear)throw new Error('게시된 시간표 데이터 형식을 확인해 주세요.');return {keyConfigured:false,defaultMode:'live',snapshot};}
  if(location.protocol==='file:')return staticConfig();
  let response;
  try{response=await fetch('/api/config',{signal:AbortSignal.timeout(18000)});}catch{throw new Error('웹사이트에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.');}
  if(response.status===404)return staticConfig();
  if(!response.ok)throw new Error('API 연결 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  if(!(response.headers.get('content-type')||'').includes('application/json'))return staticConfig();
  return response.json();
}
async function api(url){
  if(state.config?.snapshot){
    const request=new URL(url,'https://daejin.invalid'),snapshot=state.config.snapshot;
    if(request.pathname==='/api/classes')return {classes:snapshot.classesByYear[request.searchParams.get('year')]||[],source:'live',year:request.searchParams.get('year')};
    if(request.pathname==='/api/timetable'){
      const selected=state.selectedClass,week=snapshot.weeks[request.searchParams.get('from')];
      if(!week)throw new Error('이 주의 시간표는 게시되지 않았습니다. 이전 주·이번 주·다음 주를 선택해 주세요.');
      const classId=[selected.grade,selected.className,selected.department||'',selected.course||''].join('|');
      return {lessons:week.classes[classId]||[],source:'live',fetchedAt:snapshot.generatedAt};
    }
    throw new Error('지원하지 않는 요청입니다.');
  }
  if(state.config?.static){
    const request=new URL(url,'https://daejin.invalid');
    if(request.searchParams.get('mode')==='live')throw new Error('실제 조회는 인증키가 설정된 API 서버 주소에서 이용해 주세요.');
    const sample=globalThis.DaejinTimetableSample;
    if(request.pathname==='/api/classes')return {classes:sample.classes,source:'sample',year:request.searchParams.get('year')};
    if(request.pathname==='/api/timetable')return {lessons:sample.timetable(Object.fromEntries(request.searchParams)),source:'sample',fetchedAt:new Date().toISOString()};
    throw new Error('지원하지 않는 요청입니다.');
  }
  let response;try{response=await fetch(url,{signal:AbortSignal.timeout(18000)});}catch{throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.');}let data;try{data=await response.json();}catch{throw new Error('서버 응답을 읽을 수 없습니다. 새로고침 후 다시 확인해 주세요.');}if(!response.ok)throw new Error(data.error?.message||'시간표를 불러올 수 없습니다.');return data;
}
function subjectTone(subject){if(/수학/.test(subject))return 'blue';if(/영어/.test(subject))return 'purple';if(/프로그래밍|측정|하드웨어|계측/.test(subject))return 'green';if(/시스템|컴퓨터|소프트웨어/.test(subject))return 'teal';if(/과학|한국사|사회/.test(subject))return 'amber';if(/체육|미술|음악/.test(subject))return 'pink';if(/창의|진로|공휴일|휴업|방학/.test(subject))return 'gray';return 'green';}
const isNotice=lesson=>/공휴일|방학|휴업일|휴교|개교기념일/.test(lesson.subject);
const classText=()=>`${state.selectedClass.grade}학년 ${state.selectedClass.className}반`;
const dayLessons=()=>state.lessons.filter(item=>item.date===state.selectedDate);
const lessonCount=()=>dayLessons().filter(item=>!isNotice(item)).length;
const weekDates=()=>Array.from({length:5},(_,i)=>addDays(state.weekStart,i));
function setLoading(loading){state.loading=loading;$('#loading-state').hidden=!loading;$('#schedule-content').hidden=loading;$('#schedule-content').setAttribute('aria-busy',String(loading));$('#refresh-button').disabled=loading;}
function renderHeader(){
  $('#class-label').textContent=classText();$('#class-caption').textContent=classText();
  const dates=weekDates(),end=dates[4],current=monday(today())===state.weekStart;
  $('#week-label').textContent=current?'이번 주 시간표':`${+state.weekStart.slice(5,7)}월 시간표`;
  $('#week-range').textContent=`${state.weekStart.slice(0,4)}. ${shortDate(state.weekStart)} – ${shortDate(end)}`;
  $('#mobile-week-label').textContent=`${shortDate(state.weekStart)} – ${shortDate(end)}`;
  $('#aside-date').textContent=prettyDate(state.selectedDate);
  const isToday=state.selectedDate===today();$('#aside-title').textContent=isToday?'오늘의 수업':'이날의 수업';
  $('#mobile-summary-date').textContent=prettyDate(state.selectedDate);
  $('#mobile-summary-title').textContent=state.loading?'시간표를 불러오는 중':state.error?'시간표를 확인해 주세요':lessonCount()>0?`${isToday?'오늘은':'이날은'} ${lessonCount()}개의 수업`:'수업 없는 날';
  $('#mobile-summary-copy').textContent=state.error?'아래 안내를 확인하고 다시 시도해 주세요.':state.loading?classText():`${classText()} · ${state.mode==='sample'?'샘플 시간표':state.selectedClass.department||'나이스 시간표'}`;
  const pill=$('#mode-pill');pill.textContent=state.mode==='sample'?'샘플 모드':'NEIS 시간표';pill.classList.toggle('live',state.mode==='live');
  const notice=$('#data-notice');notice.classList.toggle('error',Boolean(state.error));
  $('#notice-text').innerHTML=state.error?escape(state.error):state.mode==='sample'?'화면을 살펴볼 수 있는 <strong>샘플 시간표</strong>입니다. 실제 학교 시간표와 다릅니다.':state.config?.snapshot?'나이스 실제 시간표입니다. 게시된 조회 시점을 확인하고, 변경 수업은 학교 안내를 확인해 주세요.':'나이스에 등록된 시간표입니다. 변경된 수업은 학교 안내를 확인해 주세요.';
  notice.querySelector('button').textContent=state.mode==='sample'?'API 연결 안내':'사용 안내';
  $('#source-label').innerHTML=icon('shield')+(state.mode==='sample'?'미리보기용 샘플 데이터':'나이스 교육정보 개방 포털');
  $('#updated-label').textContent=state.updatedAt?`${new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(state.updatedAt))} 조회 · 한국 시간` : '';
  $('#week-view').setAttribute('aria-pressed',String(state.view==='week'));$('#day-view').setAttribute('aria-pressed',String(state.view==='day'));
  $('#connection-title').textContent=state.config?.snapshot?'실제 나이스 시간표 게시 중':state.config?.keyConfigured?'나이스 인증키 설정됨':'샘플 모드로 사용 중';
  $('#connection-description').textContent=state.config?.snapshot?'이전 주·이번 주·다음 주의 30개 학급 시간표를 확인할 수 있어요. 인증키는 웹사이트에 포함되지 않습니다.':state.config?.static?'웹 파일로 사용 중입니다. 실제 조회는 아래 안내대로 API 서버를 연결해 주세요.':state.config?.keyConfigured?'실제 시간표 조회 시 인증키의 유효성을 확인합니다.':'API 키를 연결하면 실제 시간표를 조회할 수 있어요.';
  $('#sample-toggle-row').hidden=!state.config?.keyConfigured;$('#sample-toggle').checked=state.mode==='sample';
  const steps=$('#settings-dialog .setup-steps');
  steps.hidden=Boolean(state.config?.snapshot);steps.previousElementSibling.hidden=Boolean(state.config?.snapshot);$('#settings-dialog .key-note').hidden=Boolean(state.config?.snapshot);
  $('#check-connection').textContent=state.config?.snapshot?'최신 게시본 불러오기':'연결 상태 다시 확인';
}
function emptyMarkup(title,description){return `<div class="empty-state">${icon('calendar')}<h3>${escape(title)}</h3><p>${escape(description)}</p></div>`;}
function lessonButton(lesson,type){const tone=subjectTone(lesson.subject),label=`${prettyDate(lesson.date)} ${lesson.period}교시 ${lesson.subject}`;if(type==='grid')return `<button class="lesson-cell tone-${tone}" data-lesson="${escape(lesson.id)}" aria-label="${escape(label)}"><span class="subject-name">${escape(lesson.subject)}</span><span class="subject-meta">${state.mode==='sample'?'샘플 수업':escape(lesson.department||'나이스 등록')}</span></button>`;if(type==='aside')return `<button class="aside-lesson" data-lesson="${escape(lesson.id)}"><span class="aside-period">${lesson.period}</span><span><strong>${escape(lesson.subject)}</strong><small>${state.mode==='sample'?'샘플 수업':`${lesson.period}교시`}</small></span></button>`;return `<button class="day-card tone-${tone}" data-lesson="${escape(lesson.id)}" aria-label="${escape(label)}"><span class="period-badge">${lesson.period}교시</span><span><strong>${escape(lesson.subject)}</strong><small>${state.mode==='sample'?'미리보기용 샘플 수업':escape(lesson.department||'나이스 등록 시간표')}</small></span>${icon('chevronRight')}</button>`;}
function renderSchedule(){
  renderHeader();
  const dates=weekDates(),weekdays=['월','화','수','목','금'];
  $('#mobile-days').innerHTML=dates.map((date,i)=>`<button class="mobile-day ${date===state.selectedDate?'selected':''} ${date===today()?'today':''}" data-date="${date}" aria-label="${escape(prettyDate(date))}" aria-pressed="${date===state.selectedDate}"><span class="weekday">${weekdays[i]}</span><span class="day-number">${+date.slice(8)}</span></button>`).join('');
  $('#week-grid').style.display=state.view==='week'?'grid':'none';$('#day-list').classList.toggle('visible',state.view==='day');
  const grid=$('#week-grid'),list=$('#day-list');
  if(state.loading)return;
  if(state.error){const html=emptyMarkup('시간표를 불러오지 못했어요',state.error);grid.innerHTML=html;list.innerHTML=html;}
  else{
    const headers='<div class="grid-corner">교시</div>'+dates.map((date,i)=>`<button class="grid-day ${date===state.selectedDate?'selected':''} ${date===today()?'today':''}" data-date="${date}" aria-label="${escape(prettyDate(date))} 수업 선택" aria-pressed="${date===state.selectedDate}"><span class="weekday">${weekdays[i]}</span><span class="day-number">${+date.slice(8)}</span></button>`).join('');
    if(!state.lessons.length)grid.innerHTML=emptyMarkup('등록된 시간표가 없어요','조회한 학급과 주의 시간표가 나이스에 등록되지 않았습니다. 다른 주 또는 학급을 선택해 주세요.');
    else{
      const max=Math.max(7,...state.lessons.map(item=>item.period));const lookup=new Map(state.lessons.map(item=>[`${item.date}-${item.period}`,item]));let cells='';
      for(let period=1;period<=max;period++){cells+=`<div class="period-label">${period}교시</div>`;for(const date of dates){const lesson=lookup.get(`${date}-${period}`);cells+=lesson?lessonButton(lesson,'grid'):'<div class="lesson-cell lesson-empty" aria-label="등록된 수업 없음">—</div>';}}
      grid.innerHTML=headers+cells;
    }
    const lessons=dayLessons(),notices=[...new Set(lessons.filter(isNotice).map(item=>item.subject))];
    if(notices.length&&lessonCount()===0)list.innerHTML=emptyMarkup(notices.join(' · '),'나이스에 등록된 학교 일정입니다.');
    else if(!lessons.length)list.innerHTML=emptyMarkup('등록된 수업이 없어요',dateObj(state.selectedDate).getUTCDay()%6===0?'주말에는 등록된 수업이 없습니다.':'다른 날짜 또는 학급을 선택해 주세요.');
    else list.innerHTML=`<p class="day-desktop-title">${escape(prettyDate(state.selectedDate))}</p>`+lessons.map(lesson=>lessonButton(lesson,'day')).join('');
  }
  $('#lesson-count').textContent=state.error?'—':String(lessonCount());
  const lessons=dayLessons();$('#aside-lessons').innerHTML=state.error?'<p class="guide-copy">시간표 연결을 확인해 주세요.</p>':lessons.length?lessons.filter(item=>!isNotice(item)).map(lesson=>lessonButton(lesson,'aside')).join('')||`<p class="guide-copy">${escape([...new Set(lessons.map(item=>item.subject))].join(' · '))}</p>`:'<p class="guide-copy">등록된 수업이 없습니다.</p>';
}
function renderClassPicker(){
  const gradeSelect=$('#grade-select'),classSelect=$('#class-select');
  const grades=[...new Set(state.classes.map(item=>item.grade))];
  const chosen=gradeSelect.value||state.selectedClass.grade;
  gradeSelect.innerHTML=grades.map(grade=>`<option value="${grade}">${grade}학년</option>`).join('');
  gradeSelect.value=grades.includes(chosen)?chosen:(grades[0]||'');
  classSelect.innerHTML=state.classes.filter(item=>item.grade===gradeSelect.value).map(item=>`<option value="${escape(item.id)}">${escape(item.className)}반${item.department&&item.department!=='샘플'?` · ${escape(item.department)}`:''}</option>`).join('');
  const selected=state.classes.find(item=>item.grade===state.selectedClass.grade&&item.className===state.selectedClass.className&&item.department===state.selectedClass.department&&item.course===state.selectedClass.course);
  if(selected&&selected.grade===gradeSelect.value)classSelect.value=selected.id;
  $('#class-help').textContent=state.mode==='sample'?'샘플 모드에는 예시용 1~3학년 1~3반이 있습니다. 실제 학급 목록은 인증키 연결 후 조회합니다.':state.classes.length?`${state.classYear}학년도 나이스에 등록된 학급 목록입니다.`:'조회 학년도에 등록된 학급이 없습니다. 다른 주를 선택해 주세요.';
  $('#class-form button[type=submit]').disabled=!state.classes.length;
}
async function loadClasses({version,mode,year}){
  const data=await api(`/api/classes?${new URLSearchParams({year,mode})}`);
  if(version!==requestVersion)return;
  state.classes=data.classes;state.classYear=year;
  const selected=state.classes.find(item=>item.grade===state.selectedClass.grade&&item.className===state.selectedClass.className&&(state.selectedClass.department?item.department===state.selectedClass.department:true));
  if(selected)state.selectedClass=selected;else if(state.classes.length)state.selectedClass=state.classes[0];
  storeClass(state.selectedClass);renderClassPicker();
}
async function loadTimetable({classes=false}={}){
  const version=++requestVersion,mode=state.mode,weekStart=state.weekStart,year=academicYear(weekStart);setLoading(true);state.error=null;state.lessons=[];state.updatedAt=null;renderSchedule();
  try{
    if(classes||state.classYear!==year)await loadClasses({version,mode,year});
    if(version!==requestVersion)return;
    const {grade,className,department='',course=''}=state.selectedClass;
    const query=new URLSearchParams({from:weekStart,to:addDays(weekStart,4),grade,className,department:mode==='live'?department:'',course,mode});
    const data=await api(`/api/timetable?${query}`);if(version!==requestVersion)return;state.lessons=data.lessons;state.updatedAt=data.fetchedAt;
  }catch(error){if(version!==requestVersion)return;state.error=error.message;}
  if(version===requestVersion){setLoading(false);renderSchedule();}
}
function changeWeek(amount){const next=addDays(state.weekStart,amount*7);if(state.config?.snapshot&&!state.config.snapshot.weeks[next]){toast('게시된 시간표 범위는 이전 주·이번 주·다음 주입니다.');return;}if(+next.slice(0,4)<2025||+next.slice(0,4)>2099){toast('2025년 이후의 날짜를 선택해 주세요.');return;}const offset=Math.min(4,Math.max(0,(dateObj(state.selectedDate)-dateObj(state.weekStart))/86400000));state.weekStart=next;state.selectedDate=addDays(next,offset);return loadTimetable();}
function goToday(){state.selectedDate=today();const start=monday(today());if(state.weekStart===start)renderSchedule();else{state.weekStart=start;return loadTimetable();}}
function showDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();}
function showClassDialog(){const error=$('#class-error');error.hidden=true;if(state.error&&state.classes.length===0){error.textContent=state.error;error.hidden=false;}$('#grade-select').value=state.selectedClass.grade;renderClassPicker();showDialog('#class-dialog');}
function showLesson(id){const lesson=state.lessons.find(item=>item.id===id);if(!lesson)return;$('#lesson-detail').innerHTML=`<div class="lesson-detail-subject tone-${subjectTone(lesson.subject)}"><h2>${escape(lesson.subject)}</h2><p>${state.mode==='sample'?'미리보기용 샘플 수업':'나이스에 등록된 시간표'}</p></div><dl class="detail-facts"><dt>날짜</dt><dd>${escape(prettyDate(lesson.date))}</dd><dt>학급</dt><dd>${escape(classText())}</dd><dt>교시</dt><dd>${lesson.period}교시</dd>${lesson.department&&state.mode==='live'?`<dt>학과</dt><dd>${escape(lesson.department)}</dd>`:''}<dt>데이터</dt><dd>${state.mode==='sample'?'샘플 · 실제 학교 시간표와 다름':'나이스 교육정보 개방 포털'}</dd></dl><p class="detail-note">${state.mode==='sample'?'이 과목과 배치는 화면 확인을 위한 예시입니다. 인증키를 연결하면 실제 시간표를 볼 수 있습니다.':'교사명, 교실, 수업 시작·종료 시간은 이 API에서 제공하지 않습니다. 변경 수업과 상세 일정은 학교 안내를 확인해 주세요.'}</p>`;showDialog('#lesson-dialog');}
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='class')showClassDialog();else if(action==='settings')showDialog('#settings-dialog');else if(action==='timetable'){$('#main').scrollIntoView({behavior:'smooth'});}
  const date=event.target.closest('[data-date]')?.dataset.date;if(date){state.selectedDate=date;renderSchedule();}
  const lesson=event.target.closest('[data-lesson]')?.dataset.lesson;if(lesson)showLesson(lesson);
  if(event.target.closest('[data-close]'))event.target.closest('dialog').close();
});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
$('#prev-week').addEventListener('click',()=>changeWeek(-1));$('#next-week').addEventListener('click',()=>changeWeek(1));$('#mobile-prev').addEventListener('click',()=>changeWeek(-1));$('#mobile-next').addEventListener('click',()=>changeWeek(1));$('#today-button').addEventListener('click',goToday);$('#mobile-today').addEventListener('click',goToday);
$('#week-view').addEventListener('click',()=>{state.view='week';renderSchedule();});$('#day-view').addEventListener('click',()=>{state.view='day';renderSchedule();});$('#refresh-button').addEventListener('click',()=>loadTimetable());
$('#grade-select').addEventListener('change',renderClassPicker);
$('#class-form').addEventListener('submit',async event=>{event.preventDefault();const selected=state.classes.find(item=>item.id===$('#class-select').value);if(!selected)return;state.selectedClass=selected;storeClass(selected);$('#class-dialog').close();await loadTimetable();if(!state.error)toast(`${classText()} 시간표를 불러왔어요.`);});
$('#sample-toggle').addEventListener('change',async event=>{state.mode=event.target.checked?'sample':'live';state.classes=[];state.classYear='';await loadTimetable({classes:true});});
$('#check-connection').addEventListener('click',async()=>{if(state.config?.snapshot){location.reload();return;}const button=$('#check-connection');button.disabled=true;try{state.config=await readConfig();if(state.config.snapshot)state.mode='live';else if(!state.config.keyConfigured)state.mode='sample';else state.mode=$('#sample-toggle').checked?'sample':'live';state.classes=[];await loadTimetable({classes:true});toast(state.error?'설정과 인증키를 확인해 주세요.':state.config.snapshot?'게시된 실제 시간표를 확인했어요.':state.config.keyConfigured?'나이스 연결 상태를 확인했어요.':state.config.static?'웹 파일에서 샘플 시간표를 보고 있어요.':'아직 인증키가 설정되지 않았어요.');}catch(error){toast(error.message);}finally{button.disabled=false;}});
async function init(){renderSchedule();try{state.config=await readConfig();state.mode=state.config.defaultMode;await loadTimetable({classes:true});}catch(error){state.error=error.message;setLoading(false);renderSchedule();}}
void init();

// Optional browser-standard access to the same visible timetable state.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const tools=[
    {name:'read_class_timetable',title:'시간표 읽기',description:'현재 화면의 학급, 주간 시간표, 데이터 출처를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(Object.keys(input||{}).length)throw new Error('입력 항목이 없습니다.');return {class:classText(),weekStart:state.weekStart,selectedDate:state.selectedDate,source:state.mode,loading:state.loading,error:state.error,lessons:state.lessons};}},
    {name:'select_timetable_day',title:'시간표 날짜 선택',description:'현재 표시 중인 주에서 평일 날짜를 선택합니다.',inputSchema:{type:'object',properties:{date:{type:'string',format:'date'}},required:['date'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).length!==1||!weekDates().includes(input.date))throw new Error('현재 주의 월~금 날짜를 선택해 주세요.');state.selectedDate=input.date;renderSchedule();return {selectedDate:state.selectedDate,source:state.mode,lessons:dayLessons()};}}
  ];
  for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}}
}
