import { useEffect, useRef } from "react";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type BackClaimNativeModule = {
  setClaimed(claimed: boolean): void;
  addListener(
    event: "onBackPress",
    listener: () => void,
  ): { remove(): void };
};

const nativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<BackClaimNativeModule>("BackClaim")
    : null;

// 나중에 등록된 claim이 먼저 back을 가져간다(RN BackHandler와 같은 순서).
const claims: (() => void)[] = [];

function sync() {
  nativeModule?.setClaimed(claims.length > 0);
}

if (nativeModule) {
  nativeModule.addListener("onBackPress", () => {
    claims[claims.length - 1]?.();
  });
}

/**
 * `enabled`인 동안 하드웨어 백을 네이티브 화면 pop보다 먼저 가져와 `onBack`을 실행한다.
 * 열려 있는 JS 오버레이(바텀시트, 이미지 미리보기, 선택 모드)를 back으로 닫을 때 쓴다.
 */
export function useBackClaim(enabled: boolean, onBack: () => void) {
  // onBack이 매 렌더 새로 만들어져도 claim 순서가 흔들리지 않게 ref로 넘긴다.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    const claim = () => onBackRef.current();
    claims.push(claim);
    sync();

    return () => {
      const index = claims.indexOf(claim);
      if (index !== -1) claims.splice(index, 1);
      sync();
    };
  }, [enabled]);
}
