import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "expo-router";
import { imageUpscaler } from "../../../modules/image-upscaler";
import {
  useUpscaleQueueStore,
  type UpscaleQueueItem,
  type UpscalePreview,
} from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";

function UpscaleImage({
  item,
  preview,
  progress,
}: {
  item: UpscaleQueueItem;
  preview: UpscalePreview | null;
  progress: number;
}) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [lastGood, setLastGood] = useState<{
    uri: string;
    requestId?: string;
  } | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const loading = item.status === "running";
  const candidate = loading ? preview?.uri : item.result?.uri;
  const latestCandidate = useRef(candidate);
  const updatedAt = preview?.updatedAt;
  useLayoutEffect(() => {
    latestCandidate.current = candidate;
  }, [candidate]);
  useEffect(() => {
    if (!loading || updatedAt === undefined) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, updatedAt + 5000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [loading, updatedAt]);
  const scale = Math.min(
    bounds.width / Math.max(1, item.width),
    bounds.height / Math.max(1, item.height),
  );
  const currentFrame = lastGood?.requestId === preview?.requestId && !!lastGood;
  const fallback =
    loading &&
    (!currentFrame ||
      preview?.failed ||
      candidate === failedUri ||
      now - (preview?.updatedAt ?? 0) >= 5000);
  const tile = loading && preview?.phase === "upscaling" ? preview.tile : null;
  return (
    <>
      <View
        testID="upscale-image-viewport"
        style={styles.viewport}
        onLayout={({ nativeEvent: { layout } }) =>
          setBounds((current) =>
            current.width === layout.width && current.height === layout.height
              ? current
              : { width: layout.width, height: layout.height },
          )
        }
      >
        <View
          style={[
            styles.image,
            { width: item.width * scale, height: item.height * scale },
          ]}
        >
          <Image
            accessibilityLabel="현재 업스케일 이미지"
            source={{ uri: lastGood?.uri ?? item.uri }}
            cachePolicy={lastGood?.requestId ? "none" : "memory-disk"}
            contentFit="contain"
            style={StyleSheet.absoluteFill}
            onError={() => {
              if (lastGood) {
                setFailedUri(lastGood.uri);
                setLastGood(null);
              }
            }}
          />
          {candidate &&
          candidate !== failedUri &&
          candidate !== lastGood?.uri ? (
            <Image
              testID="upscale-preview-candidate"
              source={{ uri: candidate }}
              cachePolicy={loading ? "none" : "memory-disk"}
              style={[StyleSheet.absoluteFill, styles.pendingFrame]}
              onLoad={() => {
                if (latestCandidate.current !== candidate) return;
                setLastGood({
                  uri: candidate,
                  requestId: loading ? preview?.requestId : undefined,
                });
                if (loading && preview)
                  imageUpscaler?.acknowledgePreview?.(
                    preview.requestId,
                    preview.sequence,
                  );
              }}
              onError={() => {
                if (latestCandidate.current === candidate)
                  setFailedUri(candidate);
              }}
            />
          ) : null}
          {tile ? (
            <View
              testID="upscale-active-tile"
              pointerEvents="none"
              style={[
                styles.tile,
                {
                  left: tile.x * scale,
                  top: tile.y * scale,
                  width: tile.width * scale,
                  height: tile.height * scale,
                },
              ]}
            />
          ) : null}
          {fallback ? (
            <ActivityIndicator
              testID="upscale-preview-fallback"
              color={tokens.color.textPrimary}
              size="large"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </View>
      </View>
      <Text style={styles.caption}>
        {loading
          ? preview?.phase === "preparing"
            ? "업스케일 준비 중…"
            : preview?.phase === "saving"
              ? "결과 파일을 만드는 중…"
              : `업스케일 중… ${Math.round(progress * 100)}%`
          : item.status === "done"
            ? item.saving
              ? "갤러리에 저장 중…"
              : item.saved
                ? "업스케일 완료 · 갤러리에 저장됨"
                : item.saveError
                  ? "업스케일 완료 · 저장 실패, 완료 탭에서 재시도하세요."
                  : "업스케일 완료 · 완료 탭에서 저장할 수 있습니다."
            : item.status === "failed"
              ? "업스케일 실패 · 진행 완료 탭을 확인하세요."
              : "중단됨 · 다음 시작을 기다리는 이미지"}
      </Text>
    </>
  );
}

export function UpscaleCanvas({ onOpenQueue }: { onOpenQueue: () => void }) {
  const focused = useIsFocused();
  const item = useUpscaleQueueStore((state) =>
    state.items.find((entry) => entry.id === state.currentItemId),
  );
  const progress = useUpscaleQueueStore((state) => state.progress);
  const preview = useUpscaleQueueStore((state) => state.preview);
  const setPreviewVisible = useUpscaleQueueStore(
    (state) => state.setPreviewVisible,
  );
  useEffect(() => {
    setPreviewVisible(focused);
    return () => setPreviewVisible(false);
  }, [focused, setPreviewVisible]);
  useEffect(() => {
    const id = preview?.requestId;
    return () => {
      if (id) imageUpscaler?.releasePreviews?.(id);
    };
  }, [preview?.requestId]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setPreviewVisible(focused && state === "active"),
    );
    return () => subscription.remove();
  }, [focused, setPreviewVisible]);
  return (
    <View style={styles.canvas}>
      {item ? (
        <UpscaleImage
          key={item.id}
          item={item}
          preview={preview}
          progress={progress}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="업스케일 이미지 관리 열기"
          onPress={onOpenQueue}
          style={styles.empty}
        >
          <Ionicons
            name="expand-outline"
            size={40}
            color={tokens.color.textTertiary}
          />
          <Text style={styles.caption}>
            업스케일할 이미지를 아래 시트에서 추가하세요.
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, minHeight: 280, gap: 16, paddingBottom: 16 },
  viewport: {
    flex: 1,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { borderRadius: tokens.radius.lg, overflow: "hidden" },
  pendingFrame: { opacity: 0 },
  tile: {
    position: "absolute",
    borderWidth: 2,
    borderColor: tokens.color.accent,
    backgroundColor: "rgba(130, 130, 255, 0.12)",
  },
  empty: {
    flex: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  caption: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.regular,
    fontSize: 14,
    textAlign: "center",
  },
});
