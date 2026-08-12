/**
 * Bonding diagram skill suggestions (WS1.2, WS3.1, MS5b).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestSkillsForQuestion } from "../src/skillTagging.js";

describe("suggestSkillsForQuestion — bonding diagrams", () => {
  it("tags ionic bonding with WS1.2, WS3.1, MS5b", () => {
    const suggested = suggestSkillsForQuestion({
      question_type: "chemistry_interactive",
      chemistry_config: { kind: "ionic_bonding" },
      subject: "chemistry",
      prompt: "Draw a dot and cross diagram for sodium chloride",
    });
    assert.ok(suggested.ws.includes("WS1.2"));
    assert.ok(suggested.ws.includes("WS3.1"));
    assert.ok(suggested.ms.includes("MS5b"));
  });

  it("tags covalent bonding with WS1.2, WS3.1, MS5b", () => {
    const suggested = suggestSkillsForQuestion({
      question_type: "chemistry_interactive",
      chemistry_config: { kind: "covalent_bonding" },
      subject: "chemistry",
      prompt: "Complete the dot and cross diagram for water",
    });
    assert.ok(suggested.ws.includes("WS1.2"));
    assert.ok(suggested.ws.includes("WS3.1"));
    assert.ok(suggested.ms.includes("MS5b"));
  });

  it("does not tag electron_shell with bonding skills", () => {
    const suggested = suggestSkillsForQuestion({
      question_type: "chemistry_interactive",
      chemistry_config: { kind: "electron_shell" },
      subject: "chemistry",
      prompt: "Draw the electron arrangement of carbon",
    });
    assert.equal(suggested.ws.includes("WS1.2"), false);
    assert.equal(suggested.ms.includes("MS5b"), false);
  });
});
