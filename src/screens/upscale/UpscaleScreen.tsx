import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Keyboard,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PortalHost } from "@gorhom/portal";
import { UpscaleCanvas } from "./UpscaleCanvas";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  cancelAnimation,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { toast } from "sonner-native";

import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import {
  type GenerationRecord,
  resolveGenerationImageUri,
} from "../../lib/generationHistory";
import type { PredictiveBackEvent } from "../../native/predictiveBack";
import { PREDICTIVE_BACK_CANCEL_SPRING } from "../../native/predictiveBackStyle";
import { useBackHandler } from "../../native/useBackHandler";
import { useUpscaleQueueStore } from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import {
  ActionBar,
  ActionIconButton,
  ActionProgressButton,
} from "../generation/GenerationActionBar";
import { UtilitySheetHost } from "../generation/GenerationSheetScaffold";
import { useUpscaleSettingsStore } from "../../store/upscaleSettingsStore";
import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../context/GenerationInputCommitContext";
import {
  pickUpscaleFiles,
  pickUpscaleGalleryImages,
} from "../../lib/upscaleInput";
import {
  UPSCALE_SELECT_PORTAL_HOST,
  UpscaleSettingsSheetContent,
} from "./UpscaleSettingsSheet";
import { UpscaleQueueSheet } from "./UpscaleQueueSheet";
import type { TabbedSheetStage } from "../generation/sheets/TabbedSheetHost";

type UpscaleSheet = "settings" | "history";

function UpscaleAction() {
  const { commitPendingInput } = useGenerationInputCommit();
  const items = useUpscaleQueueStore((state) => state.items);
  const busy = useUpscaleQueueStore((state) => state.running);
  const stopRequested = useUpscaleQueueStore((state) => state.stopRequested);
  const progress = useUpscaleQueueStore((state) => state.progress);
  const start = useUpscaleQueueStore((state) => state.start);
  const requestStop = useUpscaleQueueStore((state) => state.requestStop);
  const waiting = items.filter(
    (item) => item.status === "pending" || item.status === "failed",
  ).length;
  const processed = useUpscaleQueueStore((state) => state.batchCompleted);
  const total = useUpscaleQueueStore((state) => state.activeBatchIds.length);

  async function runUpscale() {
    commitPendingInput();
    Keyboard.dismiss();
    const started = await start(useUpscaleSettingsStore.getState().settings);
    if (started === "no-module") {
      toast.error("이 빌드에는 업스케일 모듈이 없습니다.");
    } else if (started === "no-permission") {
      toast.error("결과를 저장하려면 사진 접근 권한이 필요합니다.");
    }
  }

  const label = !busy
    ? waiting > 0
      ? `업스케일 (${waiting}장)`
      : "업스케일"
    : stopRequested
      ? "중단하는 중…"
      : `중단 (${Math.min(processed + 1, total)}/${total}) · ${Math.round(progress * 100)}%`;

  return (
    <ActionProgressButton
      label={label}
      icon={busy ? "stop" : "expand-outline"}
      loading={busy}
      percent={busy && total > 0 ? (processed + progress) / total : 0}
      disabled={busy ? stopRequested : waiting === 0}
      onPress={busy ? requestStop : () => void runUpscale()}
    />
  );
}

export function UpscaleScreen() {
  return (
    <GenerationInputCommitProvider>
      <UpscaleScreenContent />
    </GenerationInputCommitProvider>
  );
}

