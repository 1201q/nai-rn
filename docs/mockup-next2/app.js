/* UI-only reproduction. No NovelAI requests or persistent token storage. */
const initialPrompt =
  "silver-haired mage, under moonlight, arcane magic circle, purple runes, starry night";
const state = {
  screen: "home",
  full: false,
  sample: false,
  prompt: initialPrompt,
  negative: "low quality, blurry, watermark, text",
  mode: "base",
  split: false,
  model: "V4.5 Full",
  effort: "High",
  quality: "Standard",
  uc: "Heavy",
  transparent: false,
  width: 832,
  height: 1216,
  resolution: "Normal",
  steps: 23,
  guidance: 5,
  rescale: 0,
  sampler: "Euler Ancestral",
  schedule: "Karras",
  seed: "",
  lockedSeed: false,
  advanced: true,
  batch: 1,
  format: "PNG",
  imageLocked: false,
  closeSheets: true,
  handleOnly: false,
  predictive: true,
  variety: false,
  blurred: false,
  toolbar: true,
  image: null,
  characters: [],
  references: {},
  chunks: [],
  categories: [],
  editing: null,
  history: [],
  selection: false,
  selected: new Set(),
  position: 12,
  positionCustom: false,
  metadataTab: "metadata",
  importPrompt: true,
  importNegative: true,
  importCharacters: true,
  importSettings: true,
  importSeed: true,
  tokenSaved: false,
  tokenEditing: false,
  tokenVisible: false,
  loading: false,
  normalize: true,
  preciseMode: "Character & Style",
  i2iStrength: 0.7,
  i2iNoise: 0,
  vibeInformation: 1,
  vibeStrength: 0.6,
  preciseStrength: 1,
  preciseFidelity: 1,
  refEnabled: { i2i: true, vibe: true, precise: true },
  gridColumns: 3,
  listEngine: "flat",
  currentHistory: 0,
  activeCharacter: null,
  chunkColor: "#6B7280",
  chunkCategory: "No category",
  editChunkId: null,
  chunkName: "",
  chunkContent: "",
  importCharacterMode: "Replace",
};
const app = document.querySelector("#app");
const picker = document.querySelector("#picker");
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const icon = (name, size) =>
  `<span class="icon" aria-hidden="true"${size ? ` style="font-size:${size}px"` : ""}>${String.fromCodePoint(ICON_GLYPHS[name] || ICON_GLYPHS["ellipse-outline"])}</span>`;
const button = (name, label, action, cls = "round", disabled = false) =>
  `<button class="${cls}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" data-action="${action}" ${disabled ? "disabled" : ""}>${icon(name)}</button>`;
const toggle = (key, label) =>
  `<button class="toggle ${state[key] ? "on" : ""}" role="switch" aria-checked="${!!state[key]}" aria-label="${escapeHtml(label)}" data-toggle="${key}"><span></span></button>`;
const select = (key, value, compact = false, display = value) =>
  `<button class="${compact ? "compact" : "select"}" data-select="${key}" aria-label="${escapeHtml(key)}" aria-haspopup="listbox" aria-expanded="false"><span>${escapeHtml(display)}</span>${icon("chevron-down", compact ? 10 : 14)}</button>`;
const v5 = () => state.model.startsWith("V5");
const medium = () => state.model === "V5 Full" && state.effort === "Medium";
const field = (label, content) =>
  `<div class="field"><label>${label}</label>${content}</div>`;
const help = (key) =>
  `<button class="help" data-help="${key}" aria-label="${key} 도움말" aria-expanded="false">${icon("information", 12)}</button>`;
function slider(key, label, min, max, step, stacked = false) {
  const digits = step === 1 ? 0 : step === 0.1 ? 1 : 2;
  const valueInput = `<input class="slider-value" type="number" data-number="${key}" value="${Number(state[key]).toFixed(digits)}" min="${min}" max="${max}" step="${step}" aria-label="${label} 값" />`;
  const rangeInput = `<div class="range-wrap"><input type="range" data-range="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${state[key]}" style="--percent:${((state[key] - min) / (max - min)) * 100}%" /></div>`;
  const varietyControl =
    key === "guidance" && !v5()
      ? `<span class="grow"></span>${help("Variety+")}<button class="toggle-chip ${state.variety ? "on" : ""}" role="switch" aria-checked="${!!state.variety}" data-toggle="variety">${icon(state.variety ? "checkmark" : "close", 12)}Variety+</button>`
      : "";
  return `<div class="slider">${stacked ? `<div class="slider-header"><span class="slider-label">${label}${help(label)}</span>${valueInput}</div>${rangeInput}` : `<div class="slider-label">${label}${help(label)}${varietyControl}</div><div class="slider-controls">${valueInput}${rangeInput}</div>`}</div>`;
}
function actionbar() {
  return `<div class="actionbar">${button("settings-sharp", "Settings 열기", "settings", `action-icon ${state.screen === "settings" ? "selected" : ""}`)}<button class="generate" data-action="generate">${icon(state.loading ? "stop" : "sparkles")}<span>${state.loading ? "취소" : state.batch > 1 ? `${state.batch}장 생성` : "생성"}</span></button>${button("time-outline", "History 열기", "history", `action-icon ${state.screen === "history" ? "selected" : ""}`)}</div>`;
}
function home() {
  return `<div class="top-actions"><div class="balance-group"><button class="balance" data-action="app-settings" aria-label="ANLAS 토큰 설정">${icon("diamond-outline")}<span>${state.sample || state.tokenSaved ? "10,000" : "—"}</span></button>${state.sample && v5() ? '<div class="usage"><svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12.75" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="2.5"/><circle cx="14" cy="14" r="12.75" fill="none" stroke="#ffc93c" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="80.11" stroke-dashoffset="60.89"/></svg><b>24</b></div>' : ""}</div>${button("ellipsis-horizontal", "더 보기", "app-settings")}</div><div class="canvas-section"><div class="canvas">${state.image ? `<img src="${escapeHtml(state.image)}" alt="생성 이미지" class="${state.blurred ? "blurred" : ""}" data-action="preview" />` : '<div class="placeholder">generated image</div>'}</div><div class="toolbar-row"><div class="toolbar ${state.toolbar ? "" : "collapsed"}">${button(state.blurred ? "eye-off-outline" : "eye-outline", "이미지 블러 적용/해제", "blur", "")}${button("download-outline", "이미지 다운로드", "download", "", !state.image)}${button("copy-outline", "이미지 복사", "copy", "", !state.image)}${button("information-circle-outline", "메타데이터 정보", "metadata", "", !state.image)}${button(state.toolbar ? "chevron-forward" : "chevron-back", "이미지 도구 접기/펼치기", "toolbar", "tool-toggle")}</div></div></div>`;
}
function promptPanel(channel, character = null, split = false) {
  const key = channel === "base" ? "prompt" : "negative";
  const value = character ? character[key] : state[key];
  const title = channel === "base" ? "Base Prompt" : "Undesired Content";
  const footer =
    channel === "base"
      ? `${v5() ? `<button class="compact" data-toggle="transparent" role="switch" aria-checked="${state.transparent}">${icon(state.transparent ? "checkmark" : "close", 10)}Transparent BG</button>` : ""}<span class="grow"></span>${select("quality", state.quality, true, `Quality Tags: ${state.quality}`)}`
      : select("uc", state.uc, true, `UC Preset: ${state.uc}`);
  return `<div class="prompt-panel ${split ? "split-panel" : ""} ${channel === "negative" ? "negative-panel" : ""}">${split ? `<div class="panel-title">${title}${channel === "negative" ? button("git-compare-outline", "Merged prompt로 전환", "split", "split-compare") : ""}</div>` : `<div class="mode-row"><button class="mode ${channel === "base" ? "selected" : ""}" data-mode="base">Base Prompt</button>${!medium() ? `<div class="mode-group ${channel === "negative" ? "selected" : ""}"><button class="mode negative ${channel === "negative" ? "selected" : ""}" data-mode="negative">Undesired Content</button>${channel === "negative" ? button("git-compare-outline", "Split prompt로 전환", "split", "compare") : ""}</div>` : ""}</div>`}${promptEditor(value, key, title, null, split ? (channel === "base" ? 76 : 60) : 96)}<div class="prompt-footer">${footer}</div><button class="token-meter" data-action="token-info" data-meter="${key}" aria-label="프롬프트 토큰 정보"></button></div>`;
}
// Rough stand-in for the app's tokenizer: enough to show the meter states.
const estimateTokens = (text) =>
  Math.round(text.split(/[s,]+/).filter(Boolean).length * 1.4);
