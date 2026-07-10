import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

import {
  MODELS,
  NOISE_SCHEDULES,
  SAMPLERS,
  type NoiseSchedule,
} from "../../constants/generation";
import {
  getI2IEffectiveResolution,
  useGenerationStore,
} from "../../store/generationStore";
import {
  MAX_VIBE_REFERENCES,
  resolveVibeReferenceImageUri,
  resolveVibeReferenceThumbnailUri,
  type VibeReference,
} from "../../lib/vibeReferences";
import {
  MAX_PRECISE_REFERENCES,
  resolvePreciseReferenceImageUri,
  resolvePreciseReferenceThumbnailUri,
  type PreciseReference,
  type PreciseReferenceType,
} from "../../lib/preciseReferences";
import { useSetOptionDetailHeader } from "../optionDetailHeader";
import { formatDecimal, triggerSelectionHaptic } from "../option/helpers";
import { light, styles } from "./styles";
import { SheetItem } from "./primitives";
import { useScalePress } from "./useScalePress";
import { NumericSheetContent } from "./NumericSheet";
import { CustomSlider } from "./CustomSlider";
import { SeedSheetContent } from "./SeedSheet";
import { ResolutionSheetContent } from "./ResolutionSheet";
import { ImageUploadSheet } from "./ImageUploadSheet";
import { CFG_CONFIG, CFG_RESCALE_CONFIG, STEPS_CONFIG } from "./constants";

export type OptionRoute =
  | "menu"
  | "model"
  | "sampler"
  | "schedule"
  | "steps"
  | "cfg"
  | "cfgRescale"
  | "parameters"
  | "seed"
  | "resolution"
  | "batchCount"
  | "metadata"
  | "i2i"
  | "vibe"
  | "precise";

const IMAGE_PREVIEW_FRAME_ASPECT = 1.58;
// 캐릭터 프롬프트 카드와 동일한 펼침/접힘 애니메이션. 카드 높이 변화 시
// 아래 형제 카드들이 layout 으로 자연스럽게 밀려남.
const REF_LAYOUT = LinearTransition.duration(240).easing(
  Easing.out(Easing.cubic),
);
const REF_BODY_ENTERING = FadeIn.duration(140);
const REF_BODY_EXITING = FadeOut.duration(100);
export const DETAIL_TITLES: Partial<Record<OptionRoute, string>> = {
  model: "Model",
  sampler: "Sampler",
  schedule: "Noise Schedule",
  steps: "Steps",
  cfg: "CFG Scale",
  cfgRescale: "CFG Rescale",
  parameters: "Parameters",
  seed: "Seed",
  resolution: "Resolution",
  batchCount: "Batch Count",
  metadata: "Metadata Extract",
  i2i: "Image2Image",
  vibe: "Vibe Transfer",
  precise: "Precise Ref",
};

const I2I_STRENGTH_CONFIG = {
  title: "Strength",
  unit: "strength",
  min: 0.01,
  max: 0.99,
  step: 0.01,
  precision: 2,
};

const I2I_NOISE_CONFIG = {
  title: "Noise",
  unit: "noise",
  min: 0,
  max: 0.99,
  step: 0.01,
  precision: 2,
};

const VIBE_STRENGTH_CONFIG = {
  title: "Reference Strength",
  min: 0,
  max: 1,
  step: 0.01,
  precision: 2,
};

const VIBE_INFORMATION_CONFIG = {
  title: "Information Extracted",
  min: 0,
  max: 1,
  step: 0.01,
  precision: 2,
};

const PRECISE_STRENGTH_CONFIG = {
  title: "Reference Strength",
  min: 0,
  max: 1,
  step: 0.01,
  precision: 2,
};

const PRECISE_FIDELITY_CONFIG = {
  title: "Fidelity",
  min: 0,
  max: 1,
  step: 0.01,
  precision: 2,
};

const PRECISE_REFERENCE_TYPES: Array<{
  label: string;
  value: PreciseReferenceType;
}> = [
  { label: "Character", value: "character" },
  { label: "Style", value: "style" },
  { label: "Both", value: "character&style" },
];

// --- 상세 라우트 본문 (각자 자기 슬라이스만 구독) ---

function ModelSheet({
  onClose,
  showTitle = true,
}: {
  onClose: () => void;
  showTitle?: boolean;
}) {
  const model = useGenerationStore((s) => s.model);
  const setModel = useGenerationStore((s) => s.setModel);
  return (
    <>
      {showTitle ? <Text style={styles.sheetTitle}>Model</Text> : null}
      <Text style={styles.sheetSectionDescription}>
        이미지를 생성할 AI 모델을 선택합니다. 모델마다 화풍과 표현 범위, 학습된 데이터가 다릅니다.
      </Text>
      {MODELS.flatMap((item, index) => {
        const el = (
          <SheetItem
            key={item.value}
            item={item}
            isActive={model === item.value}
            recommendedValue="nai-diffusion-4-5-full"
            onPress={() => {
              setModel(item.value);
              onClose();
            }}
          />
        );
        return index === 1
          ? [el, <View key="model-divider" style={styles.sheetDivider} />]
          : [el];
      })}
    </>
  );
}

function SamplerSheet({
  onClose,
  showTitle = true,
}: {
  onClose: () => void;
  showTitle?: boolean;
}) {
  const sampler = useGenerationStore((s) => s.sampler);
  const setSampler = useGenerationStore((s) => s.setSampler);
  return (
    <>
      {showTitle ? <Text style={styles.sheetTitle}>Sampler</Text> : null}
      <Text style={styles.sheetSectionDescription}>
        노이즈를 제거해 이미지를 완성하는 알고리즘을 선택합니다. 종류에 따라 속도와 결과물의 느낌이 달라집니다.
      </Text>
      {SAMPLERS.flatMap((item, index) => {
        const el = (
          <SheetItem
            key={item.value}
            item={item}
            isActive={sampler === item.value}
            recommendedValue="k_euler_ancestral"
            onPress={() => {
              setSampler(item.value);
              onClose();
            }}
          />
        );
        return index === 5
          ? [el, <View key="sampler-divider" style={styles.sheetDivider} />]
          : [el];
      })}
    </>
  );
}

