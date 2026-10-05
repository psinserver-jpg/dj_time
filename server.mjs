import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCHOOL,ApiError,createNeisClient,validateTimetableQuery} from './lib/neis.mjs';
import {SAMPLE_CLASSES,sampleTimetable} from './lib/sample.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
try{const env=await readFile(path.join(root,'.env'),'utf8');for(const line of env.split(/\r?\n/)){const match=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(!match||process.env[match[1]]!==undefined)continue;let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);else value=value.split(/\s+#/)[0].trim();process.env[match[1]]=value;}}
catch(error){if(error.code!=='ENOENT')throw new Error('.env 파일을 읽을 수 없습니다. 파일 접근 권한을 확인해 주세요.');}
const key=(process.env.NEIS_API_KEY||'').trim();
const client=createNeisClient({key,officeCode:process.env.NEIS_OFFICE_CODE||SCHOOL.officeCode,schoolCode:process.env.NEIS_SCHOOL_CODE||SCHOOL.schoolCode});
const publicDir=path.join(root,'public');
const files=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/sample-data.js','sample-data.js'],['/style.css','style.css'],['/favicon.svg','favicon.svg']]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const csp="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const rateLimits=new Map();
function sendJson(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',csp);
  try{
    if(req.method!=='GET'&&req.method!=='HEAD')throw new ApiError('지원하지 않는 요청입니다.',405,'METHOD_NOT_ALLOWED');
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      if(req.method==='HEAD'){res.writeHead(405);res.end();return;}
      const address=req.socket.remoteAddress||'local',now=Date.now();
      const rate=rateLimits.get(address);if(!rate||rate.reset<now)rateLimits.set(address,{count:1,reset:now+60000});else if(++rate.count>100)throw new ApiError('요청이 많습니다. 1분 뒤 다시 확인해 주세요.',429,'RATE_LIMIT');
      if(rateLimits.size>500){for(const [id,item]of rateLimits)if(item.reset<now)rateLimits.delete(id);}
      if(url.pathname==='/api/config'){sendJson(res,200,{school:SCHOOL,keyConfigured:Boolean(key),defaultMode:key?'live':'sample',cacheSeconds:300});return;}
      const mode=url.searchParams.get('mode')||(key?'live':'sample');
      if(!['sample','live'].includes(mode))throw new ApiError('조회 방식이 올바르지 않습니다.',400,'INVALID_MODE');
      if(url.pathname==='/api/classes'){
        const year=url.searchParams.get('year');if(!/^20\d{2}$/.test(year||'')||+year<2024)throw new ApiError('2024년 이후의 학년도를 선택해 주세요.',400,'INVALID_YEAR');
        const classes=mode==='sample'?SAMPLE_CLASSES:await client.classes(year);
        sendJson(res,200,{classes,source:mode,year,school:SCHOOL.name});return;
      }
      if(url.pathname==='/api/timetable'){
        const query=validateTimetableQuery(url.searchParams);
        const lessons=mode==='sample'?sampleTimetable(query):await client.timetable(query);
        sendJson(res,200,{lessons,source:mode,school:SCHOOL.name,from:query.from,to:query.to,fetchedAt:new Date().toISOString()});return;
      }
      throw new ApiError('요청한 API가 없습니다.',404,'NOT_FOUND');
    }
    const filename=files.get(url.pathname);if(!filename){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('페이지를 찾을 수 없습니다.');return;}
    const target=path.join(publicDir,filename);const info=await stat(target);
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)],'Content-Length':info.size,'Cache-Control':'no-cache'});
    if(req.method==='HEAD')res.end();else res.end(await readFile(target));
  }catch(error){const status=error instanceof ApiError?error.status:500;sendJson(res,status,{error:{code:error instanceof ApiError?error.code:'INTERNAL_ERROR',message:error instanceof ApiError?error.message:'서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'}});}
});
const port=Number(process.env.PORT||3000);const host=process.env.HOST||'127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT는 1~65535 범위여야 합니다.');
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`포트 ${port}가 사용 중입니다. .env에서 PORT를 변경하세요.`:'서버를 시작할 수 없습니다. 실행 환경을 확인해 주세요.');process.exit(1);});
server.listen(port,host,()=>console.log(`대진 시간표 · http://${host==='0.0.0.0'?'localhost':host}:${port}\n${key?'NEIS 인증키 연결됨':'샘플 모드 · .env에 NEIS_API_KEY를 입력하면 실제 시간표를 조회합니다.'}\n종료: Ctrl+C`));
