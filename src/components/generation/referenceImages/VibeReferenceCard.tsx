import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { VIBE_ENCODE_COST } from "../../../lib/anlasCost";
import {
  MAX_VIBE_REFERENCES,
  canUseCachedVibeEncoding,
  resolveVibeReferenceThumbnailUri,
  resolveVibeReferenceImageUri,
} from "../../../lib/vibeReferences";
import { useGenerationStore } from "../../../store/generationStore";
import { tokens } from "../../../styles/tokens";
import {
  ReferenceItem,
  ReferenceSection,
  ReferenceSlider,
} from "./ReferenceParts";
import { useReferenceUpload } from "./useReferenceUpload";

export const VibeReferenceCard = memo(function VibeReferenceCard() {
  const references = useGenerationStore((state) => state.vibeReferences);
  const normalize = useGenerationStore((state) => state.normalizeVibeStrengths);
  const model = useGenerationStore((state) => state.model);
  const { busy, pickImage } = useReferenceUpload("vibe");
  const state = useGenerationStore.getState;
  return (
    <ReferenceSection
      group
      title="Vibe Transfer"
      description="이미지를 바꾸되 분위기는 유지합니다."
      icon="copy-outline"
      count={references.length}
      activeCount={references.filter((reference) => reference.enabled).length}
      limit={MAX_VIBE_REFERENCES}
      busy={busy}
      onAdd={() => void pickImage()}
    >
      {references.length > 0 ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Normalize Reference Strength Values"
          accessibilityState={{ checked: normalize }}
          onPress={() => state().setNormalizeVibeStrengths(!normalize)}
          style={styles.normalize}
        >
          <Ionicons
            name={normalize ? "checkbox" : "square-outline"}
            size={24}
            color={normalize ? tokens.color.accent : tokens.color.textMuted}
          />
          <Text style={styles.normalizeLabel}>
            Normalize Reference Strength Values
          </Text>
        </Pressable>
      ) : null}
      {references.map((reference, index) => {
        const cached = canUseCachedVibeEncoding(reference, model);
        return (
          <ReferenceItem
            key={reference.id}
            name={`Vibe ${index + 1}`}
            uri={
              resolveVibeReferenceThumbnailUri(reference) ??
              resolveVibeReferenceImageUri(reference)
            }
            enabled={reference.enabled}
            cost={
              !reference.enabled
                ? "Off"
                : cached
                  ? "Cached"
                  : `${VIBE_ENCODE_COST} Anlas`
            }
            onToggle={(value) =>
              state().setVibeReferenceEnabled(reference.id, value)
            }
            onRemove={() => void state().removeVibeReference(reference.id)}
            note={
              cached
                ? "현재 모델과 Information Extracted 값의 인코딩 캐시를 사용합니다."
                : reference.enabled
                  ? `인코딩이 필요합니다. 다음 생성에서 ${VIBE_ENCODE_COST} Anlas가 사용됩니다.`
                  : `활성화한 다음 생성에서 Vibe 인코딩에 ${VIBE_ENCODE_COST} Anlas가 사용됩니다.`
            }
          >
            <ReferenceSlider
              label="Information Extracted"
              value={reference.informationExtracted}
              min={0.01}
              max={1}
              step={0.01}
              precision={2}
              onChange={(value) =>
                state().setVibeReferenceInformationExtracted(
                  reference.id,
                  value,
                )
              }
            />
            <ReferenceSlider
              label="Reference Strength"
              value={reference.strength}
              min={0.01}
              max={1}
              step={0.01}
              precision={2}
              onChange={(value) =>
                state().setVibeReferenceStrength(reference.id, value)
              }
            />
          </ReferenceItem>
        );
      })}
    </ReferenceSection>
  );
});

const styles = StyleSheet.create({
  normalize: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  normalizeLabel: {
    flex: 1,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: 14,
    lineHeight: 21,
  },
});
