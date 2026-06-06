import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
  TouchableOpacity as BottomSheetTouchableOpacity,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { KeyboardStickyView } from "react-native-keyboard-controller";
import Reanimated, {
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useNavigation } from "@react-navigation/native";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { AssistantScreenNavigationProp } from "../navigation/types";
import { ImagePreviewModal } from "./main/ImagePreviewModal";
import { light, SLIDER_THUMB, styles } from "./assistant/styles";
import {
  MODELS,
  NAI_RESOLUTIONS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NaiResolution,
  type NoiseSchedule,
} from "../constants/generation";
import { formatDecimal } from "./option/helpers";

const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

function hapticTick() {
  Haptics.selectionAsync().catch(() => {});
}

const PROMPT_MIN_HEIGHT = 44;
const PROMPT_MAX_HEIGHT = 140;
const IMAGE_MIN_SCALE = 0.78;

const STEPS_CONFIG = {
  title: "Steps",
  unit: "steps",
  min: 1,
  max: 50,
  step: 1,
  precision: 0,
} as const;
const CFG_CONFIG = {
  title: "CFG Scale",
  unit: "guidance",
  min: 0,
  max: 10,
  step: 0.1,
  precision: 1,
} as const;
const CFG_RESCALE_CONFIG = {
  title: "CFG Rescale",
  unit: "rescale",
  min: 0,
  max: 1,
  step: 0.02,
  precision: 2,
} as const;

const OPTIONS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "model", label: "Model", icon: "layers-outline" },
  { key: "resolution", label: "Resolution", icon: "scan-outline" },
  { key: "seed", label: "Seed", icon: "dice-outline" },
  { key: "steps", label: "Steps", icon: "footsteps-outline" },
  { key: "cfg", label: "CFG Scale", icon: "pulse-outline" },
  { key: "cfgRescale", label: "CFG Rescale", icon: "git-compare-outline" },
  { key: "sampler", label: "Sampler", icon: "shuffle-outline" },
  { key: "schedule", label: "Schedule", icon: "git-branch-outline" },
];

function ScalePressable({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: object | object[];
  onPress?: () => void;
}) {
  const anim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(anim, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
      <Animated.View style={[style, { transform: [{ scale: anim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function VarietyChip({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
    onPress();
  };

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.93],
  });

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          styles.optionChip,
          active ? styles.optionChipActive : null,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name="sparkles-outline"
          size={16}
          color={active ? "#ffffff" : light.textSecondary}
        />
        <Text
          style={[styles.optionChipText, active && styles.optionChipTextActive]}
        >
          Variety+
        </Text>
      </Animated.View>
    </Pressable>
  );
}

type ChipValue = { text: string; unit?: string; unitBefore?: boolean };

function OptionChip({
  opt,
  value,
  onPress,
}: {
  opt: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };
  value: ChipValue;
  onPress?: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 60,
      bounciness: 0,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: false,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.93],
  });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [light.surface, light.surfaceAlt],
  });

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
      <Animated.View
        style={[styles.optionChip, { transform: [{ scale }], backgroundColor }]}
      >
        <Ionicons name={opt.icon} size={16} color={light.textSecondary} />
        {value.unitBefore && value.unit ? (
          <Text style={styles.optionChipUnit}>{value.unit}</Text>
        ) : null}
        <Text style={styles.optionChipText}>{value.text}</Text>
        {!value.unitBefore && value.unit ? (
          <Text style={styles.optionChipUnit}>{value.unit}</Text>
        ) : null}
        <Ionicons name="chevron-down" size={14} color={light.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}

