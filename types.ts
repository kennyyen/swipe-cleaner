import type { Asset } from 'expo-media-library';

export type SwipeAction =
  | { type: 'keep' }
  | { type: 'delete' }
  | { type: 'album'; albumId: string; albumName: string };

export type AppSettings = {
  leftAction: SwipeAction;
  rightAction: SwipeAction;
};

export type PhotoGroup = {
  id: string;        // first asset's id — used as React key
  assets: Asset[];
  isBurst: boolean;  // true when more than one photo
};
