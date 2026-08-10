import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { useAppSheet } from "../../context/AppSheetContext";
import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import { MetadataDetails } from "../../components/metadata/MetadataDetails";
import { parseNaiMetadata, type ParsedNaiMetadata } from "../../lib/naiMetadata";
import { hasImportableMetadata } from "../../lib/metadataImport";
import { extractPngTextMetadata } from "../../lib/novelai";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

export function MetadataExtractScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { openMetadataImport } = useAppSheet();
  const setMessage = useGenerationStore((state) => state.setMessage);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedNaiMetadata | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  async function pickImage() {
    if (busy) return;
    const replacing = Boolean(pickedUri);

    try {
      setBusy(true);
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      setPickedUri(asset.uri);
      const bytes = await new File(asset.uri).bytes();
      const metadata = extractPngTextMetadata(bytes);
      setParsed(parseNaiMetadata(metadata));
      toast.success(
        replacing
          ? "메타데이터 이미지를 교체했습니다."
          : "메타데이터 이미지를 추가했습니다.",
      );
    } catch {
      setParsed(null);
      setMessage("이미지에서 메타데이터를 추출하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function clearImage() {
    setPickedUri(null);
    setParsed(null);
    toast.success("메타데이터 이미지를 삭제했습니다.");
  }

  function handleOpenImport() {
    if (!parsed) return;
    openMetadataImport(parsed);
  }

  const canImport = parsed ? hasImportableMetadata(parsed) : false;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + DETAIL_FIXED_HEADER_CONTENT_OFFSET,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View>
          {pickedUri ? (
            <View style={styles.previewCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="메타데이터 이미지 교체"
                disabled={busy}
                onPress={() => void pickImage()}
                style={StyleSheet.absoluteFill}
              >
                <ExpoImage
                  source={{ uri: pickedUri }}
                  contentFit="cover"
                  contentPosition="center"
                  cachePolicy="memory-disk"
                  transition={120}
                  style={StyleSheet.absoluteFill}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="메타데이터 이미지 제거"
                hitSlop={5}
                onPress={clearImage}
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={tokens.color.negative}
                />
              </Pressable>
              {canImport ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="메타데이터를 생성 설정으로 가져오기"
                  disabled={busy}
                  hitSlop={5}
                  onPress={handleOpenImport}
                  style={({ pressed }) => [
                    styles.importButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="download-outline"
                    size={16}
                    color={tokens.color.textPrimary}
                  />
                  <Text style={styles.importButtonLabel}>가져오기</Text>
                </Pressable>
              ) : null}
              {busy ? (
                <View pointerEvents="none" style={styles.busyOverlay}>
                  <ActivityIndicator color={tokens.color.textPrimary} />
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="메타데이터 이미지 추가"
              disabled={busy}
              onPress={() => void pickImage()}
              style={({ pressed }) => [
                styles.uploadCard,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={tokens.color.textMuted} />
              ) : (
                <>
                  <Ionicons
                    name="add-circle-outline"
                    size={32}
                    color={tokens.color.textMuted}
                  />
                  <Text style={styles.uploadLabel}>이미지 추가</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        <MetadataDetails
          parsed={parsed}
          emptyHint="이미지를 추가하면 여기에 추출된 정보가 표시됩니다"
        />
      </Animated.ScrollView>

      <DetailHeaderOverlay
        title="Metadata Extract"
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
        showMore={false}
        hideCompactTitleOnScroll
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  content: {
    paddingHorizontal: tokens.space[6],
  },
  uploadCard: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.color.borderSubtleStrong,
    backgroundColor: tokens.color.card,
  },
  uploadLabel: {
    color: tokens.color.textMuted,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
  },
  previewCard: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.card,
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(23,23,26,0.86)",
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    zIndex: 2,
  },
  importButton: {
    position: "absolute",
    right: tokens.space[5],
    bottom: tokens.space[5],
    zIndex: 2,
    minHeight: 36,
    paddingHorizontal: tokens.space[6],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[3],
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.overlay,
    ...tokens.shadow.floatSm,
  },
  importButtonLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.xs,
  },
  busyOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.scrim,
  },
  pressed: {
    opacity: 0.68,
  },
});
