import { prepareLocalFeedback } from "virtual:local-feedback-sdk";
import "./feedback.css";

const MAX_BYTES = 8 * 1024 * 1024;
const PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10];

export async function validFeedbackPng(file: Blob): Promise<boolean> {
  if (file.type !== "image/png" || file.size <= PNG_HEADER.length || file.size > MAX_BYTES) return false;
  const header = new Uint8Array(await file.slice(0, PNG_HEADER.length).arrayBuffer());
  return PNG_HEADER.every((byte, i) => header[i] === byte);
}

export function mountLocalFeedback(host: HTMLElement): void {
  const root = document.createElement("aside");
  root.className = "local-feedback";
  root.innerHTML = `
    <button type="button">Feedback</button>
    <dialog aria-labelledby="local-feedback-title">
      <form>
        <h2 id="local-feedback-title">Local screenshot feedback</h2>
        <p>Framebriar delivery is unavailable. Local export only.</p>
        <p>Choose a PNG showing only this stand-in preview. Check the image for anything private before continuing.
        This dry run never uploads your screenshot. Nothing is saved unless you download the report.</p>
        <label>Preview screenshot (PNG, up to 8 MiB)
          <input name="screenshot" type="file" accept="image/png" required>
        </label>
        <img alt="Selected screenshot for review" hidden>
        <label>Notes <textarea name="notes" maxlength="2000" rows="4"></textarea></label>
        <p role="status" aria-live="polite"></p>
        <button type="submit" disabled>Run local check</button>
        <button type="button" hidden>Download local report (JSON)</button>
        <button type="button" hidden>Download screenshot (PNG)</button>
        <button type="button">Close</button>
      </form>
    </dialog>`;
  const open = root.querySelector("button")!;
  const dialog = root.querySelector("dialog")!;
  const form = root.querySelector("form")!;
  const fileInput = root.querySelector("input")!;
  const notes = root.querySelector("textarea")!;
  const img = root.querySelector("img")!;
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const check = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const [download, downloadPng, close] = form.querySelectorAll<HTMLButtonElement>('[type="button"]');
  let report: Blob | undefined;
  let reportImage: Blob | undefined;
  let capturedAt = "";
  function clearReport() {
    report = undefined;
    reportImage = undefined;
    download.hidden = downloadPng.hidden = true;
  }

  function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  download.addEventListener("click", () => {
    if (report) downloadFile(report, "bramblepost-preview-feedback.json");
  });
  downloadPng.addEventListener("click", () => {
    if (reportImage) downloadFile(reportImage, "bramblepost-preview-feedback.png");
  });
  let imageUrl: string | undefined;
  let reviewed: File | undefined;
  let selection = 0;
  let review = 0;

  function clearImage() {
    clearReport();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = undefined;
    reviewed = undefined;
    img.hidden = check.disabled = true;
    img.removeAttribute("src");
  }

  open.addEventListener("click", () => dialog.showModal());
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    selection++;
    clearImage();
    form.reset();
    status.textContent = "";
  });

  fileInput.addEventListener("change", async () => {
    const ticket = ++selection;
    clearImage();
    status.textContent = "";
    capturedAt = new Date().toISOString();
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (!(await validFeedbackPng(file))) throw Error();
      if (ticket !== selection) return;
      const url = imageUrl = URL.createObjectURL(file);
      img.src = url;
      await img.decode();
      if (ticket !== selection) return;
      if (!img.naturalWidth || !img.naturalHeight) throw Error();
      img.hidden = false;
      reviewed = file;
      check.disabled = false;
    } catch {
      if (ticket !== selection) return;
      clearImage();
      status.textContent = "Choose a readable PNG of up to 8 MiB.";
    }
  });

  notes.addEventListener("input", () => {
    review++;
    clearReport();
    check.disabled = !reviewed;
    status.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!reviewed || check.disabled) return;
    const ticket = selection;
    const revision = review;
    const current = () => ticket === selection && revision === review;
    const file = reviewed;
    const reviewedNotes = notes.value;
    const timestamp = capturedAt;
    clearReport();
    check.disabled = true;
    try {
      let result: Blob;
      if (prepareLocalFeedback) {
        const prepared = await prepareLocalFeedback({ blob: file, notes: reviewedNotes, captureContext: {
          gameId: "bramblepost-preview",
          capturedAt: timestamp,
          scene: "stand-in-preview",
          platform: "browser",
          input: "unknown",
          buildSha: null,
        } });
        if (!prepared.report.media?.sha256) throw Error();
        result = prepared.metadata;
      } else {
        const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        result = new Blob([JSON.stringify({
          kind: "bramblepost-local-dry-run",
          capturedAt: timestamp,
          notes: reviewedNotes,
          media: { type: file.type, bytes: file.size,
            sha256: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("") },
        }, null, 2)], { type: "application/json" });
      }
      if (!current()) return;
      report = result;
      reportImage = file;
      download.hidden = downloadPng.hidden = false;
      status.textContent = prepareLocalFeedback
        ? "Framebriar prepared the screenshot locally. Nothing was sent."
        : "Screenshot checked locally without the Framebriar SDK. Nothing was sent.";
    } catch {
      if (current()) status.textContent = "The local check failed. Nothing was sent.";
    } finally {
      if (current()) check.disabled = false;
    }
  });
  host.append(root);
}
