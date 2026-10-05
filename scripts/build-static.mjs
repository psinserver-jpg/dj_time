import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const [template,css,sample,app,favicon]=await Promise.all(['public/index.html','public/style.css','public/sample-data.js','public/app.js','public/favicon.svg'].map(file=>readFile(new URL(file,root),'utf8')));
const icon='data:image/svg+xml,'+encodeURIComponent(favicon);
const safeScript=value=>value.replace(/<\/script/gi,'<\\/script');
const result=template
  .replace('<link rel="stylesheet" href="/style.css">',`<style>\n${css}\n</style>`)
  .replace(/\s*<script defer src="\/(?:sample-data|app)\.js"><\/script>/g,'')
  .replaceAll('/favicon.svg',icon)
  .replaceAll('href="/"','href="./index.html"')
  .replace('</body>',`<script>\n${safeScript(sample)}\n</script>\n<script>\n${safeScript(app)}\n</script>\n</body>`);
await writeFile(new URL('index.html',root),result);
console.log('index.html 생성 완료 · 브라우저에서 직접 열거나 정적 호스팅에 업로드하세요.');