function UpscaleScreenContent() {
  const { commitPendingInput } = useGenerationInputCommit();
  const finishInputEditing = useCallback(() => {
    commitPendingInput();
    Keyboard.dismiss();
  }, [commitPendingInput]);
  const { topInset, promptCollapsedHeight } = useGenerationChromeMetrics();
  const router = useRouter();
  const [scrollY] = useState(() => new Animated.Value(0));
  const busy = useUpscaleQueueStore((state) => state.running);
  const addImages = useUpscaleQueueStore((state) => state.addImages);
  const settings = useUpscaleSettingsStore((state) => state.settings);
  const setSettings = useUpscaleSettingsStore((state) => state.setSettings);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<UpscaleSheet | null>(null);
  const [utilityVisible, setUtilityVisible] = useState(false);
  const [queueStage, setQueueStage] = useState<TabbedSheetStage>("collapsed");
  const utilityBackProgress = useSharedValue(0);
  const queueBackProgress = useSharedValue(0);

  const toggleSheet = useCallback(
    (next: UpscaleSheet) => {
      finishInputEditing();
      setSheet((current) => (current === next ? null : next));
    },
    [finishInputEditing, setSheet],
  );
  const closeUtility = useCallback(() => {
    finishInputEditing();
    setSheet(null);
  }, [finishInputEditing]);
  // History에서는 이미지를 캔버스에 띄우는 대신 업스케일 목록에 넣는다.
  const addHistoryImage = useCallback(
    (item: GenerationRecord) => {
      addImages([
        {
          uri: resolveGenerationImageUri(item),
          width: item.width,
          height: item.height,
          originalFilename:
            resolveGenerationImageUri(item).split("/").pop() ?? null,
        },
      ]);
      toast("업스케일 목록에 추가했습니다.");
    },
    [addImages],
  );

  const hasUtilitySheet = sheet !== null || utilityVisible;
  const trackPredictiveBack = useCallback(
    (event: PredictiveBackEvent) => {
      const active = hasUtilitySheet ? utilityBackProgress : queueBackProgress;
      cancelAnimation(active);
      active.value = event.progress;
    },
    [hasUtilitySheet, utilityBackProgress, queueBackProgress],
  );
  const cancelPredictiveBack = useCallback(() => {
    utilityBackProgress.value = withSpring(0, PREDICTIVE_BACK_CANCEL_SPRING);
    queueBackProgress.value = withSpring(0, PREDICTIVE_BACK_CANCEL_SPRING);
  }, [utilityBackProgress, queueBackProgress]);
  useBackHandler(hasUtilitySheet || queueStage !== "collapsed", {
    onBack: () => {
      if (hasUtilitySheet) closeUtility();
      else if (queueStage === "full") setQueueStage("half");
      else {
        finishInputEditing();
        setQueueStage("collapsed");
      }
    },
    onStart: trackPredictiveBack,
    onProgress: trackPredictiveBack,
    onCancel: cancelPredictiveBack,
  });

  const picking = useRef(false);
  async function pickImages(source: "gallery" | "files") {
    if (picking.current) return;
    picking.current = true;
    try {
      if (source === "gallery") {
        addImages(await pickUpscaleGalleryImages());
      } else {
        const { images, rejected } = await pickUpscaleFiles();
        addImages(images);
        if (rejected > 0)
          toast.error(
            `${rejected}개 파일은 읽을 수 있는 이미지가 아니어서 제외했습니다.`,
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        message.includes("PHOTO_PERMISSION_DENIED")
          ? "이미지를 선택하려면 사진 접근 권한이 필요합니다."
          : message.includes("UPSCALE_MODULE_UNAVAILABLE")
            ? "이 빌드에는 업스케일 모듈이 없습니다."
            : "이미지를 불러오지 못했습니다.",
      );
    } finally {
      picking.current = false;
    }
  }

  function chooseImageSource() {
    Alert.alert("이미지 추가", "이미지를 가져올 위치를 선택하세요.", [
      { text: "갤러리", onPress: () => void pickImages("gallery") },
      { text: "파일 탐색기", onPress: () => void pickImages("files") },
      { text: "취소", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topInset + DETAIL_FIXED_HEADER_CONTENT_OFFSET,
            // 접힌 이미지 관리 시트와 액션바에 가리지 않게 한다.
            paddingBottom: promptCollapsedHeight + 24,
          },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <UpscaleCanvas onOpenQueue={() => setQueueStage("half")} />
      </Animated.ScrollView>

      <DetailHeaderOverlay
        title="이미지 업스케일"
        scrollY={scrollY}
        topInset={topInset}
        onBack={() => router.back()}
        onMore={() => {
          finishInputEditing();
          setSheet(null);
          setMoreMenuOpen(true);
        }}
        hideCompactTitleOnScroll
      />

      <Modal
        transparent
        statusBarTranslucent
        animationType="fade"
        visible={moreMenuOpen}
        onRequestClose={() => setMoreMenuOpen(false)}
      >
        <Pressable
          accessibilityLabel="메뉴 닫기"
          style={StyleSheet.absoluteFill}
          onPress={() => setMoreMenuOpen(false)}
        />
        <View style={[styles.moreMenu, { top: topInset + 54 }]}>
          <Pressable
            accessibilityRole="menuitem"
            onPress={() => {
              setMoreMenuOpen(false);
              router.navigate("/upscale-settings");
            }}
            style={({ pressed }) => [
              styles.moreMenuItem,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="settings-outline"
              size={18}
              color={tokens.color.textSecondary}
            />
            <Text style={styles.moreMenuLabel}>업스케일링 설정</Text>
          </Pressable>
        </View>
      </Modal>

      <UpscaleQueueSheet
        stage={queueStage}
        onStageChange={setQueueStage}
        predictiveBackProgress={queueBackProgress}
        onAddImages={chooseImageSource}
      />
      <UtilitySheetHost
        sheet={sheet}
        predictiveBackProgress={utilityBackProgress}
        onClose={closeUtility}
        onVisibilityChange={setUtilityVisible}
        onSelectGeneration={addHistoryImage}
        renderSettings={(active) => (
          <UpscaleSettingsSheetContent
            active={active}
            settings={settings}
            disabled={busy}
            onChange={setSettings}
          />
        )}
      />

      <ActionBar>
        <ActionIconButton
          icon="settings-sharp"
          label={sheet === "settings" ? "Settings 닫기" : "Settings 열기"}
          active={sheet === "settings"}
          onPress={() => toggleSheet("settings")}
        />
        <UpscaleAction />
        <ActionIconButton
          icon="time-outline"
          label={sheet === "history" ? "History 닫기" : "History 열기"}
          active={sheet === "history"}
          onPress={() => toggleSheet("history")}
        />
      </ActionBar>

      <View pointerEvents="box-none" style={styles.selectPortalLayer}>
        <PortalHost name={UPSCALE_SELECT_PORTAL_HOST} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moreMenu: {
    position: "absolute",
    right: tokens.space[8],
    minWidth: 180,
    paddingVertical: tokens.space[3],
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.raised,
    ...tokens.shadow.floatMd,
  },
  moreMenuItem: {
    height: 44,
    paddingHorizontal: tokens.space[7],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[5],
  },
  moreMenuLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.base,
  },
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: tokens.space[8],
  },
  pressed: { opacity: tokens.opacity.pressed },
  selectPortalLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 120,
    elevation: 120,
  },
});
