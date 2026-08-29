import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  AppState,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  PREDICTIVE_BACK_HAS_PROGRESS,
  PREDICTIVE_BACK_SUPPORTED,
  acquirePredictiveBack,
  observePredictiveBack,
  releasePredictiveBack,
  type PredictiveBackEvent,
} from "../../native/predictiveBack";
import { tokens } from "../../styles/tokens";

const MAX_SCALE_DOWN = 0.13;
const MAX_PEEK_X_RATIO = 0.12;
const MAX_PEEK_Y_RATIO = 0.03;
const UNDERLAY_SHIFT_X_RATIO = 0.08;
const UNDERLAY_SCALE_DOWN = 0.04;
const CORNER_RADIUS = 32;
const MAX_DIM = 0.35;
const ENTER_DURATION = 140;
const EXIT_DURATION = 110;
const EASING = Easing.out(Easing.bezierFn(0.25, 0.46, 0.45, 0.94));
const SPRING = { damping: 30, stiffness: 320, mass: 0.75 };
const PHASE_IDLE = 0;
const PHASE_TRACKING = 1;
const PHASE_CANCELLING = 2;
const PHASE_COMMITTING = 3;

export function PredictiveBackScreen({ children }: { children: ReactNode }) {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();

  const peek = useSharedValue(0);
  const exit = useSharedValue(0);
  const pivot = useSharedValue(0);
  const underlay = useSharedValue(0);
  const phase = useSharedValue(PHASE_IDLE);
  const isFocused = useRef(navigation.isFocused());
  const isDismissing = useRef(false);
  const token = useRef({}).current;

  const resetInteractiveState = useCallback(() => {
    isDismissing.current = false;
    cancelAnimation(peek);
    cancelAnimation(exit);
    peek.value = 0;
    exit.value = 0;
    pivot.value = 0;
    phase.value = PHASE_IDLE;
  }, [exit, peek, phase, pivot]);

  const settle = useCallback(() => {
    isDismissing.current = false;
    cancelAnimation(peek);
    cancelAnimation(exit);
    phase.value = PHASE_CANCELLING;
    exit.value = withTiming(0, { duration: EXIT_DURATION, easing: EASING });
    peek.value = withSpring(0, SPRING, (finished) => {
      "worklet";
      if (finished) {
        pivot.value = 0;
        phase.value = PHASE_IDLE;
      }
    });
  }, [exit, peek, phase, pivot]);

  const goBack = useCallback(() => {
    if (!navigation.canGoBack()) {
      settle();
      return;
    }

    navigation.goBack();
    requestAnimationFrame(() => {
      if (navigation.isFocused()) {
        settle();
      }
    });
  }, [navigation, settle]);

  const commit = useCallback(
    (duration = EXIT_DURATION) => {
      if (isDismissing.current) return;

      isDismissing.current = true;
      cancelAnimation(exit);
      phase.value = PHASE_COMMITTING;
      exit.value = withTiming(1, { duration, easing: EASING }, (finished) => {
        "worklet";
        if (finished) {
          runOnJS(goBack)();
        }
      });
    },
    [exit, goBack, phase],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", () => {
      if (!navigation.isFocused() && !isFocused.current) return;
      resetInteractiveState();
      cancelAnimation(underlay);
      underlay.value = 0;
    });

    return () => subscription.remove();
  }, [navigation, resetInteractiveState, underlay]);

  useEffect(
    () =>
      observePredictiveBack({
        onStart: (event) => {
          if (!isFocused.current) {
            cancelAnimation(underlay);
            underlay.value = 1 - event.progress;
          }
        },
        onProgress: (event) => {
          if (!isFocused.current) {
            underlay.value = 1 - event.progress;
          }
        },
        onCancel: () => {
          if (!isFocused.current) {
            underlay.value = withSpring(1, SPRING);
          }
        },
        onCommit: () => {
          if (!isFocused.current) {
            underlay.value = withTiming(0, {
              duration: PREDICTIVE_BACK_HAS_PROGRESS
                ? EXIT_DURATION
                : ENTER_DURATION,
              easing: EASING,
            });
          }
        },
      }),
    [underlay],
  );

  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;
      resetInteractiveState();
      underlay.value = withTiming(0, {
        duration: ENTER_DURATION,
        easing: EASING,
      });

      if (!PREDICTIVE_BACK_SUPPORTED || !navigation.canGoBack()) {
        return () => {
          isFocused.current = false;
          underlay.value = withTiming(1, {
            duration: ENTER_DURATION,
            easing: EASING,
          });
        };
      }

      const track = (event: PredictiveBackEvent) => {
        peek.value = event.progress;
        pivot.value = Math.max(
          -1,
          Math.min(1, (event.touchY / height) * 2 - 1),
        );
      };

      acquirePredictiveBack(token, {
        onStart: (event) => {
          if (isDismissing.current) return;
          cancelAnimation(peek);
          cancelAnimation(exit);
          exit.value = 0;
          phase.value = PHASE_TRACKING;
          track(event);
        },
        onProgress: (event) => {
          if (!isDismissing.current && phase.value === PHASE_TRACKING) {
            track(event);
          }
        },
        onCancel: settle,
        onCommit: () =>
          commit(PREDICTIVE_BACK_HAS_PROGRESS ? EXIT_DURATION : ENTER_DURATION),
      });

      return () => {
        isFocused.current = false;
        resetInteractiveState();
        underlay.value = withTiming(1, {
          duration: ENTER_DURATION,
          easing: EASING,
        });
        releasePredictiveBack(token);
      };
    }, [
      commit,
      exit,
      height,
      navigation,
      peek,
      phase,
      pivot,
      resetInteractiveState,
      settle,
      token,
      underlay,
    ]),
  );

  const screenStyle = useAnimatedStyle(() => {
    // Idle screens stay at identity even if an earlier native event was lost.
    const interactionActive = phase.value !== PHASE_IDLE;
    const progress = interactionActive ? peek.value : 0;
    const exitProgress =
      phase.value === PHASE_COMMITTING ? exit.value : 0;
    const underlayProgress = underlay.value;
    return {
      transform: [
        {
          translateX:
            progress * width * MAX_PEEK_X_RATIO +
            exitProgress * width -
            underlayProgress * width * UNDERLAY_SHIFT_X_RATIO,
        },
        { translateY: pivot.value * progress * height * MAX_PEEK_Y_RATIO },
        {
          scale:
            (1 - MAX_SCALE_DOWN * progress) *
            (1 - UNDERLAY_SCALE_DOWN * underlayProgress),
        },
      ],
      borderRadius: interpolate(
        progress,
        [0, 0.05, 1],
        [0, CORNER_RADIUS, CORNER_RADIUS],
        Extrapolation.CLAMP,
      ),
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    const progress = phase.value === PHASE_IDLE ? 0 : peek.value;
    const exitProgress =
      phase.value === PHASE_COMMITTING ? exit.value : 0;
    const revealed = Math.max(progress, exitProgress);
    return {
      opacity: interpolate(revealed, [0, 1], [MAX_DIM, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, backdropStyle]}
      />
      <Animated.View style={[styles.screen, screenStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#000000",
  },
  screen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: tokens.color.app,
  },
});
