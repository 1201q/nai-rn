import { useMemo } from "react";

import { RendraMetadataDetails } from "../../components/rendra/RendraMetadataDetails";
import type { GenerationRecord } from "../../lib/generationHistory";
import { parseNaiMetadataJson } from "../../lib/naiMetadata";

export function MetadataViewContent({ record }: { record: GenerationRecord }) {
  const parsed = useMemo(
    () => parseNaiMetadataJson(record.metadataJson),
    [record.metadataJson],
  );

  return <RendraMetadataDetails parsed={parsed} variant="sheet" />;
}
