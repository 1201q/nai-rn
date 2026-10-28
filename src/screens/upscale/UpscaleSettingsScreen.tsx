import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PortalHost } from "@gorhom/portal";
import { BlurTargetView } from "expo-blur";
import { useRouter, useFocusEffect, useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
import { SettingsPageScrollView } from "../../components/common/SettingsPageScrollView";
import { Toggle } from "../../components/forms/FormControls";
import { SheetSelect } from "../../components/forms/SheetSelect";
import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../context/GenerationInputCommitContext";
import { useUpscaleSettingsStore } from "../../store/upscaleSettingsStore";
import {
  useUpscaleQueueStore,
  type UpscaleSettings,
} from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import { UpscaleCpuSettings } from "./UpscaleCpuSettings";
import { UpscaleOptionLabel } from "./UpscaleOptionLabel";
import { UpscaleQualityControl } from "./UpscaleQualityControl";
import {
  UpscaleSettingsRow,
  upscalePageStyles as rows,
} from "./UpscaleSettingsRow";
import { FORMATS, TILE_SIZES, SYNC_GAPS } from "./upscaleOptions";

const PORTAL_HOST = "upscale-settings-page-overlay";
const FORMAT_LABELS = FORMATS.map((option) => option.label);
const SYNC_GAP_LABELS = SYNC_GAPS.map((option) => option.label);
const TILE_LABELS = TILE_SIZES.map((option) => option.label);

export function UpscaleSettingsScreen() {
  return (
    <GenerationInputCommitProvider>
      <SettingsContent />
    </GenerationInputCommitProvider>
  );
}

function SettingsContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const active = useIsFocused();
  const blurTargetRef = useRef<View>(null);
  const [scrollY] = useState(() => new Animated.Value(0));
  const settings = useUpscaleSettingsStore((state) => state.settings);
  const setSettings = useUpscaleSettingsStore((state) => state.setSettings);
  const disabled = useUpscaleQueueStore((state) => state.running);
  const { commitPendingInput } = useGenerationInputCommit();
  const finishEditing = useCallback(() => {
    commitPendingInput();
    Keyboard.dismiss();
  }, [commitPendingInput]);
  // Covers both the header button and native back gestures.
  useFocusEffect(useCallback(() => () => finishEditing(), [finishEditing]));
  function change(patch: Partial<UpscaleSettings>) {
    if (disabled) return;
    // Commit before a format change can unmount the current input.
    finishEditing();
    setSettings(patch);
  }
  function label(title: string, description: string) {
    return (
      <UpscaleOptionLabel
        label={title}
        description={description}
        active={active && !disabled}
        portalHostName={PORTAL_HOST}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <BlurTargetView ref={blurTargetRef} style={styles.fill}>
        <SettingsPageScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + DETAIL_FIXED_HEADER_CONTENT_OFFSET,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {disabled ? (
            <Text style={styles.notice}>
              업스케일 처리 중에는 설정을 변경할 수 없습니다.
            </Text>
          ) : null}
          <View
            pointerEvents={disabled ? "none" : "auto"}
            accessibilityElementsHidden={disabled}
            importantForAccessibility={
              disabled ? "no-hide-descendants" : "auto"
            }
            style={disabled ? styles.disabled : undefined}
          >
            <View style={[rows.option, styles.firstOption]}>
              <UpscaleSettingsRow
                title="Limit GPU Performance"
                description="GPU에서 타일 크기를 최대 100으로 제한합니다. 더 작은 자동 계산값은 유지하며 CPU에는 적용하지 않습니다."
              >
                <Toggle
                  label="Limit GPU Performance"
                  value={settings.limitGpuPerformance}
                  disabled={disabled}
                  onChange={(value) => change({ limitGpuPerformance: value })}
                />
              </UpscaleSettingsRow>
            </View>
            <View style={[rows.option, rows.row]}>
              <View style={rows.text}>
                {label(
                  "Image Format",
                  "결과 이미지의 저장 형식입니다. PNG는 무손실이며 JPG와 WebP는 저장 품질을 조절할 수 있습니다.",
                )}
              </View>
              <SheetSelect
                accessibilityLabel="Image Format"
                value={FORMATS.find((o) => o.value === settings.format)!.label}
                options={FORMAT_LABELS}
                onChange={(value) =>
                  change({
                    format: FORMATS.find((o) => o.label === value)!.value,
                  })
                }
                onOpenChange={(open) => {
                  if (open) finishEditing();
                }}
                portalHostName={PORTAL_HOST}
                style={rows.select}
              />
            </View>
            <View style={rows.option}>
              <UpscaleQualityControl
                settings={settings}
                active={active && !disabled}
                inSheet={false}
                portalHostName={PORTAL_HOST}
                onChange={setSettings}
              />
            </View>
            <View style={rows.option}>
              <UpscaleSettingsRow
                title="원본 파일명 유지"
                description="원본 이름이 없으면 자동 이름을 사용합니다. 확장자는 출력 형식에 맞추며 같은 이름은 덮어쓰지 않습니다."
              >
                <Toggle
                  label="원본 파일명 유지"
                  value={settings.keepOriginalFilename}
                  disabled={disabled}
                  onChange={(value) => change({ keepOriginalFilename: value })}
                />
              </UpscaleSettingsRow>
            </View>
            <View style={rows.option}>
              {label(
                "저장 앨범",
                "앨범 이름을 입력하면 그 앨범에 저장하고, 없으면 만듭니다. 비워 두면 기본 갤러리 위치에 저장합니다.",
              )}
              <TextInput
                accessibilityLabel="저장 앨범"
                placeholder="기본 갤러리 위치"
                placeholderTextColor={tokens.color.textMuted}
                value={settings.albumName}
                editable={!disabled}
                maxLength={80}
                autoCorrect={false}
                returnKeyType="done"
                onFocus={commitPendingInput}
                onChangeText={(albumName) => setSettings({ albumName })}
                style={styles.albumInput}
              />
            </View>
            <View style={[rows.option, rows.row]}>
              <View style={rows.text}>
                {label(
                  "Tile size",
                  "이미지를 나누어 처리하는 타일 크기입니다. 자동은 GPU 메모리 예산을 기준으로 계산합니다.",
                )}
              </View>
              <SheetSelect
                accessibilityLabel="Tile size"
                value={
                  TILE_SIZES.find((o) => o.value === settings.tileSize)!.label
                }
                options={TILE_LABELS}
                onChange={(value) =>
                  change({
                    tileSize: TILE_SIZES.find((o) => o.label === value)!.value,
                  })
                }
                onOpenChange={(open) => {
                  if (open) finishEditing();
                }}
                portalHostName={PORTAL_HOST}
                style={rows.select}
              />
            </View>

            <View style={rows.option}>
              <UpscaleSettingsRow
                title="TTA mode"
                description="8가지 방향으로 추론한 결과를 합칩니다. 처리 시간과 메모리 사용량이 늘어납니다."
              >
                <Toggle
                  label="TTA mode"
                  value={settings.ttaMode}
                  disabled={disabled}
                  onChange={(value) => change({ ttaMode: value })}
                />
              </UpscaleSettingsRow>
            </View>
            {settings.model !== "waifu2x-cunet" ? (
              <View style={[rows.option, rows.row]}>
                <View style={rows.text}>
                  {label(
                    "Real-CUGAN Sync Gap",
                    "타일을 나눠 처리할 때 적용됩니다. 0은 비활성화, 기본값은 3입니다.",
                  )}
                </View>
                <SheetSelect
                  accessibilityLabel="Real-CUGAN Sync Gap"
                  value={String(settings.syncGap)}
                  options={SYNC_GAP_LABELS}
                  onOpenChange={(open) => {
                    if (open) finishEditing();
                  }}
                  onChange={(value) =>
                    change({
                      syncGap: SYNC_GAPS.find(
                        (option) => option.label === value,
                      )!.value,
                    })
                  }
                  portalHostName={PORTAL_HOST}
                  style={rows.select}
                />
              </View>
            ) : null}
            <UpscaleCpuSettings
              settings={settings}
              active={active && !disabled}
              disabled={disabled}
              inSheet={false}
              portalHostName={PORTAL_HOST}
              onChange={setSettings}
            />
          </View>
        </SettingsPageScrollView>
      </BlurTargetView>
      <DetailHeaderOverlay
        title="Upscaling Settings"
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => {
          finishEditing();
          router.back();
        }}
        showMore={false}
        hideCompactTitleOnScroll
        blurTarget={blurTargetRef}
      />
      <View pointerEvents="box-none" style={styles.portal}>
        <PortalHost name={PORTAL_HOST} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.app },
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: tokens.space[10] },
  albumInput: {
    height: 52,
    marginTop: 14,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.sunken,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  firstOption: { borderTopWidth: 0, paddingTop: 0 },
  notice: { color: tokens.color.textMuted, marginBottom: 18 },
  disabled: { opacity: 0.5 },
  portal: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 120,
    elevation: 120,
  },
});
