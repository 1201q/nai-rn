import { createMMKV } from "react-native-mmkv";

// 동기 읽기 가능한 KV 스토어. 부팅 시 Zustand 초기 state를 즉시 복원해
// AsyncStorage 비동기 하이드레이션으로 인한 기본값 flickering을 제거한다.
export const storage = createMMKV();
