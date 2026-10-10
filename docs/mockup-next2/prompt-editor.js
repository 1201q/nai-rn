/* Same weight transitions and colors as src/lib/promptHighlight.ts. */
function promptHighlightRanges(text, excluded = []) {
  const ranges = [];
  let weight = 1;
  function push(start, end) {
    if (end <= start || Math.abs(weight - 1) < 0.01) return;
    const distance = Math.min(1, Math.abs(weight - 1) / (weight > 0 ? 1 : 0.5));
    ranges.push({
      start,
      end,
      kind: weight > 1 ? "high" : "low",
      alpha: Math.round(40 * (0.2 + 0.4 * distance)) / 40,
    });
  }
  function piece(start, end) {
    let segment = start;
    for (let i = start; i < end;) {
      const ch = text[i],
        next = i + 1 < end ? text[i + 1] : "";
      if (ch === "|") {
        const length = next === "|" ? 2 : 1;
        ranges.push({ start: i, end: i + length, kind: "bar" });
        i += length;
        continue;
      }
      if (ch === ":" && next === ":") {
        let tail = i;
        while (tail > segment && /[\d.-]/.test(text[tail - 1])) tail--;
        const number = /-?\d*\.?\d*$/.exec(text.slice(tail, i))[0];
        const mark = i - number.length;
        push(segment, mark);
        const parsed = parseFloat(number);
        weight = number === "" ? 1 : Number.isNaN(parsed) ? 0 : parsed;
        i += 2;
        if (weight === 1) {
          ranges.push({ start: mark, end: i, kind: "mid", alpha: 0.5 });
          segment = i;
        } else segment = mark;
        continue;
      }
      if ("{}[]".includes(ch)) {
        push(segment, i);
        weight = ch === "{" || ch === "]" ? weight * 1.05 : weight / 1.05;
        segment = i;
      }
      i++;
    }
    push(segment, end);
  }
  let cursor = 0;
  for (const gap of excluded) {
    piece(cursor, gap.start);
    cursor = gap.end;
  }
  piece(cursor, text.length);
  return ranges;
}
function highlightedPrompt(text) {
  const macros = [...text.matchAll(/!macro:([^!]+)!/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    name: match[1].trim(),
  }));
  const ranges = promptHighlightRanges(text, macros);
  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...ranges.flatMap((r) => [r.start, r.end]),
      ...macros.flatMap((r) => [r.start, r.end]),
    ]),
  ].sort((a, b) => a - b);
  const colors = { high: "184,55,0", low: "4,102,206", mid: "0,151,7" };
  return boundaries
    .slice(0, -1)
    .map((start, index) => {
      const end = boundaries[index + 1];
      const range = ranges.find(
        (r) => r.kind !== "bar" && r.start <= start && r.end >= end,
      );
      const bar = ranges.some(
        (r) => r.kind === "bar" && r.start <= start && r.end >= end,
      );
      const macro = macros.find((r) => r.start === start);
      if (macro) {
        const chunk = state.chunks.find((c) => c.name === macro.name);
        return `<span class="macro-highlight" style="background:${chunk ? chunk.color + "4d" : "#ef6e6e4d"}">${escapeHtml(text.slice(start, end))}</span>`;
      }
      const style = `${range ? `background:rgba(${colors[range.kind]},${range.alpha});` : ""}${bar ? "color:#f5f3c2;font-weight:500;" : ""}`;
      return style
        ? `<span style="${style}">${escapeHtml(text.slice(start, end))}</span>`
        : escapeHtml(text.slice(start, end));
    })
    .join("");
}
function promptEditor(value, key, label, characterId, minHeight = 96) {
  return `<div class="prompt-editor" style="--editor-min:${minHeight}px"><div class="prompt-mirror" aria-hidden="true">${highlightedPrompt(value)}\n</div><textarea class="prompt-input" spellcheck="false" aria-label="${escapeHtml(label)}" placeholder="${key === "prompt" ? "1girl, ..." : "lowres, ..."}" data-prompt="${key}"${characterId ? ` data-character="${characterId}"` : ""}>${escapeHtml(value)}</textarea></div>`;
}
function updatePromptEditors() {
  document.querySelectorAll(".prompt-editor").forEach((frame) => {
    const input = frame.querySelector("textarea"),
      mirror = frame.querySelector(".prompt-mirror");
    mirror.innerHTML = highlightedPrompt(input.value) + "\n";
    input.style.height = "0px";
    const height = Math.max(
      parseFloat(frame.style.getPropertyValue("--editor-min")),
      input.scrollHeight,
    );
    input.style.height = `${height}px`;
  });
  const merged = document.querySelector(
    ".prompt-card:not(.metadata-prompt) .prompt-editor",
  );
  if (merged && !state.split) {
    const input = merged.querySelector("textarea");
    const alternate = document.createElement("div");
    alternate.className = "prompt-mirror measure-prompt";
    alternate.style.width = `${input.clientWidth}px`;
    alternate.textContent =
      (state.mode === "base" ? state.negative : state.prompt) + "\n";
    document.body.append(alternate);
    input.style.height = `${Math.max(parseFloat(input.style.height), alternate.clientHeight, 96)}px`;
    alternate.remove();
  }
}
