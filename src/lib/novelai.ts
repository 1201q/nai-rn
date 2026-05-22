import JSZip from "jszip";
import { fromByteArray } from "base64-js";

const NOVELAI_IMAGE_API_URL = "https://image.novelai.net/ai/generate-image";
const MODEL = "nai-diffusion-3";

export type GenerateNovelAiImageInput = {
  token: string;
  prompt: string;
};

export type GenerateNovelAiImageResult = {
  imageDataUri: string;
  seed: number;
};

export async function generateNovelAiImage({
  token,
  prompt,
}: GenerateNovelAiImageInput): Promise<GenerateNovelAiImageResult> {
  const seed = Math.floor(Math.random() * 4_294_967_296);
  const response = await fetch(NOVELAI_IMAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/zip, */*",
    },
    body: JSON.stringify({
      input: prompt,
      model: MODEL,
      action: "generate",
      parameters: {
        width: 832,
        height: 1216,
        scale: 5,
        sampler: "k_euler_ancestral",
        steps: 28,
        n_samples: 1,
        seed,
        uc: "low quality, bad anatomy, bad hands, text, watermark",
        qualityToggle: true,
      },
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText}\n${bodyText}`,
    );
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const imageFile = Object.values(zip.files).find(
    (file) => !file.dir && /\.(png|jpe?g|webp)$/i.test(file.name),
  );

  if (!imageFile) {
    throw new Error("응답 zip 안에서 이미지 파일을 찾지 못했습니다.");
  }

  const imageBytes = await imageFile.async("uint8array");
  const base64 = fromByteArray(imageBytes);

  return {
    imageDataUri: `data:image/png;base64,${base64}`,
    seed,
  };
}
