import { afterEach, expect, it, vi } from 'vitest';
import { EditorSelection } from '@quirekit/cm-state';
import { EditorView } from '../src/editorview';

let view: EditorView | undefined;
let host: HTMLElement | undefined;
afterEach(() => { view?.destroy(); host?.remove(); view = undefined; host = undefined; vi.restoreAllMocks(); vi.useRealTimers(); });

/** @param container - Whether one physical ancestor owns both axes. @returns A real mouse gesture with controlled frame time and canonical selection acceptance. */
function gesture(container = false) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  host = document.body.appendChild(document.createElement('div'));
  if (container) {
    host.style.overflowX = host.style.overflowY = 'auto';
    Object.defineProperties(host, {
      clientWidth: { value: 100 }, scrollWidth: { value: 1000 },
      clientHeight: { value: 100 }, scrollHeight: { value: 1000 },
    });
    host.scrollLeft = host.scrollTop = 100;
  }
  const get = vi.fn((event: MouseEvent) => EditorSelection.single(2, Math.max(0, Math.min(199, event.clientX))));
  view = new EditorView({ parent: host, doc: 'x'.repeat(200), extensions: [EditorView.mouseSelectionStyle.of(() => ({ get, update: () => false }))] });
  const editor = view;
  // Geometry and frame ownership are independent here; browser tests exercise
  // the real mounted text and the accepted state's rendered selection.
  frames.clear(); editor.measureScheduled = -1;
  vi.spyOn(editor, 'requestMeasure').mockImplementation(() => {});
  vi.spyOn(editor, 'hasFocus', 'get').mockReturnValue(true);
  vi.spyOn(editor.contentDOM, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 20));
  vi.spyOn(editor.docView, 'lineAt').mockReturnValue({ posAtStart: 0, posAtEnd: 200, dom: editor.contentDOM } as ReturnType<typeof editor.docView.lineAt>);
  vi.spyOn(editor, 'dispatch').mockImplementation(spec => { editor.viewState.state = editor.state.update(spec).state; });
  vi.spyOn(window.performance, 'now').mockReturnValue(0);
  editor.contentDOM.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1, clientX: 2, clientY: 10 }));
  const mouse = editor.inputState.mouseSelection!;
  expect(mouse).not.toBeNull();
  /** @param time - RAF timestamp in this View's window. */
  function frame(time: number): void {
    expect(frames.size).toBe(1);
    const [id, callback] = [...frames][0]!;
    frames.delete(id); callback(time);
  }
  return { editor, mouse, frames, frame, scrollBy, get, owner: host };
}

it('advances edge scrolling on each frame while keeping only one pending frame', () => {
  const fixture = gesture();
  fixture.mouse.setScrollSpeed(0, 8);
  fixture.mouse.setScrollSpeed(0, 8);
  fixture.frame(16); fixture.frame(32); fixture.frame(48);
  expect(fixture.scrollBy.mock.calls.map(call => call[1])).toEqual([2, 3, 2]);
  expect(fixture.frames.size).toBe(1);
});

for (const rate of [60, 120]) it(`preserves the same total speed at ${rate}Hz without losing fractional pixels`, () => {
  const fixture = gesture(); fixture.mouse.setScrollSpeed(0, 8);
  for (let index = 1; index <= rate; index++) fixture.frame(index * 1000 / rate);
  const distance = fixture.scrollBy.mock.calls.reduce((sum, call) => sum + Number(call[1]), 0);
  expect(distance).toBeGreaterThanOrEqual(159); expect(distance).toBeLessThanOrEqual(160);
});

it('retains separate physical axes and discards old fractional motion when reversing', () => {
  const fixture = gesture(true); fixture.mouse.setScrollSpeed(8, -8);
  expect(fixture.mouse.scrollParents).toEqual({ x: fixture.owner, y: fixture.owner });
  fixture.frame(10);
  expect([fixture.owner.scrollLeft, fixture.owner.scrollTop]).toEqual([101, 99]);
  fixture.mouse.setScrollSpeed(-8, 8); fixture.frame(20);
  expect([fixture.owner.scrollLeft, fixture.owner.scrollTop]).toEqual([100, 100]);
  expect(fixture.scrollBy).not.toHaveBeenCalled();
  const queued = [...fixture.frames.values()][0]!;
  fixture.mouse.setScrollSpeed(0, 0); queued(30); expect(fixture.frames.size).toBe(0);
});

