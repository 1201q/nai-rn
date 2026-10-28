import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  imageUpscaler,
  type UpscaleCpuInfo,
  type UpscaleGpuInfo,
} from "../../../modules/image-upscaler";
import { Toggle } from "../../components/forms/FormControls";
import { SheetSliderControls } from "../../components/forms/SheetSliderControls";
import { SteppedSeekbar } from "../../components/forms/SteppedSeekbar";
import type { UpscaleSettings } from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import { cpuPolicyOptions, cpuThreadLimit } from "./upscaleOptions";
import { UpscaleOptionLabel, UpscaleHelpButton } from "./UpscaleOptionLabel";

export function UpscaleCpuSettings({
  active,
  disabled,
  settings,
  onChange,
}: {
  active: boolean;
  disabled: boolean;
  settings: UpscaleSettings;
  onChange: (patch: Partial<UpscaleSettings>) => void;
}) {
  const [hardware, setHardware] = useState<{
    cpu: UpscaleCpuInfo;
    gpu: UpscaleGpuInfo | null;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!active || !imageUpscaler) return;
    let cancelled = false;
    Promise.all([
      imageUpscaler.getCpuInfo(),
      settings.useGpu ? imageUpscaler.getGpuInfo() : Promise.resolve(null),
    ])
      .then(([cpu, gpu]) => {
        if (cancelled) return;
        setHardware({ cpu, gpu });
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
  }, [active, settings.useGpu]);

  const cpuEnabled =
    !disabled &&
    !failed &&
    hardware !== null &&
    (!settings.useGpu || hardware.gpu?.available === false);
  const policies = hardware ? cpuPolicyOptions(hardware.cpu) : [];
  const effectivePolicy =
    policies.find((policy) => policy.value === settings.cpuPolicy)?.value ?? 0;
  const limit = hardware ? cpuThreadLimit(hardware.cpu, effectivePolicy) : 1;
  const threads =
    settings.cpuThreads === 0 ? limit : Math.min(limit, settings.cpuThreads);

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <UpscaleOptionLabel
          label="Use GPU"
          active={active}
          description="켜면 GPU를 사용하고 GPU가 없으면 CPU로 처리합니다. 끄면 CPU를 사용합니다. CPU 설정은 CPU 처리에만 적용됩니다."
        />
        <Toggle
          label="Use GPU"
          value={settings.useGpu}
          disabled={disabled}
          onChange={(useGpu) => onChange({ useGpu })}
        />
      </View>
      <Text style={styles.hint}>
        {!imageUpscaler
          ? "이 빌드에는 업스케일 모듈이 없습니다."
          : failed
            ? "기기 정보를 조회하지 못했습니다. 고급 옵션을 다시 열어 재시도하세요."
            : hardware === null
              ? "CPU·GPU 정보 조회 중…"
              : settings.useGpu && hardware.gpu?.available !== false
                ? "GPU 처리 중에는 CPU 설정을 사용하지 않습니다."
                : settings.useGpu
                  ? "GPU가 없어 CPU로 처리합니다."
                  : "CPU로 처리합니다."}
      </Text>
      <View
        pointerEvents={cpuEnabled ? "auto" : "none"}
        accessibilityElementsHidden={!cpuEnabled}
        importantForAccessibility={cpuEnabled ? "auto" : "no-hide-descendants"}
        style={[styles.section, !cpuEnabled && styles.disabled]}
      >
        {policies.length > 1 ? (
          <SteppedSeekbar
            label="CPU Policy"
            labelAccessory={
              <UpscaleHelpButton
                label="CPU Policy"
                active={active && cpuEnabled}
                description={`전체·리틀·빅코어 중 처리에 사용할 코어를 선택합니다. 현재 선택은 최대 ${limit}개 코어를 사용합니다. 지원하지 않는 코어 정책은 전체 코어로 대체합니다.`}
              />
            }
            stops={policies}
            value={effectivePolicy}
            onChange={(value) => {
              const cpuPolicy = value as UpscaleSettings["cpuPolicy"];
              const max = cpuThreadLimit(hardware!.cpu, cpuPolicy);
              onChange({
                cpuPolicy,
                cpuThreads:
                  settings.cpuThreads === 0
                    ? 0
                    : Math.min(settings.cpuThreads, max),
              });
            }}
          />
        ) : (
          <UpscaleOptionLabel
            label="CPU Policy · 전체 코어"
            active={active && cpuEnabled}
            description={`이 기기는 구분 가능한 클러스터가 없어 전체 코어를 사용합니다. 최대 ${limit}개 코어를 사용할 수 있습니다.`}
          />
        )}
        <View style={styles.row}>
          <UpscaleOptionLabel
            label="CPU Threads 자동"
            active={active && cpuEnabled}
            description="켜면 선택한 코어 정책의 코어 수에 맞춰 스레드 수를 자동 지정합니다. 끄면 직접 지정할 수 있습니다."
          />
          <Toggle
            label="CPU Threads 자동"
            value={settings.cpuThreads === 0}
            disabled={!cpuEnabled}
            onChange={(automatic) =>
              onChange({ cpuThreads: automatic ? 0 : limit })
            }
          />
        </View>
        <View style={styles.threadField}>
          <UpscaleOptionLabel
            label="Number of CPU Threads"
            active={active && cpuEnabled}
            description={`CPU 추론에 사용할 스레드 수입니다. 선택한 코어 정책에 맞춰 최대 ${limit}개로 제한합니다.`}
          />
          {settings.cpuThreads > 0 && limit > 1 ? (
            <SheetSliderControls
              key={effectivePolicy}
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
            <Text style={styles.hint}>
              {settings.cpuThreads === 0 ? `자동 · ${threads}` : threads}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 18 },
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
