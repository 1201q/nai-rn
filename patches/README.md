# patches

`patch-package`로 `postinstall`에서 적용하는 의존성 패치입니다. 패치 파일 이름의 버전과 설치된 버전이 다르면 적용에 실패하므로, 해당 패키지를 올릴 때는 아래 제거 조건을 먼저 확인합니다.

| 패치 | 이유 | 제거 조건 | 도입 커밋 |
|---|---|---|---|
| `@expensify+react-native-live-markdown+0.1.333` | 프롬프트 하이라이트용 range 스타일 확장(범위별 배경색, 전경색, 글꼴). Android 배경을 커서 뒤에 그리고 입력 중 즉시 다시 그림. `editable=false`에서도 길게 눌러 텍스트 선택 허용(Metadata 시트). `atomic` range(Prompt Chunk 칩): Android에서 커서가 안에 놓이지 않고 일부만 지워도 전체 삭제 | 라이브러리가 range별 스타일과 읽기 전용 선택을 지원하면 제거. 하이라이트 방식을 바꾸면 함께 제거 | `8514efa`, `6d5d2a6`, `5c8f666` |
| `@gorhom+bottom-sheet+5.2.14` | 닫힌 상태의 backdrop이 터치를 막지 않도록 pointer events 동기화. 렌더 중 shared value 대입을 `useEffect`로 옮겨 Reanimated strict 경고 제거. 드래그로 이미 목표 위치에 도달해도 인덱스와 콜백을 갱신(Prompt 시트 뒤로가기 앱 종료 수정) | 업스트림에 같은 수정이 들어간 버전으로 올릴 때 항목별로 확인 후 제거. 시트 구조를 재구성할 때 다시 검토 | `4b3516c`, `6bf7445`, `f4e9610` |
| `expo-modules-core+57.0.6` | `SharedObjectRegistry`의 `pairs` 조회를 lock 안에서 수행. 앱 시작 시 간헐적인 SQLite "shared object already released" 오류 수정 | Expo SDK를 올릴 때 업스트림 코드에 같은 동기화가 있으면 제거 | `41bec23` |
| `html-entities+2.5.3` | `lib/index.js`에 `"worklet"` 지시어 추가. 프롬프트 파서를 live-markdown worklet에서 실행하기 위함 | live-markdown 파서에서 `html-entities`를 쓰지 않게 되면 제거 | `8514efa` |
| `react-native-notify-kit+10.4.4` | `compileSdk` 36, `androidx.core` 1.18.0으로 올림. Android 16(API 36) 이상에서 생성 진행 알림을 세그먼트 `ProgressStyle`과 promoted ongoing(Now Bar)으로 표시(`nairn.liveUpdate*` data 키 사용) | 라이브러리가 `ProgressStyle`/live update를 지원하면 JS 쪽 옵션으로 옮기고 제거 | `154160d` |
| `sonner-native+0.26.4` | 토스트 래퍼 `Animated.View`에 `pointerEvents="box-none"` 추가. 토스트 바깥 영역의 터치를 막지 않도록 함 | 업스트림에 같은 수정이 들어간 버전으로 올리면 제거 | `25afee9` |

## 패치 갱신

`node_modules`의 파일을 고친 뒤 다음 명령으로 다시 생성합니다.

```bash
npx patch-package <package-name>
```

네이티브 코드(Android/Kotlin/Java)를 고치는 패치는 적용 후 dev client를 다시 빌드해야 합니다.
