import { createContext, useContext } from "react";

// 옵션 상세 헤더 슬롯. 본문(Vibe/Precise 시트)이 헤더 우측 액션 버튼과
// 제목 아래 서브텍스트(카운트)를 헤더로 올려보내기 위한 통로.
export type OptionDetailHeaderAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export type OptionDetailHeaderState = {
  subtitle?: string | null;
  action?: OptionDetailHeaderAction | null;
} | null;

const OptionDetailHeaderContext = createContext<
  (state: OptionDetailHeaderState) => void
>(() => {});

export const OptionDetailHeaderProvider = OptionDetailHeaderContext.Provider;

export function useSetOptionDetailHeader() {
  return useContext(OptionDetailHeaderContext);
}
