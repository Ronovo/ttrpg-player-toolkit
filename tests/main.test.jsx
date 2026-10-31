import { act } from '@testing-library/react';
import { expect, it } from 'vitest';

it("starts the app in the page's root element", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await act(() => import('../src/main.jsx'));
  expect(document.querySelector('#root h1').textContent).toBe('TTRPG Player Toolkit');
});
