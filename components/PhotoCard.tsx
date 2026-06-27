import React from 'react';
import { Dimensions, Image, StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SwipeAction } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;
const FLY_OFF_DISTANCE = SCREEN_WIDTH * 1.5;

type Props = {
  uri: string;
  leftAction: SwipeAction;
  rightAction: SwipeAction;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

function actionLabel(action: SwipeAction): string {
  if (action.type === 'delete') return 'DELETE';
  if (action.type === 'keep') return 'KEEP';
  return action.albumName.toUpperCase();
}

function actionColor(action: SwipeAction): string {
  if (action.type === 'delete') return '#ff4444';
  if (action.type === 'keep') return '#44cc44';
  return '#4488ff';
}

export function PhotoCard({ uri, leftAction, rightAction, onSwipeLeft, onSwipeRight }: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      const isLeft = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -800;
      const isRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > 800;

      if (isLeft) {
        translateX.value = withTiming(-FLY_OFF_DISTANCE, { duration: 250 }, () => {
          runOnJS(onSwipeLeft)();
        });
      } else if (isRight) {
        translateX.value = withTiming(FLY_OFF_DISTANCE, { duration: 250 }, () => {
          runOnJS(onSwipeRight)();
        });
      } else {
        translateX.value = withTiming(0, { duration: 300 });
        translateY.value = withTiming(0, { duration: 300 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
          [-20, 0, 20]
        )}deg`,
      },
    ],
  }));

  const leftLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -20, 0], [1, 0.2, 0], 'clamp'),
  }));

  const rightLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 20, SWIPE_THRESHOLD], [0, 0.2, 1], 'clamp'),
  }));

  const leftColor = actionColor(leftAction);
  const rightColor = actionColor(rightAction);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />

        <Animated.View style={[styles.labelWrap, styles.leftLabelWrap, leftLabelStyle]}>
          <Text style={[styles.label, { color: leftColor, borderColor: leftColor }]}>
            {actionLabel(leftAction)}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.labelWrap, styles.rightLabelWrap, rightLabelStyle]}>
          <Text style={[styles.label, { color: rightColor, borderColor: rightColor }]}>
            {actionLabel(rightAction)}
          </Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH - 32,
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#222',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  image: {
    flex: 1,
  },
  labelWrap: {
    position: 'absolute',
    top: 40,
  },
  leftLabelWrap: {
    left: 20,
    transform: [{ rotate: '-15deg' }],
  },
  rightLabelWrap: {
    right: 20,
    transform: [{ rotate: '15deg' }],
  },
  label: {
    fontSize: 28,
    fontWeight: '800',
    borderWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    letterSpacing: 2,
    overflow: 'hidden',
  },
});
