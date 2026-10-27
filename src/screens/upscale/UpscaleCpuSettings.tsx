import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  imageUpscaler,
  type UpscaleCpuInfo,
  type UpscaleGpuInfo,
} from "../../../modules/image-upscaler";
import { Toggle } from "../../components/forms/FormControls";
import { Slider } from "../../components/forms/Slider";
import { SteppedSeekbar } from "../../components/forms/SteppedSeekbar";
import type { UpscaleSettings } from "../../store/upscaleQueueStore";
import { tokens } from "../../styles/tokens";
import { cpuPolicyOptions, cpuThreadLimit } from "./upscaleOptions";

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
        <Text style={styles.label}>Use GPU</Text>
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
          <Text style={styles.label}>CPU Policy · 전체 코어</Text>
        )}
        <Text style={styles.hint}>
          선택한 코어: 최대 {limit}개. 지원하지 않는 코어 정책은 전체 코어로
          대체합니다.
        </Text>
        <View style={styles.row}>
          <Text style={styles.label}>CPU Threads 자동</Text>
          <Toggle
            label="CPU Threads 자동"
            value={settings.cpuThreads === 0}
            disabled={!cpuEnabled}
            onChange={(automatic) =>
              onChange({ cpuThreads: automatic ? 0 : limit })
            }
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Number of CPU Threads</Text>
          <Text style={styles.hint}>
            {settings.cpuThreads === 0 ? `자동 · ${threads}` : threads}
          </Text>
        </View>
        {settings.cpuThreads > 0 && limit > 1 ? (
          <Slider
            accessibilityLabel="Number of CPU Threads"
            value={threads}
            min={1}
            max={limit}
            step={1}
            precision={0}
            pill
            jumpOnTap
            trackBg={tokens.color.sunken}
            thumbBorderWidth={0}
            onValueChange={(cpuThreads) => onChange({ cpuThreads })}
            onSlidingComplete={(cpuThreads) => onChange({ cpuThreads })}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 18 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: 15,
  },
  hint: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  disabled: { opacity: 0.5 },
});
