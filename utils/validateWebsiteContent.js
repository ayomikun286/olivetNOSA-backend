import { getWebsiteContentPage } from "../config/websiteContent.config.js";

const MAX_STRING_LENGTH = 5000;
const MAX_ARRAY_LENGTH = 100;
const MAX_DEPTH = 8;
const MAX_CONTENT_BYTES = 100_000;

const BLOCKED_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

function validateValue(value, key = "", depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new Error("Content is nested too deeply.");
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return;
  }

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      throw new Error(`${key || "Field"} is too long.`);
    }

    // URL fields must use HTTPS, HTTP, or a root-relative path.
    if (
      /(?:url|image)$/i.test(key) &&
      value.trim() !== ""
    ) {
      const trimmed = value.trim();
      const isRelativePath =
        trimmed.startsWith("/") &&
        !trimmed.startsWith("//");

      let isHttpUrl = false;

      try {
        const parsed = new URL(trimmed);
        isHttpUrl =
          parsed.protocol === "https:" ||
          parsed.protocol === "http:";
      } catch {
        // The value may be a root-relative path.
      }

      if (!isRelativePath && !isHttpUrl) {
        throw new Error(
          `${key} must be an HTTP(S) URL or root-relative path.`
        );
      }
    }

    return;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      throw new Error(`${key || "Array"} has too many items.`);
    }

    value.forEach((item) =>
      validateValue(item, key, depth + 1)
    );

    return;
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);

    if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new Error("Invalid content object.");
    }

    for (const [childKey, childValue] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(childKey)) {
        throw new Error("Invalid object key.");
      }

      validateValue(childValue, childKey, depth + 1);
    }

    return;
  }

  throw new Error("Unsupported content value.");
}

export function validateWebsiteContent(pageKey, content) {
  const page = getWebsiteContentPage(pageKey);

  if (!page) {
    throw new Error("Unknown website content page.");
  }

  if (
    !content ||
    typeof content !== "object" ||
    Array.isArray(content) ||
    Object.getPrototypeOf(content) !== Object.prototype
  ) {
    throw new Error("Content must be a plain object.");
  }

  const allowedFields = new Set(page.fields);

  for (const key of Object.keys(content)) {
    if (!allowedFields.has(key)) {
      throw new Error(`Field "${key}" is not allowed for this page.`);
    }
  }

  validateValue(content);

  const bytes = Buffer.byteLength(
    JSON.stringify(content),
    "utf8"
  );

  if (bytes > MAX_CONTENT_BYTES) {
    throw new Error("Page content is too large.");
  }

  return content;
}