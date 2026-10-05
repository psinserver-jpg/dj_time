export const SCHOOL = Object.freeze({name:'대진전자통신고등학교',officeCode:'C10',schoolCode:'7150597',homepage:'https://school.busanedu.net/pdj-h/main.do'});
export class ApiError extends Error { constructor(message,status=502,code='UPSTREAM_ERROR'){super(message);this.status=status;this.code=code;} }
export function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')) return false;
  const date=new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===value && +value.slice(0,4)>=2025 && +value.slice(0,4)<=2100;
}
export function validateTimetableQuery(query){
  const from=query.get('from'),to=query.get('to'),grade=query.get('grade'),className=query.get('className');
  if(!validDate(from)||!validDate(to)) throw new ApiError('날짜는 2025년 이후의 올바른 날짜를 선택해 주세요.',400,'INVALID_DATE');
  const span=(new Date(to)-new Date(from))/86400000;
  if(span<0||span>6) throw new ApiError('시간표는 최대 7일 범위로 조회해 주세요.',400,'INVALID_RANGE');
  if(!/^[1-3]$/.test(grade||'')||!/^\d{1,2}$/.test(className||'')||+className<1) throw new ApiError('올바른 학년과 반을 선택해 주세요.',400,'INVALID_CLASS');
  const department=query.get('department')||'',course=query.get('course')||'';
  if(department.length>100||course.length>100) throw new ApiError('학급 정보가 올바르지 않습니다.',400,'INVALID_CLASS');
  return {from,to,grade,className,department,course,year:from.slice(0,4)};
}
export function normalizeLessons(rows){
  const groups=new Map();
  for(const row of rows){
    const compact=String(row.ALL_TI_YMD||''),period=Number(row.PERIO);
    if(!/^\d{8}$/.test(compact)||!Number.isInteger(period)||period<1||period>12) continue;
    const date=`${compact.slice(0,4)}-${compact.slice(4,6)}-${compact.slice(6,8)}`;
    const subject=String(row.ITRT_CNTNT||'수업 내용 미등록').trim();
    const id=`${date}-${period}`;
    if(!groups.has(id)) groups.set(id,{id,date,period,subjects:new Set(),departments:new Set()});
    const item=groups.get(id);item.subjects.add(subject);if(row.DDDEP_NM)item.departments.add(String(row.DDDEP_NM));
  }
  return [...groups.values()].map(item=>({id:item.id,date:item.date,period:item.period,subject:[...item.subjects].join(' / '),department:[...item.departments].join(' / ')})).sort((a,b)=>a.date.localeCompare(b.date)||a.period-b.period);
}
const messages={
  'ERROR-290':'나이스 인증키가 유효하지 않습니다. .env의 NEIS_API_KEY를 확인하고 서버를 다시 실행해 주세요.',
  'ERROR-337':'나이스 API의 일일 호출 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.',
  'ERROR-300':'나이스 API 필수 조회 항목을 확인해 주세요.',
  'ERROR-500':'나이스 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.'
};
export function createNeisClient({key,officeCode=SCHOOL.officeCode,schoolCode=SCHOOL.schoolCode,fetchImpl=fetch}={}){
  const cache=new Map();
  const pending=new Map();
  async function request(endpoint,params){
    if(!key) throw new ApiError('실제 시간표를 보려면 서버에 나이스 인증키를 연결해 주세요.',503,'KEY_REQUIRED');
    const cacheKey=JSON.stringify([endpoint,params]);
    const cached=cache.get(cacheKey);if(cached&&cached.expires>Date.now())return cached.rows;
    if(pending.has(cacheKey)) return pending.get(cacheKey);
    const promise=(async()=>{
      let rows=[],total=0;
      for(let page=1;page<=10;page++){
        const url=new URL(`https://open.neis.go.kr/hub/${endpoint}`);
        url.search=new URLSearchParams({KEY:key,Type:'json',pIndex:String(page),pSize:'1000',ATPT_OFCDC_SC_CODE:officeCode,SD_SCHUL_CODE:schoolCode,...params});
        let response,data;
        try{response=await fetchImpl(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error();data=await response.json();}
        catch{throw new ApiError('나이스 서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',502,'NETWORK_ERROR');}
        const container=data[endpoint];
        const result=data.RESULT||container?.flatMap(block=>block.head||[]).find(block=>block.RESULT)?.RESULT;
        if(result?.CODE==='INFO-200')break;
        if(result?.CODE&&result.CODE!=='INFO-000')throw new ApiError(messages[result.CODE]||'나이스 API 조회에 실패했습니다. 인증키와 조회 날짜를 확인해 주세요.',502,String(result.CODE));
        const batch=container?.find(block=>Array.isArray(block.row))?.row;
        if(!batch)throw new ApiError('나이스 응답 형식을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',502,'INVALID_RESPONSE');
        total=Number(container.flatMap(block=>block.head||[]).find(block=>'list_total_count' in block)?.list_total_count||batch.length);
        rows.push(...batch);
        if(rows.length>=total)break;
        if(batch.length<1000)throw new ApiError('API가 일부 데이터만 반환했습니다. 발급받은 인증키를 확인해 주세요.',502,'INCOMPLETE_RESPONSE');
        if(page===10)throw new ApiError('조회 데이터가 너무 많습니다. 범위를 줄여 주세요.',502,'TOO_MANY_ROWS');
      }
      if(cache.size>=100)cache.delete(cache.keys().next().value);
      cache.set(cacheKey,{rows,expires:Date.now()+5*60*1000});return rows;
    })();
    pending.set(cacheKey,promise);
    try{return await promise;}finally{pending.delete(cacheKey);}
  }
  return {
    async classes(year){
      const rows=await request('classInfo',{AY:year});
      const classes=new Map();
      for(const row of rows){const grade=String(row.GRADE||''),className=String(row.CLASS_NM||''),department=String(row.DDDEP_NM||''),course=String(row.DGHT_CRSE_SC_NM||'');if(!/^[1-3]$/.test(grade)||!/^\d{1,2}$/.test(className))continue;const id=[grade,className,department,course].join('|');classes.set(id,{id,grade,className,department,course});}
      return [...classes.values()].sort((a,b)=>+a.grade-+b.grade||+a.className-+b.className||a.department.localeCompare(b.department,'ko'));
    },
    async timetable(query){
      // Date bounds identify the school year even across January or March.
      const params={GRADE:query.grade,CLASS_NM:query.className,TI_FROM_YMD:query.from.replaceAll('-',''),TI_TO_YMD:query.to.replaceAll('-','')};
      if(query.department)params.DDDEP_NM=query.department;
      if(query.course)params.DGHT_CRSE_SC_NM=query.course;
      return normalizeLessons(await request('hisTimetable',params));
    }
  };
}
