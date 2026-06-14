import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated as RNAnimated,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  TouchableOpacity as BottomSheetTouchableOpacity,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Reanimated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
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
import { formatDecimal, triggerSelectionHaptic } from "../option/helpers";
import { light, styles } from "./styles";
import { SheetItem } from "./primitives";
import { useScalePress } from "./useScalePress";
import { NumericSheetContent } from "./NumericSheet";
import { SeedSheetContent } from "./SeedSheet";
import { ResolutionSheetContent } from "./ResolutionSheet";
import { ImageUploadSheet } from "./ImageUploadSheet";
import {
  BATCH_COUNT_CONFIG,
  CFG_CONFIG,
  CFG_RESCALE_CONFIG,
  STEPS_CONFIG,
} from "./constants";

export type OptionRoute =
  | "menu"
  | "model"
  | "sampler"
  | "schedule"
  | "steps"
  | "cfg"
  | "cfgRescale"
  | "seed"
  | "resolution"
  | "batchCount"
  | "metadata"
  | "i2i"
  | "vibe"
  | "precise";

export type OptionsSheetHandle = {
  openAt: (route?: OptionRoute) => void;
  close: () => void;
};

// 고정 2포인트 — 라우트 전환 시 리사이즈 금지(과거 높이-측정 버그 회피).
type TransitionDirection = "forward" | "back";

