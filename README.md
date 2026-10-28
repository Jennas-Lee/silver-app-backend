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

## 배포

Vercel의 Git 자동 배포는 끄고(`vercel.json`), GitHub Actions에서 배포합니다.

| 워크플로 | 실행 시점 | 결과 |
|---|---|---|
| `ci.yml` | PR, `main` push | lint, 타입 검사, 빌드 |
| `deploy-preview.yml` | PR | 미리보기 배포 후 PR에 URL 댓글 |
| `deploy-production.yml` | `main` push | 프로덕션 배포 후 health 확인 |

- GitHub Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- 런타임 환경변수(`ANTHROPIC_API_KEY`, `DEVICE_TOKENS`)는 Vercel 프로젝트에 등록합니다.

## 기여 방법

- 브랜치: `main`에서 `feat/`, `fix/`, `chore/`, `docs/` 접두어로 생성
- 커밋: [Conventional Commits](https://www.conventionalcommits.org/) (`feat(kiosk): ...`)
- PR은 squash merge합니다. API를 바꾸면 `docs/api/`도 함께 수정하고 `api-change` 라벨을 붙입니다.
