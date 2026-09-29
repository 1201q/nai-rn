// 여러 계층(store, lib, UI)이 함께 쓰는 생성 도메인 타입. 다른 모듈을 import하지 않는다.

export type CharacterPrompt = {
  id: string;
  name?: string;
  prompt: string;
  negativePrompt: string;
  enabled: boolean;
  position: { x: number; y: number };
};

// 앱 저장소에 복사된 I2I 원본 이미지. storagePath는 nai-references 기준 상대 경로.
export type I2ISourceImage = {
  uri: string;
  storagePath: string;
  width: number;
  height: number;
};
