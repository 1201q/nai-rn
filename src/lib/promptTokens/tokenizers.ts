import { decode } from "html-entities";

export interface PromptTokenizer {
  countTokens(text: string): number;
}

type UnigramConfig = {
  model: {
    type: "Unigram";
    unk_id: number;
    vocab: Array<[string, number]>;
  };
  pre_tokenizer?: {
    type: string;
    pretokenizers?: Array<{
      type: string;
      replacement?: string;
      add_prefix_space?: boolean;
    }>;
  };
  post_processor?: {
    special_tokens?: Record<string, { ids: number[] }>;
  };
};

type TrieNode = {
  children: Map<string, TrieNode>;
  tokenId?: number;
  score?: number;
};

function createTrieNode(): TrieNode {
  return { children: new Map() };
}

// 정의 항목을 한 번에 처리하면 기기에서 JS 스레드가 0.2~0.3초 멈춘다.
// 시트 제스처와 뒤로가기가 막히지 않도록 일정 시간마다 양보한다.
const YIELD_BUDGET_MS = 8;

async function forEachYielding<T>(
  items: readonly T[],
  callback: (item: T, index: number) => void,
): Promise<void> {
  let sliceStart = performance.now();
  for (let index = 0; index < items.length; index += 1) {
    callback(items[index], index);
    if (index % 512 === 0 && performance.now() - sliceStart > YIELD_BUDGET_MS) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      sliceStart = performance.now();
    }
  }
}

export class NovelAiT5Tokenizer implements PromptTokenizer {
  private readonly root = createTrieNode();
  private readonly unknownId: number;
  private readonly unknownScore: number;
  private readonly eosId: number;
  private readonly replacement: string;
  private readonly addPrefixSpace: boolean;

  static async create(config: UnigramConfig): Promise<NovelAiT5Tokenizer> {
    const tokenizer = new NovelAiT5Tokenizer(config);
    await forEachYielding(config.model.vocab, ([token, score], tokenId) => {
      let node = tokenizer.root;
      for (const character of Array.from(token)) {
        let child = node.children.get(character);
        if (!child) {
          child = createTrieNode();
          node.children.set(character, child);
        }
        node = child;
      }
      node.tokenId = tokenId;
      node.score = score;
    });
    return tokenizer;
  }

  private constructor(config: UnigramConfig) {
    this.unknownId = config.model.unk_id;
    this.unknownScore =
      config.model.vocab.reduce(
        (minimum, [, score]) => Math.min(minimum, score),
        Number.POSITIVE_INFINITY,
      ) - 10;
    this.eosId = config.post_processor?.special_tokens?.["</s>"]?.ids[0] ?? 1;

    const processors: Array<{
      type: string;
      replacement?: string;
      add_prefix_space?: boolean;
    }> =
      config.pre_tokenizer?.type === "Sequence"
        ? (config.pre_tokenizer.pretokenizers ?? [])
        : config.pre_tokenizer
          ? [{ type: config.pre_tokenizer.type }]
          : [];
    const metaspace = processors.find((item) => item.type === "Metaspace");
    this.replacement = metaspace?.replacement ?? "▁";
    this.addPrefixSpace = metaspace?.add_prefix_space ?? true;
  }

  encode(text: string): number[] {
    const cleanText = text
      .replace(/[\[\]{}]/g, "")
      .replace(/-?\d*\.?\d*::/g, "");
    if (!cleanText) return [this.eosId];

    const pieces = cleanText.split(/\s+/).filter(Boolean);
    const tokenIds = pieces.flatMap((piece) => {
      const metaspacePiece =
        (this.addPrefixSpace ? this.replacement : "") +
        piece.split(" ").join(this.replacement);
      return this.encodePiece(metaspacePiece);
    });
    tokenIds.push(this.eosId);
    return tokenIds;
  }

  countTokens(text: string): number {
    return this.encode(text).length;
  }

