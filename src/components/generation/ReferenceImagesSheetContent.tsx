import { memo, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Reanimated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import { MAX_PRECISE_REFERENCES, resolvePreciseReferenceThumbnailUri, resolvePreciseReferenceImageUri, type PreciseReferenceType } from "../../lib/preciseReferences";
import { MAX_VIBE_REFERENCES, canUseCachedVibeEncoding, resolveVibeReferenceThumbnailUri, resolveVibeReferenceImageUri } from "../../lib/vibeReferences";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";
import { SheetSliderControls } from "../forms/SheetSliderControls";
import { SheetSelect } from "../forms/SheetSelect";
import { BottomSheetKeyboardAwareScrollView } from "./BottomSheetKeyboardAwareScrollView";

type ReferenceKind = "i2i" | "vibe" | "precise";
type IconName = ComponentProps<typeof Ionicons>["name"];
const MODES: { label: string; value: PreciseReferenceType }[] = [
  { label: "Character & Style", value: "character&style" },
  { label: "Style Only", value: "style" },
  { label: "Character Only", value: "character" },
];
const MODE_LABELS = MODES.map((mode) => mode.label);
const REFERENCE_TIMING = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

function ReferenceSlider({ label, value, min, max, step, precision, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.sliderBlock}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <SheetSliderControls
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        precision={precision}
        onChange={onChange}
      />
    </View>
  );
}