function updateTokenMeters() {
  const max = 512;
  document.querySelectorAll(".token-meter").forEach((meter) => {
    const key = meter.dataset.meter;
    const owner = meter.dataset.character
      ? state.characters.find((c) => c.id === Number(meter.dataset.character))
      : state;
    const field = estimateTokens(owner[key] || "");
    const total = [state, ...state.characters].reduce(
      (sum, item) => sum + estimateTokens(item[key] || ""),
      0,
    );
    const width = (value) => Math.min(100, (value / max) * 100);
    meter.classList.toggle("over", total > max);
    meter.innerHTML = `<span class="token-bar">${total ? `<i class="total" style="width:${width(total)}%"></i>` : ""}${field ? `<i class="field" style="width:${width(field)}%"></i>` : ""}</span>`;
  });
}
function characterCard(c, i) {
  const mode = medium() ? "base" : c.mode || "base";
  return `<div class="character-card"><div class="character-head"><span class="badge-cell"><span class="number ${state.positionCustom ? "positioned" : ""}">${i + 1}</span></span><input class="character-name" data-character-name="${c.id}" value="${escapeHtml(c.name)}" placeholder="Character ${i + 1}" aria-label="Character ${i + 1} 이름" /><button class="toggle small ${c.enabled !== false ? "on" : ""}" role="switch" aria-checked="${c.enabled !== false}" aria-label="Character ${i + 1} 사용" data-action="enable-character:${c.id}"><span></span></button><button class="character-action" data-character-menu="${c.id}" aria-label="Character ${i + 1} 더 보기" aria-haspopup="menu" aria-expanded="false">${icon("ellipsis-horizontal")}</button>${button(c.expanded ? "chevron-up" : "chevron-down", "캐릭터 펼치기/접기", `expand:${c.id}`, "character-action")}</div><div class="character-body ${c.enabled === false ? "disabled" : ""}">${c.expanded ? `<div class="character-editor"><div class="mode-row"><button class="mode ${mode === "base" ? "selected" : ""}" data-character-mode="base" data-id="${c.id}">Prompt</button>${medium() ? "" : `<button class="mode negative ${mode === "negative" ? "selected" : ""}" data-character-mode="negative" data-id="${c.id}">Undesired Content</button>`}</div>${promptEditor(c[mode === "base" ? "prompt" : "negative"], mode === "base" ? "prompt" : "negative", `Character ${i + 1} ${mode === "base" ? "Prompt" : "Undesired Content"}`, c.id, 72)}<div class="character-footer"><button class="token-meter" data-action="token-info" data-meter="${mode === "base" ? "prompt" : "negative"}" data-character="${c.id}" aria-label="캐릭터 토큰 정보"></button></div></div>` : `<button class="character-preview" data-action="expand:${c.id}">${escapeHtml(c.prompt.trim() || "프롬프트가 비어 있습니다")}</button>`}</div></div>`;
}
function prompts() {
  const max = v5() ? 22 : 6;
  return `<div class="prompt-card">${state.split && !medium() ? promptPanel("base", null, true) + '<div class="split-divider"></div>' + promptPanel("negative", null, true) : promptPanel(medium() ? "base" : state.mode)}</div><div class="character-section"><div class="row"><div class="grow"><h3>Character Prompts <span class="reference-count">${state.characters.length}/${max}</span></h3><p class="description">장면 속 캐릭터별로 프롬프트를 지정합니다.</p></div>${button("add", "캐릭터 프롬프트 추가", "add-character", "square", state.characters.length >= max)}</div><div class="row"><span class="subtle">Position</span><div class="segmented"><button class="${!state.positionCustom ? "selected" : ""}" data-action="auto-position">AI's Choice</button><button class="${state.positionCustom ? "selected" : ""}" data-action="custom-position" ${state.characters.length < (v5() ? 1 : 2) ? "disabled" : ""}>Custom</button>${button("grid-outline", "캐릭터 위치 편집", "position", "", state.characters.length < (v5() ? 1 : 2))}</div></div></div>${state.characters.map(characterCard).join("")}`;
}
const referenceTypes = [
  ["i2i", "Image2Image", "이미지를 변형합니다.", "color-wand-outline"],
  [
    "vibe",
    "Vibe Transfer",
    "이미지를 바꾸되 분위기는 유지합니다.",
    "copy-outline",
  ],
  [
    "precise",
    "Precise Reference",
    "캐릭터나 스타일의 참조 이미지를 추가합니다.",
    "albums-outline",
  ],
  [
    "extract",
    "Metadata Extract",
    "이미지에서 메타데이터를 추출합니다.",
    "information-circle-outline",
  ],
];
function referenceSlider(key, label, min, max, step) {
  return `<div class="reference-slider"><span class="reference-slider-label">${label}</span>${slider(key, label, min, max, step).replace(/<div class="slider-label">[\s\S]*?<\/div>/, "")}</div>`;
}
function references() {
  return referenceTypes
    .map(([key, title, description, glyph]) => {
      const filled = !!state.references[key] && key !== "extract";
      const enabled = state.refEnabled[key] !== false;
      const header = `<div class="reference-head ${filled ? "filled" : ""}">${icon(glyph)}<div class="grow"><h3>${title}${filled ? ` <span class="reference-count">(${enabled ? "1" : "0/1"})</span>` : ""}</h3>${filled ? "" : `<p>${description}</p>`}</div>${button(filled && key !== "i2i" ? "add" : "cloud-upload-outline", `${title} 이미지 추가`, `upload:${key}`, `square ${filled ? "compact-upload" : ""}`)}</div>`;
      if (!filled) return `<div class="reference-card">${header}</div>`;
      const cost =
        key === "vibe"
          ? enabled
            ? "2 Anlas"
            : "Off"
          : key === "precise"
            ? enabled
              ? "5 Anlas"
              : "Off"
            : "";
      const itemName =
        key === "i2i" ? "I2I 이미지" : key === "vibe" ? "Vibe 1" : "Precise 1";
      const controls =
        key === "i2i"
          ? referenceSlider("i2iStrength", "Strength", 0.01, 0.99, 0.01) +
            referenceSlider("i2iNoise", "Noise", 0, 0.99, 0.01)
          : key === "vibe"
            ? referenceSlider(
                "vibeInformation",
                "Information Extracted",
                0.01,
                1,
                0.01,
              ) +
              referenceSlider(
                "vibeStrength",
                "Reference Strength",
                0.01,
                1,
                0.01,
              )
            : select("preciseMode", state.preciseMode) +
              referenceSlider("preciseStrength", "Strength", 0, 1, 0.05) +
              referenceSlider("preciseFidelity", "Fidelity", 0, 1, 0.05);
      return `<div class="reference-group">${header}<div class="reference-card filled-card">${key === "vibe" ? `<button class="normalize" data-toggle="normalize" role="checkbox" aria-checked="${state.normalize}">${icon(state.normalize ? "checkbox" : "square-outline", 24)}<span>Normalize Reference Strength Values</span></button>` : ""}<div class="reference-item"><div class="reference-item-row"><div class="reference-thumbnail"><img src="${escapeHtml(state.references[key])}" alt="${title} 참조" class="${enabled ? "" : "disabled"}" /><div class="reference-actions">${button("trash-outline", `${itemName} 삭제`, `remove-reference:${key}`, "reference-delete")}<button class="toggle small ${enabled ? "on" : ""}" role="switch" aria-checked="${enabled}" aria-label="${itemName} 사용" data-action="enable-reference:${key}"><span></span></button></div></div><div class="reference-controls"><div class="reference-heading"><h4>${itemName}</h4>${cost ? `<span class="reference-cost">${cost}</span>` : ""}</div>${controls}</div></div>${key === "vibe" ? '<p class="reference-note">인코딩이 필요합니다. 다음 생성에서 2 Anlas가 사용됩니다.</p>' : ""}</div></div></div>`;
    })
    .join("");
}
function settings() {
  return `<div class="field"><label>Model</label>${select("model", state.model)}${state.model === "V5 Full" ? `<div class="field-head"><label>Effort</label>${help("Effort")}<div class="segmented mini">${["Medium", "High"].map((value) => `<button data-effort="${value}" class="${state.effort === value ? "selected" : ""}">${value}</button>`).join("")}</div></div>` : ""}</div><div class="section"><h3 class="eyebrow">IMAGE SETTINGS</h3><div><div class="resolution-header"><label class="field-label">Resolution</label><div class="dimensions"><input type="number" data-number="width" value="${state.width}" min="64" step="64" aria-label="Width" /><button class="dimension-swap" data-action="swap-dimensions" aria-label="Width와 Height 바꾸기">${icon("swap-horizontal", 14)}</button><input type="number" data-number="height" value="${state.height}" min="64" step="64" aria-label="Height" /></div></div><div class="resolution-controls">${select("resolution", state.resolution)}<div class="segmented">${[
    ["landscape", "tablet-landscape-outline"],
    ["portrait", "tablet-portrait-outline"],
    ["square", "square-outline"],
  ]
    .map(
      ([orientation, glyph]) =>
        `<button data-orientation="${orientation}" aria-label="${orientation} resolution" class="${(state.width === state.height ? "square" : state.width > state.height ? "landscape" : "portrait") === orientation ? "selected" : ""}">${icon(glyph)}</button>`,
    )
    .join(
      "",
    )}</div></div></div></div><div class="section"><h3 class="eyebrow">AI SETTINGS</h3>${medium() ? "" : slider("steps", "Steps", 1, 50, 1)}${slider("guidance", "Prompt Guidance", 0, 10, 0.1)}<div class="columns">${field("Seed", `<div class="seed"><input data-input="seed" value="${escapeHtml(state.seed)}" placeholder="Enter a seed" aria-label="Seed 값" inputmode="numeric" maxlength="10" />${button(state.seed ? "close" : "dice-outline", state.seed ? "Seed 지우기" : "현재 이미지 Seed 가져오기", "seed-action", "seed-action", !state.seed && !state.image)}</div>`)}${medium() ? "" : field("Sampler", select("sampler", state.sampler))}</div></div>${medium() ? "" : `<div class="section"><button class="advanced" data-toggle="advanced"><span class="eyebrow">ADVANCED SETTINGS</span>${icon(state.advanced ? "chevron-up" : "chevron-down")}</button>${state.advanced ? slider("rescale", "Prompt Guidance Rescale", 0, 1, 0.02) + (!v5() ? field("Schedule", select("schedule", state.schedule)) : "") : ""}</div>`}`;
}
function appSettings() {
  const options = [
    [
      "imageLocked",
      "메인 화면 이미지 확대/이동 잠금",
      "메인 화면의 생성 이미지를 기본 크기와 위치로 고정합니다. 켜 두면 드래그, 확대/축소가 잠깁니다.",
    ],
    [
      "closeSheets",
      "이미지 생성 시 열린 시트 닫기",
      "이미지 생성 버튼을 누르면 열려 있던 Prompt, Settings, History 시트를 닫습니다.",
    ],
    [
      "handleOnly",
      "슬라이더 핸들로만 조절하기",
      "슬라이더의 동그란 핸들을 잡고 끌 때만 값이 바뀝니다. 스크롤하다 의도치 않게 값이 바뀌는 실수를 막습니다.",
    ],
    [
      "predictive",
      "뒤로가기 미리보기 (고급)",
      "뒤로가기 제스처를 하는 동안 시트와 화면이 손가락을 따라 줄어들면서 미리 보입니다. predictive back에 문제가 있다면 끄시는 것을 추천드립니다.",
    ],
  ];
  return `<div class="settings-page"><div class="account">${state.sample || state.tokenSaved ? `<span class="tier">OPUS</span><div class="anlas"><strong>10,000</strong><span>Anlas</span></div><div class="token-row">${icon("key-outline", 16)}<span class="grow">demo••••••••0000</span><button class="text-action" data-action="edit-token">${state.tokenEditing ? "취소" : "변경"}</button></div>` : '<h3 class="account-title">API Token</h3><p>이미지 생성과 ANLAS 잔액 조회에 사용됩니다</p>'}${(!state.sample && !state.tokenSaved) || state.tokenEditing ? `<div class="token-shell"><input id="token" type="${state.tokenVisible ? "text" : "password"}" placeholder="NovelAI API token" aria-label="NovelAI API 토큰" autocomplete="off" />${button(state.tokenVisible ? "eye-outline" : "eye-off-outline", "토큰 표시/숨기기", "token-visible", "visibility")}<button class="save" data-action="save-token">저장</button></div><div class="security">${icon("lock-closed-outline")}<span>토큰은 이 기기의 보안 저장소에만 저장됩니다</span></div>` : ""}</div><div class="option" style="display:block">${slider("batch", "Batch Count", 1, 100, 1, true)}</div><div class="option"><div class="grow row"><h3>Image Format</h3>${help("Image Format")}</div><div style="width:112px">${select("format", state.format)}</div></div>${options.map(([key, title, description]) => `<div class="option"><div class="grow"><h3>${title}</h3><p>${description}</p></div>${toggle(key, title)}</div>`).join("")}<div class="option"><div class="grow"><h3>History 더미 이미지 (테스트용)</h3><p>History 그리드 테스트용 단색 이미지 200장을 추가합니다.</p></div><button class="text-action" data-action="seed-history">추가</button></div></div><div class="detail-header">${button("chevron-back", "뒤로", "home")}<b>App Settings</b><span style="width:40px"></span></div>`;
}
function chunks() {
  if (state.editing) {
    const category = state.editing === "category";
    const target = state.chunks.find((c) => c.id === state.editChunkId);
    const colors = [
      "#6B7280",
      "#EF4444",
      "#F59E0B",
      "#EAB308",
      "#22C55E",
      "#06B6D4",
      "#3B82F6",
      "#8B5CF6",
      "#EC4899",
    ];
    const label = (title, content) =>
      `<div class="chunk-field"><label>${title}</label>${content}</div>`;
    return `<div class="chunks-header"><h3>${target ? "Chunk 편집" : category ? "새 카테고리" : "새 Chunk"}</h3>${button("close", "닫기", "cancel-chunk", "")}</div>${label("Name", `<input id="chunk-name" class="form-input" aria-label="Name" value="${escapeHtml(state.chunkName)}" placeholder="${category ? "Category name..." : "e.g., My Style Tags"}" />`)}${category ? "" : label("Content", `<textarea id="chunk-content" class="form-input multiline" aria-label="Content" placeholder="Enter the tags/content this chunk will expand to...">${escapeHtml(state.chunkContent)}</textarea>`) + label("Category", `<div class="chunk-wrap">${["No category", ...state.categories].map((c) => `<button class="chunk-option ${state.chunkCategory === c ? "selected" : ""}" data-chunk-category="${escapeHtml(c)}">${escapeHtml(c === "No category" ? "Uncategorized" : c)}</button>`).join("")}</div>`)}${label("Color", `<div class="chunk-wrap">${colors.map((color) => `<button class="color-swatch ${state.chunkColor === color ? "selected" : ""}" style="background:${color}" data-color="${color}" aria-label="색상 ${color}"></button>`).join("")}</div><div class="hex-row"><span class="color-swatch" style="background:${state.chunkColor}"></span><input id="chunk-color" class="form-input" aria-label="색상 코드" value="${state.chunkColor}" maxlength="7" /></div>`)}${target ? `<div class="form-actions"><button data-action="delete-chunk" class="destructive">Delete</button><button data-action="cancel-chunk">Cancel</button><button class="primary" data-action="save-chunk">Save</button></div>` : '<div class="form-actions"><button data-action="cancel-chunk">Cancel</button><button class="primary" data-action="save-chunk">Save</button></div>'}`;
  }
  return `<div class="chunks-header"><h3>Prompt Chunks</h3>${button("folder-open-outline", "카테고리 추가", "add-category", "")}${button("add", "Chunk 추가", "add-chunk", "")}</div>${!state.chunks.length && !state.categories.length ? '<p class="chunk-empty">No custom prompt chunks yet. Tap + to add one.</p>' : ""}<div class="chunk-wrap">${state.chunks
    .filter((c) => c.category === "No category")
    .map(chunkChip)
    .join("")}</div>${state.categories
    .map(
      (category) =>
        `<div class="chunk-category">${icon("chevron-down", 14)}<strong>${escapeHtml(category)}</strong><span>${state.chunks.filter((c) => c.category === category).length}</span>${icon("pencil", 12)}</div><div class="chunk-category-children"><div class="chunk-wrap">${
          state.chunks
            .filter((c) => c.category === category)
            .map(chunkChip)
            .join("") || '<p class="chunk-empty"><i>Empty category</i></p>'
        }</div></div>`,
    )
    .join(
      "",
    )}${state.chunks.length || state.categories.length ? '<div class="form-actions"><button data-action="delete-chunks">Delete All</button></div>' : ""}`;
}
function chunkChip(chunk) {
  return `<div class="chunk-chip" style="background:${chunk.color}15;border-color:${chunk.color}66"><button class="chunk-insert" data-chunk="${chunk.id}" title="${escapeHtml(chunk.content)}">${escapeHtml(chunk.name)}</button><button class="chunk-edit" data-edit-chunk="${chunk.id}" aria-label="${escapeHtml(chunk.name)} 편집">${icon("pencil", 12)}</button></div>`;
}
function utilityHeader() {
  if (state.screen === "metadata")
    return `<header class="sheet-header">${state.metadataTab === "import" ? button("chevron-back", "Metadata로 돌아가기", "metadata-tab", "sheet-back") : ""}<h2>${state.metadataTab === "import" ? "Import" : "Metadata"}</h2>${button("close", "닫기", "home", "close")}</header>`;
  if (state.screen === "history")
    return `<header class="sheet-header history-header">${state.selection ? `<span class="selection-count">${state.selected.size}개 선택</span><button class="history-text accent" data-action="select-all">${state.selected.size === state.history.length ? "전체 해제" : "전체 선택"}</button><span class="grow"></span><button class="history-text" data-action="selection">취소</button>` : `<h2>History</h2><div class="history-header-buttons"><button class="history-text" data-action="list-engine">${state.listEngine}</button>${button("grid-outline", "한 줄에 보이는 이미지 수 변경", "grid-columns", "close")}${button("close", "닫기", "home", "close")}</div>`}</header>`;
  return `<header class="sheet-header"><h2>Settings</h2>${button("close", "닫기", "home", "close")}</header>`;
}
function positionEditor() {
  const active =
    state.characters.find((c) => c.id === state.activeCharacter) ||
    state.characters[0];
  const cell = active?.position ?? state.position;
  const chips = state.characters
    .map(
      (c, i) =>
        `<button class="position-chip ${c === active ? "selected" : ""}" data-position-character="${c.id}">${i + 1}${c.name ? "  " + escapeHtml(c.name) : ""}</button>`,
    )
    .join("");
  const grid = `<div class="position-grid">${Array.from({ length: 25 }, (_, i) => `<button class="${cell === i ? "selected" : ""}" data-position="${i}" aria-label="X ${((i % 5) * 0.2 + 0.1).toFixed(1)}, Y ${(Math.floor(i / 5) * 0.2 + 0.1).toFixed(1)}">${state.characters.map((c, n) => ((c.position ?? 12) === i ? `<span class="position-marker ${c === active ? "selected" : ""}">${n + 1}</span>` : "")).join("")}</button>`).join("")}</div>`;
  const board = `<div class="free-position-board" data-board>${state.references.i2i ? `<img src="${escapeHtml(state.references.i2i)}" alt="I2I 背景" />` : ""}${state.characters.map((c, i) => `<button class="free-marker ${c === active ? "selected" : ""}" data-position-character="${c.id}" style="left:${(c.x ?? 0.5) * 100}%;top:${(c.y ?? 0.5) * 100}%;border-color:${c === active ? "var(--text)" : "var(--accent)"}">${i + 1}</button>`).join("")}</div>`;
  return `<div class="position-area"><div class="position-chips">${chips}</div><div class="position-board-slot">${v5() ? board : grid}</div><button class="position-save" data-action="home">저장</button></div>`;
}
function metadata() {
  if (!state.image) return '<p class="chunk-empty">메타데이터가 없습니다.</p>';
  if (state.metadataTab === "import") {
    const options = [
      ["importPrompt", "Prompt", state.prompt],
      ["importNegative", "Undesired Content", state.negative],
      ...(state.characters.length
        ? [
            [
              "importCharacters",
              "Character Prompts",
              state.characters
                .map((c, i) => c.name || `Character ${i + 1}`)
                .join(", "),
            ],
          ]
        : []),
      [
        "importSettings",
        "Generation Settings",
        `${state.model} · ${state.width} × ${state.height} · ${medium() ? 14 : state.steps} steps · ${state.sampler}`,
      ],
      ["importSeed", "Seed", state.seed || "123456789"],
    ];
    const count = options.filter(([key]) => state[key]).length;
    return `<p class="description import-lead">현재 이미지에 저장된 값을 생성 설정에 적용합니다.</p><div class="meta-card">${options.map(([key, label, preview]) => `<div class="import-item"><button class="import-row" data-toggle="${key}" role="checkbox" aria-checked="${!!state[key]}" aria-label="${label}"><span class="import-check ${state[key] ? "checked" : ""}">${state[key] ? icon("checkmark", 14) : ""}</span><span class="grow"><strong>${label}</strong><span class="import-preview">${escapeHtml(preview || "없음")}</span></span></button>${key === "importCharacters" && state[key] ? `<div class="import-character-mode"><div class="segmented">${["Replace", "Append"].map((mode) => `<button class="${state.importCharacterMode === mode ? "selected" : ""}" data-import-mode="${mode}">${mode}</button>`).join("")}</div><p>${state.importCharacterMode === "Append" ? "현재 목록 뒤에 캐릭터 프롬프트를 추가합니다." : "현재 캐릭터 프롬프트를 교체합니다."}</p></div>` : ""}</div>`).join("")}</div><button class="import-confirm" data-action="import-metadata" ${count ? "" : "disabled"}>${count ? `${count}개 항목 가져오기` : "가져올 항목을 선택하세요"}</button>`;
  }
  const block = (label, value, negative = false) =>
    `<div class="meta-block"><div class="meta-block-head"><span>${label}</span>${button("copy-outline", `${label} 복사`, "copy-meta", "meta-copy", !value)}</div><div class="readonly-prompt ${negative ? "negative" : ""} ${value ? "" : "empty"}">${value ? highlightedPrompt(value) : "없음"}</div></div>`;
  const characterCards = state.characters
    .map(
      (c, i) =>
        `<div class="meta-card"><h4>${escapeHtml(c.name || `Character ${i + 1}`)}</h4>${block("Prompt", c.prompt)}${c.negative ? block("Undesired Content", c.negative, true) : ""}</div>`,
    )
    .join("");
  const values = [
    ["Model", state.model],
    ["Resolution", `${state.width} × ${state.height}`],
    ["Steps", medium() ? 14 : state.steps],
    ["Prompt Guidance", state.guidance],
    ["Prompt Guidance Rescale", state.rescale],
    ["Sampler", state.sampler],
    ["Noise Schedule", v5() ? "Karras" : state.schedule],
    ["Seed", state.seed || "123456789"],
    ["Quality Tags", state.quality],
    ["UC Preset", state.uc],
  ];
  const rows = values
    .map(([label, value]) =>
      label === "Seed"
        ? `<button class="meta-row" data-action="copy-meta" aria-label="Seed 복사"><span>${label}</span><b>${escapeHtml(value)}${icon("copy-outline", 14)}</b></button>`
        : `<div class="meta-row"><span>${label}</span><b>${escapeHtml(value)}</b></div>`,
    )
    .join("");
  return `<section class="metadata-section"><h3 class="eyebrow">PROMPTS</h3><div class="meta-card">${block("Base Prompt", state.prompt)}${block("Undesired Content", state.negative, true)}</div>${characterCards}</section><section class="metadata-section"><h3 class="eyebrow">GENERATION PARAMETERS</h3><div class="meta-card">${rows}</div></section><button class="meta-import" data-action="import-tab">${icon("download-outline", 18)}설정으로 가져오기</button>`;
}
function history() {
  if (!state.history.length)
    return '<div class="empty-history"><strong>아직 생성한 이미지가 없어요</strong><p>이미지를 생성하면 여기에 기록이 쌓입니다</p></div>';
  return `<div class="history-grid ${state.gridColumns >= 5 ? "compact-grid" : ""}" style="--columns:${state.gridColumns}">${state.history.map((image, index) => `<button class="history-tile ${state.selected.has(index) ? "selected" : ""} ${state.currentHistory === index ? "current" : ""}" data-history="${index}" aria-label="생성 이미지 ${index + 1}"><img src="${escapeHtml(image)}" alt="생성 이미지 ${index + 1}" />${state.selection ? `<span class="selection-indicator ${state.selected.has(index) ? "selected" : ""}">${state.selected.has(index) ? icon("checkmark", state.gridColumns >= 5 ? 11 : 14) : ""}</span>` : ""}</button>`).join("")}</div>${state.selection ? `<div class="selection-actions"><div class="selection-pill">${button("download-outline", "선택 이미지 저장", "download", "selection-action", !state.selected.size)}${button("trash-outline", "선택 이미지 삭제", "delete-history", "selection-action", !state.selected.size)}</div></div>` : ""}`;
}
let lastRenderedScreen = null;
function render() {
  const scrollTop =
    state.screen === lastRenderedScreen
      ? app.querySelector(".sheet-scroll,.history-grid,.settings-page")
          ?.scrollTop || 0
      : 0;
  closePicker();
  let html = home();
  if (state.screen === "position") html += positionEditor();
  const promptScreen = ["prompt", "reference", "chunks"].includes(state.screen);
  if (!["app-settings", "preview"].includes(state.screen)) {
    if (state.screen !== "home" && state.screen !== "position")
      html +=
        '<button class="scrim" data-action="home" aria-label="시트 닫기"></button>';
    if (promptScreen)
      html += `<section class="sheet ${state.full ? "full" : ""}" aria-label="Prompt"><button class="handle" data-action="height" aria-label="시트 높이 변경"><span></span></button><header class="sheet-header tabs-header"><div class="tabs" role="tablist">${[
        ["prompt", "Prompt"],
        ["reference", "Reference Images"],
        ["chunks", "Chunks"],
      ]
        .map(
          ([key, label]) =>
            `<button role="tab" aria-selected="${state.screen === key}" class="${state.screen === key ? "selected" : ""}" data-screen="${key}">${label}${key === "reference" && Object.keys(state.references).filter((key) => key !== "extract" && state.refEnabled[key] !== false).length ? `<span class="tab-badge">${Object.keys(state.references).filter((key) => key !== "extract" && state.refEnabled[key] !== false).length}</span>` : ""}</button>`,
        )
        .join(
          "",
        )}</div>${button("chevron-down", "Prompt 접기", "home", "close")}</header><div class="sheet-scroll">${state.screen === "prompt" ? prompts() : state.screen === "reference" ? references() : chunks()}</div></section>`;
    else
      html += `<section class="sheet collapsed"><button class="handle" data-action="prompt" aria-label="Prompt 펼치기"><span></span></button><button class="preview" data-action="prompt"><span>${escapeHtml(state.prompt.trim() || "Prompt를 입력하세요")}</span>${icon("chevron-up")}</button></section>`;
    if (["settings", "history", "metadata"].includes(state.screen))
      html += `<section class="sheet utility full" aria-label="${state.screen}"><button class="handle" data-action="home" aria-label="시트 닫기"><span></span></button>${utilityHeader()}${state.screen === "history" ? history() : `<div class="sheet-scroll ${state.screen === "settings" ? "settings-content" : ""}">${state.screen === "settings" ? settings() : metadata()}</div>`}</section>`;
    html += actionbar();
  }
  if (state.screen === "app-settings") html = appSettings();
  if (state.screen === "preview")
    html += `<div class="zoom-preview"><img src="${escapeHtml(state.image)}" alt="이미지 미리보기" data-action="zoom" /><div class="zoom-controls">${button("close", "닫기", "home")}<div class="zoom-actions">${button("download-outline", "저장", "download")}${button("copy-outline", "복사", "copy")}${button("information-circle-outline", "정보", "metadata")}</div></div></div>`;
  app.innerHTML = html;
  app.dataset.screen = state.screen;
  const scroll = app.querySelector(
    ".sheet-scroll,.history-grid,.settings-page",
  );
  if (scroll) scroll.scrollTop = scrollTop;
  lastRenderedScreen = state.screen;
  updatePromptEditors();
  updateTokenMeters();
  updateSheetScrolled();
  document
    .querySelectorAll("nav [data-screen]")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.screen === state.screen),
    );
  document.querySelector("#status-icons").innerHTML =
    icon("cellular") + icon("wifi") + icon("battery-full");
}
// Header divider appears only once content has scrolled under the header.
function updateSheetScrolled() {
  app.querySelectorAll(".sheet").forEach((sheet) => {
    const scroll = sheet.querySelector(".sheet-scroll,.history-grid");
    sheet.classList.toggle("scrolled", !!scroll && scroll.scrollTop > 0);
  });
}
app.addEventListener("scroll", updateSheetScrolled, true);
function navigate(screen) {
  if (screen !== state.screen) state.metadataTab = "metadata";
  state.screen = screen;
  state.editing = null;
  if (["prompt", "reference", "chunks"].includes(screen))
    state.full = screen === "prompt" ? state.full : true;
  render();
}
let toastTimer;
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = "none"), 2600);
}
function closePicker() {
  picker.hidden = true;
  picker.innerHTML = "";
  document
    .querySelectorAll('[aria-expanded="true"]')
    .forEach((el) => el.setAttribute("aria-expanded", "false"));
}
const selectOptions = {
  model: [
    "V5 Full",
    "V5 Curated",
    "V4.5 Full",
    "V4.5 Curated",
    "V4 Curated (Legacy)",
    "Anime V3 (Legacy)",
    "Furry V3 (Legacy)",
  ],
  resolution: ["Small", "Normal", "Large", "Wallpaper"],
  sampler: [
    "Euler Ancestral",
    "Euler",
    "DPM++ 2S Ancestral",
    "DPM++ 2M SDE",
    "DPM++ 2M",
    "DPM++ SDE",
    "DDIM (Legacy)",
  ],
  preciseMode: ["Character & Style", "Style Only", "Character Only"],
  schedule: ["Karras", "Exponential", "Polyexponential"],
  quality: ["Standard", "None"],
  uc: ["Heavy", "Light", "Human Focus", "None"],
  format: ["PNG", "WebP"],
};
const selectGroups = {
  model: [
    ["Recommended", (value) => value.startsWith("V5")],
    ["Legacy", () => true],
  ],
  sampler: [
    ["Recommended", (value) => value === "Euler Ancestral"],
    ["Others", () => true],
  ],
};
function openPicker(trigger, key) {
  const phone = document.querySelector(".phone").getBoundingClientRect(),
    rect = trigger.getBoundingClientRect();
  const values = (
    key === "quality" && v5()
      ? ["Standard", "Light", "None"]
      : selectOptions[key]
  ).filter((value) => !(v5() && value === "DDIM (Legacy)"));
  const option = (value, label = value) =>
    `<button role="option" aria-selected="${state[key] === value}" class="${state[key] === value ? "selected" : ""}" data-option="${escapeHtml(value)}" data-key="${key}">${escapeHtml(label)}${state[key] === value ? icon("checkmark") : ""}</button>`;
  const rest = [...values];
  const options = selectGroups[key]
    ? selectGroups[key]
        .map(([group, test]) => {
          const items = rest.filter(test);
          items.forEach((item) => rest.splice(rest.indexOf(item), 1));
          return items.length
            ? `<div class="picker-group">${group}</div>${items.map((value) => option(value, group === "Legacy" ? value.replace(" (Legacy)", "") : value)).join("")}`
            : "";
        })
        .join("")
    : values.map((value) => option(value)).join("");
  picker.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  picker.innerHTML = `<button class="picker-backdrop" data-action="close-picker" aria-label="선택 닫기"></button><div class="picker-options" role="listbox" aria-label="${key}">${options}</div>`;
  const menu = picker.querySelector(".picker-options"),
    width = Math.max(180, rect.width),
    left = Math.max(
      12,
      Math.min(rect.left - phone.left, phone.width - width - 12),
    ),
    height = menu.offsetHeight,
    below = rect.bottom - phone.top + 6;
  Object.assign(menu.style, {
    width: `${Math.min(width, phone.width - 24)}px`,
    left: `${left}px`,
    top: `${below + height > phone.height - 34 ? Math.max(48, rect.top - phone.top - height - 6) : below}px`,
  });
}
function openCharacterMenu(trigger, id) {
  const phone = document.querySelector(".phone").getBoundingClientRect(),
    rect = trigger.getBoundingClientRect();
  const index = state.characters.findIndex((c) => c.id === id);
  const items = [
    ["grid-outline", "위치 지정", "character-position", state.characters.length < (v5() ? 1 : 2)],
    ["arrow-up", "위로 이동", "move-up", index === 0],
    ["arrow-down", "아래로 이동", "move-down", index === state.characters.length - 1],
    ["trash-outline", "삭제", "remove-character", false],
  ];
  picker.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  picker.innerHTML = `<button class="picker-backdrop" data-action="close-picker" aria-label="메뉴 닫기"></button><div class="picker-options character-menu" role="menu">${items.map(([glyph, label, name, disabled]) => `<button role="menuitem" class="${name === "remove-character" ? "destructive" : ""}" data-action="${name}:${id}" ${disabled ? "disabled" : ""}>${label}${icon(glyph)}</button>`).join("")}</div>`;
  const menu = picker.querySelector(".picker-options"),
    height = items.length * 44,
    below = rect.bottom - phone.top + 6;
  Object.assign(menu.style, {
    width: "180px",
    left: `${Math.max(12, rect.right - phone.left - 180)}px`,
    top: `${below + height > phone.height - 34 ? rect.top - phone.top - height - 6 : below}px`,
  });
}
const helpText = {
  Effort:
    "Medium은 비용이 적은 대신 Steps 14, Euler Ancestral, UC Preset Heavy로 고정되고 Undesired Content를 쓸 수 없습니다.",
  Steps:
    "이미지를 정제하는 반복 횟수입니다. 낮으면 빠르게 구도를 시험할 수 있고, 높으면 시간과 비용이 늘지만 항상 더 좋아지지는 않습니다.",
  "Prompt Guidance":
    "프롬프트를 따르는 강도입니다. 낮으면 더 자유롭고 부드러우며, 높으면 지시와 세부 표현이 강해집니다.",
  "Prompt Guidance Rescale":
    "높은 Prompt Guidance에서 색이 지나치게 진하거나 경계가 거칠어질 때 완화합니다.",
  "Variety+":
    "초기 구도 단계의 프롬프트 제약을 줄여 포즈와 배경의 다양성을 높입니다.",
  "Batch Count":
    "생성 버튼을 한번 누를 때 연속으로 만들 이미지 수입니다. 이미지 1장의 생성이 끝난 후, 바로 다음 생성으로 진입합니다.",
  "Image Format":
    "생성 이미지를 저장할 파일 형식입니다. PNG는 무손실이라 용량이 크고, WebP는 용량이 더 작습니다.",
};
function openHelp(trigger, key) {
  const phone = document.querySelector(".phone").getBoundingClientRect(),
    rect = trigger.getBoundingClientRect();
  const width = Math.min(280, phone.width - 24);
  picker.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  picker.innerHTML = `<button class="picker-backdrop" data-action="close-picker" aria-label="설명 닫기"></button><div class="settings-tooltip" role="tooltip">${escapeHtml(helpText[key])}</div>`;
  const tooltip = picker.querySelector(".settings-tooltip");
  tooltip.style.width = `${width}px`;
  tooltip.style.left = `${Math.max(12, Math.min(rect.left - phone.left - 12, phone.width - width - 12))}px`;
  tooltip.style.top = `${rect.bottom - phone.top + 7}px`;
  if (rect.bottom - phone.top + 7 + tooltip.offsetHeight > phone.height - 12)
    tooltip.style.top = `${Math.max(12, rect.top - phone.top - 7 - tooltip.offsetHeight)}px`;
}
function setSample(enabled) {
  state.sample = enabled;
  state.image = enabled ? "sample.svg" : null;
  state.history = enabled ? Array(12).fill("sample.svg") : [];
  state.references = enabled
    ? { i2i: "sample.svg", vibe: "sample.svg", precise: "sample.svg" }
    : {};
  state.characters = enabled
    ? [
        {
          id: 1,
          name: "Character 1",
          prompt: "silver hair, mage, purple eyes",
          negative: "",
          expanded: true,
        },
      ]
    : [];
  state.selected.clear();
  render();
}
let generationTimer;
function action(name) {
  if (
    [
      "home",
      "prompt",
      "reference",
      "chunks",
      "settings",
      "history",
      "app-settings",
      "metadata",
      "position",
      "preview",
    ].includes(name)
  ) {
    navigate(
      state.screen === name && ["settings", "history"].includes(name)
        ? "home"
        : name,
    );
    return;
  }
  if (name.startsWith("remove-character:")) {
    state.characters = state.characters.filter(
      (c) => c.id !== Number(name.split(":")[1]),
    );
    render();
    return;
  }
  if (name.startsWith("expand:")) {
    const c = state.characters.find((c) => c.id === Number(name.split(":")[1]));
    c.expanded = !c.expanded;
    render();
    return;
  }
  if (name.startsWith("remove-reference:")) {
    delete state.references[name.split(":")[1]];
    render();
    return;
  }
  if (name.startsWith("upload:")) {
    document.querySelector("#upload").dataset.target = name.split(":")[1];
    document.querySelector("#upload").click();
    return;
  }
  if (name.startsWith("enable-reference:")) {
    const key = name.split(":")[1];
    state.refEnabled[key] = !state.refEnabled[key];
    render();
    return;
  }
  if (name.startsWith("enable-character:")) {
    const c = state.characters.find((c) => c.id === Number(name.split(":")[1]));
    c.enabled = c.enabled === false;
    render();
    return;
  }
  if (name.startsWith("move-up:") || name.startsWith("move-down:")) {
    const index = state.characters.findIndex(
      (c) => c.id === Number(name.split(":")[1]),
    );
    const destination = index + (name.startsWith("move-up:") ? -1 : 1);
    [state.characters[index], state.characters[destination]] = [
      state.characters[destination],
      state.characters[index],
    ];
    render();
    return;
  }
  if (name.startsWith("character-position:")) {
    state.activeCharacter = Number(name.split(":")[1]);
    state.positionCustom = true;
    navigate("position");
    return;
  }
  switch (name) {
    case "height":
      state.full = !state.full;
      render();
      break;
    case "toolbar":
      state.toolbar = !state.toolbar;
      render();
      break;
    case "blur":
      state.blurred = !state.blurred;
      render();
      break;
    case "split":
      state.split = !state.split;
      render();
      break;
    case "add-character":
      state.characters.push({
        id: Date.now(),
        name: `Character ${state.characters.length + 1}`,
        prompt: "",
        negative: "",
        expanded: true,
      });
      render();
      break;
    case "auto-position":
      state.positionCustom = false;
      render();
      break;
    case "custom-position":
      state.positionCustom = true;
      render();
      break;
    case "random-seed":
      state.seed = String(Math.floor(Math.random() * 4294967296));
      render();
      break;
    case "lock-seed":
      state.lockedSeed = !state.lockedSeed;
      render();
      break;
    case "selection":
      state.selection = !state.selection;
      state.selected.clear();
      render();
      break;
    case "delete-history":
      state.history = state.history.filter(
        (_, index) => !state.selected.has(index),
      );
      state.selected.clear();
      render();
      break;
    case "seed-history":
      state.history.push(...Array(200).fill("sample.svg"));
      toast("더미 이미지 200장을 추가했습니다.");
      break;
    case "add-chunk":
      state.editing = "chunk";
      state.editChunkId = null;
      state.chunkName = "";
      state.chunkContent = "";
      state.chunkColor = "#6B7280";
      state.chunkCategory = "No category";
      render();
      break;
    case "add-category":
      state.editing = "category";
      state.editChunkId = null;
      state.chunkName = "";
      state.chunkContent = "";
      state.chunkColor = "#6B7280";
      render();
      break;
    case "cancel-chunk":
      state.editing = null;
      render();
      break;
    case "save-chunk": {
      const nameValue = document.querySelector("#chunk-name").value.trim();
      if (!nameValue) {
        toast("Name을 입력해 주세요.");
        break;
      }
      if (state.editing === "category") state.categories.push(nameValue);
      else {
        const item = {
          id: state.editChunkId || Date.now(),
          name: nameValue,
          content: document.querySelector("#chunk-content").value,
          category: state.chunkCategory,
          color: document.querySelector("#chunk-color").value,
        };
        if (!/^#[0-9a-f]{6}$/i.test(item.color)) {
          toast("올바른 색상 코드를 입력해 주세요.");
          break;
        }
        if (state.editChunkId)
          state.chunks = state.chunks.map((c) =>
            c.id === state.editChunkId ? item : c,
          );
        else state.chunks.push(item);
      }
      state.editing = null;
      render();
      break;
    }
    case "delete-chunks":
      state.chunks = [];
      state.categories = [];
      render();
      break;
    case "delete-chunk":
      state.chunks = state.chunks.filter((c) => c.id !== state.editChunkId);
      state.editing = null;
      render();
      break;
    case "edit-token":
      state.tokenEditing = !state.tokenEditing;
      render();
      break;
    case "token-visible": {
      const input = document.querySelector("#token");
      state.tokenVisible = !state.tokenVisible;
      input.type = state.tokenVisible ? "text" : "password";
      break;
    }
    case "save-token":
      if (!document.querySelector("#token").value.trim()) {
        toast("토큰을 입력해 주세요.");
        break;
      }
      state.tokenSaved = true;
      state.tokenEditing = false;
      render();
      toast("목업 연결 상태를 표시했습니다. 실제 토큰은 저장하지 않습니다.");
      break;
    case "generate":
      if (state.loading) {
        clearTimeout(generationTimer);
        state.loading = false;
        render();
        break;
      }
      if (!state.sample && !state.tokenSaved) {
        toast("NovelAI API 토큰을 먼저 설정해 주세요.");
        break;
      }
      state.loading = true;
      if (state.closeSheets) state.screen = "home";
      render();
      generationTimer = setTimeout(() => {
        state.loading = false;
        state.image = "sample.svg";
        state.history.unshift("sample.svg");
        render();
        toast("샘플 이미지 생성이 완료되었습니다.");
      }, 1500);
      break;
    case "download":
      if (state.image) {
        const link = document.createElement("a");
        link.href = state.image;
        link.download = "nai-mockup-sample.svg";
        link.click();
      }
      break;
    case "copy":
      toast("이미지 복사는 앱의 네이티브 기능입니다.");
      break;
    case "zoom":
      document.querySelector(".zoom-preview img").classList.toggle("zoomed");
      break;
    case "close-picker":
      closePicker();
      break;
    case "swap-dimensions":
      [state.width, state.height] = [state.height, state.width];
      render();
      break;
    case "seed-action":
      state.seed = state.seed ? "" : state.image ? "123456789" : "";
      state.lockedSeed = !!state.seed;
      render();
      break;
    case "token-info":
      toast("토큰 사용량은 실제 앱의 tokenizer로 계산됩니다.");
      break;
    case "grid-columns":
      state.gridColumns = state.gridColumns === 5 ? 2 : state.gridColumns + 1;
      render();
      break;
    case "list-engine":
      state.listEngine =
        state.listEngine === "flat"
          ? "flash"
          : state.listEngine === "flash"
            ? "legend"
            : "flat";
      render();
      break;
    case "select-all":
      state.selected =
        state.selected.size === state.history.length
          ? new Set()
          : new Set(state.history.map((_, i) => i));
      render();
      break;
    case "metadata-tab":
      state.metadataTab = "metadata";
      lastRenderedScreen = null;
      render();
      break;
    case "import-tab":
      state.metadataTab = "import";
      lastRenderedScreen = null;
      render();
      break;
    case "copy-meta":
      toast("클립보드에 복사했습니다.");
      break;
    case "import-metadata":
      navigate("home");
      toast("목업 메타데이터 적용 화면을 확인했습니다.");
      break;
  }
}
document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target || target.disabled) return;
  if (target.dataset.screen) {
    navigate(target.dataset.screen);
    return;
  }
  if (target.dataset.action) {
    action(target.dataset.action);
    return;
  }
  if (target.dataset.toggle) {
    const key = target.dataset.toggle;
    state[key] = !state[key];
    render();
    return;
  }
  if (target.dataset.mode) {
    state.mode = target.dataset.mode;
    render();
    return;
  }
  if (target.dataset.importMode) {
    state.importCharacterMode = target.dataset.importMode;
    render();
    return;
  }
  if (target.dataset.characterMenu) {
    openCharacterMenu(target, Number(target.dataset.characterMenu));
    return;
  }
  if (target.dataset.characterMode) {
    state.characters.find((c) => c.id === Number(target.dataset.id)).mode =
      target.dataset.characterMode;
    render();
    return;
  }
  if (target.dataset.positionCharacter) {
    state.activeCharacter = Number(target.dataset.positionCharacter);
    render();
    return;
  }
  if (target.dataset.chunkCategory) {
    state.chunkCategory = target.dataset.chunkCategory;
    render();
    return;
  }
  if (target.dataset.color) {
    state.chunkColor = target.dataset.color;
    render();
    return;
  }
  if (target.dataset.editChunk) {
    const chunk = state.chunks.find(
      (c) => c.id === Number(target.dataset.editChunk),
    );
    state.editing = "chunk";
    state.editChunkId = chunk.id;
    state.chunkColor = chunk.color;
    state.chunkName = chunk.name;
    state.chunkContent = chunk.content;
    state.chunkCategory = chunk.category;
    render();
    return;
  }
  if (target.dataset.expand) {
    action(`expand:${target.dataset.expand}`);
    return;
  }
  if (target.dataset.select) {
    openPicker(target, target.dataset.select);
    return;
  }
  if (target.dataset.option) {
    const key = target.dataset.key;
    state[key] = target.dataset.option;
    if (key === "resolution") {
      const sizes = {
        Small: [512, 768],
        Normal: [832, 1216],
        Large: [1024, 1536],
        Wallpaper: [1088, 1920],
      };
      [state.width, state.height] = sizes[state.resolution];
    }
    if (key === "model") {
      state.steps = 23;
      state.guidance = v5() ? 7 : 5;
      state.effort = "High";
    }
    render();
    return;
  }
  if (target.dataset.effort) {
    state.effort = target.dataset.effort;
    render();
    return;
  }
  if (target.dataset.orientation) {
    const dimensions =
      state.resolution === "Small"
        ? [512, 768]
        : state.resolution === "Large"
          ? [1024, 1536]
          : state.resolution === "Wallpaper"
            ? [1088, 1920]
            : [832, 1216];
    [state.width, state.height] =
      target.dataset.orientation === "square"
        ? [1024, 1024]
        : target.dataset.orientation === "landscape"
          ? [dimensions[1], dimensions[0]]
          : dimensions;
    render();
    return;
  }
  if (target.dataset.position) {
    state.position = Number(target.dataset.position);
    const c =
      state.characters.find((c) => c.id === state.activeCharacter) ||
      state.characters[0];
    if (c) c.position = state.position;
    render();
    return;
  }
  if (target.dataset.history) {
    const index = Number(target.dataset.history);
    if (state.selection) {
      state.selected.has(index)
        ? state.selected.delete(index)
        : state.selected.add(index);
      render();
    } else {
      state.image = state.history[index];
      navigate("preview");
    }
    return;
  }
  if (target.dataset.chunk) {
    const chunk = state.chunks.find(
      (c) => c.id === Number(target.dataset.chunk),
    );
    state.prompt += `${state.prompt ? ", " : ""}${chunk.content}`;
    toast("Chunk를 Base Prompt에 추가했습니다.");
    return;
  }
  if (target.dataset.help) openHelp(target, target.dataset.help);
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.prompt) {
    const destination = target.dataset.character
      ? state.characters.find((c) => c.id === Number(target.dataset.character))
      : state;
    destination[target.dataset.prompt] = target.value;
  }
  if (target.dataset.prompt) {
    updatePromptEditors();
    updateTokenMeters();
  }
  if (target.dataset.characterName)
    state.characters.find(
      (c) => c.id === Number(target.dataset.characterName),
    ).name = target.value;
  if (target.id === "chunk-name") state.chunkName = target.value;
  if (target.id === "chunk-content") state.chunkContent = target.value;
  if (target.id === "chunk-color") state.chunkColor = target.value;
  if (target.dataset.input) state[target.dataset.input] = target.value;
  if (target.dataset.range) {
    const key = target.dataset.range;
    state[key] = Number(target.value);
    target.style.setProperty(
      "--percent",
      `${((target.value - target.min) / (target.max - target.min)) * 100}%`,
    );
    const input = target.closest(".slider").querySelector("[data-number]");
    input.value = target.value;
  }
});
document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.number) {
    state[target.dataset.number] = Math.max(
      Number(target.min || 0),
      Math.min(Number(target.max || 4294967295), Number(target.value)),
    );
    render();
  }
});
document
  .querySelector("#sample")
  .addEventListener("change", (event) => setSample(event.target.checked));
