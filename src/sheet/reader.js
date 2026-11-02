// The PDF reader behind the Character Sheet tab, built on pdf.js. It uses pdf.js's legacy build, which carries
// its own fallbacks for the newest JavaScript features, so sheets open in browsers that are not the very latest.
import { AnnotationEditorType, AnnotationMode, GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { EventBus, PDFLinkService, PDFViewer } from "pdfjs-dist/legacy/web/pdf_viewer.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/legacy/web/pdf_viewer.css";

GlobalWorkerOptions.workerSrc = workerUrl;

const FIT_WIDTH = "page-width";

// Shows the PDF in `data` (its bytes) in `container`, which must be absolutely positioned and hold one empty
// <div> for the pages. `values` are filled into its form fields before anything is drawn. `onChange` runs on the
// first field change after the values were last read, so a caller saving on it saves once per round of typing.
export async function openSheet(container, data, values, onChange) {
  const eventBus = new EventBus();
  const linkService = new PDFLinkService({ eventBus });
  const viewer = new PDFViewer({
    container,
    viewer: container.firstElementChild,
    eventBus,
    linkService,
    annotationMode: AnnotationMode.ENABLE_FORMS,
    annotationEditorMode: AnnotationEditorType.DISABLE,
  });
  linkService.setViewer(viewer);
  const task = getDocument({ data });
  const pdf = await task.promise;
  const storage = pdf.annotationStorage;
  Object.entries(values).forEach(([id, value]) => storage.setValue(id, value));
  storage.resetModified();
  storage.onSetModified = onChange;
  eventBus.on("pagesinit", () => (viewer.currentScaleValue = FIT_WIDTH));
  viewer.setDocument(pdf);
  linkService.setDocument(pdf);
  const { info } = await pdf.getMetadata();

  return {
    pages: pdf.numPages,
    fillable: Boolean(info.IsAcroFormPresent || info.IsXFAPresent),
    // What is typed into the fields, as a copy: pdf.js keeps changing its own objects as the player types.
    values() {
      const { map } = storage.serializable;
      storage.resetModified();
      return map ? JSON.parse(JSON.stringify(Object.fromEntries(map))) : {};
    },
    zoomIn: () => viewer.increaseScale(),
    zoomOut: () => viewer.decreaseScale(),
    fitWidth: () => (viewer.currentScaleValue = FIT_WIDTH),
    // The PDF with the typed values written into it, or as uploaded when nothing has been typed.
    filled: () => (storage.size ? pdf.saveDocument() : pdf.getData()),
    close() {
      storage.onSetModified = null;
      viewer.cleanup();
      task.destroy();
    },
  };
}
