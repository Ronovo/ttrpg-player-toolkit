import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useStoredState from '../src/hooks/useStoredState.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useStoredState', () => {
  it('starts from the stored value, or the default when nothing is stored', () => {
    localStorage.setItem('kept', 'dark');
    expect(renderHook(() => useStoredState('kept', 'light')).result.current[0]).toBe('dark');
    expect(renderHook(() => useStoredState('new', 'light')).result.current[0]).toBe('light');
  });

  it('stores every change', () => {
    const { result } = renderHook(() => useStoredState('theme', 'light'));
    act(() => result.current[1]('dark'));
    expect(result.current[0]).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('uses the default for a stored value that is no longer allowed', () => {
    localStorage.setItem('theme', 'retired-theme');
    const { result } = renderHook(() => useStoredState('theme', 'light', ['light', 'dark']));
    expect(result.current[0]).toBe('light');
    act(() => result.current[1]('dark'));
    expect(result.current[0]).toBe('dark');
  });

  it('keeps working for the session when storage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useStoredState('notes', ''));
    act(() => result.current[1]('a long note'));
    expect(result.current[0]).toBe('a long note');
  });

  it('starts from the default when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    expect(renderHook(() => useStoredState('theme', 'light')).result.current[0]).toBe('light');
  });
});
