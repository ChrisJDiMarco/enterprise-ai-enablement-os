import { strictEqual } from "node:assert";
import { test } from "node:test";

import {
  DEFAULT_EXPERIENCE_MODE,
  normalizeExperienceMode,
} from "../src/lib/ui/experience-mode.ts";

test("normalizeExperienceMode defaults to guided", () => {
  strictEqual(DEFAULT_EXPERIENCE_MODE, "guided");
  strictEqual(normalizeExperienceMode(undefined), "guided");
  strictEqual(normalizeExperienceMode("guided"), "guided");
  strictEqual(normalizeExperienceMode("unexpected"), "guided");
});

test("normalizeExperienceMode preserves unguided preference", () => {
  strictEqual(normalizeExperienceMode("unguided"), "unguided");
});