function ScheduleSheet({
  onClose,
  showTitle = true,
}: {
  onClose: () => void;
  showTitle?: boolean;
}) {
  const noiseSchedule = useGenerationStore((s) => s.noiseSchedule);
  const setNoiseSchedule = useGenerationStore((s) => s.setNoiseSchedule);
  return (
    <>
      {showTitle ? <Text style={styles.sheetTitle}>Noise Schedule</Text> : null}
      <Text style={styles.sheetSectionDescription}>
        생성 과정에서 스텝마다 노이즈를 얼마나, 어떻게 제거할지 정합니다. 디테일과 결과의 안정감이 달라집니다.
      </Text>
      {NOISE_SCHEDULES.flatMap((item, index) => {
        const el = (
          <SheetItem
            key={item.value}
            item={item}
            isActive={noiseSchedule === item.value}
            recommendedValue="karras"
            onPress={() => {
              setNoiseSchedule(item.value as NoiseSchedule);
              onClose();
            }}
          />
        );
        return index === 2
          ? [el, <View key="schedule-divider" style={styles.sheetDivider} />]
          : [el];
      })}
    </>
  );
}

function StepsSheet() {
  const steps = useGenerationStore((s) => s.steps);
  const setSteps = useGenerationStore((s) => s.setSteps);
  return (
    <NumericSheetContent
      value={steps}
      onChange={setSteps}
      cfg={STEPS_CONFIG}
      showTitle={false}
    />
  );
}

function CfgSheet() {
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  const setPromptGuidance = useGenerationStore((s) => s.setPromptGuidance);
  return (
    <NumericSheetContent
      value={promptGuidance}
      onChange={setPromptGuidance}
      cfg={CFG_CONFIG}
      showTitle={false}
    />
  );
}

function CfgRescaleSheet() {
  const promptGuidanceRescale = useGenerationStore(
    (s) => s.promptGuidanceRescale,
  );
  const setPromptGuidanceRescale = useGenerationStore(
    (s) => s.setPromptGuidanceRescale,
  );
  return (
    <NumericSheetContent
      value={promptGuidanceRescale}
      onChange={setPromptGuidanceRescale}
      cfg={CFG_RESCALE_CONFIG}
      showTitle={false}
    />
  );
}

function ParametersSheet() {
  const steps = useGenerationStore((s) => s.steps);
  const setSteps = useGenerationStore((s) => s.setSteps);
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  const setPromptGuidance = useGenerationStore((s) => s.setPromptGuidance);
  const promptGuidanceRescale = useGenerationStore(
    (s) => s.promptGuidanceRescale,
  );
  const setPromptGuidanceRescale = useGenerationStore(
    (s) => s.setPromptGuidanceRescale,
  );
  return (
    <View style={styles.sheetCardGroup}>
      <View style={[styles.sheetCard, styles.sheetCardTop, paramStyles.block]}>
        <NumericSheetContent
          value={steps}
          onChange={setSteps}
          cfg={STEPS_CONFIG}
          compact
        />
      </View>
      <View style={[styles.sheetCard, styles.sheetCardMiddle, paramStyles.block]}>
        <NumericSheetContent
          value={promptGuidance}
          onChange={setPromptGuidance}
          cfg={CFG_CONFIG}
          compact
        />
      </View>
      <View style={[styles.sheetCard, styles.sheetCardBottom, paramStyles.block]}>
        <NumericSheetContent
          value={promptGuidanceRescale}
          onChange={setPromptGuidanceRescale}
          cfg={CFG_RESCALE_CONFIG}
          compact
        />
      </View>
    </View>
  );
}

function SeedSheet() {
  const seed = useGenerationStore((s) => s.seed);
  const setSeed = useGenerationStore((s) => s.setSeed);
  const seedLocked = useGenerationStore((s) => s.seedLocked);
  const setSeedLocked = useGenerationStore((s) => s.setSeedLocked);
  return (
    <SeedSheetContent
      seed={seed}
      locked={seedLocked}
      onChangeSeed={setSeed}
      onToggleLock={() => setSeedLocked(!seedLocked)}
      showTitle={false}
    />
  );
}

function ResolutionSheet({ onClose }: { onClose: () => void }) {
  const resolution = useGenerationStore((s) => s.resolution);
  const setResolution = useGenerationStore((s) => s.setResolution);
  return (
    <ResolutionSheetContent
      resolution={resolution}
      onChange={setResolution}
      onClose={onClose}
      showTitle={false}
    />
  );
}