it('caps movement after a paused frame instead of replaying missed scrolling', () => {
  const fixture = gesture(); fixture.mouse.setScrollSpeed(0, 8); fixture.frame(1000);
  expect(fixture.scrollBy).toHaveBeenLastCalledWith(0, 8);
  fixture.frame(1016); expect(fixture.scrollBy).toHaveBeenLastCalledWith(0, 2);
});

it('accepts the actual release coordinate even when no last mousemove arrived', () => {
  const fixture = gesture();
  fixture.mouse.move(new MouseEvent('mousemove', { buttons: 1, clientX: 15, clientY: 10 }));
  fixture.mouse.up(new MouseEvent('mouseup', { button: 0, clientX: 37, clientY: 10 }));
  expect(fixture.editor.state.selection.main.toJSON()).toEqual({ anchor: 2, head: 37 });
  expect(fixture.editor.inputState.mouseSelection).toBeNull();
});

it('keeps an existing native content drag from being replaced on release', () => {
  const fixture = gesture(); fixture.mouse.dragging = true;
  const selection = fixture.editor.state.selection; fixture.get.mockClear();
  fixture.mouse.up(new MouseEvent('mouseup', { clientX: 37, clientY: 10 }));
  expect(fixture.get).not.toHaveBeenCalled(); expect(fixture.editor.state.selection).toBe(selection);
});

for (const ending of ['pointercancel', 'blur']) it(`preserves native content drag ownership on ${ending}`, () => {
  const fixture = gesture(), content = EditorSelection.range(2, 15);
  fixture.mouse.setScrollSpeed(0, 8); fixture.mouse.dragging = true;
  fixture.editor.inputState.draggedContent = content;
  (ending === 'blur' ? window : document).dispatchEvent(new Event(ending));
  expect(fixture.frames.size).toBe(0);
  expect(fixture.editor.inputState.draggedContent).toBe(content);
  expect(fixture.editor.inputState.mouseSelection).toBe(fixture.mouse);
});

it('does not requeue a frame when accepting its selection ends the gesture', () => {
  const fixture = gesture(); fixture.get.mockReturnValue(EditorSelection.single(2, 20));
  vi.mocked(fixture.editor.dispatch).mockImplementation(spec => {
    fixture.editor.viewState.state = fixture.editor.state.update(spec).state; fixture.mouse.destroy();
  });
  fixture.mouse.setScrollSpeed(0, 8); fixture.frame(16);
  expect(fixture.editor.state.selection.main.head).toBe(20); expect(fixture.frames.size).toBe(0);
});

for (const ending of ['mouseup', 'pointercancel', 'blur', 'destroy']) it(`stops frames and stale selection work after ${ending}`, () => {
  const fixture = gesture(); fixture.mouse.setScrollSpeed(0, 8);
  expect(fixture.frames.size).toBe(1);
  const queued = [...fixture.frames.values()][0]!;
  if (ending === 'mouseup') fixture.mouse.up(new MouseEvent('mouseup', { clientX: 25, clientY: 10 }));
  else if (ending === 'pointercancel') document.dispatchEvent(new Event('pointercancel'));
  else if (ending === 'blur') window.dispatchEvent(new Event('blur'));
  else fixture.editor.destroy();
  const selection = fixture.editor.state.selection, queries = fixture.get.mock.calls.length;
  expect(fixture.frames.size).toBe(0);
  queued(50); fixture.mouse.select(new MouseEvent('mousemove', { clientX: 90, clientY: 10 }));
  expect(fixture.scrollBy).not.toHaveBeenCalled();
  expect(fixture.get).toHaveBeenCalledTimes(queries);
  expect(fixture.editor.state.selection).toBe(selection);
});
