// 예측 뒤로가기 중 레이어를 줄이는 정도와 취소 시 복귀 spring.
export const PREDICTIVE_BACK_SCALE_STOP = 0.6;
export const PREDICTIVE_BACK_MIN_SCALE = 0.94;
export const PREDICTIVE_BACK_CANCEL_SPRING = {
  damping: 30,
  stiffness: 320,
  mass: 0.75,
};
