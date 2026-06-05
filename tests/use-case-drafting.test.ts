import { test } from "node:test";
import assert from "node:assert/strict";

import {
  draftUseCaseFromPrompt,
  inferDepartmentFromPrompt,
  titleFromPrompt,
} from "../src/lib/use-case-drafting.ts";

test("inferDepartmentFromPrompt: routes common enterprise language to functions", () => {
  assert.equal(inferDepartmentFromPrompt("employees ask PTO policy questions"), "HR");
  assert.equal(inferDepartmentFromPrompt("variance analysis during finance close"), "Finance");
  assert.equal(inferDepartmentFromPrompt("contract intake and NDA triage"), "Legal");
  assert.equal(inferDepartmentFromPrompt("supplier RFP comparison"), "Procurement");
  assert.equal(inferDepartmentFromPrompt("service desk ticket triage"), "IT");
});

test("titleFromPrompt: turns a messy request into a concise title", () => {
  assert.equal(titleFromPrompt("please create a new AI use case for HR PTO policy self-service!!"), "HR PTO Policy Self-service");
});

test("draftUseCaseFromPrompt: keeps sensitive actions gated for discovery", () => {
  const draft = draftUseCaseFromPrompt("Help finance approve external vendor payments with legal review");

  assert.equal(draft.department, "Finance");
  assert.equal(draft.dataSensitivity, "medium");
  assert.equal(draft.humanReview, true);
  assert.equal(draft.externalCommunication, true);
  assert.match(draft.aiNotDo ?? "", /restricted decisions/);
});