function PromptModePill({
  mode,
  onChange,
}: {
  mode: "base" | "negative";
  onChange: (m: "base" | "negative") => void;
}) {
  const leftAnim = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;
  const layouts = useRef<{ x: number; width: number }[]>([]);
  const initialized = useRef(false);

  const animateTo = (index: number) => {
    const layout = layouts.current[index];
    if (!layout) return;
    Animated.spring(leftAnim, {
      toValue: layout.x,
      useNativeDriver: false,
      speed: 25,
      bounciness: 5,
    }).start();
    Animated.spring(widthAnim, {
      toValue: layout.width,
      useNativeDriver: false,
      speed: 25,
      bounciness: 5,
    }).start();
  };

  const handleLayout = (index: number, x: number, width: number) => {
    layouts.current[index] = { x, width };
    if (!initialized.current && layouts.current[0] && layouts.current[1]) {
      initialized.current = true;
      const initial = layouts.current[mode === "base" ? 0 : 1];
      leftAnim.setValue(initial.x);
      widthAnim.setValue(initial.width);
    }
  };

  const handlePress = (next: "base" | "negative") => {
    animateTo(next === "base" ? 0 : 1);
    onChange(next);
  };

  return (
    <View style={styles.promptModePill}>
      <Animated.View
        style={[styles.promptModeThumb, { left: leftAnim, width: widthAnim }]}
      />
      <Pressable
        onLayout={(e) =>
          handleLayout(0, e.nativeEvent.layout.x, e.nativeEvent.layout.width)
        }
        onPress={() => handlePress("base")}
        style={styles.promptModeSegment}
      >
        <Text
          style={[
            styles.promptModeText,
            mode === "base" && styles.promptModeTextActive,
          ]}
        >
          Base
        </Text>
      </Pressable>
      <Pressable
        onLayout={(e) =>
          handleLayout(1, e.nativeEvent.layout.x, e.nativeEvent.layout.width)
        }
        onPress={() => handlePress("negative")}
        style={styles.promptModeSegment}
      >
        <Text
          style={[
            styles.promptModeText,
            mode === "negative" && styles.promptModeTextActive,
          ]}
        >
          Negative
        </Text>
      </Pressable>
    </View>
  );
}

function SheetItem({
  item,
  isActive,
  onPress,
  recommendedValue,
}: {
  item: { value: string; label: string };
  isActive: boolean;
  onPress: () => void;
  recommendedValue?: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  const onPressIn = () =>
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 60,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: false,
      speed: 30,
      bounciness: 0,
    }).start();

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(244,244,243,0)", light.surface],
  });

  return (
    <BottomSheetTouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.sheetModelItem,
          { transform: [{ scale }], backgroundColor },
        ]}
      >
        <View style={styles.sheetModelItemLabelRow}>
          <Text
            style={[
              styles.sheetModelItemLabel,
              isActive && styles.sheetModelItemLabelActive,
            ]}
          >
            {item.label}
          </Text>
          {item.value === recommendedValue && (
            <View style={styles.sheetModelItemBadge}>
              <Text style={styles.sheetModelItemBadgeText}>권장</Text>
            </View>
          )}
        </View>
        {isActive && (
          <Ionicons name="checkmark" size={20} color={light.accent} />
        )}
      </Animated.View>
    </BottomSheetTouchableOpacity>
  );
}

type NumericConfig = {
  title: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  precision: number;
};

function snapValue(v: number, cfg: NumericConfig) {
  "worklet";
  const idx = Math.round((v - cfg.min) / cfg.step);
  const stepped = cfg.min + idx * cfg.step;
  return Number(
    Math.min(cfg.max, Math.max(cfg.min, stepped)).toFixed(cfg.precision),
  );
}

function formatNumeric(v: number, precision: number) {
  if (precision <= 0) return String(v);
  return v.toFixed(precision);
}

function NumericSlider({
  display,
  onCommit,
  cfg,
}: {
  display: SharedValue<number>;
  onCommit: (v: number) => void;
  cfg: NumericConfig;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const range = cfg.max - cfg.min;
  const dragStart = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      dragStart.value = (display.value - cfg.min) / range;
    })
    .onUpdate((event) => {
      if (trackWidth <= SLIDER_THUMB) return;
      const usableWidth = trackWidth - SLIDER_THUMB;
      const nextProgress = Math.min(
        1,
        Math.max(0, dragStart.value + event.translationX / usableWidth),
      );
      const nextValue = snapValue(cfg.min + nextProgress * range, cfg);
      if (nextValue !== display.value) {
        display.value = nextValue;
        runOnJS(hapticTick)();
      }
    })
    .onEnd(() => {
      runOnJS(onCommit)(display.value);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width:
      ((display.value - cfg.min) / range) *
        Math.max(0, trackWidth - SLIDER_THUMB) +
      SLIDER_THUMB / 2,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          ((display.value - cfg.min) / range) *
          Math.max(0, trackWidth - SLIDER_THUMB),
      },
    ],
  }));

  return (
    <View
      style={styles.stepsSliderTrack}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.stepsSliderBase} />
      <Reanimated.View style={[styles.stepsSliderFill, fillStyle]} />
      {trackWidth > 0 ? (
        <GestureDetector gesture={panGesture}>
          <Reanimated.View style={[styles.stepsSliderThumb, thumbStyle]} />
        </GestureDetector>
      ) : null}
    </View>
  );
}