  private encodePiece(piece: string): number[] {
    const characters = Array.from(piece);
    const bestScores = Array<number>(characters.length + 1).fill(
      Number.NEGATIVE_INFINITY,
    );
    const previous = Array<number>(characters.length + 1).fill(-1);
    const tokenAt = Array<number>(characters.length + 1).fill(this.unknownId);
    bestScores[0] = 0;

    for (let start = 0; start < characters.length; start += 1) {
      if (!Number.isFinite(bestScores[start])) continue;

      const unknownEnd = start + 1;
      const unknownCandidate = bestScores[start] + this.unknownScore;
      if (unknownCandidate > bestScores[unknownEnd]) {
        bestScores[unknownEnd] = unknownCandidate;
        previous[unknownEnd] = start;
        tokenAt[unknownEnd] = this.unknownId;
      }

      let node = this.root;
      for (let end = start; end < characters.length; end += 1) {
        const child = node.children.get(characters[end]);
        if (!child) break;
        node = child;

        if (node.tokenId === undefined || node.score === undefined) continue;
        const next = end + 1;
        const candidate = bestScores[start] + node.score;
        if (candidate > bestScores[next]) {
          bestScores[next] = candidate;
          previous[next] = start;
          tokenAt[next] = node.tokenId;
        }
      }
    }

    const result: number[] = [];
    let cursor = characters.length;
    while (cursor > 0) {
      result.push(tokenAt[cursor]);
      cursor = previous[cursor];
    }
    return result.reverse();
  }
}

type Pair = [string, string];

function bytesToUnicode(): Map<number, string> {
  const bytes: number[] = [];
  for (let value = 33; value <= 126; value += 1) bytes.push(value);
  for (let value = 161; value <= 172; value += 1) bytes.push(value);
  for (let value = 174; value <= 255; value += 1) bytes.push(value);

  const characters = [...bytes];
  let extra = 0;
  for (let value = 0; value < 256; value += 1) {
    if (bytes.includes(value)) continue;
    bytes.push(value);
    characters.push(256 + extra);
    extra += 1;
  }

  return new Map(
    bytes.map((value, index) => [
      value,
      String.fromCodePoint(characters[index]),
    ]),
  );
}

function getPairs(word: string[]): Pair[] {
  const pairs: Pair[] = [];
  for (let index = 0; index < word.length - 1; index += 1) {
    pairs.push([word[index], word[index + 1]]);
  }
  return pairs;
}

function pairKey(pair: Pair): string {
  return `${pair[0]}\u0000${pair[1]}`;
}

export class NovelAiClipTokenizer implements PromptTokenizer {
  private readonly byteEncoder = bytesToUnicode();
  private readonly encoder = new Map<string, number>();
  private readonly bpeRanks = new Map<string, number>();
  private readonly cache = new Map<string, string>();
  private readonly textEncoder = new TextEncoder();

  constructor(definitionText: string) {
    const mergeLines = definitionText
      .split("\n")
      .slice(1, 49_152 - 256 - 2 + 1)
      .filter(Boolean);
    const byteVocabulary = Array.from(this.byteEncoder.values());
    const vocabulary = [
      ...byteVocabulary,
      ...byteVocabulary.map((value) => `${value}</w>`),
      ...mergeLines.map((line) => line.split(" ").join("")),
      "<|startoftext|>",
      "<|endoftext|>",
    ];
    vocabulary.forEach((token, index) => this.encoder.set(token, index));
    mergeLines.forEach((line, index) => {
      const [left, right] = line.split(" ");
      this.bpeRanks.set(pairKey([left, right]), index);
    });
  }

  encode(text: string): number[] {
    const cleanText = decode(decode(text))
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (!cleanText) return [];

    const matches = cleanText.match(
      /<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[\p{L}]+|[\p{N}]|[^\s\p{L}\p{N}]+/giu,
    );
    if (!matches) return [];

    return matches.flatMap((token) => {
      const encodedBytes = Array.from(this.textEncoder.encode(token), (byte) =>
        this.byteEncoder.get(byte),
      ).join("");
      return this.bpe(encodedBytes)
        .split(" ")
        .map((piece) => this.encoder.get(piece))
        .filter((tokenId): tokenId is number => tokenId !== undefined);
    });
  }

