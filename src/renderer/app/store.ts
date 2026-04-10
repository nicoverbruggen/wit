/**
 * Owns: a minimal synchronous in-memory store used by renderer modules.
 * Out of scope: persistence, middleware, and async orchestration.
 * Inputs/Outputs: reducer-driven dispatch and subscribe/getState API.
 * Side effects: invokes subscribers synchronously after each dispatch.
 */

export type StoreReducer<TState, TAction> = (state: TState, action: TAction) => TState;

export type StoreListener = () => void;

export type RendererStore<TState, TAction> = {
  getState: () => TState;
  dispatch: (action: TAction) => void;
  subscribe: (listener: StoreListener) => () => void;
};

/**
 * Creates a lightweight synchronous store with reducer-based updates.
 *
 * @param options.initialState Initial state snapshot.
 * @param options.reducer Pure reducer used for state transitions.
 * @returns Store instance with `getState`, `dispatch`, and `subscribe`.
 */
export function createRendererStore<TState, TAction>(options: {
  initialState: TState;
  reducer: StoreReducer<TState, TAction>;
}): RendererStore<TState, TAction> {
  let state = options.initialState;
  const listeners = new Set<StoreListener>();

  const dispatch = (action: TAction): void => {
    state = options.reducer(state, action);

    for (const listener of listeners) {
      listener();
    }
  };

  const subscribe = (listener: StoreListener): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState: () => state,
    dispatch,
    subscribe
  };
}
