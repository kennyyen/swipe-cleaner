import React from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SwipeAction } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;
const FLY_OFF_DISTANCE = SCREEN_WIDTH * 1.5;
const MAX_ZOOM = 5;

type Props = {
  uri: string;
  creationTime: number | null;
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

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PhotoCard({
  uri,
  creationTime,
  leftAction,
  rightAction,
  onSwipeLeft,
  onSwipeRight,
}: Props) {
  // Card-level swipe values
  const swipeX = useSharedValue(0);
  const swipeY = useSharedValue(0);

  // Image-level zoom + pan values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const imgX = useSharedValue(0);
  const imgY = useSharedValue(0);
  const savedImgX = useSharedValue(0);
  const savedImgY = useSharedValue(0);

  const resetZoom = () => {
    'worklet';
    scale.value = withSpring(1, { damping: 20 });
    imgX.value = withSpring(0, { damping: 20 });
    imgY.value = withSpring(0, { damping: 20 });
    savedScale.value = 1;
    savedImgX.value = 0;
    savedImgY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        resetZoom();
      } else {
        savedScale.value = scale.value;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value > 1.01) {
        resetZoom();
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1.01) {
        // Panning within zoomed image — don't swipe
        imgX.value = savedImgX.value + e.translationX;
        imgY.value = savedImgY.value + e.translationY;
      } else {
        // Swiping the card
        swipeX.value = e.translationX;
        swipeY.value = e.translationY * 0.4;
      }
    })
    .onEnd((e) => {
      if (scale.value > 1.01) {
        savedImgX.value = imgX.value;
        savedImgY.value = imgY.value;
      } else {
        const isLeft = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -800;
        const isRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > 800;
        if (isLeft) {
          swipeX.value = withTiming(-FLY_OFF_DISTANCE, { duration: 250 }, () => {
            runOnJS(onSwipeLeft)();
          });
        } else if (isRight) {
          swipeX.value = withTiming(FLY_OFF_DISTANCE, { duration: 250 }, () => {
            runOnJS(onSwipeRight)();
          });
        } else {
          swipeX.value = withTiming(0, { duration: 300 });
          swipeY.value = withTiming(0, { duration: 300 });
        }
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: swipeX.value },
      { translateY: swipeY.value },
      {
        rotate: `${interpolate(
          swipeX.value,
          [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
          [-20, 0, 20]
        )}deg`,
      },
    ],
  }));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: imgX.value },
      { translateY: imgY.value },
    ],
  }));

  // Hide swipe labels while zoomed in
  const leftLabelStyle = useAnimatedStyle(() => ({
    opacity:
      scale.value > 1.01
        ? 0
        : interpolate(swipeX.value, [-SWIPE_THRESHOLD, -20, 0], [1, 0.2, 0], 'clamp'),
  }));

  const rightLabelStyle = useAnimatedStyle(() => ({
    opacity:
      scale.value > 1.01
        ? 0
        : interpolate(swipeX.value, [0, 20, SWIPE_THRESHOLD], [0, 0.2, 1], 'clamp'),
  }));

  const leftColor = actionColor(leftAction);
  const rightColor = actionColor(rightAction);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.card, cardStyle]}>
        {/* Zoomable image */}
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, imageStyle]}
          resizeMode="cover"
        />

        {/* Timestamp */}
        {creationTime != null && (
          <Animated.View style={[styles.timestamp, useAnimatedStyle(() => ({
            opacity: scale.value > 1.01 ? 0 : 1,
          }))]}>
            <Text style={styles.timestampText}>{formatDate(creationTime)}</Text>
          </Animated.View>
        )}

        {/* Swipe action labels */}
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
  timestamp: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  timestampText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
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
