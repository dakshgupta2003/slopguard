import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inCorpus } from "../src/corpus.js";

test("matches a hallucinated name however it is spelled", () => {
  for (const spelling of ["llama-cpp", "llama_cpp", "llamacpp", "Llama-CPP", "  llama-cpp  "]) {
    assert.ok(inCorpus("pip", spelling), `${spelling} should match the corpus`);
  }
});

test("holds the names that were hallucinated first and registered later", () => {
  for (const name of ["authfusion", "wavesocket", "websockets3", "graphitorm"]) {
    assert.ok(inCorpus("pip", name), `${name} was bulk-registered after being hallucinated`);
  }
});

test("leaves real packages and other ecosystems alone", () => {
  for (const name of ["requests", "flask", "numpy", "opentelemetry-api", "llama-cpp-python"]) {
    assert.ok(!inCorpus("pip", name), `${name} is a real package`);
  }
  assert.ok(!inCorpus("npm", "llama-cpp"), "the pip corpus must not leak into npm");
});
