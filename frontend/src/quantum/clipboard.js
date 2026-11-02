// Call directly from the click handler: Firefox requires user activation.
export async function copyText(text, env = globalThis) {
  if (typeof text !== "string" || !text) return false;
  try {
    if (typeof env.navigator?.clipboard?.writeText === "function") {
      await env.navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* A denied Clipboard API call can still allow selection-based copy. */ }
  // With no Clipboard API (for example on HTTP), run before any await.
  return copySelection(text, env.document);
}

function copySelection(text, document) {
  if (!document?.body || typeof document.execCommand !== "function") return false;
  const active = document.activeElement;
  const selection = document.getSelection?.();
  const ranges = [];
  for (let index = 0; index < (selection?.rangeCount || 0); index++) ranges.push(selection.getRangeAt(index).cloneRange());
  const inputSelection = typeof active?.selectionStart === "number"
    ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  try {
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    // Compatibility fallback only; deprecated browsers may reject it as well.
    return document.execCommand("copy") === true;
  } catch { return false; }
  finally {
    textarea.remove();
    try {
      if (active?.isConnected) {
        active.focus({ preventScroll: true });
        if (inputSelection) active.setSelectionRange(...inputSelection);
      }
      if (selection) {
        selection.removeAllRanges();
        for (const range of ranges) selection.addRange(range);
      }
    } catch { /* The original element or selection may have been removed. */ }
  }
}
