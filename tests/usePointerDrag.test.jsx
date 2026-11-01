import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import usePointerDrag from '../src/hooks/usePointerDrag.js';

afterEach(cleanup);

function Handle({ start, move }) {
  return <div data-testid="handle" {...usePointerDrag(start, move)} />;
}

it('remembers what start returns and reports the distance from the press until the pointer lets go', () => {
  const capture = vi.fn();
  const start = vi.fn(() => 'window');
  const move = vi.fn();
  const { getByTestId } = render(<Handle start={start} move={move} />);
  const handle = getByTestId('handle');
  handle.setPointerCapture = capture;

  fireEvent.pointerMove(handle, { clientX: 5, clientY: 5 });
  fireEvent.pointerDown(handle, { clientX: 10, clientY: 20, pointerId: 7 });
  fireEvent.pointerMove(handle, { clientX: 25, clientY: 5 });
  fireEvent.pointerUp(handle);
  fireEvent.pointerMove(handle, { clientX: 99, clientY: 99 });

  expect(capture).toHaveBeenCalledWith(7);
  expect(start).toHaveBeenCalledTimes(1);
  expect(move.mock.calls).toEqual([['window', 15, -15]]);
});
