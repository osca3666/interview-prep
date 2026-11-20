export const VISUAL_TEST_REQUEST_HEADER = "x-interviewprep-visual-test";
export const VISUAL_TEST_REQUEST_VALUE = "analytics-demo";

type VisualTestRequest = {
  nodeEnv: string | undefined;
  playwrightTest: string | undefined;
  pathname: string;
  searchParams: URLSearchParams;
};

export function isAnalyticsVisualTestRequest({
  nodeEnv,
  playwrightTest,
  pathname,
  searchParams,
}: VisualTestRequest) {
  return (
    nodeEnv === "development" &&
    playwrightTest === "1" &&
    pathname === "/analytics" &&
    searchParams.size === 1 &&
    searchParams.get("demo") === "1"
  );
}

export function hasTrustedAnalyticsVisualTestHeader(headers: Headers) {
  return (
    headers.get(VISUAL_TEST_REQUEST_HEADER) === VISUAL_TEST_REQUEST_VALUE
  );
}
