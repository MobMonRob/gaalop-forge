# QuantumGAALOP one-click code copying

Copy code copies the complete generated source as plain text in one click.
It calls navigator.clipboard.writeText directly from the click handler when
available. If that API is absent or rejects the write, it automatically tries
document.execCommand("copy") using a temporary, invisible textarea.
This fallback is synchronous when the standard API is absent, preserving
Firefox's user activation on remote HTTP pages.

The temporary field is removed and the original focus and selection restored.
The generated editor is not changed. There are no additional buttons,
selection steps, permission queries or confirmation dialogs added by the app.
Only a successful copy displays Copied; if the browser blocks both methods,
the existing status area reports the failure without claiming success.

Firefox supports the standard API in secure contexts. Remote HTTP origins
do not qualify, while localhost and loopback origins do. The legacy copy
command is deprecated and cannot guarantee success under every browser policy.
The backend, server protocol and generated mathematical code are unchanged.

Checks: node frontend/scripts/test-clipboard.mjs; from frontend, pnpm build.
Browser checks must verify the clipboard text after a single click on remote
HTTP, standard API success in a secure context, fallback after API rejection,
and honest failure reporting when both methods are blocked. Verify copying
with both the normal editor and the plain textarea fallback.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
