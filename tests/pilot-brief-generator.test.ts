import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import {
  buildDeterministicPilotBrief,
  buildPilotBriefSourcePacket,
  buildPilotBriefSystemPrompt,
  buildPilotBriefUserPrompt,
  cleanGeneratedPilotBrief,
} from "../src/lib/pilot-brief-generator.ts";

test("pilot brief source packet exposes grounded use case and intelligence facts", () => {
  const workspace = buildDemoWorkspace("demo");
  const useCase = workspace.useCases.find((item) => item.id === "uc-it-incident") ?? workspace.useCases[0];
  const packet = buildPilotBriefSourcePacket(useCase);

  assert.equal(packet.useCase.id, useCase.id);
  assert.equal(packet.useCase.title, useCase.title);
  assert.equal(packet.valueModel.annualValueUsd > 0, true);
  assert.equal(packet.intelligence.requiredReviews.length > 0, true);
  assert.equal(packet.intelligence.successMetrics.length > 0, true);
});

test("deterministic pilot brief remains a complete fallback artifact", () => {
  const workspace = buildDemoWorkspace("demo");
  const useCase = workspace.useCases[0];
  const brief = buildDeterministicPilotBrief(useCase);

  assert.match(brief, new RegExp(`# ${useCase.title} Pilot Brief`));
  assert.match(brief, /## AI Pattern And Autonomy/);
  assert.match(brief, /## Evidence To Close Before Expansion/);
  assert.match(brief, /## Launch Decision Gate/);
});

test("pilot brief prompt instructs providers not to invent evidence", () => {
  const workspace = buildDemoWorkspace("demo");
  const useCase = workspace.useCases[0];
  const deterministicBrief = buildDeterministicPilotBrief(useCase);
  const sourcePacket = buildPilotBriefSourcePacket(useCase);
  const system = buildPilotBriefSystemPrompt();
  const user = buildPilotBriefUserPrompt({ sourcePacket, deterministicBrief });

  assert.match(system, /Do not invent facts/);
  assert.match(system, /Return Markdown only/);
  assert.match(user, /Source packet JSON/);
  assert.match(user, /Deterministic fallback draft/);
});

test("cleanGeneratedPilotBrief accepts valid markdown and rejects unusable output", () => {
  const fallback = "# Fallback Pilot Brief\n\n## Pilot Scope\nUse the fallback.";
  const generated = "```markdown\n# AI Pilot Brief\n\n## Pilot Scope\nUse configured model.\n\n## Guardrails\n- Review required\n```";

  assert.equal(cleanGeneratedPilotBrief(generated, fallback).startsWith("# AI Pilot Brief"), true);
  assert.equal(cleanGeneratedPilotBrief("nonsense", fallback), fallback);
});
