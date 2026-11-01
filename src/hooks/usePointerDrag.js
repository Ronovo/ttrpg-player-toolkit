import { useRef } from "react";

// Pointer handlers for dragging something. On a press, `start(event)` returns what the drag needs to remember; as
// the pointer moves, `move(remembered, dx, dy)` gets it with the distance from the press, in pixels.
export default function usePointerDrag(start, move) {
  const drag = useRef(null);

  function end() {
    drag.current = null;
  }

  return {
    onPointerDown(event) {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, y: event.clientY, from: start(event) };
    },
    onPointerMove(event) {
      const current = drag.current;
      if (current) move(current.from, event.clientX - current.x, event.clientY - current.y);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}