function NumericSheetContent({
  value,
  onChange,
  cfg,
}: {
  value: number;
  onChange: (v: number) => void;
  cfg: NumericConfig;
}) {
  const [inputText, setInputText] = useState(
    formatNumeric(value, cfg.precision),
  );
  const [editing, setEditing] = useState(false);

  // 드래그 중 표시값은 UI 스레드에서 직접 구동(재렌더 없음).
  // 외부 변경(+/- · 수동입력 · 초기값)은 여기서 동기화.
  const display = useSharedValue(value);
  useEffect(() => {
    display.value = value;
    setInputText(formatNumeric(value, cfg.precision));
  }, [value, cfg.precision, display]);

  const animatedProps = useAnimatedProps(() => {
    const v = display.value;
    const text = cfg.precision <= 0 ? String(v) : v.toFixed(cfg.precision);
    return { text, defaultValue: text } as object;
  });

  const step = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(snapValue(value + delta, cfg));
  };

  const commitInput = () => {
    setEditing(false);
    const parsed = Number(inputText);
    if (!Number.isFinite(parsed)) {
      setInputText(formatNumeric(value, cfg.precision));
      return;
    }
    const next = snapValue(parsed, cfg);
    onChange(next);
    setInputText(formatNumeric(next, cfg.precision));
  };

  const filter = cfg.precision > 0 ? /[^0-9.]/g : /[^0-9]/g;

  return (
    <>
      <Text style={styles.sheetTitle}>{cfg.title}</Text>

      <View style={styles.stepsValueRow}>
        <ScalePressable
          style={[
            styles.stepsButton,
            value <= cfg.min && styles.stepsButtonDisabled,
          ]}
          onPress={() => step(-cfg.step)}
        >
          <Ionicons name="remove" size={24} color={light.textPrimary} />
        </ScalePressable>

        <View style={styles.stepsValueCenter}>
          {editing ? (
            <BottomSheetTextInput
              style={styles.stepsValueInput}
              value={inputText}
              onChangeText={(t) => setInputText(t.replace(filter, ""))}
              onBlur={commitInput}
              onSubmitEditing={commitInput}
              keyboardType={cfg.precision > 0 ? "decimal-pad" : "number-pad"}
              maxLength={6}
              autoFocus
            />
          ) : (
            <Pressable onPress={() => setEditing(true)}>
              <AnimatedTextInput
                style={[styles.stepsValueInput, { padding: 0 }]}
                editable={false}
                pointerEvents="none"
                animatedProps={animatedProps}
              />
            </Pressable>
          )}
          <Text style={styles.stepsValueUnit}>{cfg.unit}</Text>
        </View>

        <ScalePressable
          style={[
            styles.stepsButton,
            value >= cfg.max && styles.stepsButtonDisabled,
          ]}
          onPress={() => step(cfg.step)}
        >
          <Ionicons name="add" size={24} color={light.textPrimary} />
        </ScalePressable>
      </View>

      <NumericSlider display={display} onCommit={onChange} cfg={cfg} />
      <View style={styles.stepsRangeRow}>
        <Text style={styles.stepsRangeLabel}>
          {formatNumeric(cfg.min, cfg.precision)}
        </Text>
        <Text style={styles.stepsRangeLabel}>
          {formatNumeric(cfg.max, cfg.precision)}
        </Text>
      </View>
    </>
  );
}

