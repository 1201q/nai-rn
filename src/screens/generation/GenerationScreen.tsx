import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  IconButton,
  PrimaryButton,
} from "../../components/common/Buttons";
import {
  selectOverallPercent,
  useGenerationStore,
} from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { GenerationCanvas } from "./GenerationCanvas";

function GenerateAction() {
  const isLoading = useGenerationStore((s) => s.isLoading);
  const batchCount = useGenerationStore((s) => s.batchCount);
  const queueTotal = useGenerationStore((s) => s.queueTotal);
  const queueIndex = useGenerationStore((s) => s.queueIndex);
  const percent = useGenerationStore(selectOverallPercent);
  const generateImage = useGenerationStore((s) => s.generateImage);
  const requestQueueCancel = useGenerationStore((s) => s.requestQueueCancel);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = isLoading
      ? withTiming(percent, { duration: 300, easing: Easing.linear })
      : 0;
  }, [isLoading, percent, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const label = isLoading
    ? queueTotal > 1
      ? `취소 (${queueIndex}/${queueTotal}) · ${Math.round(percent * 100)}%`
      : `취소 · ${Math.round(percent * 100)}%`
    : batchCount > 1
      ? `${batchCount}장 생성`
      : "생성";

  return (
    <PrimaryButton
      label={label}
      loading={false}
      icon={
        <Ionicons
          name={isLoading ? "stop" : "sparkles"}
          size={18}
          color={tokens.color.onAccent}
        />
      }
      background={
        isLoading ? (
          <Reanimated.View style={[styles.progressFill, progressStyle]} />
        ) : undefined
      }
      onPress={() => {
        if (isLoading) {
          requestQueueCancel();
          return;
        }
        generateImage();
      }}
    />
  );
}

export function GenerationScreen({
  onOpenHistory,
}: {
  onOpenHistory?: () => void;
} = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const anlasBalance = useGenerationStore((s) => s.anlasBalance);

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar style="light" />

      <View
        pointerEvents="box-none"
        style={[styles.topActions, { top: insets.top + 8 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ANLAS 토큰 설정"
          onPress={() => router.navigate("/settings")}
          style={({ pressed }) => [
            styles.balancePill,
            pressed && styles.balancePillPressed,
          ]}
        >
          <Ionicons
            name="diamond-outline"
            size={15}
            color={tokens.color.accent}
          />
          <Text style={styles.balanceText}>
            {anlasBalance ? anlasBalance.total.toLocaleString() : "—"}
          </Text>
        </Pressable>

        <IconButton
          icon="ellipsis-horizontal"
          label="더 보기"
          size={40}
          onPress={() => router.navigate("/settings")}
          style={styles.moreButton}
        />
      </View>

      <View style={styles.topActionsSpacer} />
      <GenerationCanvas />

      <View style={styles.bottomActions}>
        <IconButton
          icon="settings-outline"
          label="이미지 세팅"
          onPress={() => router.navigate("/image-settings")}
          style={styles.sideActionButton}
        />
        <GenerateAction />
        <IconButton
          icon="time-outline"
          label="History"
          onPress={onOpenHistory ?? (() => router.navigate("/history"))}
          style={styles.sideActionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: tokens.space[8],
    backgroundColor: tokens.color.app,
    gap: tokens.space[5],
  },
  topActions: {
    position: "absolute",
    left: tokens.space[8],
    right: tokens.space[8],
    zIndex: 3,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topActionsSpacer: {
    height: 40,
  },
  balancePill: {
    height: 40,
    paddingHorizontal: tokens.space[7],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[4],
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.card,
    ...tokens.shadow.floatMd,
  },
  balanceText: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  balancePillPressed: {
    opacity: 0.68,
  },
  moreButton: {
    borderWidth: 0,
    backgroundColor: tokens.color.card,
  },
  bottomActions: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
    marginTop: tokens.space[8],
  },
  sideActionButton: {
    borderWidth: 0,
    backgroundColor: tokens.color.card,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: tokens.color.accentActive,
  },
});
