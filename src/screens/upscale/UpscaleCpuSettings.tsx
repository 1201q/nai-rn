import { useEffect, useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";

import {
  imageUpscaler,
  type UpscaleCpuInfo,
} from "../../../modules/image-upscaler";
import { useGenerationInputCommit } from "../../context/GenerationInputCommitContext";
import { Toggle } from "../../components/forms/FormControls";
import { SheetSliderControls } from "../../components/forms/SheetSliderControls";
import { SheetSelect } from "../../components/forms/SheetSelect";
import { UpscaleSettingsRow, upscalePageStyles } from "./UpscaleSettingsRow";
import type { UpscaleSettings } from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import { cpuPolicyOptions, cpuThreadLimit } from "./upscaleOptions";
import { UpscaleOptionLabel } from "./UpscaleOptionLabel";

export function UpscaleCpuSettings({
  active,
  disabled,
  settings,
  onChange,
  inSheet = false,
  portalHostName,
}: {
  active: boolean;
  inSheet?: boolean;
  portalHostName?: string;
  disabled: boolean;
  settings: UpscaleSettings;
  onChange: (patch: Partial<UpscaleSettings>) => void;
}) {
  const { commitPendingInput } = useGenerationInputCommit();
  const [hardware, setHardware] = useState<UpscaleCpuInfo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!active || !imageUpscaler) return;
    let cancelled = false;
    imageUpscaler
      .getCpuInfo()
      .then((cpu) => {
        if (cancelled) return;
        setHardware(cpu);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHardware(null);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const cpuEnabled = !disabled && !failed && hardware !== null;
  const policies = hardware ? cpuPolicyOptions(hardware) : [];
  const effectivePolicy =
    policies.find((policy) => policy.value === settings.cpuPolicy)?.value ?? 0;
  const limit = hardware ? cpuThreadLimit(hardware, effectivePolicy) : 1;
  const threads =
    settings.cpuThreads === 0 ? limit : Math.min(limit, settings.cpuThreads);

  return (
    <View style={styles.section}>
      {!imageUpscaler || failed || hardware === null ? (
        <Text style={styles.hint}>
          {!imageUpscaler
            ? "이 빌드에는 업스케일 모듈이 없습니다."
            : failed
              ? "기기 정보를 조회하지 못했습니다. 이 설정 페이지를 다시 열어 재시도하세요."
              : "CPU 정보 조회 중…"}
        </Text>
      ) : null}
      <View
        pointerEvents={cpuEnabled ? "auto" : "none"}
        accessibilityElementsHidden={!cpuEnabled}
        importantForAccessibility={cpuEnabled ? "auto" : "no-hide-descendants"}
        style={[styles.section, !cpuEnabled && styles.disabled]}
      >
        <View style={[upscalePageStyles.option, upscalePageStyles.row]}>
          <View style={upscalePageStyles.text}>
            <UpscaleOptionLabel
              label="CPU Policy"
              active={active && cpuEnabled}
              portalHostName={portalHostName}
              description={`전체·리틀·빅코어 중 처리에 사용할 코어를 선택합니다. 현재 선택은 최대 ${limit}개 코어를 사용합니다. 지원하지 않는 정책은 전체로 대체합니다.`}
            />
          </View>
          <SheetSelect
            onOpenChange={(open) => {
              if (open) {
                commitPendingInput();
                Keyboard.dismiss();
              }
            }}
            accessibilityLabel="CPU Policy"
            value={
              policies.find((p) => p.value === effectivePolicy)?.label ?? "전체"
            }
            options={policies.map((p) => p.label)}
            portalHostName={portalHostName}
            style={upscalePageStyles.select}
            onChange={(label) => {
              const cpuPolicy = policies.find((p) => p.label === label)!.value;
              const max = cpuThreadLimit(hardware!, cpuPolicy);
              onChange({
                cpuPolicy,
                cpuThreads:
                  settings.cpuThreads === 0
                    ? 0
                    : Math.min(settings.cpuThreads, max),
              });
            }}
          />
        </View>
        <View style={upscalePageStyles.option}>
          <UpscaleSettingsRow
            title="CPU Threads 자동"
            description="선택한 코어 정책의 코어 수에 맞춰 스레드 수를 자동 지정합니다. 끄면 직접 지정할 수 있습니다."
          >
            <Toggle
              label="CPU Threads 자동"
              value={settings.cpuThreads === 0}
              disabled={!cpuEnabled}
              onChange={(automatic) => {
                commitPendingInput();
                Keyboard.dismiss();
                onChange({ cpuThreads: automatic ? 0 : limit });
              }}
            />
          </UpscaleSettingsRow>
        </View>
        <View
          style={[
            upscalePageStyles.option,
            settings.cpuThreads > 0 && limit > 1
              ? styles.threadField
              : undefined,
          ]}
        >
          {settings.cpuThreads === 0 || limit <= 1 ? (
            <UpscaleOptionLabel
              portalHostName={portalHostName}
              label="Number of CPU Threads"
              active={active && cpuEnabled}
              description={`CPU 추론에 사용할 스레드 수입니다. 선택한 코어 정책에 맞춰 최대 ${limit}개로 제한합니다.`}
            />
          ) : null}
          {settings.cpuThreads > 0 && limit > 1 ? (
            <SheetSliderControls
              key={effectivePolicy}
              inSheet={inSheet}
              header={
                <UpscaleOptionLabel
                  label="Number of CPU Threads"
                  active={active && cpuEnabled}
                  portalHostName={portalHostName}
                  description={`CPU 추론에 사용할 스레드 수입니다. 선택한 코어 정책에 맞춰 최대 ${limit}개로 제한합니다.`}
                />
              }
              label="Number of CPU Threads"
              active={active && cpuEnabled}
              value={threads}
              min={1}
              max={limit}
              step={1}
              precision={0}
              onChange={(cpuThreads) => onChange({ cpuThreads })}
            />
          ) : (
            <Text style={upscalePageStyles.description}>
              {settings.cpuThreads === 0 ? `자동 · ${threads}` : threads}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 0 },
  threadField: { gap: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  hint: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  disabled: { opacity: 0.5 },
});
