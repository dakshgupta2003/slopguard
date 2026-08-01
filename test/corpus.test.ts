import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inCorpus } from "../src/corpus.js";

test("matches a hallucinated name however pypi would spell it", () => {
  for (const spelling of ["llama-cpp", "llama_cpp", "llama.cpp", "Llama-CPP", "  llama-cpp  "]) {
    assert.ok(inCorpus("pip", spelling), `${spelling} is the same project as llama-cpp`);
  }
});

test("does not treat a dropped separator as the same package", () => {
  assert.ok(inCorpus("pip", "chroma-db"), "chroma-db is the hallucinated name");
  assert.ok(!inCorpus("pip", "chromadb"), "chromadb is a real popular package, not the same name");
  assert.ok(!inCorpus("pip", "llamacpp"), "PEP 503 collapses separators, it does not delete them");
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
