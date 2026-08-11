import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
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
  releasePredictiveBack,
  type PredictiveBackEvent,
} from "../../native/predictiveBack";
import { tokens } from "../../styles/tokens";

const MAX_SCALE_DOWN = 0.13;
const MAX_PEEK_X_RATIO = 0.12;
const MAX_PEEK_Y_RATIO = 0.03;
const CORNER_RADIUS = 32;
const MAX_DIM = 0.35;
const ENTER_DURATION = 280;
const EXIT_DURATION = 240;
const EASING = Easing.out(Easing.bezierFn(0.25, 0.46, 0.45, 0.94));
const SPRING = { damping: 28, stiffness: 260, mass: 0.85 };

export function PredictiveBackScreen({ children }: { children: ReactNode }) {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const canGoBack = navigation.canGoBack();
  const canAnimate = PREDICTIVE_BACK_SUPPORTED && canGoBack;

  const peek = useSharedValue(0);
  const exit = useSharedValue(canAnimate ? 1 : 0);
  const pivot = useSharedValue(0);
  const isDismissing = useRef(false);
  const token = useRef({}).current;

  useEffect(() => {
    if (!canAnimate) {
      exit.value = 0;
      return;
    }
    exit.value = withTiming(0, {
      duration: ENTER_DURATION,
      easing: EASING,
    });
  }, [canAnimate, exit]);

  const settle = useCallback(() => {
    isDismissing.current = false;
    peek.value = withSpring(0, SPRING);
    exit.value = withTiming(0, { duration: 180, easing: EASING });
  }, [exit, peek]);

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
      exit.value = withTiming(1, { duration, easing: EASING }, (finished) => {
        "worklet";
        if (finished) {
          runOnJS(goBack)();
        }
      });
    },
    [exit, goBack],
  );

  const cancel = useCallback(() => {
    isDismissing.current = false;
    cancelAnimation(peek);
    peek.value = withSpring(0, SPRING);
  }, [peek]);

  useFocusEffect(
    useCallback(() => {
      if (!PREDICTIVE_BACK_SUPPORTED || !navigation.canGoBack()) {
        return;
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
          track(event);
        },
        onProgress: (event) => {
          if (!isDismissing.current) track(event);
        },
        onCancel: cancel,
        onCommit: () =>
          commit(PREDICTIVE_BACK_HAS_PROGRESS ? EXIT_DURATION : ENTER_DURATION),
      });

      return () => releasePredictiveBack(token);
    }, [cancel, commit, height, navigation, peek, pivot, token]),
  );

  const screenStyle = useAnimatedStyle(() => {
    const progress = peek.value;
    return {
      transform: [
        {
          translateX: progress * width * MAX_PEEK_X_RATIO + exit.value * width,
        },
        { translateY: pivot.value * progress * height * MAX_PEEK_Y_RATIO },
        { scale: 1 - MAX_SCALE_DOWN * progress },
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
    const revealed = Math.max(peek.value, exit.value);
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
