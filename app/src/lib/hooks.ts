/**
 * Realtime Firestore hooks (SPEC: Firestore listeners are the source of
 * truth). Generic snapshot subscriptions plus small typed wrappers.
 */

import { useEffect, useState } from 'react';
import {
  onSnapshot,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export interface QueryState<T> {
  data: WithId<T>[];
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a query, attaching each doc's id. `query` must be memoized by
 * the caller (deps). Returns rows typed as the doc type plus `{ id }`.
 */
export function useQuery<T>(query: Query<T> | null): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!query) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const unsub = onSnapshot(
      query,
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as WithId<T>);
        setState({ data, loading: false, error: null });
      },
      (error) => setState({ data: [], loading: false, error }),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return state;
}

export interface DocState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/** Subscribe to a single document. `ref` must be memoized by the caller. */
export function useDoc<T>(ref: DocumentReference<T> | null): DocState<T> {
  const [state, setState] = useState<DocState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const unsub = onSnapshot(
      ref,
      (snap) => setState({ data: snap.exists() ? (snap.data() as T) : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return state;
}
