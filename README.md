# 대진전자통신고등학교 시간표

웹사이트: https://psinserver-jpg.github.io/dj_time/

PC에서는 주간 시간표 표, 모바일에서는 하루 수업 카드로 표시됩니다. 나이스에 등록된 학급 30개의 이전 주·이번 주·다음 주 시간표를 확인할 수 있습니다. 게시된 조회 날짜가 화면 아래에 표시됩니다. 학교 공식 서비스는 아닙니다.

## GitHub Pages 배포

완성된 `index.html`에 실제 시간표 데이터가 들어 있으며 인증키는 포함하지 않습니다. GitHub Pages의 정적 환경에서 API 서버 없이 동작합니다. GitHub Actions는 공개 파일 `index.html`만 배포합니다.

자동 갱신을 사용하려면 저장소 **Settings → Secrets and variables → Actions**에서 `NEIS_API_KEY` Repository Secret을 등록하고 **Settings → Pages → Source → GitHub Actions**를 선택하세요. 그다음 **Actions → Publish Daejin timetable → Run workflow**를 실행하세요. 인증키를 코드, README 또는 공개 파일에 적지 마세요.

키가 설정되면 매일 한국 시간 오전 6시 17분 및 main 변경 시 실제 데이터를 조회해 게시합니다. GitHub 예약 실행은 지연될 수 있습니다. 나이스 조회 실패 시 기존 배포를 유지합니다. 키가 없으면 저장소에 포함된 실제 데이터가 게시되며 갱신되지 않습니다.

## 로컬에서 사용

`index.html`을 브라우저에서 열면 포함된 실제 시간표를 볼 수 있습니다. 소스 화면만 샘플로 빌드하려면 `npm run build`를 실행하세요. 실제 데이터 빌드는 서버 환경변수 `NEIS_API_KEY`를 설정한 뒤 `npm run build:pages`로 실행합니다.

날짜 제한 없이 서버에서 직접 조회하려면 Node.js 20 이상을 설치하고 `.env.example`을 `.env`로 복사하여 인증키를 입력한 뒤 `npm start`를 실행합니다. 외부 패키지 설치는 필요하지 않습니다. `.env`는 Git에 포함하지 않습니다.

검증: `npm test`.

데이터 출처: [나이스 교육정보 개방 포털](https://open.neis.go.kr). 학교 코드 `C10 / 7150597`.
