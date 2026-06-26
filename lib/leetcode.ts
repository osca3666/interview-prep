export type ParsedLeetCodeProblemUrl = {
  slug: string;
  canonicalUrl: string;
};

const leetcodeHosts = new Set(["leetcode.com", "www.leetcode.com"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseLeetCodeProblemUrl(
  value: string,
): ParsedLeetCodeProblemUrl | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !leetcodeHosts.has(url.hostname)) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const problemsIndex = segments.indexOf("problems");
  const slug = problemsIndex >= 0 ? segments[problemsIndex + 1] : null;

  if (!slug) {
    return null;
  }

  const normalizedSlug = slug.toLowerCase();

  if (!slugPattern.test(normalizedSlug)) {
    return null;
  }

  return {
    slug: normalizedSlug,
    canonicalUrl: `https://leetcode.com/problems/${normalizedSlug}/`,
  };
}