const SNAP_POINTS = ["60%", "92%"];
const ROUTE_ENTER_FORWARD = SlideInRight.duration(140);
const ROUTE_ENTER_BACK = SlideInLeft.duration(140);
const ROUTE_FADE_IN = FadeIn.duration(100);
const IMAGE_PREVIEW_FRAME_ASPECT = 1.58;
const DETAIL_TITLES: Partial<Record<OptionRoute, string>> = {
  model: "Model",
  sampler: "Sampler",
  schedule: "Noise Schedule",
  steps: "Steps",
  cfg: "CFG Scale",
  cfgRescale: "CFG Rescale",
  seed: "Seed",
  resolution: "Resolution",
  batchCount: "Batch Count",
  metadata: "Metadata Extract",
  i2i: "I2I",
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
      {showTitle ? (
        <Text style={styles.sheetTitle}>Noise Schedule</Text>
      ) : null}
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

function BatchCountSheet() {
  const batchCount = useGenerationStore((s) => s.batchCount);
  const setBatchCount = useGenerationStore((s) => s.setBatchCount);
  return (
    <NumericSheetContent
      value={batchCount}
      onChange={setBatchCount}
      cfg={BATCH_COUNT_CONFIG}
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
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        <BottomSheetTouchableOpacity
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
        </BottomSheetTouchableOpacity>
      )}

      {sourceImage ? (
        <>
          <View style={i2iStyles.actionRow}>
            <BottomSheetTouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={handlePick}
              style={i2iStyles.secondaryButton}
            >
              {busy ? (
                <ActivityIndicator size="small" color={light.textSecondary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={15} color={light.textSecondary} />
                  <Text style={i2iStyles.secondaryButtonText}>다시 선택</Text>
                </>
              )}
            </BottomSheetTouchableOpacity>
            <BottomSheetTouchableOpacity
              activeOpacity={0.72}
              onPress={() => {
                triggerSelectionHaptic();
                clearI2I();
              }}
              style={i2iStyles.secondaryButton}
            >
              <Ionicons name="close" size={15} color={light.textSecondary} />
              <Text style={i2iStyles.secondaryButtonText}>끄기</Text>
            </BottomSheetTouchableOpacity>
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
      <Slider
        style={vibeStyles.slider}
        value={value}
        minimumValue={config.min}
        maximumValue={config.max}
        step={config.step}
        minimumTrackTintColor={light.accent}
        maximumTrackTintColor={light.input}
        thumbTintColor={light.accent}
        onSlidingComplete={(next) => {
          triggerSelectionHaptic();
          onChange(Number(next.toFixed(config.precision)));
        }}
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
    <View style={vibeStyles.card}>
      <BottomSheetTouchableOpacity
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
        <BottomSheetTouchableOpacity
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
        </BottomSheetTouchableOpacity>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={light.textHint}
        />
      </BottomSheetTouchableOpacity>

      {expanded ? (
        <View style={vibeStyles.expandedBody}>
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
            <BottomSheetTouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={onReplace}
              style={vibeStyles.secondaryButton}
            >
              {busy ? (
                <ActivityIndicator size="small" color={light.textSecondary} />
              ) : (
                <Ionicons name="refresh" size={15} color={light.textSecondary} />
              )}
              <Text style={vibeStyles.secondaryButtonText}>다시 선택</Text>
            </BottomSheetTouchableOpacity>
            <BottomSheetTouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={onRemove}
              style={vibeStyles.secondaryButton}
            >
              <Ionicons name="trash-outline" size={15} color={light.textSecondary} />
              <Text style={vibeStyles.secondaryButtonText}>삭제</Text>
            </BottomSheetTouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function VibeSheet() {
  const references = useGenerationStore((s) => s.vibeReferences);
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
  const [expandedId, setExpandedId] = useState<string | null>(
    references[0]?.id ?? null,
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

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        setExpandedId(reference.id);
      }
    } catch {
      setMessage("Vibe 이미지를 선택하지 못했습니다.");
    } finally {
      setAdding(false);
      setBusyId(null);
    }
  }

  const canAdd = references.length < MAX_VIBE_REFERENCES;

  return (
    <View style={vibeStyles.sheet}>
      <View style={vibeStyles.topRow}>
        <BottomSheetTouchableOpacity
          activeOpacity={0.82}
          disabled={!canAdd || adding}
          onPress={() => pickVibeImage()}
          style={[vibeStyles.addButton, !canAdd && vibeStyles.addButtonDisabled]}
        >
          {adding ? (
            <ActivityIndicator size="small" color={light.accentText} />
          ) : (
            <Ionicons name="add" size={22} color={light.accentText} />
          )}
          <Text style={vibeStyles.addButtonText}>이미지 추가</Text>
        </BottomSheetTouchableOpacity>
        <Text style={vibeStyles.countText}>
          {references.length}/{MAX_VIBE_REFERENCES}
        </Text>
      </View>

      <BottomSheetTouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          triggerSelectionHaptic();
          setNormalize(!normalize);
        }}
        style={vibeStyles.normalizeRow}
      >
        <View
          style={[
            vibeStyles.checkbox,
            normalize && vibeStyles.checkboxActive,
          ]}
        >
          {normalize ? (
            <Ionicons name="checkmark" size={15} color={light.accentText} />
          ) : null}
        </View>
        <Text style={vibeStyles.normalizeText}>
          Normalize Reference Strength Values
        </Text>
      </BottomSheetTouchableOpacity>

      {references.length === 0 ? (
        <View style={vibeStyles.emptyCard}>
          <Ionicons name="images-outline" size={28} color={light.textSecondary} />
          <Text style={vibeStyles.emptyText}>
            Vibe로 사용할 이미지를 추가하세요.
          </Text>
        </View>
      ) : (
        <View style={vibeStyles.list}>
          {references.map((reference) => (
            <VibeReferenceCard
              key={reference.id}
              reference={reference}
              expanded={expandedId === reference.id}
              busy={busyId === reference.id}
              onToggleExpanded={() => {
                triggerSelectionHaptic();
                setExpandedId((current) =>
                  current === reference.id ? null : reference.id,
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
                if (expandedId === reference.id) {
                  setExpandedId(null);
                }
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
    model === "nai-diffusion-4-5-full" ||
    model === "nai-diffusion-4-5-curated"
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
          <BottomSheetTouchableOpacity
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
          </BottomSheetTouchableOpacity>
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
    <View style={vibeStyles.card}>
      <BottomSheetTouchableOpacity
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
        <BottomSheetTouchableOpacity
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
        </BottomSheetTouchableOpacity>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={light.textHint}
        />
      </BottomSheetTouchableOpacity>

      {expanded ? (
        <View style={vibeStyles.expandedBody}>
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
            <BottomSheetTouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={onReplace}
              style={vibeStyles.secondaryButton}
            >
              {busy ? (
                <ActivityIndicator size="small" color={light.textSecondary} />
              ) : (
                <Ionicons name="refresh" size={15} color={light.textSecondary} />
              )}
              <Text style={vibeStyles.secondaryButtonText}>다시 선택</Text>
            </BottomSheetTouchableOpacity>
            <BottomSheetTouchableOpacity
              activeOpacity={0.72}
              disabled={busy}
              onPress={onRemove}
              style={vibeStyles.secondaryButton}
            >
              <Ionicons name="trash-outline" size={15} color={light.textSecondary} />
              <Text style={vibeStyles.secondaryButtonText}>삭제</Text>
            </BottomSheetTouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
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
  const [expandedId, setExpandedId] = useState<string | null>(
    references[0]?.id ?? null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const modelSupported = isPreciseReferenceSupportedModel(model);
  const blockedByVibe = activeVibeCount > 0;

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

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        setExpandedId(reference.id);
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

  return (
    <View style={vibeStyles.sheet}>
      <View style={vibeStyles.topRow}>
        <BottomSheetTouchableOpacity
          activeOpacity={0.82}
          disabled={!canAdd || adding}
          onPress={() => pickPreciseImage()}
          style={[
            vibeStyles.addButton,
            (!canAdd || adding) && vibeStyles.addButtonDisabled,
          ]}
        >
          {adding ? (
            <ActivityIndicator size="small" color={light.accentText} />
          ) : (
            <Ionicons name="add" size={22} color={light.accentText} />
          )}
          <Text style={vibeStyles.addButtonText}>이미지 추가</Text>
        </BottomSheetTouchableOpacity>
        <Text style={vibeStyles.countText}>
          {references.length}/{MAX_PRECISE_REFERENCES}
        </Text>
      </View>

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
        <View style={vibeStyles.emptyCard}>
          <Ionicons name="person-outline" size={28} color={light.textSecondary} />
          <Text style={vibeStyles.emptyText}>
            Precise Reference로 사용할 이미지를 추가하세요.
          </Text>
        </View>
      ) : (
        <View style={vibeStyles.list}>
          {references.map((reference) => (
            <PreciseReferenceCard
              key={reference.id}
              reference={reference}
              expanded={expandedId === reference.id}
              busy={busyId === reference.id}
              enableBlocked={blockedByVibe || !modelSupported}
              onToggleExpanded={() => {
                triggerSelectionHaptic();
                setExpandedId((current) =>
                  current === reference.id ? null : reference.id,
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
                if (expandedId === reference.id) {
                  setExpandedId(null);
                }
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

function MenuRow({
  label,
  value,
  active,
  disabled,
  isToggle,
  onPress,
}: {
  label: string;
  value?: string;
  active?: boolean;
  disabled?: boolean;
  isToggle?: boolean;
  onPress?: () => void;
}) {
  const { anim, onPressIn, onPressOut, scale } = useScalePress({
    scaleTo: 0.96,
  });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0)", light.surfaceAlt],
  });

  return (
    <BottomSheetTouchableOpacity
      activeOpacity={1}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <RNAnimated.View
        style={[
          styles.sheetMenuRow,
          { transform: [{ scale }], backgroundColor },
        ]}
      >
        <Text
          style={[
            styles.sheetMenuLabel,
            disabled && styles.sheetMenuLabelDisabled,
          ]}
        >
          {label}
        </Text>
        <View style={styles.sheetMenuValueRow}>
          {value ? (
            <Text
              style={[styles.sheetMenuValue, active && styles.sheetMenuValueActive]}
              numberOfLines={1}
            >
              {value}
            </Text>
          ) : null}
          {!disabled && !isToggle && (
            <Ionicons name="chevron-forward" size={18} color={light.textHint} />
          )}
        </View>
      </RNAnimated.View>
    </BottomSheetTouchableOpacity>
  );
}

function MenuTile({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { anim, onPressIn, onPressOut, scale } = useScalePress({
    scaleTo: 0.96,
  });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0)", light.surfaceAlt],
  });

  return (
    <View style={styles.sheetMenuTileCell}>
      <BottomSheetTouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
      >
        <RNAnimated.View
          style={[
            styles.sheetMenuTile,
            { transform: [{ scale }], backgroundColor },
          ]}
        >
          <Text style={styles.sheetMenuTileLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.sheetMenuTileValue} numberOfLines={1}>
            {value}
          </Text>
        </RNAnimated.View>
      </BottomSheetTouchableOpacity>
    </View>
  );
}

function OptionsMenu({
  onSelect,
}: {
  onSelect: (route: OptionRoute) => void;
}) {
  const model = useGenerationStore((s) => s.model);
  const resolution = useGenerationStore((s) => s.resolution);
  const seed = useGenerationStore((s) => s.seed);
  const seedLocked = useGenerationStore((s) => s.seedLocked);
  const steps = useGenerationStore((s) => s.steps);
  const promptGuidance = useGenerationStore((s) => s.promptGuidance);
  const promptGuidanceRescale = useGenerationStore(
    (s) => s.promptGuidanceRescale,
  );
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
      <Text style={styles.sheetTitle}>Options</Text>

      <Text style={styles.sheetMenuGroupLabel}>Core</Text>
      <View style={styles.sheetCard}>
        <View style={styles.sheetMenuTileRow}>
          <MenuTile
            label="Model"
            value={modelText}
            onPress={() => onSelect("model")}
          />
          <View style={styles.sheetTileDivider} />
          <MenuTile
            label="Resolution"
            value={`${resolution.width}x${resolution.height}`}
            onPress={() => onSelect("resolution")}
          />
        </View>
      </View>
      <View style={styles.sheetCard}>
        <MenuRow
          label="Seed"
          value={seedText}
          onPress={() => onSelect("seed")}
        />
      </View>

      <Text style={styles.sheetMenuGroupLabel}>Parameter Options</Text>
      <View style={styles.sheetCard}>
        <View style={styles.sheetMenuTileRow}>
          <MenuTile
            label="Steps"
            value={`${steps}`}
            onPress={() => onSelect("steps")}
          />
          <View style={styles.sheetTileDivider} />
          <MenuTile
            label="CFG Scale"
            value={formatDecimal(promptGuidance)}
            onPress={() => onSelect("cfg")}
          />
          <View style={styles.sheetTileDivider} />
          <MenuTile
            label="CFG Rescale"
            value={formatDecimal(promptGuidanceRescale, 2)}
            onPress={() => onSelect("cfgRescale")}
          />
        </View>
      </View>
      <View style={styles.sheetCard}>
        <MenuRow
          label="Sampler"
          value={samplerText}
          onPress={() => onSelect("sampler")}
        />
        <View style={styles.sheetCardDivider} />
        <MenuRow
          label="Schedule"
          value={scheduleText}
          onPress={() => onSelect("schedule")}
        />
        <View style={styles.sheetCardDivider} />
        <MenuRow
          label="Variety+"
          value={varietyPlus ? "On" : "Off"}
          active={varietyPlus}
          isToggle
          onPress={() => {
            triggerSelectionHaptic();
            setVarietyPlus(!varietyPlus);
          }}
        />
      </View>

      <Text style={styles.sheetMenuGroupLabel}>Reference</Text>
      <View style={styles.sheetCard}>
        <MenuRow label="Metadata Extract" onPress={() => onSelect("metadata")} />
        <View style={styles.sheetCardDivider} />
        <MenuRow
          label="I2I"
          value={i2iSourceImage ? "On" : "Off"}
          active={Boolean(i2iSourceImage)}
          onPress={() => onSelect("i2i")}
        />
        <View style={styles.sheetCardDivider} />
        <MenuRow
          label="Vibe Transfer"
          value={activeVibeCount > 0 ? `${activeVibeCount}` : "Off"}
          active={activeVibeCount > 0}
          onPress={() => onSelect("vibe")}
        />
        <View style={styles.sheetCardDivider} />
        <MenuRow
          label="Precise Ref"
          value={activePreciseCount > 0 ? `${activePreciseCount}` : "Off"}
          active={activePreciseCount > 0}
          onPress={() => onSelect("precise")}
        />
      </View>
    </>
  );
}

// --- 라우티드 단일 시트 ---

export const OptionsSheet = forwardRef<
  OptionsSheetHandle,
  {
    onOpenChange: (open: boolean) => void;
    renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
  }
>(function OptionsSheet(
  { onOpenChange, renderBackdrop },
  ref,
) {
  const sheetRef = useRef<BottomSheet>(null);
  const [route, setRoute] = useState<OptionRoute>("menu");
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");
  const routeRef = useRef<OptionRoute>("menu");
  const openRef = useRef(false);

  const goTo = useCallback((next: OptionRoute, direction?: TransitionDirection) => {
    if (routeRef.current === next) return;
    setTransitionDirection(direction ?? (next === "menu" ? "back" : "forward"));
    routeRef.current = next;
    setRoute(next);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openAt: (next = "menu") => {
        goTo(next, next === "menu" ? "back" : "forward");
        sheetRef.current?.snapToIndex(0);
      },
      close: () => sheetRef.current?.close(),
    }),
    [goTo],
  );

  const handleChange = useCallback(
    (index: number) => {
      const open = index >= 0;
      if (open !== openRef.current) {
        openRef.current = open;
        onOpenChange(open);
      }
      if (!open) goTo("menu", "back");
      // 닫힐 때 다음 열림은 항상 메뉴부터
      if (!open) goTo("menu");
    },
    [goTo, onOpenChange],
  );

  // 헤더 백 / Android 백 공통: 상세면 메뉴로, 메뉴면 시트 닫기.
  const back = useCallback(() => {
    if (routeRef.current !== "menu") {
      goTo("menu", "back");
    } else {
      sheetRef.current?.close();
    }
  }, [goTo]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!openRef.current) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const backToMenu = useCallback(() => goTo("menu", "back"), [goTo]);
  const routeEntering =
    transitionDirection === "forward" ? ROUTE_ENTER_FORWARD : ROUTE_ENTER_BACK;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      style={styles.sheetContainer}
      containerStyle={styles.sheetContainer}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={handleChange}
    >
      {route !== "menu" && (
        <Reanimated.View
          key={`header-${route}`}
          entering={routeEntering}
          style={styles.sheetRouteContent}
        >
          <Reanimated.View entering={ROUTE_FADE_IN} style={styles.sheetBackHeader}>
            <BottomSheetTouchableOpacity
              style={styles.sheetBackButton}
              onPress={back}
            >
              <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
            </BottomSheetTouchableOpacity>
            <Text style={styles.sheetBackTitle} numberOfLines={1}>
              {DETAIL_TITLES[route]}
            </Text>
          </Reanimated.View>
        </Reanimated.View>
      )}

      <BottomSheetScrollView
        key={route}
        contentContainerStyle={styles.sheetScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View
          key={route}
          entering={routeEntering}
          style={styles.sheetRouteContent}
        >
          <Reanimated.View entering={ROUTE_FADE_IN} style={styles.sheetRouteContent}>
            {route === "menu" ? (
              <OptionsMenu
                onSelect={(next) => goTo(next, "forward")}
              />
            ) : route === "model" ? (
              <ModelSheet onClose={backToMenu} showTitle={false} />
            ) : route === "sampler" ? (
              <SamplerSheet onClose={backToMenu} showTitle={false} />
            ) : route === "schedule" ? (
              <ScheduleSheet onClose={backToMenu} showTitle={false} />
            ) : route === "steps" ? (
              <StepsSheet />
            ) : route === "cfg" ? (
              <CfgSheet />
            ) : route === "cfgRescale" ? (
              <CfgRescaleSheet />
            ) : route === "seed" ? (
              <SeedSheet />
            ) : route === "resolution" ? (
              <ResolutionSheet onClose={backToMenu} />
            ) : route === "batchCount" ? (
              <BatchCountSheet />
            ) : route === "metadata" ? (
              <ImageUploadSheet
                onClose={() => sheetRef.current?.close()}
                showTitle={false}
              />
            ) : route === "i2i" ? (
              <I2ISheet />
            ) : route === "vibe" ? (
              <VibeSheet />
            ) : route === "precise" ? (
              <PreciseReferenceSheet />
            ) : null}
          </Reanimated.View>
        </Reanimated.View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

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
    maxHeight: 220,
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

const vibeStyles = StyleSheet.create({
  sheet: {
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  addButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: light.accent,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: light.accentText,
    fontSize: 14,
    fontWeight: "800",
  },
  countText: {
    color: light.textHint,
    fontSize: 13,
    fontWeight: "700",
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
    maxHeight: 200,
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
