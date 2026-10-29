#!/system/bin/sh
# Prepare cpu_engine_smoke and the upscaler-models directory under this root first.
base=${UPSCALE_SMOKE_ROOT:-/data/local/tmp/nai-upscale-audit}
failed=0
run_case() {
  timeout 30 "$base/cpu_engine_smoke" "$base/upscaler-models/$1" "$2" "$3" "${4:-100}" "${5:-0}" "${6:-0}" "${7:-32}" "${8:-32}"
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "FAIL status=$status case=$*"
    failed=$((failed+1))
  fi
}
for noise in -1 0 1 2 3; do run_case realcugan-se 2 "$noise"; done
for scale in 3 4; do
  for noise in -1 0 3; do run_case realcugan-se "$scale" "$noise"; done
done
for scale in 2 3; do
  for noise in -1 0 3; do run_case realcugan-pro "$scale" "$noise"; done
done
for noise in 0 1 2 3; do run_case waifu2x-cunet 1 "$noise"; done
for noise in -1 0 1 2 3; do run_case waifu2x-cunet 2 "$noise"; done
run_case realcugan-se 2 -1 100 1 0
run_case waifu2x-cunet 2 -1 100 1 0
for gap in 0 1 2 3; do run_case realcugan-se 2 -1 32 0 "$gap" 96 96; done
run_case realcugan-se 2 -1 32 1 3 96 96
echo "TOTAL cases=33 failed=$failed"
exit "$failed"
