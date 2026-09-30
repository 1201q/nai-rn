# nai-rn

NovelAI 이미지 생성 API를 사용하는 비공식 모바일 클라이언트입니다 (Expo SDK 57, React Native 0.86).

네이티브 모듈(`modules/`)과 패치(`patches/`)를 사용하므로 Expo Go로는 실행할 수 없습니다. dev client 빌드를 설치한 뒤 Metro에 연결합니다.

## 개발 실행

1. dev client 빌드를 기기나 에뮬레이터에 설치합니다.

   ```bash
   npx eas build --profile development --platform android
   ```

   로컬에서 빌드하려면 `npx expo run:android`를 사용합니다. 네이티브 모듈이나 패치가 바뀌면 다시 빌드해야 합니다.

2. Metro를 실행하고 앱에서 연결합니다.

   ```bash
   npm run start
   ```

   같은 네트워크의 실기기는 `npm run start:lan`, 네트워크가 막혀 있으면 `npm run start:tunnel`을 사용합니다.

## 앱 변형

`APP_VARIANT` 환경 변수로 패키지 ID와 앱 이름을 나눕니다 (`app.config.js`).

| APP_VARIANT | 패키지 ID | EAS 프로필 |
|---|---|---|
| `development` | `com.q1201.nairn.dev` | `development` |
| `preview` | `com.q1201.nairn.preview` | `preview` |
| `production` (기본값) | `com.q1201.nairn` | `apk`, `production` |

`npm run start`, `start:lan`, `start:tunnel`은 `development`로 실행합니다.

## 검사

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

CI(`.github/workflows/ci.yml`)도 같은 순서로 실행합니다.
