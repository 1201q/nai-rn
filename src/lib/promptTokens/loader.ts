import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import type { ImagePromptTokenizerType } from "../../constants/models";
import {
  NovelAiClipTokenizer,
  NovelAiQwenTokenizer,
  NovelAiT5Tokenizer,
  type PromptTokenizer,
} from "./tokenizers";

const tokenizerPromises: Partial<
  Record<ImagePromptTokenizerType, Promise<PromptTokenizer>>
> = {};

function getTokenizerAsset(type: ImagePromptTokenizerType): number {
  if (type === "qwen") {
    return require("../../../assets/tokenizers/qwen35_merges.def");
  }
  return type === "t5"
    ? require("../../../assets/tokenizers/t5_tokenizer.def")
    : require("../../../assets/tokenizers/clip_tokenizer.def");
}

async function readDefinition(type: ImagePromptTokenizerType): Promise<string> {
  const asset = Asset.fromModule(getTokenizerAsset(type));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  // 압축 없이 넣어 둔 JSON을 네이티브에서 읽는다. JS 압축 해제는 기기에서 1초 가까이 걸렸다.
  return new File(uri).text();
}

export function getPromptTokenizer(
  type: ImagePromptTokenizerType,
): Promise<PromptTokenizer> {
  if (!tokenizerPromises[type]) {
    tokenizerPromises[type] = readDefinition(type).then(
      (definition): PromptTokenizer | Promise<PromptTokenizer> => {
        if (type === "t5") {
          return NovelAiT5Tokenizer.create(JSON.parse(definition));
        }
        if (type === "qwen") {
          return NovelAiQwenTokenizer.create(JSON.parse(definition));
        }
        const parsed = JSON.parse(definition) as { text: string };
        return new NovelAiClipTokenizer(parsed.text);
      },
    );
  }
  return tokenizerPromises[type];
}
