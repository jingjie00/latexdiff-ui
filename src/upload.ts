import { applyFileToColumn, type ColumnSetup } from "./column";

export const FILE_INPUT_ACCEPT =
  ".tex,.ltx,.latex,.txt,.md,.bib,.sty,.cls,.bst,.bbl,text/*";

export const OLD_EDITOR_EMPTY_HINT = `Load your previous draft here (.tex or plain text):

• Paste LaTeX source (⌘V / Ctrl+V)
• Copy a file in Finder or File Explorer, then paste here
• Drag and drop a file onto this panel
• Click Upload (↑) in the column header
• Double-click here when empty`;

export const NEW_EDITOR_EMPTY_HINT = `Load your revised draft here (.tex or plain text):

• Paste LaTeX source (⌘V / Ctrl+V)
• Copy a file in Finder or File Explorer, then paste here
• Drag and drop a file onto this panel
• Click Upload (↑) in the column header
• Double-click here when empty`;

export function wireColumnUpload(setup: ColumnSetup, uploadBtn: HTMLButtonElement): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = FILE_INPUT_ACCEPT;
  input.hidden = true;
  setup.wrap.appendChild(input);

  const openPicker = () => {
    input.click();
  };

  uploadBtn.addEventListener("click", openPicker);

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }
    await applyFileToColumn(setup, file);
  });

  setup.textarea.addEventListener("dblclick", () => {
    if (setup.textarea.value.trim().length === 0) {
      openPicker();
    }
  });
}
