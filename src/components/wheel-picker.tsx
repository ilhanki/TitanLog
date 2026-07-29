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

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;

export function createDescendingWheelOptions(
  options: readonly number[]
): number[] {
  return [...new Set(options)].sort((left, right) => right - left);
}

export function resolveWheelValue(
  options: readonly number[],
  offsetY: number,
  itemHeight = ITEM_HEIGHT
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
    new Animated.Value(selectedIndex * ITEM_HEIGHT)
  ).current;
  const listRef = useRef<Animated.FlatList<number>>(null);

  const selectIndex = (index: number, animated = true) => {
    const bounded = Math.max(0, Math.min(data.length - 1, index));
    listRef.current?.scrollToOffset({
      animated,
      offset: bounded * ITEM_HEIGHT,
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
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
        })}
        initialScrollIndex={selectedIndex}
        keyExtractor={(item) => String(item)}
        onMomentumScrollEnd={settle}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={settle}
        ref={listRef}
        renderItem={({ index, item }) => {
          const inputRange = [
            (index - 2) * ITEM_HEIGHT,
            (index - 1) * ITEM_HEIGHT,
            index * ITEM_HEIGHT,
            (index + 1) * ITEM_HEIGHT,
            (index + 2) * ITEM_HEIGHT,
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
              <AppText style={styles.value} variant="metric">
                {formatValue(item)}
              </AppText>
            </Animated.View>
          );
        }}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={ITEM_HEIGHT}
        style={styles.list}
      />
    </View>
  );
}

const verticalPadding = ITEM_HEIGHT * ((VISIBLE_ITEMS - 1) / 2);

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    minWidth: 104,
    overflow: 'hidden',
  },
  content: { paddingVertical: verticalPadding },
  item: {
    alignItems: 'center',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
  },
  list: { flexGrow: 0 },
  selectionBand: {
    backgroundColor: theme.colors.primarySoft,
    borderBottomColor: theme.colors.primary,
    borderBottomWidth: theme.borders.thin,
    borderTopColor: theme.colors.primary,
    borderTopWidth: theme.borders.thin,
    height: ITEM_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: verticalPadding,
  },
  value: { color: theme.colors.text, fontVariant: ['tabular-nums'] },
});