function SeedSheetContent({
  seed,
  locked,
  onChangeSeed,
  onToggleLock,
}: {
  seed: number;
  locked: boolean;
  onChangeSeed: (v: number) => void;
  onToggleLock: () => void;
}) {
  return (
    <>
      <Text style={styles.sheetTitle}>Seed</Text>
      <View style={styles.seedSheetRow}>
        <BottomSheetTextInput
          style={[styles.seedSheetInput, locked && styles.seedSheetInputLocked]}
          value={seed === 0 ? "" : String(seed)}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "");
            onChangeSeed(digits ? Number(digits) : 0);
          }}
          editable={!locked}
          keyboardType="number-pad"
          placeholder="Random"
          placeholderTextColor={light.textHint}
        />
        <BottomSheetTouchableOpacity
          style={[
            styles.seedSheetButton,
            locked && styles.seedSheetButtonActive,
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onToggleLock();
          }}
        >
          <Ionicons
            name={locked ? "lock-closed" : "lock-open-outline"}
            size={20}
            color={locked ? light.accent : light.textSecondary}
          />
        </BottomSheetTouchableOpacity>
        <BottomSheetTouchableOpacity
          style={styles.seedSheetButton}
          disabled={locked}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onChangeSeed(Math.floor(Math.random() * 4_294_967_295));
          }}
        >
          <Ionicons
            name="dice-outline"
            size={20}
            color={locked ? light.textHint : light.textSecondary}
          />
        </BottomSheetTouchableOpacity>
      </View>
      <Text style={styles.seedSheetHint}>
        비우면 매 생성마다 랜덤. 잠그면 시드 고정.
      </Text>
    </>
  );
}

function ResolutionSheetContent({
  resolution,
  onChange,
  onClose,
}: {
  resolution: NaiResolution;
  onChange: (v: NaiResolution) => void;
  onClose: () => void;
}) {
  const setDimension = (key: "width" | "height", text: string) => {
    const digits = text.replace(/\D/g, "");
    onChange({
      label: "Custom",
      width: key === "width" ? Number(digits || 0) : resolution.width,
      height: key === "height" ? Number(digits || 0) : resolution.height,
    });
  };

  // 입력 확정 시 64 배수로 스냅 (최소 64)
  const snapDimension = (key: "width" | "height") => {
    const v = resolution[key];
    const snapped = v ? Math.max(64, Math.round(v / 64) * 64) : 0;
    if (snapped !== v) {
      onChange({ ...resolution, label: "Custom", [key]: snapped });
    }
  };

  const swap = () => {
    onChange({
      label: "Custom",
      width: resolution.height,
      height: resolution.width,
    });
  };

  const visibleGroups = NAI_RESOLUTIONS.filter((g) => g.group === "Normal");
  const isCustom = !visibleGroups.some((g) =>
    g.options.some(
      (o) => o.width === resolution.width && o.height === resolution.height,
    ),
  );

  return (
    <>
      <Text style={styles.sheetTitle}>Resolution</Text>

      <View style={styles.resolutionInputRow}>
        <View style={styles.resolutionInputBox}>
          <Text style={styles.resolutionInputLabel}>W</Text>
          <BottomSheetTextInput
            style={styles.resolutionInput}
            value={resolution.width ? String(resolution.width) : ""}
            onChangeText={(t) => setDimension("width", t)}
            onEndEditing={() => snapDimension("width")}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={light.textHint}
          />
        </View>
        <BottomSheetTouchableOpacity
          style={styles.resolutionSwapButton}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            swap();
          }}
        >
          <Ionicons
            name="swap-horizontal"
            size={20}
            color={light.textSecondary}
          />
        </BottomSheetTouchableOpacity>
        <View style={styles.resolutionInputBox}>
          <Text style={styles.resolutionInputLabel}>H</Text>
          <BottomSheetTextInput
            style={styles.resolutionInput}
            value={resolution.height ? String(resolution.height) : ""}
            onChangeText={(t) => setDimension("height", t)}
            onEndEditing={() => snapDimension("height")}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={light.textHint}
          />
        </View>
      </View>

      {visibleGroups.map((group) => (
        <View key={group.group}>
          <Text style={styles.resolutionGroupLabel}>{group.group}</Text>
          {group.options.map((opt) => (
            <SheetItem
              key={opt.label}
              item={{ value: opt.label, label: opt.label }}
              isActive={
                opt.width === resolution.width &&
                opt.height === resolution.height
              }
              onPress={() => {
                onChange({
                  label: opt.label,
                  width: opt.width,
                  height: opt.height,
                });
                onClose();
              }}
            />
          ))}
        </View>
      ))}

      <View>
        <Text style={styles.resolutionGroupLabel}>Custom</Text>
        <SheetItem
          item={{ value: "custom", label: "Custom" }}
          isActive={isCustom}
          onPress={onClose}
        />
      </View>
    </>
  );
}