app.addEventListener(
  "scroll",
  (event) => {
    if (event.target.classList.contains("settings-page"))
      app.querySelector(".detail-header b").style.opacity = Math.max(
        0,
        1 - event.target.scrollTop / 72,
      );
  },
  true,
);
app.addEventListener("contextmenu", (event) => {
  const tile = event.target.closest("[data-history]");
  if (!tile) return;
  event.preventDefault();
  state.selection = true;
  state.selected.add(Number(tile.dataset.history));
  render();
});
app.addEventListener("pointerdown", (event) => {
  const board = event.target.closest("[data-board]");
  if (!board) return;
  const c =
    state.characters.find((c) => c.id === state.activeCharacter) ||
    state.characters[0];
  if (!c) return;
  const rect = board.getBoundingClientRect();
  c.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  c.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  render();
});
document.querySelector("#upload").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  const key = event.target.dataset.target;
  reader.onload = () => {
    state.references[key] = reader.result;
    render();
  };
  reader.readAsDataURL(file);
  event.target.value = "";
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!picker.hidden) closePicker();
    else if (
      state.full &&
      ["prompt", "reference", "chunks"].includes(state.screen)
    ) {
      state.full = false;
      render();
    } else navigate("home");
  }
});
let dragStart = null;
app.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".handle")) dragStart = event.clientY;
});
app.addEventListener("pointerup", (event) => {
  if (dragStart === null) return;
  const distance = event.clientY - dragStart;
  dragStart = null;
  if (Math.abs(distance) > 25) {
    if (["prompt", "reference", "chunks"].includes(state.screen)) {
      state.full = distance < 0;
      if (distance > 100) state.screen = "home";
      render();
    } else if (state.screen === "home" && distance < 0) navigate("prompt");
  }
});
render();
