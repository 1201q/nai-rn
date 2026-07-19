import { useMemo } from "react";

import { RendraMetadataDetails } from "../../components/rendra/RendraMetadataDetails";
import type { GenerationRecord } from "../../lib/generationHistory";
import { parseNaiMetadata, type ParsedNaiMetadata } from "../../lib/naiMetadata";

export function MetadataViewContent({ record }: { record: GenerationRecord }) {
  const parsed = useMemo<ParsedNaiMetadata | null>(() => {
    try {
      const raw = JSON.parse(record.metadataJson) as Record<string, string>;
      return parseNaiMetadata(raw);
    } catch {
      return null;
    }
  }, [record]);

  return <RendraMetadataDetails parsed={parsed} variant="sheet" />;
}
