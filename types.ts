export type SwipeAction =
  | { type: 'keep' }
  | { type: 'delete' }
  | { type: 'album'; albumId: string; albumName: string };

export type AppSettings = {
  leftAction: SwipeAction;
  rightAction: SwipeAction;
};