function I2ISheet() {
  const sourceImage = useGenerationStore((s) => s.i2iSourceImage);
  const setSourceImage = useGenerationStore((s) => s.setI2ISourceImage);
  const strength = useGenerationStore((s) => s.i2iStrength);
  const setStrength = useGenerationStore((s) => s.setI2IStrength);
  const noise = useGenerationStore((s) => s.i2iNoise);
  const setNoise = useGenerationStore((s) => s.setI2INoise);
  const clearI2I = useGenerationStore((s) => s.clearI2I);
  const setMessage = useGenerationStore((s) => s.setMessage);
  const [busy, setBusy] = useState(false);

  const effectiveResolution = sourceImage
    ? getI2IEffectiveResolution(sourceImage)
    : null;

  async function handlePick() {
    if (busy) return;
    try {
      setBusy(true);
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      setSourceImage({
        uri: asset.uri,
        width: asset.width || 64,
        height: asset.height || 64,
      });
    } catch {
      setMessage("I2I 이미지를 선택하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {sourceImage ? (
        <View
          style={[
            i2iStyles.previewCard,
            { aspectRatio: IMAGE_PREVIEW_FRAME_ASPECT },
          ]}
        >
          <ExpoImage
            source={{ uri: sourceImage.uri }}
            contentFit="contain"
            contentPosition="center"
            transition={120}
            style={i2iStyles.previewImage}
          />
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={busy}
          onPress={handlePick}
          style={i2iStyles.uploadCard}
        >
          {busy ? (
            <ActivityIndicator color={light.textSecondary} />
          ) : (
            <>
              <Ionicons
                name="image-outline"
                size={28}
                color={light.textSecondary}
              />
              <Text style={i2iStyles.uploadText}>이미지 선택</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {sourceImage ? (
        <>
          <View style={i2iStyles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={handlePick}
              style={i2iStyles.secondaryButton}
            >
              {busy ? (
                <ActivityIndicator size="small" color={light.textSecondary} />
              ) : (
                <>
                  <Ionicons
                    name="refresh"
                    size={15}
                    color={light.textSecondary}
                  />
                  <Text style={i2iStyles.secondaryButtonText}>다시 선택</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.72}
              onPress={() => {
                triggerSelectionHaptic();
                clearI2I();
              }}
              style={i2iStyles.secondaryButton}
            >
              <Ionicons name="close" size={15} color={light.textSecondary} />
              <Text style={i2iStyles.secondaryButtonText}>끄기</Text>
            </TouchableOpacity>
          </View>
          {effectiveResolution ? (
            <Text style={i2iStyles.sizeText}>
              {effectiveResolution.width}x{effectiveResolution.height}
            </Text>
          ) : null}
          <NumericSheetContent
            value={strength}
            onChange={setStrength}
            cfg={I2I_STRENGTH_CONFIG}
          />
          <NumericSheetContent
            value={noise}
            onChange={setNoise}
            cfg={I2I_NOISE_CONFIG}
          />
        </>
      ) : null}
    </>
  );
}

function formatVibeValue(value: number) {
  return formatDecimal(value, 2);
}

function shortVibeId(id: string) {
  return id.replace(/^vibe_/, "").slice(-8);
}

function VibeCompactSlider({
  label,
  value,
  onChange,
  config,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  config: typeof VIBE_STRENGTH_CONFIG;
}) {
  return (
    <View style={vibeStyles.sliderBlock}>
      <View style={vibeStyles.sliderHeader}>
        <Text style={vibeStyles.sliderLabel}>{label}</Text>
        <Text style={vibeStyles.sliderValue}>{formatVibeValue(value)}</Text>
      </View>
      <CustomSlider
        style={vibeStyles.slider}
        value={value}
        min={config.min}
        max={config.max}
        step={config.step}
        precision={config.precision}
        trackHeight={5}
        thumbSize={20}
        trackBg={light.input}
        pill
        onSlidingComplete={onChange}
      />
    </View>
  );
}

function VibeReferenceCard({
  reference,
  expanded,
  busy,
  onToggleExpanded,
  onToggleEnabled,
  onStrengthChange,
  onInformationChange,
  onReplace,
  onRemove,
}: {
  reference: VibeReference;
  expanded: boolean;
  busy: boolean;
  onToggleExpanded: () => void;
  onToggleEnabled: () => void;
  onStrengthChange: (v: number) => void;
  onInformationChange: (v: number) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const imageUri =
    resolveVibeReferenceThumbnailUri(reference) ??
    resolveVibeReferenceImageUri(reference);
  const encodingRequired =
    reference.encodedPath === null ||
    reference.encodedInformationExtracted !== reference.informationExtracted;

  return (
    <Reanimated.View layout={REF_LAYOUT} style={vibeStyles.card}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onToggleExpanded}
        style={vibeStyles.cardHeader}
      >
        <ExpoImage
          source={{ uri: imageUri }}
          contentFit="cover"
          transition={120}
          style={vibeStyles.thumbnail}
        />
        <View style={vibeStyles.cardText}>
          <Text style={vibeStyles.cardTitle} numberOfLines={1}>
            {shortVibeId(reference.id)}
          </Text>
          <Text style={vibeStyles.cardSubtitle} numberOfLines={1}>
            S {formatVibeValue(reference.strength)} · I{" "}
            {formatVibeValue(reference.informationExtracted)}
          </Text>
        </View>
        {encodingRequired ? (
          <View style={vibeStyles.costBadge}>
            <Text style={vibeStyles.costBadgeText}>2</Text>
            <Ionicons name="diamond" size={12} color={light.accent} />
          </View>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.72}
          onPress={onToggleEnabled}
          style={[
            vibeStyles.enabledButton,
            reference.enabled && vibeStyles.enabledButtonActive,
          ]}
        >
          <Ionicons
            name="checkmark"
            size={18}
            color={reference.enabled ? light.accentText : light.textHint}
          />
        </TouchableOpacity>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={light.textHint}
        />
      </TouchableOpacity>

      {expanded ? (
        <Reanimated.View
          entering={REF_BODY_ENTERING}
          exiting={REF_BODY_EXITING}
          layout={REF_LAYOUT}
          style={vibeStyles.expandedBody}
        >
          <View
            style={[
              vibeStyles.previewCard,
              { aspectRatio: IMAGE_PREVIEW_FRAME_ASPECT },
            ]}
          >
            <ExpoImage
              source={{ uri: resolveVibeReferenceImageUri(reference) }}
              contentFit="contain"
              contentPosition="center"
              transition={120}
              style={vibeStyles.previewImage}
            />
          </View>
          <VibeCompactSlider
            label={VIBE_STRENGTH_CONFIG.title}
            value={reference.strength}
            onChange={onStrengthChange}
            config={VIBE_STRENGTH_CONFIG}
          />
          <VibeCompactSlider
            label={VIBE_INFORMATION_CONFIG.title}
            value={reference.informationExtracted}
            onChange={onInformationChange}
            config={VIBE_INFORMATION_CONFIG}
          />
          {encodingRequired ? (
            <Text style={vibeStyles.encodingHint}>
              Encoding required. This will cost 2 Anlas on the next generation.
            </Text>
          ) : (
            <Text style={vibeStyles.encodingHint}>Encoded vibe cached.</Text>
          )}
          <View style={vibeStyles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={onReplace}
              style={vibeStyles.secondaryButton}
            >
              {busy ? (
                <ActivityIndicator size="small" color={light.textSecondary} />
              ) : (
                <Ionicons
                  name="refresh"
                  size={15}
                  color={light.textSecondary}
                />
              )}
              <Text style={vibeStyles.secondaryButtonText}>다시 선택</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={onRemove}
              style={vibeStyles.secondaryButton}
            >
              <Ionicons
                name="trash-outline"
                size={15}
                color={light.textSecondary}
              />
              <Text style={vibeStyles.secondaryButtonText}>삭제</Text>
            </TouchableOpacity>
          </View>
        </Reanimated.View>
      ) : null}
    </Reanimated.View>
  );
}

function ReferenceSummaryToggle({
  label,
  status,
  value,
  onToggle,
}: {
  label: string;
  status: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={vibeStyles.summaryRow}>
      <View style={vibeStyles.summaryCopy}>
        <Text style={vibeStyles.summaryLabel}>{label}</Text>
        <Text style={vibeStyles.summaryText}>{status}</Text>
      </View>
      <View style={vibeStyles.summaryAction}>
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          accessibilityLabel={label}
          onPress={onToggle}
        >
          <ToggleSwitch value={value} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function VibeSheet() {
  const references = useGenerationStore((s) => s.vibeReferences);
  const activePreciseCount = useGenerationStore(
    (s) => s.preciseReferences.filter((item) => item.enabled).length,
  );
  const normalize = useGenerationStore((s) => s.normalizeVibeStrengths);
  const setNormalize = useGenerationStore((s) => s.setNormalizeVibeStrengths);
  const addReference = useGenerationStore((s) => s.addVibeReference);
  const replaceReference = useGenerationStore((s) => s.replaceVibeReference);
  const removeReference = useGenerationStore((s) => s.removeVibeReference);
  const setEnabled = useGenerationStore((s) => s.setVibeReferenceEnabled);
  const setStrength = useGenerationStore((s) => s.setVibeReferenceStrength);
  const setInformation = useGenerationStore(
    (s) => s.setVibeReferenceInformationExtracted,
  );
  const setMessage = useGenerationStore((s) => s.setMessage);
  const expandedIds = useGenerationStore((s) => s.vibeReferenceExpandedIds);
  const setExpandedIds = useGenerationStore(
    (s) => s.setVibeReferenceExpandedIds,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function pickVibeImage(targetId?: string) {
    if (adding || busyId) return;
    try {
      if (targetId) {
        setBusyId(targetId);
      } else {
        setAdding(true);
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const input = {
        uri: asset.uri,
        width: asset.width || 64,
        height: asset.height || 64,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      };

      const reference = targetId
        ? await replaceReference(targetId, input)
        : await addReference(input);
      if (reference) {
        const current = useGenerationStore.getState().vibeReferenceExpandedIds;
        setExpandedIds(
          current.includes(reference.id) ? current : [...current, reference.id],
        );
      }
    } catch {
      setMessage("Vibe 이미지를 선택하지 못했습니다.");
    } finally {
      setAdding(false);
      setBusyId(null);
    }
  }

  const canAdd = references.length < MAX_VIBE_REFERENCES;
  const activeVibeCount = references.filter((item) => item.enabled).length;
  const vibeEnabled = activeVibeCount > 0;
  const vibeStatus =
    activePreciseCount > 0
      ? "Blocked by Precise Reference"
      : references.length > 0
        ? `${activeVibeCount}/${references.length} enabled`
        : "No references";

  function toggleVibeReferences() {
    triggerSelectionHaptic();
    if (vibeEnabled) {
      references.forEach(
        (reference) => reference.enabled && setEnabled(reference.id, false),
      );
      return;
    }

    if (references.length === 0) {
      setMessage("Add a Vibe image first.");
      return;
    }

    if (activePreciseCount > 0) {
      setMessage("Vibe Transfer cannot be used with Precise Reference.");
      return;
    }

    references.forEach((reference) => setEnabled(reference.id, true));
  }

  // 이미지 추가 버튼/카운트는 상세 헤더로 올린다.
  const setHeader = useSetOptionDetailHeader();
  useEffect(() => {
    setHeader({
      action: {
        label: "이미지 추가",
        onPress: () => void pickVibeImage(),
        disabled: !canAdd,
        busy: adding,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdd, adding]);

  return (
    <View style={vibeStyles.sheet}>
      <ReferenceSummaryToggle
        label="Vibe Transfer"
        status={vibeStatus}
        value={vibeEnabled}
        onToggle={toggleVibeReferences}
      />

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          triggerSelectionHaptic();
          setNormalize(!normalize);
        }}
        style={vibeStyles.normalizeRow}
      >
        <View
          style={[vibeStyles.checkbox, normalize && vibeStyles.checkboxActive]}
        >
          {normalize ? (
            <Ionicons name="checkmark" size={15} color={light.accentText} />
          ) : null}
        </View>
        <Text style={vibeStyles.normalizeText}>
          Normalize Reference Strength Values
        </Text>
      </TouchableOpacity>

      {references.length === 0 ? (
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={adding || !canAdd}
          onPress={() => void pickVibeImage()}
          style={vibeStyles.emptyCard}
        >
          <Ionicons
            name="images-outline"
            size={28}
            color={light.textSecondary}
          />
          <Text style={vibeStyles.emptyText}>
            Vibe로 사용할 이미지를 추가하세요.
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={vibeStyles.list}>
          {references.map((reference) => (
            <VibeReferenceCard
              key={reference.id}
              reference={reference}
              expanded={expandedIds.includes(reference.id)}
              busy={busyId === reference.id}
              onToggleExpanded={() => {
                const current =
                  useGenerationStore.getState().vibeReferenceExpandedIds;
                setExpandedIds(
                  current.includes(reference.id)
                    ? current.filter((value) => value !== reference.id)
                    : [...current, reference.id],
                );
              }}
              onToggleEnabled={() => {
                triggerSelectionHaptic();
                setEnabled(reference.id, !reference.enabled);
              }}
              onStrengthChange={(value) => setStrength(reference.id, value)}
              onInformationChange={(value) =>
                setInformation(reference.id, value)
              }
              onReplace={() => pickVibeImage(reference.id)}
              onRemove={() => {
                triggerSelectionHaptic();
                setExpandedIds(
                  useGenerationStore
                    .getState()
                    .vibeReferenceExpandedIds.filter(
                      (value) => value !== reference.id,
                    ),
                );
                void removeReference(reference.id);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function isPreciseReferenceSupportedModel(model: string) {
  return (
    model === "nai-diffusion-4-5-full" || model === "nai-diffusion-4-5-curated"
  );
}

function formatPreciseValue(value: number) {
  return formatDecimal(value, 2);
}

function shortPreciseId(id: string) {
  return id.replace(/^precise_/, "").slice(-8);
}

function getPreciseReferenceTypeLabel(value: PreciseReferenceType) {
  if (value === "character") return "Character";
  if (value === "style") return "Style";
  return "Character & Style";
}

function PreciseReferenceTypeSelector({
  value,
  onChange,
}: {
  value: PreciseReferenceType;
  onChange: (value: PreciseReferenceType) => void;
}) {
  return (
    <View style={vibeStyles.typeSelector}>
      {PRECISE_REFERENCE_TYPES.map((item) => {
        const active = item.value === value;
        return (
          <TouchableOpacity
            key={item.value}
            activeOpacity={0.78}
            onPress={() => {
              triggerSelectionHaptic();
              onChange(item.value);
            }}
            style={[
              vibeStyles.typeButton,
              active && vibeStyles.typeButtonActive,
            ]}
          >
            <Text
              style={[
                vibeStyles.typeButtonText,
                active && vibeStyles.typeButtonTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PreciseReferenceCard({
  reference,
  expanded,
  busy,
  enableBlocked,
  onToggleExpanded,
  onToggleEnabled,
  onStrengthChange,
  onFidelityChange,
  onTypeChange,
  onReplace,
  onRemove,
}: {
  reference: PreciseReference;
  expanded: boolean;
  busy: boolean;
  enableBlocked: boolean;
  onToggleExpanded: () => void;
  onToggleEnabled: () => void;
  onStrengthChange: (v: number) => void;
  onFidelityChange: (v: number) => void;
  onTypeChange: (v: PreciseReferenceType) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const imageUri =
    resolvePreciseReferenceThumbnailUri(reference) ??
    resolvePreciseReferenceImageUri(reference);
  const toggleDisabled = !reference.enabled && enableBlocked;

  return (
    <Reanimated.View layout={REF_LAYOUT} style={vibeStyles.card}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onToggleExpanded}
        style={vibeStyles.cardHeader}
      >
        <ExpoImage
          source={{ uri: imageUri }}
          contentFit="cover"
          transition={120}
          style={vibeStyles.thumbnail}
        />
        <View style={vibeStyles.cardText}>
          <Text style={vibeStyles.cardTitle} numberOfLines={1}>
            {shortPreciseId(reference.id)}
          </Text>
          <Text style={vibeStyles.cardSubtitle} numberOfLines={1}>
            {getPreciseReferenceTypeLabel(reference.referenceType)} · S{" "}
            {formatPreciseValue(reference.strength)} · F{" "}
            {formatPreciseValue(reference.fidelity)}
          </Text>
        </View>
        {reference.enabled ? (
          <View style={vibeStyles.costBadge}>
            <Text style={vibeStyles.costBadgeText}>5</Text>
            <Ionicons name="diamond" size={12} color={light.accent} />
          </View>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.72}
          disabled={toggleDisabled}
          onPress={onToggleEnabled}
          style={[
            vibeStyles.enabledButton,
            reference.enabled && vibeStyles.enabledButtonActive,
            toggleDisabled && vibeStyles.disabledControl,
          ]}
        >
          <Ionicons
            name="checkmark"
            size={18}
            color={reference.enabled ? light.accentText : light.textHint}
          />
        </TouchableOpacity>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={light.textHint}
        />
      </TouchableOpacity>

      {expanded ? (
        <Reanimated.View
          entering={REF_BODY_ENTERING}
          exiting={REF_BODY_EXITING}
          layout={REF_LAYOUT}
          style={vibeStyles.expandedBody}
        >
          <View
            style={[
              vibeStyles.previewCard,
              { aspectRatio: IMAGE_PREVIEW_FRAME_ASPECT },
            ]}
          >
            <ExpoImage
              source={{ uri: resolvePreciseReferenceImageUri(reference) }}
              contentFit="contain"
              contentPosition="center"
              transition={120}
              style={vibeStyles.previewImage}
            />
          </View>
          <VibeCompactSlider
            label={PRECISE_STRENGTH_CONFIG.title}
            value={reference.strength}
            onChange={onStrengthChange}
            config={PRECISE_STRENGTH_CONFIG}
          />
          <VibeCompactSlider
            label={PRECISE_FIDELITY_CONFIG.title}
            value={reference.fidelity}
            onChange={onFidelityChange}
            config={PRECISE_FIDELITY_CONFIG}
          />
          <PreciseReferenceTypeSelector
            value={reference.referenceType}
            onChange={onTypeChange}
          />
          {reference.enabled ? (
            <Text style={vibeStyles.encodingHint}>
              Enabled references cost 5 Anlas per generation.
            </Text>
          ) : null}
          <View style={vibeStyles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={onReplace}
              style={vibeStyles.secondaryButton}
            >
              {busy ? (
                <ActivityIndicator size="small" color={light.textSecondary} />
              ) : (
                <Ionicons
                  name="refresh"
                  size={15}
                  color={light.textSecondary}
                />
              )}
              <Text style={vibeStyles.secondaryButtonText}>다시 선택</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={onRemove}
              style={vibeStyles.secondaryButton}
            >
              <Ionicons
                name="trash-outline"
                size={15}
                color={light.textSecondary}
              />
              <Text style={vibeStyles.secondaryButtonText}>삭제</Text>
            </TouchableOpacity>
          </View>
        </Reanimated.View>
      ) : null}
    </Reanimated.View>
  );
}

function PreciseReferenceSheet() {
  const references = useGenerationStore((s) => s.preciseReferences);
  const model = useGenerationStore((s) => s.model);
  const activeVibeCount = useGenerationStore(
    (s) => s.vibeReferences.filter((item) => item.enabled).length,
  );
  const addReference = useGenerationStore((s) => s.addPreciseReference);
  const replaceReference = useGenerationStore((s) => s.replacePreciseReference);
  const removeReference = useGenerationStore((s) => s.removePreciseReference);
  const setEnabled = useGenerationStore((s) => s.setPreciseReferenceEnabled);
  const setStrength = useGenerationStore((s) => s.setPreciseReferenceStrength);
  const setFidelity = useGenerationStore((s) => s.setPreciseReferenceFidelity);
  const setType = useGenerationStore((s) => s.setPreciseReferenceType);
  const setMessage = useGenerationStore((s) => s.setMessage);
  const expandedIds = useGenerationStore((s) => s.preciseReferenceExpandedIds);
  const setExpandedIds = useGenerationStore(
    (s) => s.setPreciseReferenceExpandedIds,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const modelSupported = isPreciseReferenceSupportedModel(model);
  const blockedByVibe = activeVibeCount > 0;
  const activePreciseCount = references.filter((item) => item.enabled).length;
  const preciseEnabled = activePreciseCount > 0;
  const preciseStatus = preciseEnabled
    ? `${activePreciseCount}/${references.length} enabled`
    : !modelSupported
      ? "Requires V4.5 model"
      : blockedByVibe
        ? "Blocked by Vibe Transfer"
        : references.length > 0
          ? `0/${references.length} enabled`
          : "No references";

  async function pickPreciseImage(targetId?: string) {
    if (adding || busyId) return;
    if (!targetId && !modelSupported) {
      setMessage("Precise Reference는 V4.5 모델에서 사용할 수 있습니다.");
      return;
    }
    if (!targetId && blockedByVibe) {
      setMessage(
        "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      );
      return;
    }

    try {
      if (targetId) {
        setBusyId(targetId);
      } else {
        setAdding(true);
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const input = {
        uri: asset.uri,
        width: asset.width || 64,
        height: asset.height || 64,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      };

      const reference = targetId
        ? await replaceReference(targetId, input)
        : await addReference(input);
      if (reference) {
        const current =
          useGenerationStore.getState().preciseReferenceExpandedIds;
        setExpandedIds(
          current.includes(reference.id) ? current : [...current, reference.id],
        );
      }
    } catch {
      setMessage("Precise Reference 이미지를 선택하지 못했습니다.");
    } finally {
      setAdding(false);
      setBusyId(null);
    }
  }

  const canAdd =
    references.length < MAX_PRECISE_REFERENCES &&
    modelSupported &&
    !blockedByVibe;

  function togglePreciseReferences() {
    triggerSelectionHaptic();
    if (preciseEnabled) {
      references.forEach(
        (reference) => reference.enabled && setEnabled(reference.id, false),
      );
      return;
    }

    if (references.length === 0) {
      setMessage("Add a Precise Reference image first.");
      return;
    }

    if (!modelSupported) {
      setMessage("Precise Reference requires a V4.5 model.");
      return;
    }

    if (blockedByVibe) {
      setMessage("Precise Reference cannot be used with Vibe Transfer.");
      return;
    }

    references.forEach((reference) => setEnabled(reference.id, true));
  }

  // 이미지 추가 버튼/카운트는 상세 헤더로 올린다.
  const setHeader = useSetOptionDetailHeader();
  useEffect(() => {
    setHeader({
      action: {
        label: "이미지 추가",
        onPress: () => void pickPreciseImage(),
        disabled: !canAdd,
        busy: adding,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdd, adding]);

  return (
    <View style={vibeStyles.sheet}>
      <ReferenceSummaryToggle
        label="Precise Reference"
        status={preciseStatus}
        value={preciseEnabled}
        onToggle={togglePreciseReferences}
      />

      {!modelSupported ? (
        <Text style={vibeStyles.encodingHint}>
          Precise Reference는 V4.5 모델에서 사용할 수 있습니다.
        </Text>
      ) : null}
      {blockedByVibe ? (
        <Text style={vibeStyles.encodingHint}>
          Vibe Transfer와 함께 사용할 수 없습니다.
        </Text>
      ) : null}

      {references.length === 0 ? (
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={adding || !canAdd}
          onPress={() => void pickPreciseImage()}
          style={[vibeStyles.emptyCard, !canAdd && vibeStyles.disabledControl]}
        >
          <Ionicons
            name="person-outline"
            size={28}
            color={light.textSecondary}
          />
          <Text style={vibeStyles.emptyText}>
            Precise Reference로 사용할 이미지를 추가하세요.
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={vibeStyles.list}>
          {references.map((reference) => (
            <PreciseReferenceCard
              key={reference.id}
              reference={reference}
              expanded={expandedIds.includes(reference.id)}
              busy={busyId === reference.id}
              enableBlocked={blockedByVibe || !modelSupported}
              onToggleExpanded={() => {
                const current =
                  useGenerationStore.getState().preciseReferenceExpandedIds;
                setExpandedIds(
                  current.includes(reference.id)
                    ? current.filter((value) => value !== reference.id)
                    : [...current, reference.id],
                );
              }}
              onToggleEnabled={() => {
                triggerSelectionHaptic();
                setEnabled(reference.id, !reference.enabled);
              }}
              onStrengthChange={(value) => setStrength(reference.id, value)}
              onFidelityChange={(value) => setFidelity(reference.id, value)}
              onTypeChange={(value) => setType(reference.id, value)}
              onReplace={() => pickPreciseImage(reference.id)}
              onRemove={() => {
                triggerSelectionHaptic();
                setExpandedIds(
                  useGenerationStore
                    .getState()
                    .preciseReferenceExpandedIds.filter(
                      (value) => value !== reference.id,
                    ),
                );
                void removeReference(reference.id);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// --- 루트 메뉴 ---

function ToggleSwitch({ value }: { value: boolean }) {
  const progress = useDerivedValue(() =>
    withTiming(value ? 1 : 0, { duration: 180 }),
  );
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [light.surfaceAlt, light.accent],
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["#FFFFFF", light.accentText],
    ),
  }));
  return (
    <Reanimated.View style={[styles.toggleTrack, trackStyle]}>
      <Reanimated.View style={[styles.toggleThumb, thumbStyle]} />
    </Reanimated.View>
  );
}

function MenuRow({
  icon,
  label,
  value,
  active,
  disabled,
  isToggle,
  rightToggle,
  toggleOn,
  onToggle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  active?: boolean;
  disabled?: boolean;
  isToggle?: boolean;
  rightToggle?: boolean;
  toggleOn?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
}) {
  const { progress, onPressIn, onPressOut, scaleStyle } = useScalePress({
    scaleTo: 0.98,
  });
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(0,0,0,0)", light.surfaceAlt],
    ),
  }));

  return (
    <TouchableOpacity
      activeOpacity={1}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <View style={styles.sheetMenuRow}>
        <Reanimated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, bgStyle]}
        />
        <Reanimated.View style={[styles.sheetMenuRowContent, scaleStyle]}>
          <View style={styles.sheetMenuLeft}>
            <View style={styles.sheetMenuIconBox}>
              <Ionicons name={icon} size={16} color={light.textSecondary} />
            </View>
            <Text
              style={[
                styles.sheetMenuLabel,
                disabled && styles.sheetMenuLabelDisabled,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
          <View style={styles.sheetMenuValueRow}>
            {isToggle ? (
              <ToggleSwitch value={!!active} />
            ) : (
              <>
                {value ? (
                  <Text
                    style={[
                      styles.sheetMenuValue,
                      active && styles.sheetMenuValueActive,
                    ]}
                    numberOfLines={1}
                  >
                    {value}
                  </Text>
                ) : null}
                {rightToggle ? (
                  <>
                    <View style={styles.sheetMenuToggleDivider} />
                    <TouchableOpacity
                      activeOpacity={0.7}
                      hitSlop={8}
                      onPress={onToggle}
                    >
                      <ToggleSwitch value={!!toggleOn} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={light.textHint}
                  />
                )}
              </>
            )}
          </View>
        </Reanimated.View>
      </View>
    </TouchableOpacity>
  );
}

function StackedMenuRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { progress, onPressIn, onPressOut, scaleStyle } = useScalePress({
    scaleTo: 0.98,
  });
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(0,0,0,0)", light.surfaceAlt],
    ),
  }));

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <View style={[styles.sheetMenuRow, paramStyles.row]}>
        <Reanimated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, bgStyle]}
        />
        <Reanimated.View style={[styles.sheetMenuRowContent, scaleStyle]}>
          <View style={styles.sheetMenuIconBox}>
            <Ionicons name={icon} size={21} color={light.textSecondary} />
          </View>
          <View style={paramStyles.rowText}>
            <Text style={styles.sheetMenuLabel}>{label}</Text>
            <Text style={paramStyles.rowSubtitle} numberOfLines={1}>
              {value}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={light.textHint} />
        </Reanimated.View>
      </View>
    </TouchableOpacity>
  );
}

function OptionsMenu({ onSelect }: { onSelect: (route: OptionRoute) => void }) {
  const model = useGenerationStore((s) => s.model);
  const resolution = useGenerationStore((s) => s.resolution);
  const seed = useGenerationStore((s) => s.seed);
  const seedLocked = useGenerationStore((s) => s.seedLocked);
  const sampler = useGenerationStore((s) => s.sampler);
  const noiseSchedule = useGenerationStore((s) => s.noiseSchedule);
  const varietyPlus = useGenerationStore((s) => s.varietyPlus);
  const setVarietyPlus = useGenerationStore((s) => s.setVarietyPlus);
  const i2iSourceImage = useGenerationStore((s) => s.i2iSourceImage);
  const activeVibeCount = useGenerationStore(
    (s) => s.vibeReferences.filter((item) => item.enabled).length,
  );
  const activePreciseCount = useGenerationStore(
    (s) => s.preciseReferences.filter((item) => item.enabled).length,
  );
  const clearI2I = useGenerationStore((s) => s.clearI2I);
  const vibeReferences = useGenerationStore((s) => s.vibeReferences);
  const setVibeReferenceEnabled = useGenerationStore(
    (s) => s.setVibeReferenceEnabled,
  );
  const preciseReferences = useGenerationStore((s) => s.preciseReferences);
  const setPreciseReferenceEnabled = useGenerationStore(
    (s) => s.setPreciseReferenceEnabled,
  );

  const modelText = MODELS.find((m) => m.value === model)?.label ?? model;
  const samplerText =
    SAMPLERS.find((s) => s.value === sampler)?.label ?? sampler;
  const scheduleText =
    NOISE_SCHEDULES.find((n) => n.value === noiseSchedule)?.label ??
    noiseSchedule;
  let seedText = `${seed}`;
  if (seed === 0) {
    seedText = "Random";
  } else if (seedLocked) {
    seedText = `${seed} Lock`;
  }

  return (
    <>
      <View style={styles.sheetCardGroup}>
        <View style={[styles.sheetCard, styles.sheetCardTop]}>
          <StackedMenuRow
            icon="cube-outline"
            label="Model"
            value={modelText}
            onPress={() => onSelect("model")}
          />
        </View>
        <View style={[styles.sheetCard, styles.sheetCardBottom]}>
          <StackedMenuRow
            icon="resize-outline"
            label="Resolution"
            value={`${resolution.width}x${resolution.height}`}
            onPress={() => onSelect("resolution")}
          />
        </View>
      </View>
      <View style={styles.sheetCardGroup}>
        <View style={styles.sheetCard}>
          <StackedMenuRow
            icon="dice-outline"
            label="Seed"
            value={seedText}
            onPress={() => onSelect("seed")}
          />
        </View>
      </View>

      <Text style={styles.sheetMenuGroupLabel}>Parameter Options</Text>
      <ParametersSheet />
      <View style={styles.sheetCardGroup}>
        <View style={[styles.sheetCard, styles.sheetCardTop]}>
          <StackedMenuRow
            icon="shuffle-outline"
            label="Sampler"
            value={samplerText}
            onPress={() => onSelect("sampler")}
          />
        </View>
        <View style={[styles.sheetCard, styles.sheetCardMiddle]}>
          <StackedMenuRow
            icon="pulse-outline"
            label="Schedule"
            value={scheduleText}
            onPress={() => onSelect("schedule")}
          />
        </View>
        <View style={[styles.sheetCard, styles.sheetCardBottom]}>
          <MenuRow
            icon="sparkles-outline"
            label="Variety+"
            active={varietyPlus}
            isToggle
            onPress={() => {
              triggerSelectionHaptic();
              setVarietyPlus(!varietyPlus);
            }}
          />
        </View>
      </View>

      <Text style={styles.sheetMenuGroupLabel}>Reference</Text>
      <View style={styles.sheetCardGroup}>
        <View style={[styles.sheetCard, styles.sheetCardTop]}>
          <MenuRow
            icon="scan-outline"
            label="Metadata Extract"
            onPress={() => onSelect("metadata")}
          />
        </View>
        <View style={[styles.sheetCard, styles.sheetCardMiddle]}>
          <MenuRow
            icon="image-outline"
            label="Image2Image"
            active={Boolean(i2iSourceImage)}
            rightToggle
            toggleOn={Boolean(i2iSourceImage)}
            onToggle={() => {
              triggerSelectionHaptic();
              if (i2iSourceImage) {
                clearI2I();
              } else {
                onSelect("i2i");
              }
            }}
            onPress={() => onSelect("i2i")}
          />
        </View>
        <View style={[styles.sheetCard, styles.sheetCardMiddle]}>
          <MenuRow
            icon="color-palette-outline"
            label="Vibe Transfer"
            value={activeVibeCount > 0 ? `${activeVibeCount}` : undefined}
            active={activeVibeCount > 0}
            rightToggle
            toggleOn={activeVibeCount > 0}
            onToggle={() => {
              triggerSelectionHaptic();
              if (activeVibeCount > 0) {
                vibeReferences.forEach(
                  (r) => r.enabled && setVibeReferenceEnabled(r.id, false),
                );
              } else if (vibeReferences.length > 0) {
                vibeReferences.forEach((r) =>
                  setVibeReferenceEnabled(r.id, true),
                );
              } else {
                onSelect("vibe");
              }
            }}
            onPress={() => onSelect("vibe")}
          />
        </View>
        <View style={[styles.sheetCard, styles.sheetCardBottom]}>
          <MenuRow
            icon="person-outline"
            label="Precise Ref"
            value={activePreciseCount > 0 ? `${activePreciseCount}` : undefined}
            active={activePreciseCount > 0}
            rightToggle
            toggleOn={activePreciseCount > 0}
            onToggle={() => {
              triggerSelectionHaptic();
              if (activePreciseCount > 0) {
                preciseReferences.forEach(
                  (r) => r.enabled && setPreciseReferenceEnabled(r.id, false),
                );
              } else if (preciseReferences.length > 0) {
                preciseReferences.forEach((r) =>
                  setPreciseReferenceEnabled(r.id, true),
                );
              } else {
                onSelect("precise");
              }
            }}
            onPress={() => onSelect("precise")}
          />
        </View>
      </View>
    </>
  );
}

// --- 라우트 본문 렌더 (호스트는 AppSheetContext) ---

// 옵션 라우트의 본문을 반환. 제목/헤더/스택/스크롤은 호스트(AppSheetContext)가 담당.
export function renderOptionRoute(
  route: OptionRoute,
  {
    back,
    close,
    push,
  }: {
    back: () => void;
    close: () => void;
    push: (route: OptionRoute) => void;
  },
) {
  switch (route) {
    case "menu":
      return <OptionsMenu onSelect={push} />;
    case "model":
      return <ModelSheet onClose={back} showTitle={false} />;
    case "sampler":
      return <SamplerSheet onClose={back} showTitle={false} />;
    case "schedule":
      return <ScheduleSheet onClose={back} showTitle={false} />;
    case "steps":
      return <StepsSheet />;
    case "cfg":
      return <CfgSheet />;
    case "cfgRescale":
      return <CfgRescaleSheet />;
    case "parameters":
      return <ParametersSheet />;
    case "seed":
      return <SeedSheet />;
    case "resolution":
      return <ResolutionSheet onClose={back} />;
    case "metadata":
      return <ImageUploadSheet onClose={close} showTitle={false} />;
    case "i2i":
      return <I2ISheet />;
    case "vibe":
      return <VibeSheet />;
    case "precise":
      return <PreciseReferenceSheet />;
    default:
      return null;
  }
}

const i2iStyles = StyleSheet.create({
  uploadCard: {
    height: 160,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: light.border,
    borderStyle: "dashed",
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: {
    color: light.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  previewCard: {
    width: "100%",
    minHeight: 150,
    borderRadius: 18,
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  secondaryButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: light.surface,
  },
  secondaryButtonText: {
    color: light.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  sizeText: {
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 8,
    color: light.textHint,
    fontSize: 13,
    fontWeight: "700",
  },
});

const paramStyles = StyleSheet.create({
  block: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  row: {
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowSubtitle: {
    color: light.textHint,
    fontSize: 13,
    fontWeight: "600",
  },
});

const vibeStyles = StyleSheet.create({
  sheet: {
    gap: 12,
  },
  summaryRow: {
    minHeight: 68,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: light.surface,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    color: light.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  summaryText: {
    marginTop: 4,
    color: light.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  summaryAction: {
    flexDirection: "row",
    alignItems: "center",
  },
  normalizeRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: light.textHint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    borderColor: light.accent,
    backgroundColor: light.accent,
  },
  normalizeText: {
    flex: 1,
    color: light.textSecondary,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyCard: {
    minHeight: 150,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: light.border,
    borderStyle: "dashed",
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    color: light.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    gap: 10,
  },
  card: {
    borderRadius: 18,
    backgroundColor: light.surface,
    overflow: "hidden",
  },
  cardHeader: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  thumbnail: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: light.input,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: light.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  cardSubtitle: {
    marginTop: 4,
    color: light.textHint,
    fontSize: 12,
    fontWeight: "700",
  },
  costBadge: {
    minWidth: 42,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 12,
    backgroundColor: light.input,
  },
  costBadgeText: {
    color: light.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  enabledButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.input,
  },
  enabledButtonActive: {
    backgroundColor: light.accent,
  },
  disabledControl: {
    opacity: 0.45,
  },
  expandedBody: {
    gap: 12,
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  previewCard: {
    width: "100%",
    minHeight: 140,
    borderRadius: 14,
    backgroundColor: light.input,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  sliderBlock: {
    gap: 4,
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sliderLabel: {
    color: light.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  sliderValue: {
    color: light.accent,
    fontSize: 14,
    fontWeight: "800",
  },
  slider: {
    width: "100%",
    height: 36,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 8,
  },
  typeButton: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: light.input,
  },
  typeButtonActive: {
    backgroundColor: light.accent,
  },
  typeButtonText: {
    color: light.textSecondary,
    fontSize: 13,
    fontWeight: "800",
  },
  typeButtonTextActive: {
    color: light.accentText,
  },
  encodingHint: {
    color: light.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: light.input,
  },
  secondaryButtonText: {
    color: light.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
});