// 프롬프트 입력은 고빈도 편집. 텍스트를 로컬 state로 보유해 키 입력당 전체
// 화면 재렌더를 막고, context 동기화는 blur/전송/언마운트 시에만. 전송 시엔
// 최신 로컬값을 직접 전달해 stale 방지.
function PromptCard({ inputHeight }: { inputHeight: SharedValue<number> }) {
  const navigation = useNavigation<AssistantScreenNavigationProp>();
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    isLoading,
    generateImage,
  } = useGenerationOptions();

  const [mode, setMode] = useState<"base" | "negative">("base");
  const [baseText, setBaseText] = useState(prompt);
  const [negText, setNegText] = useState(negativePrompt);
  const focusedRef = useRef(false);
  // 언마운트(네비게이션 등 blur 미발생) 대비 최신값 보존
  const latestRef = useRef({ base: prompt, neg: negativePrompt });

  const heights = useRef<Record<"base" | "negative", number>>({
    base: PROMPT_MIN_HEIGHT,
    negative: PROMPT_MIN_HEIGHT,
  });

  // 외부(저장소 로드 등) 변경은 포커스 아닐 때만 로컬에 반영 (타이핑 중엔 로컬 우선)
  useEffect(() => {
    if (!focusedRef.current) {
      setBaseText(prompt);
      latestRef.current.base = prompt;
    }
  }, [prompt]);
  useEffect(() => {
    if (!focusedRef.current) {
      setNegText(negativePrompt);
      latestRef.current.neg = negativePrompt;
    }
  }, [negativePrompt]);

  const onChangeText = (t: string) => {
    if (mode === "base") {
      setBaseText(t);
      latestRef.current.base = t;
    } else {
      setNegText(t);
      latestRef.current.neg = t;
    }
  };

  const flushBoth = () => {
    setPrompt(latestRef.current.base);
    setNegativePrompt(latestRef.current.neg);
  };

  // 언마운트 시 마지막 동기화 (blur 가 안 올 수 있음)
  useEffect(
    () => () => {
      setPrompt(latestRef.current.base);
      setNegativePrompt(latestRef.current.neg);
    },
    [setPrompt, setNegativePrompt],
  );

  const handleContentSizeChange = (e: {
    nativeEvent: { contentSize: { height: number } };
  }) => {
    const next = Math.min(
      PROMPT_MAX_HEIGHT,
      Math.max(PROMPT_MIN_HEIGHT, e.nativeEvent.contentSize.height),
    );
    heights.current[mode] = next;
    inputHeight.value = withTiming(next, { duration: 150 });
  };

  // 모드 전환은 콘텐츠 변화가 없어 onContentSizeChange 안 옴 → 기억한 높이로 즉시 반영
  useEffect(() => {
    inputHeight.value = withTiming(heights.current[mode], { duration: 150 });
  }, [mode, inputHeight]);

  const inputAnimStyle = useAnimatedStyle(() => ({
    height: inputHeight.value,
  }));

  const handleSubmit = () => {
    if (isLoading) return;
    flushBoth();
    generateImage(undefined, {
      prompt: latestRef.current.base,
      negativePrompt: latestRef.current.neg,
    });
  };

  return (
    <View style={styles.promptCard}>
      <Reanimated.View style={[styles.promptInputWrap, inputAnimStyle]}>
        <TextInput
          style={styles.promptInput}
          value={mode === "base" ? baseText : negText}
          onChangeText={onChangeText}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            flushBoth();
          }}
          onContentSizeChange={handleContentSizeChange}
          placeholder="Ready to help, ask anything…"
          placeholderTextColor={light.textHint}
          multiline
        />
        <View style={styles.expandButton}>
          <Ionicons name="scan-outline" size={16} color={light.textSecondary} />
        </View>
      </Reanimated.View>

      <View style={styles.promptActionRow}>
        <View style={styles.promptActionLeft}>
          <PromptModePill mode={mode} onChange={setMode} />
          <ScalePressable
            style={styles.characterButton}
            onPress={() => navigation.navigate("AssistantCharacter")}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={light.textSecondary}
            />
            <Text style={styles.characterButtonText}>Character</Text>
          </ScalePressable>
        </View>
        <ScalePressable style={styles.submitButton} onPress={handleSubmit}>
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Ionicons name="arrow-up" size={22} color="#ffffff" />
          )}
        </ScalePressable>
      </View>
    </View>
  );
}

