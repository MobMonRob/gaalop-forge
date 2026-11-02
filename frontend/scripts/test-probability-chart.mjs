import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createSSRApp } from "vue";
import { parse, compileScript } from "vue/compiler-sfc";
import { renderToString } from "vue/server-renderer";

// Render the real component so the checks cover its warning branches and labels.
const filename = new URL("../src/quantum/ProbabilityChart.vue", import.meta.url);
const { descriptor, errors } = parse(await readFile(filename, "utf8"), { filename: filename.pathname });
assert.deepEqual(errors, []);
const compiled = compileScript(descriptor, { id: "probability-chart-test", inlineTemplate: true });
const content = compiled.content.replace(/from\s+(["'])vue\1/g, `from ${JSON.stringify(import.meta.resolve("vue"))}`);
const { default: Chart } = await import(`data:text/javascript;base64,${Buffer.from(content).toString("base64")}`);
const render = state => renderToString(createSSRApp(Chart, { name: "psi", state }));
function state(totalProbability = 2 * 0.7071 ** 2, residualNorm = 0) {
  const probability = totalProbability / 2;
  return { nqubits: 1, labels: ["0", "1"], real: [Math.sqrt(probability), Math.sqrt(probability)],
    imaginary: [0, 0], probabilities: [probability, probability], totalProbability, residualNorm };
}
const warningCount = html => (html.match(/class="q-warning"/g) || []).length;

test("the 0.7071 example displays the actual probabilities without a warning or normalization", async () => {
  const example = state();
  const original = JSON.stringify(example);
  for (const value of Object.values(example)) if (Array.isArray(value)) Object.freeze(value);
  Object.freeze(example);
  const html = await render(example);
  assert.equal(warningCount(html), 0);
  assert.ok(html.includes("0.49999041"));
  assert.ok(html.includes("Total probability = 0.99998082"));
  assert.ok(html.includes("Deviation from 1 = 1.918e-5"));
  assert.equal(JSON.stringify(example), original);
});

test("unit probability and deviations at or below 1e-4 pass the display check on both sides", async () => {
  for (const total of [1, 1.00005, 0.99995, 1.0001, 0.9999]) assert.equal(warningCount(await render(state(total))), 0, String(total));
});

test("deviations above 1e-4 and the zero vector still warn", async () => {
  for (const total of [1.00010001, 0.99989999, 1.2, 0]) {
    const html = await render(state(total));
    assert.equal(warningCount(html), 1, String(total));
    assert.ok(html.includes("Total probability differs from 1"));
    assert.ok(html.includes("Values are shown without normalization"));
  }
});

test("the ket-subspace residual keeps its independent 1e-8 tolerance", async () => {
  assert.equal(warningCount(await render(state(1, 1e-8))), 0);
  const html = await render(state(1, 1.00001e-8));
  assert.equal(warningCount(html), 1);
  assert.ok(html.includes("outside the selected algebra’s ket subspace"));
  assert.ok(!html.includes("Total probability differs from 1"));
});

test("both failed checks produce distinct diagnostic messages", async () => {
  const html = await render(state(0.9, 1e-7));
  assert.equal(warningCount(html), 2);
  assert.ok(html.includes("Total probability differs from 1"));
  assert.ok(html.includes("outside the selected algebra’s ket subspace"));
});

test("small nonzero probabilities retain scientific notation and negative amplitudes retain their sign", async () => {
  const example = state(1);
  example.probabilities = [1e-12, 1 - 1e-12];
  example.real = [-1e-6, Math.sqrt(1 - 1e-12)];
  const html = await render(example);
  assert.ok(html.includes("1.0000000e-12"));
  assert.ok(html.includes("-0.0000010000000"));
  assert.equal(warningCount(html), 0);
});

test("sixteen labelled bars have sufficient space for eight-significant-digit labels", async () => {
  const example = { nqubits: 4, labels: Array.from({ length: 16 }, (_, index) => index.toString(2).padStart(4, "0")),
    real: Array(16).fill(0.25), imaginary: Array(16).fill(0), probabilities: Array(16).fill(1 / 16), totalProbability: 1, residualNorm: 0 };
  const html = await render(example);
  const width = Number(html.match(/viewBox="0 0 ([\d.]+) 290"/)[1]);
  assert.ok((width - 60) / 16 >= 80);
  assert.ok(html.includes("0.062500000"));
  assert.equal(warningCount(html), 0);
});
