import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { inflateSync, strFromU8 } from "fflate";

import {
  getImagePromptTokenPolicy,
  type ImagePromptTokenizerType,
} from "../../constants/generation";
import {
  NovelAiClipTokenizer,
  NovelAiT5Tokenizer,
  type PromptTokenizer,
} from "./tokenizers";

const tokenizerPromises: Partial<
  Record<ImagePromptTokenizerType, Promise<PromptTokenizer>>
> = {};

function getTokenizerAsset(type: ImagePromptTokenizerType): number {
  return type === "t5"
    ? require("../../../assets/tokenizers/t5_tokenizer.def")
    : require("../../../assets/tokenizers/clip_tokenizer.def");
}

async function readDefinition(type: ImagePromptTokenizerType): Promise<string> {
  const asset = Asset.fromModule(getTokenizerAsset(type));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const compressed = await new File(uri).bytes();
  return strFromU8(inflateSync(compressed));
}

export function getPromptTokenizer(
  type: ImagePromptTokenizerType,
): Promise<PromptTokenizer> {
  if (!tokenizerPromises[type]) {
    tokenizerPromises[type] = readDefinition(type).then((definition) => {
      if (type === "t5") {
        return new NovelAiT5Tokenizer(JSON.parse(definition));
      }
      const parsed = JSON.parse(definition) as { text: string };
      return new NovelAiClipTokenizer(parsed.text);
    });
  }
  return tokenizerPromises[type];
}

export function warmPromptTokenizerForModel(model: string): Promise<void> {
  const policy = getImagePromptTokenPolicy(model);
  if (!policy) return Promise.resolve();
  return getPromptTokenizer(policy.tokenizer).then(() => undefined);
}