  countTokens(text: string): number {
    return this.encode(text).length;
  }

  private bpe(token: string): string {
    const cached = this.cache.get(token);
    if (cached) return cached;

    let word = [
      ...Array.from(token).slice(0, -1),
      `${Array.from(token).at(-1) ?? ""}</w>`,
    ];

    while (word.length > 1) {
      let bestPair: Pair | undefined;
      let bestRank = Number.POSITIVE_INFINITY;
      for (const pair of getPairs(word)) {
        const rank = this.bpeRanks.get(pairKey(pair));
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          bestPair = pair;
        }
      }
      if (!bestPair) break;

      const merged: string[] = [];
      for (let index = 0; index < word.length; index += 1) {
        if (
          index < word.length - 1 &&
          word[index] === bestPair[0] &&
          word[index + 1] === bestPair[1]
        ) {
          merged.push(bestPair[0] + bestPair[1]);
          index += 1;
        } else {
          merged.push(word[index]);
        }
      }
      word = merged;
    }

    const result = word.join(" ");
    this.cache.set(token, result);
    return result;
  }
}

// V5용 byte-level BPE (GPT-2 방식). 번들에는 merge 순위만 들어 있어 토큰 id는 만들지 않고 개수만 센다.
// 웹과 동일: T5와 달리 가중치 문법을 지우지 않고, 특수 토큰도 더하지 않는다.
// 연속된 공백은 하나로 센다 (웹 표시값과 대조해 확인).
export class NovelAiQwenTokenizer implements PromptTokenizer {
  private readonly byteEncoder = bytesToUnicode();
  private readonly ranks = new Map<string, number>();
  private readonly cache = new Map<string, number>();
  private readonly splitPattern: RegExp;
  private readonly textEncoder = new TextEncoder();

  static async create(definition: {
    splitRegex: string;
    merges: string;
  }): Promise<NovelAiQwenTokenizer> {
    const tokenizer = new NovelAiQwenTokenizer(definition.splitRegex);
    // 줄 번호가 merge 순위다. "left right" -> pairKey 형식으로 바꿔 저장한다.
    await forEachYielding(definition.merges.split("\n"), (line, rank) => {
      tokenizer.ranks.set(line.replace(" ", "\u0000"), rank);
    });
    return tokenizer;
  }

  private constructor(splitRegex: string) {
    this.splitPattern = new RegExp(splitRegex, "gu");
  }

  countTokens(text: string): number {
    let total = 0;
    const cleanText = text.replace(/ {2,}/g, " ").normalize("NFC");
    for (const match of cleanText.matchAll(this.splitPattern)) {
      total += this.countPiece(match[0]);
    }
    return total;
  }

  private countPiece(piece: string): number {
    const cached = this.cache.get(piece);
    if (cached !== undefined) return cached;

    let word = Array.from(
      this.textEncoder.encode(piece),
      (byte) => this.byteEncoder.get(byte) ?? "",
    );
    while (word.length > 1) {
      let bestIndex = -1;
      let bestRank = Number.POSITIVE_INFINITY;
      for (let index = 0; index < word.length - 1; index += 1) {
        const rank = this.ranks.get(pairKey([word[index], word[index + 1]]));
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          bestIndex = index;
        }
      }
      if (bestIndex === -1) break;

      const left = word[bestIndex];
      const right = word[bestIndex + 1];
      const merged: string[] = [];
      for (let index = 0; index < word.length; index += 1) {
        if (
          index < word.length - 1 &&
          word[index] === left &&
          word[index + 1] === right
        ) {
          merged.push(left + right);
          index += 1;
        } else {
          merged.push(word[index]);
        }
      }
      word = merged;
    }

    this.cache.set(piece, word.length);
    return word.length;
  }
}
