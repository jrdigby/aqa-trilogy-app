/**
 * Unit tests for equipment interactive marking and stem SVG (no DOM).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  markEquipmentResponse,
  EQUIPMENT_PRESETS,
  renderStemDiagramSvg,
  APPARATUS_IDS,
  apparatusIdsForSubject,
} from "../src/equipmentWorkflow.js";

describe("apparatus catalogue", () => {
  it("covers all three sciences", () => {
    assert.ok(apparatusIdsForSubject("biology").length > 3);
    assert.ok(apparatusIdsForSubject("chemistry").length > 5);
    assert.ok(apparatusIdsForSubject("physics").length > 5);
    assert.ok(APPARATUS_IDS.includes("beaker"));
    assert.ok(APPARATUS_IDS.includes("microscope"));
    assert.ok(APPARATUS_IDS.includes("ray_box"));
  });
});

describe("markEquipmentResponse", () => {
  it("marks identify beaker correct", () => {
    const preset = EQUIPMENT_PRESETS.identify_beaker;
    const q = {
      question_type: "equipment_interactive",
      max_marks: 1,
      equipment_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "equipment", key_payload: preset.answer };
    const resp = { kind: "identify", selectedId: "beaker" };
    assert.equal(markEquipmentResponse(q, resp, key, [], null).total, 1);
  });

  it("rejects wrong identify", () => {
    const preset = EQUIPMENT_PRESETS.identify_beaker;
    const q = {
      question_type: "equipment_interactive",
      max_marks: 1,
      equipment_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "equipment", key_payload: preset.answer };
    const resp = { kind: "identify", selectedId: "burette" };
    assert.equal(markEquipmentResponse(q, resp, key, [], null).total, 0);
  });

  it("marks label_hotspots titration setup", () => {
    const preset = EQUIPMENT_PRESETS.titration_setup;
    const q = {
      question_type: "equipment_interactive",
      max_marks: 3,
      equipment_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "equipment", key_payload: preset.answer };
    const resp = {
      kind: "label_hotspots",
      hotspotLabels: { 1: "burette", 2: "conical_flask", 3: "stand_clamp" },
    };
    assert.equal(markEquipmentResponse(q, resp, key, [], null).total, 3);
  });

  it("rejects partial hotspot labels", () => {
    const preset = EQUIPMENT_PRESETS.titration_setup;
    const q = {
      question_type: "equipment_interactive",
      max_marks: 3,
      equipment_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "equipment", key_payload: preset.answer };
    const resp = {
      kind: "label_hotspots",
      hotspotLabels: { 1: "burette", 2: "beaker", 3: "stand_clamp" },
    };
    assert.equal(markEquipmentResponse(q, resp, key, [], null).total, 0);
  });
});

describe("renderStemDiagramSvg", () => {
  it("renders beaker identify preset", () => {
    const svg = renderStemDiagramSvg("identify_beaker");
    assert.ok(svg.includes("<svg"));
  });

  it("renders titration label preset", () => {
    const svg = renderStemDiagramSvg("titration_setup");
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.length > 200);
  });
});
