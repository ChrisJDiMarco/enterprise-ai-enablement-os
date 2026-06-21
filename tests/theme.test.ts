import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBrandHex,
  brandForeground,
  brandThemeVariables,
} from "../src/lib/ui/theme.ts";

const DEFAULT_BRAND = "#635bff";

test("normalizeBrandHex: lowercases a valid hex", () => {
  assert.equal(normalizeBrandHex("#3B5BDB"), "#3b5bdb");
});

test("normalizeBrandHex: trims surrounding whitespace", () => {
  assert.equal(normalizeBrandHex("  #abcdef  "), "#abcdef");
});

test("normalizeBrandHex: falls back to the default for invalid input", () => {
  assert.equal(normalizeBrandHex("red"), DEFAULT_BRAND);
  assert.equal(normalizeBrandHex("#fff"), DEFAULT_BRAND);
  assert.equal(normalizeBrandHex("#12345g"), DEFAULT_BRAND);
  assert.equal(normalizeBrandHex(undefined), DEFAULT_BRAND);
});

test("brandForeground: white text on a dark brand", () => {
  assert.equal(brandForeground("#1e293b"), "#ffffff");
});

test("brandForeground: dark text on a light brand", () => {
  assert.equal(brandForeground("#ffffff"), "#0f172a");
  assert.equal(brandForeground("#f8fafc"), "#0f172a");
});

test("brandThemeVariables: derives the theme custom properties", () => {
  const vars = brandThemeVariables("#3b5bdb");
  assert.deepEqual(Object.keys(vars).sort(), [
    "--primary",
    "--primary-contrast",
    "--primary-hover",
    "--primary-soft-dark",
    "--primary-soft-light",
  ]);
  assert.equal(vars["--primary"], "#3b5bdb");
  assert.equal(vars["--primary-contrast"], brandForeground("#3b5bdb"));
  assert.match(vars["--primary-hover"], /^#[0-9a-f]{6}$/);
  assert.match(vars["--primary-soft-light"], /^#[0-9a-f]{6}$/);
  assert.equal(vars["--primary-soft-dark"], "rgba(59, 91, 219, 0.16)");
});

test("brandThemeVariables: normalizes the incoming color first", () => {
  const vars = brandThemeVariables("not-a-color");
  assert.equal(vars["--primary"], DEFAULT_BRAND);
});

test("brandThemeVariables: hover is darker, light soft is lighter than the base", () => {
  const vars = brandThemeVariables("#3b5bdb");
  const sum = (hex: string) =>
    parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  const base = sum("#3b5bdb");
  assert.ok(sum(vars["--primary-hover"]) < base, "hover should be darker");
  assert.ok(sum(vars["--primary-soft-light"]) > base, "soft should be lighter");
});
