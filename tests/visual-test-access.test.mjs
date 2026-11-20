import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const {
  hasTrustedAnalyticsVisualTestHeader,
  isAnalyticsVisualTestRequest,
  VISUAL_TEST_REQUEST_HEADER,
  VISUAL_TEST_REQUEST_VALUE,
} = loadTypeScriptModule(
  new URL("../lib/visual-test-access.ts", import.meta.url),
);

function request(overrides = {}) {
  return {
    nodeEnv: "development",
    playwrightTest: "1",
    pathname: "/analytics",
    searchParams: new URLSearchParams("demo=1"),
    ...overrides,
  };
}

test("visual analytics access requires the exact development Playwright request", () => {
  assert.equal(isAnalyticsVisualTestRequest(request()), true);
  assert.equal(isAnalyticsVisualTestRequest(request({ nodeEnv: "production" })), false);
  assert.equal(isAnalyticsVisualTestRequest(request({ nodeEnv: "test" })), false);
  assert.equal(isAnalyticsVisualTestRequest(request({ playwrightTest: undefined })), false);
  assert.equal(isAnalyticsVisualTestRequest(request({ pathname: "/dashboard" })), false);
  assert.equal(isAnalyticsVisualTestRequest(request({ searchParams: new URLSearchParams() })), false);
  assert.equal(isAnalyticsVisualTestRequest(request({ searchParams: new URLSearchParams("demo=1&extra=1") })), false);
  assert.equal(isAnalyticsVisualTestRequest(request({ searchParams: new URLSearchParams("demo=1&demo=1") })), false);
});

test("only the trusted upstream header value is recognized", () => {
  const headers = new Headers({
    [VISUAL_TEST_REQUEST_HEADER]: VISUAL_TEST_REQUEST_VALUE,
  });
  assert.equal(hasTrustedAnalyticsVisualTestHeader(headers), true);
  headers.set(VISUAL_TEST_REQUEST_HEADER, "spoofed");
  assert.equal(hasTrustedAnalyticsVisualTestHeader(headers), false);
});