export function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AssistantScreenNavigationProp>();
  const {
    currentGeneration,
    currentImageUri,
    model,
    setModel,
    resolution,
    setResolution,
    steps,
    setSteps,
    promptGuidance,
    setPromptGuidance,
    promptGuidanceRescale,
    setPromptGuidanceRescale,
    noiseSchedule,
    setNoiseSchedule,
    sampler,
    setSampler,
    seed,
    setSeed,
    seedLocked,
    setSeedLocked,
    varietyPlus,
    setVarietyPlus,
  } = useGenerationOptions();

  const previewAnimation = useRef(new Animated.Value(0)).current;
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);

  function openImagePreview() {
    if (!currentImageUri) return;
    setIsImagePreviewOpen(true);
    previewAnimation.setValue(0);
    Animated.timing(previewAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function closeImagePreview() {
    Animated.timing(previewAnimation, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsImagePreviewOpen(false);
    });
  }

  async function handleSaveImage() {
    if (!currentImageUri || isSavingImage) return;

    try {
      setIsSavingImage(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "photo",
      ]);

      if (!permission.granted) {
        Alert.alert("저장 실패", "사진 저장 권한이 필요합니다.");
        return;
      }

      await MediaLibrary.saveToLibraryAsync(currentImageUri);
      Alert.alert("저장됨", "이미지를 휴대폰 저장소에 저장했습니다.");
    } catch {
      Alert.alert("저장 실패", "이미지를 휴대폰 저장소에 저장하지 못했습니다.");
    } finally {
      setIsSavingImage(false);
    }
  }

  async function handleCopyImage() {
    if (!currentImageUri || isCopyingImage) return;

    try {
      setIsCopyingImage(true);
      const base64Image = await new File(currentImageUri).base64();
      await Clipboard.setImageAsync(base64Image);
      Alert.alert("복사됨", "이미지를 클립보드에 복사했습니다.");
    } catch {
      Alert.alert("복사 실패", "이미지를 클립보드에 복사하지 못했습니다.");
    } finally {
      setIsCopyingImage(false);
    }
  }

  const modelSheetRef = useRef<BottomSheet>(null);
  const samplerSheetRef = useRef<BottomSheet>(null);
  const scheduleSheetRef = useRef<BottomSheet>(null);
  const stepsSheetRef = useRef<BottomSheet>(null);
  const cfgSheetRef = useRef<BottomSheet>(null);
  const cfgRescaleSheetRef = useRef<BottomSheet>(null);
  const seedSheetRef = useRef<BottomSheet>(null);
  const resolutionSheetRef = useRef<BottomSheet>(null);
  const activeSheetRef = useRef<
    | "model"
    | "sampler"
    | "schedule"
    | "steps"
    | "cfg"
    | "cfgRescale"
    | "seed"
    | "resolution"
    | null
  >(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isImagePreviewOpen) {
          closeImagePreview();
          return true;
        }
        const active = activeSheetRef.current;
        if (active === "model") {
          modelSheetRef.current?.close();
          return true;
        }
        if (active === "sampler") {
          samplerSheetRef.current?.close();
          return true;
        }
        if (active === "schedule") {
          scheduleSheetRef.current?.close();
          return true;
        }
        if (active === "steps") {
          stepsSheetRef.current?.close();
          return true;
        }
        if (active === "cfg") {
          cfgSheetRef.current?.close();
          return true;
        }
        if (active === "cfgRescale") {
          cfgRescaleSheetRef.current?.close();
          return true;
        }
        if (active === "seed") {
          seedSheetRef.current?.close();
          return true;
        }
        if (active === "resolution") {
          resolutionSheetRef.current?.close();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [isImagePreviewOpen]);

  const handleSheetChange = useCallback(
    (
      sheet:
        | "model"
        | "sampler"
        | "schedule"
        | "steps"
        | "cfg"
        | "cfgRescale"
        | "seed"
        | "resolution",
      index: number,
    ) => {
      if (index >= 0) {
        activeSheetRef.current = sheet;
      } else if (activeSheetRef.current === sheet) {
        activeSheetRef.current = null;
      }
    },
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  // 입력창 높이(UI 스레드). PromptCard 가 구동, 이미지 스케일이 이를 읽음.
  const inputHeight = useSharedValue(PROMPT_MIN_HEIGHT);

  // 입력창이 커질수록 이미지를 비율 유지한 채 축소.
  // scale(transform) 이라 재레이아웃 없음 → 깜박이지 않음.
  // 세로 공간 회수는 바깥 slot 의 height 로만.
  const baseHeight = useSharedValue(0);

  const imageCardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          inputHeight.value,
          [PROMPT_MIN_HEIGHT, PROMPT_MAX_HEIGHT],
          [1, IMAGE_MIN_SCALE],
        ),
      },
    ],
  }));

  const imageSlotAnimStyle = useAnimatedStyle(() => {
    if (baseHeight.value === 0) return {};
    const scale = interpolate(
      inputHeight.value,
      [PROMPT_MIN_HEIGHT, PROMPT_MAX_HEIGHT],
      [1, IMAGE_MIN_SCALE],
    );
    return { height: baseHeight.value * scale };
  });

  const sheetRefs: Record<string, React.RefObject<BottomSheet | null>> = {
    model: modelSheetRef,
    sampler: samplerSheetRef,
    schedule: scheduleSheetRef,
    steps: stepsSheetRef,
    cfg: cfgSheetRef,
    cfgRescale: cfgRescaleSheetRef,
    seed: seedSheetRef,
    resolution: resolutionSheetRef,
  };

  const optionValues: Record<string, ChipValue> = {
    model: { text: MODELS.find((m) => m.value === model)?.label ?? model },
    resolution: { text: `${resolution.width}×${resolution.height}` },
    seed: {
      text: seed === 0 ? "Random" : seedLocked ? `${seed} 🔒` : String(seed),
    },
    steps: { text: String(steps), unit: "steps", unitBefore: true },
    cfg: {
      text: formatDecimal(promptGuidance),
      unit: "guidance",
      unitBefore: true,
    },
    cfgRescale: {
      text: formatDecimal(promptGuidanceRescale, 2),
      unit: "rescale",
      unitBefore: true,
    },
    sampler: {
      text: SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler,
    },
    schedule: {
      text:
        NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ??
        noiseSchedule,
    },
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerCircleButton}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>test1</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerCircleButton}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="History"
            onPress={() => navigation.navigate("AssistantHistory")}
          >
            <Ionicons name="time-outline" size={20} color={light.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCircleButton}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate("AssistantSettings")}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={light.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 중단: 생성 이미지 영역 */}
      <ScrollView
        style={styles.imageScroll}
        contentContainerStyle={styles.imageScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View style={[styles.imageSlot, imageSlotAnimStyle]}>
          <Reanimated.View
            onLayout={(e) => {
              baseHeight.value = e.nativeEvent.layout.height;
            }}
            style={[
              styles.imageCard,
              imageCardAnimStyle,
              currentGeneration
                ? {
                    aspectRatio:
                      currentGeneration.width / currentGeneration.height,
                  }
                : null,
            ]}
          >
            {currentImageUri ? (
              <Pressable
                style={styles.generatedImage}
                onPress={openImagePreview}
              >
                <ExpoImage
                  source={{ uri: currentImageUri }}
                  contentFit="cover"
                  transition={120}
                  style={styles.generatedImage}
                />
              </Pressable>
            ) : null}
            {currentImageUri ? (
              <View style={styles.imageOverlayRow}>
                <TouchableOpacity
                  style={styles.imageOverlayButton}
                  activeOpacity={0.82}
                  onPress={handleSaveImage}
                  disabled={isSavingImage}
                >
                  {isSavingImage ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Ionicons
                      name="arrow-down-outline"
                      size={20}
                      color="#ffffff"
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.imageOverlayButton}
                  activeOpacity={0.82}
                  onPress={handleCopyImage}
                  disabled={isCopyingImage}
                >
                  {isCopyingImage ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Ionicons name="copy-outline" size={20} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </Reanimated.View>
        </Reanimated.View>
      </ScrollView>

      {/* 하단: 옵션 + 프롬프트 */}
      <KeyboardStickyView
        style={[styles.bottomArea, { paddingBottom: insets.bottom + 16 }]}
        offset={{ closed: 0, opened: 0 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.optionScrollContent}
        >
          {OPTIONS.map((opt) => (
            <OptionChip
              key={opt.key}
              opt={opt}
              value={optionValues[opt.key] ?? { text: opt.label }}
              onPress={
                sheetRefs[opt.key]
                  ? () => sheetRefs[opt.key].current?.snapToIndex(0)
                  : undefined
              }
            />
          ))}

          <VarietyChip
            active={varietyPlus}
            onPress={() => setVarietyPlus(!varietyPlus)}
          />
        </ScrollView>

        <PromptCard inputHeight={inputHeight} />
      </KeyboardStickyView>

      <BottomSheet
        ref={modelSheetRef}
        index={-1}
        snapPoints={[430]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("model", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Model</Text>
          {MODELS.flatMap((item, index) => {
            const el = (
              <SheetItem
                key={item.value}
                item={item}
                isActive={model === item.value}
                recommendedValue="nai-diffusion-4-5-full"
                onPress={() => {
                  setModel(item.value);
                  modelSheetRef.current?.close();
                }}
              />
            );
            return index === 1
              ? [el, <View key="model-divider" style={styles.sheetDivider} />]
              : [el];
          })}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={samplerSheetRef}
        index={-1}
        snapPoints={[540]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("sampler", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Sampler</Text>
          {SAMPLERS.flatMap((item, index) => {
            const el = (
              <SheetItem
                key={item.value}
                item={item}
                isActive={sampler === item.value}
                recommendedValue="k_euler_ancestral"
                onPress={() => {
                  setSampler(item.value);
                  samplerSheetRef.current?.close();
                }}
              />
            );
            return index === 5
              ? [el, <View key="sampler-divider" style={styles.sheetDivider} />]
              : [el];
          })}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={scheduleSheetRef}
        index={-1}
        snapPoints={[360]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        onChange={(index) => handleSheetChange("schedule", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sheetTitle}>Noise Schedule</Text>
          {NOISE_SCHEDULES.flatMap((item, index) => {
            const el = (
              <SheetItem
                key={item.value}
                item={item}
                isActive={noiseSchedule === item.value}
                recommendedValue="karras"
                onPress={() => {
                  setNoiseSchedule(item.value as NoiseSchedule);
                  scheduleSheetRef.current?.close();
                }}
              />
            );
            return index === 2
              ? [
                  el,
                  <View key="schedule-divider" style={styles.sheetDivider} />,
                ]
              : [el];
          })}
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={stepsSheetRef}
        index={-1}
        snapPoints={[320]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => handleSheetChange("steps", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <NumericSheetContent
            value={steps}
            onChange={setSteps}
            cfg={STEPS_CONFIG}
          />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={cfgSheetRef}
        index={-1}
        snapPoints={[320]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => handleSheetChange("cfg", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <NumericSheetContent
            value={promptGuidance}
            onChange={setPromptGuidance}
            cfg={CFG_CONFIG}
          />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={cfgRescaleSheetRef}
        index={-1}
        snapPoints={[320]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => handleSheetChange("cfgRescale", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <NumericSheetContent
            value={promptGuidanceRescale}
            onChange={setPromptGuidanceRescale}
            cfg={CFG_RESCALE_CONFIG}
          />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={seedSheetRef}
        index={-1}
        snapPoints={[260]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => handleSheetChange("seed", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SeedSheetContent
            seed={seed}
            locked={seedLocked}
            onChangeSeed={setSeed}
            onToggleLock={() => setSeedLocked(!seedLocked)}
          />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={resolutionSheetRef}
        index={-1}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => handleSheetChange("resolution", index)}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ResolutionSheetContent
            resolution={resolution}
            onChange={setResolution}
            onClose={() => resolutionSheetRef.current?.close()}
          />
        </BottomSheetScrollView>
      </BottomSheet>

      <ImagePreviewModal
        visible={isImagePreviewOpen}
        images={currentImageUri ? [currentImageUri] : []}
        initialIndex={0}
        animation={previewAnimation}
        onClose={closeImagePreview}
      />
    </View>
  );
}
