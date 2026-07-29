import { useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

export const WHEEL_ITEM_HEIGHT = 52;
export const WHEEL_VISIBLE_ITEM_COUNT = 5;
export const WHEEL_VIEWPORT_HEIGHT =
  WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEM_COUNT;
export const WHEEL_EDGE_PADDING =
  (WHEEL_VIEWPORT_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

export function getWheelOffset(index: number): number {
  return index * WHEEL_ITEM_HEIGHT;
}

export function getWheelGeometry(index: number) {
  const selectedOffset = getWheelOffset(index);
  return {
    bottomPadding: WHEEL_EDGE_PADDING,
    itemHeight: WHEEL_ITEM_HEIGHT,
    selectionBandHeight: WHEEL_ITEM_HEIGHT,
    selectionBandTop: WHEEL_EDGE_PADDING,
    selectedCenter:
      WHEEL_EDGE_PADDING +
      selectedOffset -
      selectedOffset +
      WHEEL_ITEM_HEIGHT / 2,
    selectedOffset,
    topPadding: WHEEL_EDGE_PADDING,
    viewportCenter: WHEEL_VIEWPORT_HEIGHT / 2,
    viewportHeight: WHEEL_VIEWPORT_HEIGHT,
  } as const;
}

export function createDescendingWheelOptions(
  options: readonly number[]
): number[] {
  return [...new Set(options)].sort((left, right) => right - left);
}

export function resolveWheelValue(
  options: readonly number[],
  offsetY: number,
  itemHeight = WHEEL_ITEM_HEIGHT
): number {
  const index = Math.max(
    0,
    Math.min(options.length - 1, Math.round(offsetY / itemHeight))
  );
  return options[index]!;
}

type WheelPickerProps = {
  accessibilityLabel: string;
  formatValue: (value: number) => string;
  onChange: (value: number) => void;
  options: readonly number[];
  unit: string;
  value: number;
};

export function WheelPicker({
  accessibilityLabel,
  formatValue,
  onChange,
  options,
  unit,
  value,
}: WheelPickerProps) {
  const data = useMemo(() => createDescendingWheelOptions(options), [options]);
  const selectedIndex = Math.max(0, data.indexOf(value));
  const scrollY = useRef(
    new Animated.Value(getWheelOffset(selectedIndex))
  ).current;
  const listRef = useRef<Animated.FlatList<number>>(null);

  const selectIndex = (index: number, animated = true) => {
    const bounded = Math.max(0, Math.min(data.length - 1, index));
    listRef.current?.scrollToOffset({
      animated,
      offset: getWheelOffset(bounded),
    });
    onChange(data[bounded]!);
  };

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextValue = resolveWheelValue(
      data,
      event.nativeEvent.contentOffset.y
    );
    if (nextValue !== value) onChange(nextValue);
  };

  return (
    <View
      accessibilityActions={[
        { name: 'increment', label: 'Artır' },
        { name: 'decrement', label: 'Azalt' },
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: `${formatValue(value)} ${unit}` }}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') {
          selectIndex(selectedIndex - 1);
        } else if (event.nativeEvent.actionName === 'decrement') {
          selectIndex(selectedIndex + 1);
        }
      }}
      style={styles.container}
    >
      <View pointerEvents="none" style={styles.selectionBand} />
      <Animated.FlatList
        contentContainerStyle={styles.content}
        data={data}
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          index,
          length: WHEEL_ITEM_HEIGHT,
          offset: getWheelOffset(index),
        })}
        initialScrollIndex={selectedIndex}
        keyExtractor={(item) => String(item)}
        onMomentumScrollEnd={settle}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={settle}
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({
            animated: false,
            offset: getWheelOffset(index),
          });
        }}
        ref={listRef}
        renderItem={({ index, item }) => {
          const inputRange = [
            getWheelOffset(index - 2),
            getWheelOffset(index - 1),
            getWheelOffset(index),
            getWheelOffset(index + 1),
            getWheelOffset(index + 2),
          ];
          return (
            <Animated.View
              style={[
                styles.item,
                {
                  opacity: scrollY.interpolate({
                    extrapolate: 'clamp',
                    inputRange,
                    outputRange: [0.22, 0.58, 1, 0.58, 0.22],
                  }),
                  transform: [
                    {
                      scale: scrollY.interpolate({
                        extrapolate: 'clamp',
                        inputRange,
                        outputRange: [0.82, 0.9, 1.08, 0.9, 0.82],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.centeredRow}>
                <AppText style={styles.value} variant="metric">
                  {formatValue(item)}
                </AppText>
              </View>
            </Animated.View>
          );
        }}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={WHEEL_ITEM_HEIGHT}
        snapToOffsets={data.map((_, index) => getWheelOffset(index))}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centeredRow: {
    alignItems: 'center',
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
  },
  container: {
    height: WHEEL_VIEWPORT_HEIGHT,
    minWidth: 104,
    overflow: 'hidden',
  },
  content: {
    paddingBottom: WHEEL_EDGE_PADDING,
    paddingTop: WHEEL_EDGE_PADDING,
  },
  item: {
    alignItems: 'center',
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
  },
  list: { flexGrow: 0 },
  selectionBand: {
    backgroundColor: theme.colors.primarySoft,
    borderBottomColor: theme.colors.primary,
    borderBottomWidth: theme.borders.thin,
    borderTopColor: theme.colors.primary,
    borderTopWidth: theme.borders.thin,
    height: WHEEL_ITEM_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: WHEEL_EDGE_PADDING,
  },
  value: {
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: WHEEL_ITEM_HEIGHT,
    textAlignVertical: 'center',
  },
});
