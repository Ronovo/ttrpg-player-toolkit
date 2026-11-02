import { useEffect, useRef, useState } from "react";
import useAccount from "../hooks/useAccount.jsx";
import { api } from "../lib/api.js";
import { downloadFile } from "../lib/download.js";
import { LoginLink } from "./AccountMenu.jsx";
import Confirm from "./Confirm.jsx";
import Icon from "./Icon.jsx";

const SAVE_DELAY_MS = 2000;
const PDF_TYPE = "application/pdf";

function loadReader() {
  return import("../sheet/reader.js");
}

// One uploaded sheet in the PDF reader. What is typed into its fields is saved SAVE_DELAY_MS after typing stops,
// and straight away when the reader closes with a save still waiting, unless `dropping` holds this sheet's id
// because it is being removed or replaced.
function SheetView({ sheet, dropping }) {
  const container = useRef(null);
  const reader = useRef(null);
  const timer = useRef(null);
  const [opened, setOpened] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function save() {
    timer.current = null;
    if (dropping.current === sheet.id) return;
    setStatus("Saving...");
    try {
      await api("/api/sheet/values", { method: "PUT", body: JSON.stringify(reader.current.values()) });
      setStatus("Saved");
    } catch (failure) {
      setStatus("");
      setError(failure.message);
    }
  }

  useEffect(() => {
    let closed = false;
    function changed() {
      setStatus("Not saved yet");
      clearTimeout(timer.current);
      timer.current = setTimeout(save, SAVE_DELAY_MS);
    }
    async function open() {
      const response = await fetch("/api/sheet/file");
      if (!response.ok) throw new Error(response.statusText);
      const [bytes, { openSheet }] = await Promise.all([response.arrayBuffer(), loadReader()]);
      if (closed) return;
      const handle = await openSheet(container.current, new Uint8Array(bytes), sheet.values, changed);
      if (closed) {
        handle.close();
        return;
      }
      reader.current = handle;
      setOpened({ pages: handle.pages, fillable: handle.fillable });
    }
    open().catch(() => setError("That PDF could not be opened."));
    return () => {
      closed = true;
      if (timer.current) {
        clearTimeout(timer.current);
        save();
      }
      reader.current?.close();
    };
  }, []);

  async function download() {
    try {
      downloadFile(await reader.current.filled(), sheet.name, PDF_TYPE);
    } catch {
      setError("The PDF could not be prepared for download.");
    }
  }

  return (
    <>
      <div className="sheet-toolbar">
        <span className="sheet-name">{sheet.name}</span>
        {opened && <span className="chip">{opened.pages} {opened.pages === 1 ? "page" : "pages"}</span>}
        <button type="button" className="secondary" aria-label="Zoom out" disabled={!opened} onClick={() => reader.current.zoomOut()}>
          <Icon name="minus" />
        </button>
        <button type="button" className="secondary" aria-label="Zoom in" disabled={!opened} onClick={() => reader.current.zoomIn()}>
          <Icon name="plus" />
        </button>
        <button type="button" className="secondary" disabled={!opened} onClick={() => reader.current.fitWidth()}>Fit width</button>
        <button type="button" disabled={!opened} onClick={download}>
          <Icon name="download" />
          Download
        </button>
        <span className="sheet-status" aria-live="polite">{status}</span>
      </div>
      {opened && !opened.fillable && <p className="form-note">This PDF has no form fields to fill in.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sheet-stage">
        <div className="sheet-scroll" ref={container}>
          <div className="pdfViewer" />
        </div>
      </div>
    </>
  );
}

// The logged-in account's sheet: uploading, replacing and removing it, and the reader once there is one.
function SheetShelf() {
  const [sheet, setSheet] = useState(undefined);
  const [error, setError] = useState("");
  const [replacing, setReplacing] = useState(null);
  const [removing, setRemoving] = useState(false);
  const dropping = useRef(null);

  useEffect(() => {
    api("/api/sheet").then((data) => setSheet(data.sheet)).catch((failure) => setError(failure.message));
  }, []);

  async function upload(file) {
    setReplacing(null);
    setError("");
    dropping.current = sheet?.id;
    const form = new FormData();
    form.append("file", file);
    try {
      setSheet((await api("/api/sheet", { method: "PUT", body: form })).sheet);
    } catch (failure) {
      dropping.current = null;
      setError(failure.message);
    }
  }

  function choose(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    if (sheet) setReplacing(file);
    else upload(file);
  }

  async function remove() {
    setRemoving(false);
    dropping.current = sheet.id;
    try {
      await api("/api/sheet", { method: "DELETE" });
      setSheet(null);
    } catch (failure) {
      dropping.current = null;
      setError(failure.message);
    }
  }

  return (
    <>
      <div className="controls">
        <label className="file-button">
          <Icon name="upload" />
          Upload PDF
          <input type="file" accept=".pdf,application/pdf" className="visually-hidden" onChange={choose} />
        </label>
        {sheet && <button type="button" className="secondary" onClick={() => setRemoving(true)}>Remove</button>}
      </div>
      {replacing && (
        <Confirm
          text={`Replace ${sheet.name} with ${replacing.name}? What is filled in on ${sheet.name} goes with it.`}
          yes="Replace"
          no="Keep current"
          onYes={() => upload(replacing)}
          onNo={() => setReplacing(null)}
        />
      )}
      {removing && (
        <Confirm
          text={`Remove ${sheet.name} and everything filled in on it?`}
          yes="Remove"
          no="Keep"
          onYes={remove}
          onNo={() => setRemoving(false)}
        />
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {sheet === null && <p className="form-note">Upload a character sheet PDF. A fillable one can be filled in right here.</p>}
      {sheet && <SheetView key={sheet.id} sheet={sheet} dropping={dropping} />}
    </>
  );
}

export default function CharacterSheet() {
  const { account } = useAccount();
  return (
    <section className="panel character-sheet">
      <h2><Icon name="sheet" />Character Sheet</h2>
      {!account.enabled && (
        <p className="form-note">
          The character sheet is kept with a portfolio account, and portfolio login is not turned on for this server.
        </p>
      )}
      {account.enabled && !account.username && (
        <div className="sheet-login">
          <p>Log in with your portfolio account to keep a character sheet.</p>
          <LoginLink />
        </div>
      )}
      {account.username && <SheetShelf />}
    </section>
  );
}
