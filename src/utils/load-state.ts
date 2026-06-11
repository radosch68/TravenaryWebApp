// Shared page-level fetch lifecycle. Pages use the subset of states they need;
// 'idle' is for deferred loads, 'not-found' for routes resolving a missing resource.
export type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'not-found'