function useReferenceUpload(kind: ReferenceKind) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  async function pickImage() {
    if (pending.current) return;
    const state = useGenerationStore.getState();
    if (kind === "precise" && !["nai-diffusion-4-5-full", "nai-diffusion-4-5-curated"].includes(state.model)) {
      state.setMessage("Precise Reference는 V4.5 모델에서 사용할 수 있습니다.");
      return;
    }
    if ((kind === "vibe" && state.preciseReferences.some((item) => item.enabled)) ||
        (kind === "precise" && state.vibeReferences.some((item) => item.enabled))) {
      state.setMessage("Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.");
      return;
    }
    if ((kind === "vibe" && state.vibeReferences.length >= MAX_VIBE_REFERENCES) ||
        (kind === "precise" && state.preciseReferences.length >= MAX_PRECISE_REFERENCES)) return;
    pending.current = true;
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        state.setMessage("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, base64: false });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      const input = { uri: asset.uri, width: asset.width || 64, height: asset.height || 64, fileName: asset.fileName, mimeType: asset.mimeType };
      const current = useGenerationStore.getState();
      if (kind === "i2i") await current.setI2ISourceImage(input);
      else if (kind === "vibe" && current.vibeReferences.length < MAX_VIBE_REFERENCES) await current.addVibeReference(input);
      else if (kind === "precise" && current.preciseReferences.length < MAX_PRECISE_REFERENCES &&
        ["nai-diffusion-4-5-full", "nai-diffusion-4-5-curated"].includes(current.model)) await current.addPreciseReference(input);
    } catch {
      state.setMessage("참조 이미지를 선택하지 못했습니다.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { busy, pickImage };
}

function IconButton({ label, icon, onPress, disabled = false, busy = false, destructive = false, standalone = false, compact = false, borderless = false }: {
  label: string; icon: IconName; onPress: () => void; disabled?: boolean; busy?: boolean; destructive?: boolean; standalone?: boolean; compact?: boolean; borderless?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    hitSlop={compact ? { top: 3, bottom: 3 } : undefined}
    style={({ pressed }) => [styles.iconButton, standalone && styles.addButton, compact && styles.compactIconButton, borderless && styles.borderlessIconButton, (pressed || disabled || busy) && styles.dimmed]}>
    {busy ? <ActivityIndicator color={tokens.color.textTertiary} /> : <Ionicons name={icon} size={16} color={destructive ? tokens.color.negative : tokens.color.textTertiary} />}
  </Pressable>;
}

function ReferenceSection({ title, description, icon, count, activeCount = count, busy, limit, onAdd, onReplace, children, group = false }: {
  title: string; description: string; icon: IconName; count: number; activeCount?: number; busy: boolean; limit: number; onAdd: () => void; onReplace?: () => void; children?: ReactNode; group?: boolean;
}) {
  const filled = count > 0;
  const countLabel = activeCount < count ? `${activeCount}/${count}` : `${count}`;
  const headerHeight = useSharedValue(filled ? 47 : 60);
  const contentHeight = useSharedValue(0);
  const headerStyle = useAnimatedStyle(() => ({
    marginHorizontal: withTiming(filled ? 8 : 0, REFERENCE_TIMING),
    height: withTiming(headerHeight.value, REFERENCE_TIMING),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    height: withTiming(filled ? contentHeight.value : 0, REFERENCE_TIMING),
    opacity: withTiming(filled ? 1 : 0, REFERENCE_TIMING),
  }));
  if (group) {
    return (
      <View key="filled-group">
        <Reanimated.View
          testID={`${title}-header`}
          collapsable={false}
          style={[
            styles.card,
            styles.emptyCard,
            styles.groupHeaderFrame,
            filled ? styles.groupHeaderFilled : styles.groupHeaderEmpty,
            headerStyle,
          ]}
        >
          <View
            key={filled ? "filled-header" : "empty-header"}
            collapsable={false}
            onLayout={(event) => {
              headerHeight.value = event.nativeEvent.layout.height + (filled ? 1 : 2);
            }}
            style={[styles.header, styles.emptyHeader, styles.measuredContent, styles.groupHeaderSurface, filled && styles.groupHeaderRow]}
          >
            <Ionicons name={icon} size={22} color={tokens.color.textTertiary} style={styles.headerIcon} />
            <View style={styles.copy}>
              <Text style={styles.title}>
                {title}{filled ? <Text style={styles.groupCount}>{` (${countLabel})`}</Text> : null}
              </Text>
              {!filled ? <Text style={styles.description}>{description}</Text> : null}
            </View>
            <IconButton
              label={filled && onReplace ? "I2I 이미지 교체" : `${title} 이미지 추가`}
              icon={filled && !onReplace ? "add" : "cloud-upload-outline"}
              busy={busy}
              disabled={count >= limit && !onReplace}
              standalone
              compact={filled}
              onPress={filled && onReplace ? onReplace : onAdd}
            />
          </View>
        </Reanimated.View>
        <Reanimated.View
          collapsable={false}
          pointerEvents={filled ? "auto" : "none"}
          accessibilityElementsHidden={!filled}
          importantForAccessibility={filled ? "auto" : "no-hide-descendants"}
          style={[styles.clipped, contentStyle]}
        >
          {filled ? (
            <View
              testID={`${title}-images`}
              onLayout={(event) => { contentHeight.value = event.nativeEvent.layout.height; }}
              style={[styles.card, styles.measuredContent]}
            >
              {children}
            </View>
          ) : null}
        </Reanimated.View>
      </View>
    );
  }
  return <View key="empty-section" testID={group ? `${title}-header` : undefined} style={[styles.card, count === 0 && styles.emptyCard]}>
    <View style={[styles.header, count === 0 && styles.emptyHeader]}>
      <Ionicons name={icon} size={22} color={tokens.color.textTertiary} style={styles.headerIcon} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}{count > 0 ? ` (${countLabel})` : ""}</Text>
        {count === 0 ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <IconButton label={`${title} 이미지 추가`} icon={count ? "add" : "cloud-upload-outline"} busy={busy} disabled={count >= limit} standalone={count === 0} onPress={onAdd} />
    </View>
    {children}
  </View>;
}

function ReferenceItem({ name, uri, enabled, cost, onToggle, onRemove, children, note, first = false }: {
  name: string; uri: string | null | undefined; enabled: boolean; cost?: string; onToggle: (value: boolean) => void; onRemove: () => void; children: ReactNode; note?: string; first?: boolean;
}) {
  return <View style={[styles.item, first && styles.firstItem]}>
    <View style={styles.itemRow}>
      <View style={styles.thumbnailColumn}>
        <Image source={uri ? { uri } : undefined} accessibilityLabel={name} contentFit="contain" style={[styles.thumbnail, !enabled && styles.dimmed]} />
        <View style={styles.imageActions}>
          <IconButton label={`${name} 삭제`} icon="trash-outline" destructive borderless onPress={onRemove} />
          <Pressable accessibilityRole="checkbox" accessibilityLabel={`${name} 사용`} accessibilityState={{ checked: enabled }} onPress={() => onToggle(!enabled)} style={[styles.enableButton, enabled && styles.enabled]}>
            <Ionicons name="checkmark" size={17} color={enabled ? tokens.color.textPrimary : tokens.color.textMuted} />
          </Pressable>
        </View>
      </View>
      <View style={styles.controls}>
        <View style={styles.itemHeading}>
          <Text numberOfLines={1} style={styles.name}>{name}</Text>
          {cost ? <Text style={styles.cost}>{cost}</Text> : null}
        </View>
        {children}
      </View>
    </View>
    {note ? <Text style={styles.note}>{note}</Text> : null}
  </View>;
}

export const ImageToImageReferenceCard = memo(function ImageToImageReferenceCard() {
  const source = useGenerationStore((state) => state.i2iSourceImage);
  const enabled = useGenerationStore((state) => state.i2iEnabled);
  const strength = useGenerationStore((state) => state.i2iStrength);
  const noise = useGenerationStore((state) => state.i2iNoise);
  const { busy, pickImage } = useReferenceUpload("i2i");
  const state = useGenerationStore.getState;
  return (
    <ReferenceSection
      group
      title="Image2Image"
      description="이미지를 변형합니다."
      icon="color-wand-outline"
      count={source ? 1 : 0}
      activeCount={source && enabled ? 1 : 0}
      limit={1}
      busy={busy}
      onAdd={() => void pickImage()}
      onReplace={() => void pickImage()}
    >
      {source ? (
        <ReferenceItem
          first
          name="I2I 이미지"
          uri={source.uri}
          enabled={enabled}
          onToggle={(value) => state().setI2IEnabled(value)}
          onRemove={() => state().clearI2I()}
        >
          <ReferenceSlider label="Strength" value={strength} min={0.01} max={0.99} step={0.01} precision={2} onChange={(value) => state().setI2IStrength(value)} />
          <ReferenceSlider label="Noise" value={noise} min={0} max={0.99} step={0.01} precision={2} onChange={(value) => state().setI2INoise(value)} />
        </ReferenceItem>
      ) : null}
    </ReferenceSection>
  );
});

export const VibeReferenceCard = memo(function VibeReferenceCard() {
  const references = useGenerationStore((state) => state.vibeReferences);
  const normalize = useGenerationStore((state) => state.normalizeVibeStrengths);
  const { busy, pickImage } = useReferenceUpload("vibe");
  const state = useGenerationStore.getState;
  return <ReferenceSection group title="Vibe Transfer" description="이미지를 바꾸되 분위기는 유지합니다." icon="copy-outline" count={references.length} activeCount={references.filter((reference) => reference.enabled).length} limit={MAX_VIBE_REFERENCES} busy={busy} onAdd={() => void pickImage()}>
    {references.length > 0 ? <Pressable accessibilityRole="checkbox" accessibilityLabel="Normalize Reference Strength Values" accessibilityState={{ checked: normalize }} onPress={() => state().setNormalizeVibeStrengths(!normalize)} style={styles.normalize}>
      <Ionicons name={normalize ? "checkbox" : "square-outline"} size={24} color={normalize ? tokens.color.accent : tokens.color.textMuted} />
      <Text style={styles.normalizeLabel}>Normalize Reference Strength Values</Text>
    </Pressable> : null}
    {references.map((reference, index) => {
      const cached = canUseCachedVibeEncoding(reference);
      return <ReferenceItem key={reference.id} name={`Vibe ${index + 1}`} uri={resolveVibeReferenceThumbnailUri(reference) ?? resolveVibeReferenceImageUri(reference)} enabled={reference.enabled}
        cost={!reference.enabled ? "Off" : cached ? "Cached" : "2 Anlas"}
        onToggle={(value) => state().setVibeReferenceEnabled(reference.id, value)} onRemove={() => void state().removeVibeReference(reference.id)}
        note={cached ? "현재 Information Extracted 값의 인코딩 캐시를 사용합니다." : reference.enabled ? "인코딩이 필요합니다. 다음 생성에서 2 Anlas가 사용됩니다." : "활성화한 다음 생성에서 Vibe 인코딩에 2 Anlas가 사용됩니다."}>
        <ReferenceSlider label="Information Extracted" value={reference.informationExtracted} min={0.01} max={1} step={0.01} precision={2} onChange={(value) => state().setVibeReferenceInformationExtracted(reference.id, value)} />
        <ReferenceSlider label="Reference Strength" value={reference.strength} min={0.01} max={1} step={0.01} precision={2} onChange={(value) => state().setVibeReferenceStrength(reference.id, value)} />
      </ReferenceItem>;
    })}
  </ReferenceSection>;
});

export const PreciseReferenceCard = memo(function PreciseReferenceCard({ active }: { active: boolean }) {
  const references = useGenerationStore((state) => state.preciseReferences);
  const { busy, pickImage } = useReferenceUpload("precise");
  const [openModeId, setOpenModeId] = useState<string | null>(null);
  useEffect(() => { if (!active) setOpenModeId(null); }, [active]);
  const state = useGenerationStore.getState;
  return <ReferenceSection group title="Precise Reference" description="캐릭터나 스타일의 참조 이미지를 추가합니다." icon="albums-outline" count={references.length} activeCount={references.filter((reference) => reference.enabled).length} limit={MAX_PRECISE_REFERENCES} busy={busy} onAdd={() => void pickImage()}>
    {references.map((reference, index) => <ReferenceItem key={reference.id} first={index === 0} name={`Precise ${index + 1}`} uri={resolvePreciseReferenceThumbnailUri(reference) ?? resolvePreciseReferenceImageUri(reference)} enabled={reference.enabled}
      cost={reference.enabled ? "5 Anlas" : "Off"} onToggle={(value) => state().setPreciseReferenceEnabled(reference.id, value)} onRemove={() => void state().removePreciseReference(reference.id)}>
      <SheetSelect accessibilityLabel={`Precise ${index + 1} Mode`} value={MODES.find((mode) => mode.value === reference.referenceType)!.label} options={MODE_LABELS}
        open={active && openModeId === reference.id} onOpenChange={(open) => setOpenModeId(open ? reference.id : null)}
        onChange={(label) => { const mode = MODES.find((item) => item.label === label); if (mode) state().setPreciseReferenceType(reference.id, mode.value); }} />
      <ReferenceSlider label="Strength" value={reference.strength} min={0} max={1} step={0.05} precision={2} onChange={(value) => state().setPreciseReferenceStrength(reference.id, value)} />
      <ReferenceSlider label="Fidelity" value={reference.fidelity} min={0} max={1} step={0.05} precision={2} onChange={(value) => state().setPreciseReferenceFidelity(reference.id, value)} />
    </ReferenceItem>)}
  </ReferenceSection>;
});

export const ReferenceImagesSheetContent = memo(function ReferenceImagesSheetContent({ active }: { active: boolean }) {
  const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
  return (
    <BottomSheetKeyboardAwareScrollView
      active={active}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: sheetContentPaddingBottom },
      ]}
      mode={Platform.OS === "android" ? "layout" : "insets"}
      removeClippedSubviews={false}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <ImageToImageReferenceCard />
      <VibeReferenceCard />
      <PreciseReferenceCard active={active} />
    </BottomSheetKeyboardAwareScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  sliderBlock: { gap: 7 },
  sliderLabel: { color: tokens.color.textTertiary, fontFamily: tokens.font.semibold, fontSize: 13 },
  content: { padding: 14, gap: 12 },
  card: { borderWidth: 1, borderColor: tokens.color.promptBorder, borderRadius: 16, backgroundColor: "#100F13", overflow: "hidden" },
  header: { minHeight: 40, paddingLeft: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: tokens.color.raised },
  emptyCard: { backgroundColor: tokens.color.card },
  emptyHeader: { paddingVertical: 8, paddingRight: 12, backgroundColor: tokens.color.card },
  groupHeaderFilled: { borderBottomWidth: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  groupHeaderEmpty: { borderBottomWidth: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  groupHeaderFrame: { overflow: "visible" },
  groupHeaderSurface: { backgroundColor: "transparent" },
  groupHeaderRow: { paddingVertical: 2, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  clipped: { overflow: "hidden" },
  measuredContent: { position: "absolute", top: 0, left: 0, right: 0 },
  groupCount: { color: tokens.color.textMuted, fontFamily: tokens.font.regular, fontSize: 14 },
  addButton: { width: 42, height: 42, borderLeftWidth: 0, borderRadius: 12, backgroundColor: tokens.color.raised },
  compactIconButton: { height: 28 },
  borderlessIconButton: { borderLeftWidth: 0 },
  headerIcon: { marginRight: 2 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: tokens.color.textPrimary, fontFamily: tokens.font.semibold, fontSize: 15 },
  description: { marginTop: 1, color: tokens.color.textTertiary, fontFamily: tokens.font.regular, fontSize: 13, lineHeight: 19 },
  iconButton: { width: 40, height: 40, flexShrink: 0, borderLeftWidth: 1, borderLeftColor: tokens.color.promptBorder, alignItems: "center", justifyContent: "center" },
  dimmed: { opacity: 0.5 },
  item: { padding: 14, borderTopWidth: 1, borderTopColor: tokens.color.promptBorder },
  firstItem: { borderTopWidth: 0 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 13 },
  thumbnailColumn: { width: 88, gap: 8 },
  thumbnail: { width: 88, height: 112, borderWidth: 1, borderColor: tokens.color.promptBorder, borderRadius: 10, backgroundColor: tokens.color.sunken },
  imageActions: { flexDirection: "row", gap: 4 },
  enableButton: { width: 40, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  enabled: { backgroundColor: tokens.color.toast },
  controls: { flex: 1, minWidth: 0, gap: 12 },
  itemHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flex: 1, color: tokens.color.textPrimary, fontFamily: tokens.font.semibold, fontSize: 15 },
  cost: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: tokens.color.card, color: tokens.color.textTertiary, fontFamily: tokens.font.semibold, fontSize: 12 },
  note: { marginTop: 12, color: tokens.color.textMuted, fontFamily: tokens.font.regular, fontSize: 12, lineHeight: 18 },
  normalize: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  normalizeLabel: { flex: 1, color: tokens.color.textTertiary, fontFamily: tokens.font.medium, fontSize: 14, lineHeight: 21 },
});
