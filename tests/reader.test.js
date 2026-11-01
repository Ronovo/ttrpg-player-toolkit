import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// pdf.js needs a real browser, so it is replaced by stand-ins that record what the reader asks of it.
const fakes = vi.hoisted(() => ({ viewers: [], links: [], buses: [] }));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  AnnotationEditorType: { DISABLE: -1 },
  AnnotationMode: { ENABLE_FORMS: 2 },
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist/legacy/web/pdf_viewer.mjs', () => ({
  EventBus: class {
    constructor() {
      this.handlers = {};
      fakes.buses.push(this);
    }
    on(name, handler) { this.handlers[name] = handler; }
  },
  PDFLinkService: class {
    constructor(options) {
      this.options = options;
      fakes.links.push(this);
    }
    setViewer(viewer) { this.viewer = viewer; }
    setDocument(pdf) { this.pdf = pdf; }
  },
  PDFViewer: class {
    constructor(options) {
      this.options = options;
      this.currentScaleValue = 'auto';
      this.increaseScale = vi.fn();
      this.decreaseScale = vi.fn();
      this.cleanup = vi.fn();
      fakes.viewers.push(this);
    }
    setDocument(pdf) { this.pdf = pdf; }
  },
}));

vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({ default: '/assets/pdf.worker.js' }));

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { openSheet } = await import('../src/sheet/reader.js');

// Behaves like pdf.js's AnnotationStorage: onSetModified fires on the first change after resetModified.
class Storage {
  map = new Map();
  modified = false;
  onSetModified = null;
  get size() { return this.map.size; }
  setValue(id, value) {
    const old = this.map.get(id);
    if (old) Object.assign(old, value);
    else this.map.set(id, value);
    if (!this.modified) {
      this.modified = true;
      this.onSetModified?.();
    }
  }
  resetModified() { this.modified = false; }
  get serializable() { return { map: this.map.size ? new Map(this.map) : null }; }
}

function fakePdf(info = { IsAcroFormPresent: true }) {
  return {
    numPages: 3,
    annotationStorage: new Storage(),
    getMetadata: vi.fn(async () => ({ info })),
    saveDocument: vi.fn(async () => new Uint8Array([1, 2])),
    getData: vi.fn(async () => new Uint8Array([3])),
    destroy: vi.fn(),
  };
}

function container() {
  const element = document.createElement('div');
  element.append(document.createElement('div'));
  return element;
}

beforeEach(() => {
  Object.values(fakes).forEach((list) => list.splice(0));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('the PDF reader', () => {
  it('points pdf.js at its worker', () => {
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe('/assets/pdf.worker.js');
  });

  it('opens the PDF with live form fields, fills in the saved values and fits the page width', async () => {
    const pdf = fakePdf();
    pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve(pdf) });
    const box = container();
    const data = new Uint8Array([9]);
    const onChange = vi.fn();
    const sheet = await openSheet(box, data, { '4R': { value: 'Thorin' } }, onChange);

    expect(pdfjs.getDocument).toHaveBeenCalledWith({ data });
    const [viewer] = fakes.viewers;
    expect(viewer.options).toEqual(expect.objectContaining({
      container: box, viewer: box.firstElementChild, annotationMode: 2, annotationEditorMode: -1,
      eventBus: fakes.buses[0], linkService: fakes.links[0],
    }));
    expect([fakes.links[0].viewer, fakes.links[0].pdf, viewer.pdf]).toEqual([viewer, pdf, pdf]);
    expect(pdf.annotationStorage.map.get('4R')).toEqual({ value: 'Thorin' });
    expect(onChange).not.toHaveBeenCalled();
    expect([sheet.pages, sheet.fillable]).toEqual([3, true]);

    fakes.buses[0].handlers.pagesinit();
    expect(viewer.currentScaleValue).toBe('page-width');
    pdf.annotationStorage.setValue('4R', { value: 'Gimli' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('tells a PDF with an XFA form or no form at all apart', async () => {
    for (const [info, fillable] of [[{ IsXFAPresent: true }, true], [{}, false]]) {
      pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve(fakePdf(info)) });
      expect((await openSheet(container(), new Uint8Array(), {}, vi.fn())).fillable).toBe(fillable);
    }
  });

  it('hands out a copy of the typed values and waits for the next change before calling again', async () => {
    const pdf = fakePdf();
    pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve(pdf) });
    const onChange = vi.fn();
    const sheet = await openSheet(container(), new Uint8Array(), {}, onChange);
    expect(sheet.values()).toEqual({});

    pdf.annotationStorage.setValue('4R', { value: 'Thorin' });
    const values = sheet.values();
    pdf.annotationStorage.setValue('4R', { value: 'Thorin Oakenshield' });
    expect(values).toEqual({ '4R': { value: 'Thorin' } });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('zooms, fits the width, writes the filled PDF and closes', async () => {
    const pdf = fakePdf();
    pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve(pdf) });
    const sheet = await openSheet(container(), new Uint8Array(), {}, vi.fn());
    const [viewer] = fakes.viewers;
    sheet.zoomIn();
    sheet.zoomOut();
    viewer.currentScaleValue = 1.5;
    sheet.fitWidth();
    expect([viewer.increaseScale.mock.calls.length, viewer.decreaseScale.mock.calls.length, viewer.currentScaleValue])
      .toEqual([1, 1, 'page-width']);

    expect(await sheet.filled()).toEqual(new Uint8Array([3]));
    pdf.annotationStorage.setValue('4R', { value: 'Thorin' });
    expect(await sheet.filled()).toEqual(new Uint8Array([1, 2]));

    sheet.close();
    expect([pdf.annotationStorage.onSetModified, viewer.cleanup.mock.calls.length, pdf.destroy.mock.calls.length])
      .toEqual([null, 1, 1]);
  });
});
