<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# silver-app-backend 작업 안내 (AI 에이전트용)

어르신용 앱 "실버 도우미"의 백엔드입니다. 사기 문자 판정과 키오스크 화면 안내를 Claude API로 처리하고, 어르신·보호자 계정과 차단 기록 공유를 담당합니다. Next.js(App Router)로 만들고 Vercel에 배포합니다.

- 앱 저장소: [silver-app-android](https://github.com/Jennas-Lee/silver-app-android). 두 저장소를 같은 상위 폴더에 나란히 clone하면 편합니다.
  ```
  silver-app/
  ├── silver-app-backend/
  └── silver-app-android/
  ```
- API 명세: [`docs/api/v1.md`](docs/api/v1.md). 앱과의 약속이므로 코드보다 먼저 확인합니다.
- 사용자와는 **한국어**로 소통합니다. 짧고 쉬운 말로 설명합니다.

## 새 PC에서 처음 세팅

```bash
npm ci
cp .env.example .env.local
npm run dev            # http://localhost:3000/api/health 가 {"status":"ok",...} 이면 준비 완료
```

- Node.js 24 이상 (`package.json`의 `engines`, CI는 `.github/workflows/ci.yml` 기준)
- `.env.local` 값
  - `ANTHROPIC_API_KEY`: 저장소 주인에게 받습니다. 없으면 로컬에서 `ant auth login` 프로필을 써도 됩니다. 문자 판정·키오스크 API만 이 키가 필요합니다.
  - `DEVICE_TOKENS=dev-token-1`: 앱의 `local.properties`의 `device.token`과 같아야 합니다.
  - `DATABASE_URL`: 로컬에서는 **비워 둡니다.** 비어 있으면 내장 Postgres(PGlite)를 `.pglite/` 폴더에 만들고 테이블도 자동으로 만듭니다. 처음부터 다시 하려면 서버를 끄고 `.pglite/`를 지웁니다.
- **비밀 값(API 키, 토큰, DB 주소)은 대화창에 붙여넣거나 출력하지 않습니다.** 필요하면 사용자에게 직접 파일에 넣어 달라고 합니다.

## 작업을 끝내기 전에 반드시 실행

CI와 같은 검사입니다. 모두 통과해야 PR을 올립니다.

```bash
npm run lint
npm run typecheck
npm run build
```

계정 기능을 바꿨다면 계정 흐름 시험(가입 → 연결 → 기록 공유, CI에서도 실행)도 돌립니다.

```bash
npm run dev                                   # 다른 창에서
node scripts/smoke-accounts.mjs http://localhost:3000
```

API 동작은 로컬 서버를 띄워 직접 확인합니다.

```bash
curl -s localhost:3000/api/v1/messages/classify -H "X-Device-Token: dev-token-1" \
  -H "Content-Type: application/json" -d '{"source":"sms","sender":"+821012345678","senderInContacts":false,"body":"[Web발신] 택배 주소 확인 bit.ly/x"}'
node scripts/try-messages.mjs            # 예시 문자 여러 건으로 판정 확인
```

`scripts/eval-*.mjs`는 Claude API를 많이 호출해서 **비용이 듭니다.** 사용자에게 먼저 물어보고 실행합니다.

## 구조

| 위치 | 내용 |
|---|---|
| `src/app/api/v1/<기능>/.../route.ts` | API 라우트. 입력 검사 → `src/lib` 호출 → JSON 응답만 담당 |
| `src/lib/<기능>/schema.ts` | zod 스키마 (요청·응답·모델 출력) |
| `src/lib/<기능>/prompt.ts` | Claude 시스템 프롬프트 |
| `src/lib/<기능>/classify.ts`, `guide.ts` | Claude 호출과 후처리 |
| `src/lib/anthropic.ts` | Claude 클라이언트 (요청당 50초, 재시도 1회) |
| `src/lib/auth.ts` | 문자 판정·키오스크 API 인증 (로그인 토큰 또는 예전 `X-Device-Token`) |
| `src/lib/session.ts` | 로그인 토큰 발급·확인, `requireUser(request, role)` |
| `src/lib/password.ts`, `pii.ts`, `http.ts` | 비밀번호(scrypt), 개인정보 가림, `apiError()`·요청 읽기 |
| `src/db/schema.ts` | DB 테이블 (Drizzle ORM) |
| `src/db/index.ts` | DB 연결 `getDb()`. 운영은 Prisma Postgres, 로컬·CI는 PGlite |
| `drizzle/` | 마이그레이션 SQL (자동 생성, 직접 고치지 않음) |
| `docs/api/v1.md` | API 명세 |
| `scripts/` | 시험·평가 스크립트 |

## 코드 규칙

- **Next.js 16:** 위의 안내대로 `node_modules/next/dist/docs/`를 먼저 읽습니다. 동적 라우트의 `params`는 `await`해야 하고, 타입은 `RouteContext<'/경로/[id]'>`를 씁니다.
- **DB 스키마를 바꾸면** `src/db/schema.ts`를 고친 뒤 `npm run db:generate`로 `drizzle/`에 마이그레이션을 만들고 같이 커밋합니다. 배포할 때 Vercel 빌드가 `scripts/migrate.mjs`로 자동 적용합니다. 이미 배포된 마이그레이션 파일은 고치지 않습니다.
- **계정과 권한:** 로그인한 사용자는 `Authorization: Bearer <토큰>`으로 요청합니다. 서버에는 토큰의 해시만 저장합니다. 보호자 API는 `requireUser(request, "guardian")`로 막고, 어르신 기록을 볼 때는 연결(`links`)이 있는지 꼭 확인합니다.
- **개인정보:** 보호자에게 보이는 문자 내용은 저장할 때 `maskPii()`로 계좌·카드·주민번호 등을 가립니다. 앱의 `PiiMasker`와 같은 규칙을 유지합니다.
- **입력 검사:** 요청 본문은 zod로 검사합니다. 오류 응답은 항상 `apiError(status, code, message)` 형식 `{ "error": { "code", "message" } }`입니다.
- **Claude 호출:** 기존 `classify.ts`, `guide.ts`의 방식을 따릅니다. 모델 ID는 직접 박지 말고 환경변수 기본값(`claude-opus-5-5`)을 씁니다. 구조화된 출력(zod), 시스템 프롬프트 캐시, 낮은 effort를 유지합니다. 모델이나 프롬프트를 바꾸면 평가 스크립트로 전후를 비교합니다.
- **어르신에게 보이거나 들리는 문장** (오류 메시지, 키오스크 음성 안내, 판정 이유 등)
  - 쉬운 해요체, 짧은 문장으로 씁니다.
  - IT 용어와 영어를 쓰지 않습니다. 예: "URL" → "인터넷 주소", "앱을 설치" → "프로그램을 까는 것"
- 주석은 한국어로, 짧게 씁니다.
- **API를 바꾸면** `docs/api/v1.md`를 같이 고칩니다. 앱이 이미 쓰는 필드는 지우거나 의미를 바꾸지 않습니다.
- **새 환경변수**는 `.env.example`에 추가하고, 사용자에게 Vercel에도 등록해 달라고 알립니다.

## 배포

- Vercel의 GitHub 연동이 자동으로 배포합니다. PR은 미리보기, `main`은 프로덕션입니다.
- **GitHub Actions에 배포 단계를 넣지 않습니다.** Actions는 검사(CI)만 합니다.
- 리전은 `vercel.json`의 서울(`icn1`)입니다.
- DB는 Vercel에 연결된 Prisma Postgres입니다. `DATABASE_URL`(직접 연결, 마이그레이션용)과 `DATABASE_URL_POOLED`(연결 풀, 서버용)가 Production·Preview에 자동으로 들어갑니다. **미리보기와 운영이 같은 DB를 씁니다.** 미리보기에서 시험하면 운영 DB에 데이터가 남습니다.

## Git 규칙

- `main`에 직접 push하지 않습니다. `feat/`, `fix/`, `chore/`, `docs/` 접두어로 브랜치를 만듭니다.
- 커밋 메시지: Conventional Commits, 설명은 한국어. 예: `feat(kiosk): 키오스크 안내 API`
- PR은 `.github/pull_request_template.md`를 채우고, **squash merge**합니다. API를 바꿨으면 `api-change` 라벨을 붙입니다.
- PR 여러 개를 이어서 쌓았다면, 아래 PR을 `--delete-branch`로 merge하면 위 PR이 닫힙니다. 위 PR의 base를 먼저 `main`으로 바꿉니다.

## 커밋하면 안 되는 것

- `.env.local` 등 비밀 값, `.pglite/` (로컬 DB)
- `samples/` (키오스크 시험 사진), `eval-results/` (평가 결과)
- 외부 데이터셋. 비영리 라이선스(CC BY-NC-SA 등)라 저장소에 넣지 않습니다.

## Windows에서 작업할 때

- Git Bash에서 `/`로 시작하는 인자나 `브랜치:경로`가 Windows 경로로 바뀔 수 있습니다. 이럴 때는 `MSYS_NO_PATHCONV=1`을 앞에 붙입니다.
- 여러 줄 텍스트(커밋 메시지, PR 본문)는 heredoc보다 파일로 써서 `-F`로 넘기는 편이 안전합니다.
