import { type ReactElement, type Ref, useMemo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import {
  BottomSheetFlatList,
  type BottomSheetFlatListMethods,
  useBottomSheetScrollableCreator,
} from "@gorhom/bottom-sheet";
import { LegendList } from "@legendapp/list/react-native";
import { FlashList } from "@shopify/flash-list";

import type { GenerationRecord } from "../../../lib/generationHistory";
import type { HistoryListEngine } from "../../../store/generationOptionsPersistence";
import { GRID_GAP } from "./HistoryTiles";

type HistoryGridItem = GenerationRecord | null;
// LegendList는 null 아이템을 렌더하지 않아 생성 중 타일을 문자열로 표시한다.
const ACTIVE_GENERATION_ITEM = "active-generation";

type HistoryGridListProps = {
  engine: HistoryListEngine;
  listRef: Ref<BottomSheetFlatListMethods>;
  data: HistoryGridItem[];
  // renderTile이 의존하는 값이 바뀌면 재활용 리스트가 보이는 타일을 다시 그리게 한다.
  extraData: unknown;
  columns: number;
  tileSize: number;
  // 좌우 여백을 뺀 그리드 너비
  gridWidth: number;
  padding: number;
  initialRow: number;
  contentContainerStyle: StyleProp<ViewStyle>;
  ListEmptyComponent: ReactElement;
  ListFooterComponent: ReactElement | null;
  renderTile: (item: HistoryGridItem, index: number) => ReactElement;
  onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onEndReached: () => void;
};

type RecyclerGridProps = Omit<HistoryGridListProps, "engine">;

function keyOf(item: HistoryGridItem) {
  return item?.id ?? ACTIVE_GENERATION_ITEM;
}

// FlashList와 LegendList는 열 너비를 균등 분할하므로, 타일 간격이 FlatList와 같아지게 열마다 밀어준다.
function columnShift({ tileSize, gridWidth, columns }: RecyclerGridProps) {
  return tileSize + GRID_GAP - gridWidth / columns;
}

function FlatGrid({
  listRef,
  data,
  columns,
  tileSize,
  padding,
  initialRow,
  renderTile,
  onScroll,
  gridWidth: _gridWidth,
  ...listProps
}: RecyclerGridProps) {
  const rowHeight = tileSize + GRID_GAP;

  return (
    <BottomSheetFlatList
      {...listProps}
      ref={listRef}
      // 타입에는 빠져 있지만 BottomSheetFlatList가 JS 스레드에서 호출해 준다.
      {...{ onScroll }}
      data={data}
      keyExtractor={keyOf}
      numColumns={columns}
      // numColumns를 쓰면 index는 줄 번호다.
      getItemLayout={(_data, index) => ({
        length: rowHeight,
        offset: padding + rowHeight * index,
        index,
      })}
      initialScrollIndex={initialRow}
      showsVerticalScrollIndicator={false}
      initialNumToRender={15}
      // 한 번에 그리는 타일 수를 열 수와 상관없이 비슷하게 유지한다.
      maxToRenderPerBatch={Math.ceil(27 / columns)}
      windowSize={columns >= 5 ? 5 : 7}
      onEndReachedThreshold={0.4}
      renderItem={({ item, index }) => renderTile(item, index)}
    />
  );
}

function FlashGrid(props: RecyclerGridProps) {
  const {
    listRef,
    data,
    columns,
    initialRow,
    renderTile,
    tileSize: _tileSize,
    gridWidth: _gridWidth,
    padding: _padding,
    ...listProps
  } = props;
  const renderScrollComponent = useBottomSheetScrollableCreator();
  const shift = columnShift(props);

  return (
    <FlashList
      {...listProps}
      ref={listRef as never}
      data={data}
      renderScrollComponent={renderScrollComponent}
      keyExtractor={keyOf}
      // 생성 중 타일과 일반 타일이 서로 재활용되지 않게 한다.
      getItemType={(item) => (item === null ? "active" : "tile")}
      numColumns={columns}
      initialScrollIndex={initialRow > 0 ? initialRow * columns : undefined}
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.4}
      renderItem={({ item, index }) => (
        <View style={{ marginLeft: (index % columns) * shift }}>
          {renderTile(item, index)}
        </View>
      )}
    />
  );
}

function LegendGrid(props: RecyclerGridProps) {
  const {
    listRef,
    data,
    columns,
    tileSize,
    initialRow,
    renderTile,
    gridWidth: _gridWidth,
    padding: _padding,
    ...listProps
  } = props;
  const renderScrollComponent = useBottomSheetScrollableCreator();
  const shift = columnShift(props);
  const legendData = useMemo(
    () => data.map((item) => item ?? ACTIVE_GENERATION_ITEM),
    [data],
  );

  return (
    <LegendList
      {...listProps}
      ref={listRef as never}
      data={legendData}
      renderScrollComponent={renderScrollComponent}
      keyExtractor={(item) => (typeof item === "string" ? item : item.id)}
      getItemType={(item) => (typeof item === "string" ? "active" : "tile")}
      getFixedItemSize={() => tileSize + GRID_GAP}
      recycleItems
      numColumns={columns}
      initialScrollIndex={initialRow > 0 ? initialRow * columns : undefined}
      showsVerticalScrollIndicator={false}
      // LegendList는 끝 도달을 한 번 알리면, 시작과 끝 양쪽에서 임계값의 1.3배 넘게
      // 벗어나야 다시 알린다. 불러온 페이지가 짧으면 그만큼 벗어날 수 없어
      // 다음 페이지를 못 불러오므로, 시작 쪽 감지를 끄고 끝 쪽 임계값을 줄인다.
      onStartReachedThreshold={0}
      onEndReachedThreshold={0.2}
      renderItem={({ item, index }) => (
        <View style={{ marginLeft: (index % columns) * shift }}>
          {renderTile(typeof item === "string" ? null : item, index)}
        </View>
      )}
    />
  );
}

export function HistoryGridList({ engine, ...props }: HistoryGridListProps) {
  if (engine === "flash") return <FlashGrid {...props} />;
  if (engine === "legend") return <LegendGrid {...props} />;
  return <FlatGrid {...props} />;
}
