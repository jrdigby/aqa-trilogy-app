/**
 * Unit tests for circuit interactive marking and stem SVG (no DOM).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  markCircuitResponse,
  CIRCUIT_PRESETS,
  renderStemDiagramSvg,
  CIRCUIT_SYMBOL_IDS,
} from "../src/circuitWorkflow.js";

describe("circuit symbols", () => {
  it("includes AQA GCSE required symbols", () => {
    for (const id of [
      "cell", "battery", "switch_open", "switch_closed", "lamp", "fuse",
      "ammeter", "voltmeter", "diode", "led", "resistor", "variable_resistor",
      "thermistor", "ldr",
    ]) {
      assert.ok(CIRCUIT_SYMBOL_IDS.includes(id), `missing ${id}`);
    }
  });
});

describe("markCircuitResponse", () => {
  it("marks identify lamp correct", () => {
    const preset = CIRCUIT_PRESETS.series_identify_lamp;
    const q = {
      question_type: "circuit_interactive",
      max_marks: 1,
      circuit_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "circuit", key_payload: preset.answer };
    const resp = { kind: "identify_component", selectedType: "lamp" };
    assert.equal(markCircuitResponse(q, resp, key, [], null).total, 1);
  });

  it("rejects wrong identify", () => {
    const preset = CIRCUIT_PRESETS.series_identify_lamp;
    const q = {
      question_type: "circuit_interactive",
      max_marks: 1,
      circuit_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "circuit", key_payload: preset.answer };
    const resp = { kind: "identify_component", selectedType: "resistor" };
    assert.equal(markCircuitResponse(q, resp, key, [], null).total, 0);
  });

  it("marks complete_slots correct", () => {
    const preset = CIRCUIT_PRESETS.series_missing_lamp;
    const q = {
      question_type: "circuit_interactive",
      max_marks: 2,
      circuit_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "circuit", key_payload: preset.answer };
    const resp = { kind: "complete_slots", slotChoices: { s1: "lamp" } };
    assert.equal(markCircuitResponse(q, resp, key, [], null).total, 2);
  });

  it("marks build_preset series", () => {
    const preset = CIRCUIT_PRESETS.build_series_cell_lamp;
    const q = {
      question_type: "circuit_interactive",
      max_marks: 1,
      circuit_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "circuit", key_payload: preset.answer };
    const resp = { kind: "build_preset", slotChoices: { s0: "cell", s1: "lamp" } };
    assert.equal(markCircuitResponse(q, resp, key, [], null).total, 1);
  });
});

describe("renderStemDiagramSvg", () => {
  it("renders series lamp preset as svg", () => {
    const svg = renderStemDiagramSvg("series_lamp");
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("circuit-svg") || svg.includes("viewBox"));
  });

  it("renders single symbol identify preset", () => {
    const svg = renderStemDiagramSvg("series_identify_ammeter");
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes(">A<") || svg.includes("ammeter") || svg.length > 100);
  });
});
