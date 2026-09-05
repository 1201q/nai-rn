import { memo, useEffect, type EffectCallback } from "react";
import {
  createBottomSheetScrollableComponent,
  SCROLLABLE_TYPE,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import type { BottomSheetScrollViewProps } from "@gorhom/bottom-sheet/src/components/bottomSheetScrollable/types";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import Reanimated from "react-native-reanimated";

const AnimatedKeyboardAwareScrollView = Reanimated.createAnimatedComponent(
  KeyboardAwareScrollView,
);

const BottomSheetKeyboardAwareScrollViewComponent =
  createBottomSheetScrollableComponent<
    BottomSheetScrollViewMethods,
    BottomSheetScrollViewProps & KeyboardAwareScrollViewProps
  >(SCROLLABLE_TYPE.SCROLLVIEW, AnimatedKeyboardAwareScrollView);

export const BottomSheetKeyboardAwareScrollView = memo(
  function BottomSheetKeyboardAwareScrollView({
    active = true,
    ...props
  }: BottomSheetScrollViewProps & KeyboardAwareScrollViewProps & { active?: boolean }) {
    function useActiveFocusEffect(effect: EffectCallback) {
      useEffect(() => {
        if (active) return effect();
      }, [active, effect]);
    }

    return (
      <BottomSheetKeyboardAwareScrollViewComponent
        {...props}
        focusHook={useActiveFocusEffect}
      />
    );
  },
);

BottomSheetKeyboardAwareScrollView.displayName =
  "BottomSheetKeyboardAwareScrollView";
