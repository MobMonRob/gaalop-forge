import assert from "node:assert/strict";
import { test } from "node:test";
import { copyText } from "../src/quantum/clipboard.js";

const code = "function psi = state(b0)\npsi(1) = b0 / 2; % α\nend\n";
function selectionEnvironment(result = true) {
  const calls = [];
  const originalRange = { cloneRange: () => originalRange };
  const selection = { rangeCount: 1, getRangeAt: () => originalRange,
    removeAllRanges: () => calls.push("clear selection"), addRange: range => calls.push(range) };
  const active = { isConnected: true, selectionStart: 2, selectionEnd: 5, selectionDirection: "backward",
    focus: () => calls.push("restore focus"), setSelectionRange: (...args) => calls.push(args) };
  const textarea = { style: {}, focus: () => calls.push("focus"), select: () => calls.push("select"), remove: () => calls.push("remove") };
  const document = { activeElement: active, getSelection: () => selection,
    body: { appendChild: element => assert.equal(element, textarea) },
    createElement: name => { assert.equal(name, "textarea"); return textarea; },
    execCommand: command => { assert.equal(command, "copy"); calls.push(textarea.value); if (result instanceof Error) throw result; return result; } };
  return { env: { document }, calls, textarea, originalRange };
}

test("standard Clipboard API starts immediately and copies the complete text", async () => {
  let written;
  const pending = copyText(code, { navigator: { clipboard: { writeText: text => { written = text; return Promise.resolve(); } } } });
  assert.equal(written, code);
  assert.equal(await pending, true);
});

test("missing Clipboard API uses selection copy synchronously and restores focus and selection", async () => {
  const { env, calls, textarea, originalRange } = selectionEnvironment();
  const pending = copyText(code, env);
  assert.ok(calls.includes(code));
  assert.equal(await pending, true);
  assert.equal(textarea.readOnly, true);
  assert.deepEqual(calls.slice(-5), ["remove", "restore focus", [2, 5, "backward"], "clear selection", originalRange]);
});

test("rejected Clipboard API falls back to selection copy", async () => {
  const { env, calls } = selectionEnvironment();
  env.navigator = { clipboard: { writeText: async () => { throw new Error("NotAllowedError"); } } };
  assert.equal(await copyText(code, env), true);
  assert.ok(calls.includes(code));
});

test("a browser returning false never reports copied", async () => {
  const { env, calls } = selectionEnvironment(false);
  assert.equal(await copyText(code, env), false);
  assert.ok(calls.includes("remove"));
  assert.ok(calls.includes("restore focus"));
});

test("a throwing legacy copy is cleaned up and reports failure", async () => {
  const { env, calls } = selectionEnvironment(new Error("Copy blocked"));
  assert.equal(await copyText(code, env), false);
  assert.ok(calls.includes("remove"));
});

test("unsupported legacy and modern APIs report failure", async () => {
  assert.equal(await copyText(code, {}), false);
  assert.equal(await copyText(code, { document: { body: {} } }), false);
});

test("empty output does not touch the clipboard", async () => {
  const { env, calls } = selectionEnvironment();
  assert.equal(await copyText("", env), false);
  assert.deepEqual(calls, []);
});

test("completed copying stays successful if the original focus was removed", async () => {
  const { env, calls } = selectionEnvironment();
  env.document.activeElement.focus = () => { throw new Error("Original editor was removed"); };
  assert.equal(await copyText(code, env), true);
  assert.ok(calls.includes("remove"));
});
