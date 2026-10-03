// Opus 사용량 배지를 눌렀을 때 보여줄 문구
export function formatUsageRecovery(remainingMs: number) {
  const minutes = Math.ceil(remainingMs / 60_000);
  if (minutes <= 1) return "1분 이내";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `약 ${minutes}분`;
  return rest === 0 ? `약 ${hours}시간` : `약 ${hours}시간 ${rest}분`;
}

export function formatUsageMessage(
  percent: number,
  nextPercentAt: number | undefined,
  now = Date.now(),
) {
  const head = `Opus 사용량 ${percent}% 남음`;
  if (percent >= 100 || nextPercentAt === undefined) return head;
  return `${head} · 다음 1% 회복까지 ${formatUsageRecovery(
    Math.max(0, nextPercentAt - now),
  )}`;
}
