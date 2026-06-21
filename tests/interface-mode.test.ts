import { strictEqual } from "node:assert";
import { test } from "node:test";

import {
  DEFAULT_INTERFACE_MODE,
  normalizeInterfaceMode,
} from "../src/lib/ui/interface-mode.ts";

test("normalizeInterfaceMode defaults to atlas", () => {
  strictEqual(DEFAULT_INTERFACE_MODE, "atlas");
  strictEqual(normalizeInterfaceMode(undefined), "atlas");
  strictEqual(normalizeInterfaceMode("classic"), "classic");
  strictEqual(normalizeInterfaceMode("unexpected"), "atlas");
});

test("normalizeInterfaceMode preserves atlas preference", () => {
  strictEqual(normalizeInterfaceMode("atlas"), "atlas");
});
