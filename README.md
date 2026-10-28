# silver-app-backend

어르신을 위한 악성 메시지·보이스피싱 탐지 및 키오스크 음성 안내 앱의 백엔드입니다. Next.js(App Router)로 만들고 Vercel에 배포합니다.

- 앱 저장소: [silver-app-android](https://github.com/Jennas-Lee/silver-app-android)
- API 명세: [`docs/api/v1.md`](docs/api/v1.md)

## 로컬 실행

```bash
npm ci
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000/api/health
```

| 명령 | 설명 |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run build` | 프로덕션 빌드 |
| `node scripts/try-messages.mjs [서버주소]` | 예시 문자로 문자 판정 API 정확도 시험 |
| `node scripts/try-kiosk.mjs <사진> "<목표>" [서버주소]` | 키오스크 안내 API를 사진으로 시험 |

키오스크 시험용 사진은 `samples/`에 넣습니다 (git에 올라가지 않음).

## 배포

배포는 Vercel의 GitHub 연동이 자동으로 합니다. GitHub Actions는 검사만 합니다.

| 담당 | 실행 시점 | 결과 |
|---|---|---|
| Vercel | PR 브랜치 push | 미리보기 배포, Vercel 봇이 PR에 URL 댓글 |
| Vercel | `main` push | 프로덕션 배포 |
| GitHub Actions `ci.yml` | PR, `main` push | lint, 타입 검사, 빌드 |

- 런타임 환경변수(`ANTHROPIC_API_KEY`, `DEVICE_TOKENS`)는 Vercel 프로젝트에 등록합니다.
- 리전은 `vercel.json`에서 서울(`icn1`)로 지정합니다.

## 기여 방법

- 브랜치: `main`에서 `feat/`, `fix/`, `chore/`, `docs/` 접두어로 생성
- 커밋: [Conventional Commits](https://www.conventionalcommits.org/) (`feat(kiosk): ...`)
- PR은 squash merge합니다. API를 바꾸면 `docs/api/`도 함께 수정하고 `api-change` 라벨을 붙입니다.
