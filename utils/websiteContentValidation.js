
import { getWebsiteContentPage } from "../config/websiteContent.config.js";

const MAX_STRING_LENGTH = 5000;
const MAX_ARRAY_LENGTH = 100;
const MAX_DEPTH = 8;
const MAX_NODES = 5000;
const MAX_CONTENT_BYTES = 100_000;

const BLOCKED_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

const URL_FIELDS = new Set([
  "url",
  "image",
  "imageUrl",
  "heroImage",
  "logoUrl",
  "href",
  "link",
  "linkTo",
  "website",
  "src",
  "mapUrl",
]);

const isValidLink = (value) => {
  const trimmed = value.trim();

  if (!trimmed) return true;

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const validateValue = (value, key = "", depth = 0, state) => {
  state.nodes += 1;

  if (state.nodes > MAX_NODES) {
    return "Content contains too many values.";
  }

  if (depth > MAX_DEPTH) {
    return "Content is nested too deeply.";
  }

  if (value === null || typeof value === "boolean") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? null : "Invalid numeric value.";
  }

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      return `${key || "A text field"} exceeds the maximum length.`;
    }

    if (URL_FIELDS.has(key) && !isValidLink(value)) {
      return `${key} must be an HTTP(S) URL or root-relative path.`;
    }

    return null;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      return `${key || "An array"} contains too many items.`;
    }

    for (const item of value) {
      const error = validateValue(item, key, depth + 1, state);
      if (error) return error;
    }

    return null;
  }

  if (typeof value !== "object") {
    return "Unsupported content value.";
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    return "Invalid content object.";
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    if (
      BLOCKED_KEYS.has(childKey) ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(childKey)
    ) {
      return "Content contains an invalid field name.";
    }

    const error = validateValue(
      childValue,
      childKey,
      depth + 1,
      state
    );

    if (error) return error;
  }

  return null;
};

export const validateWebsiteContent = (pageKey, content) => {
  const page = getWebsiteContentPage(pageKey);

  if (!page) {
    return "Unknown website content page.";
  }

  if (
    !content ||
    typeof content !== "object" ||
    Array.isArray(content) ||
    Object.getPrototypeOf(content) !== Object.prototype
  ) {
    return "Content must be a plain object.";
  }

  const allowedFields = new Set(page.fields);

  for (const key of Object.keys(content)) {
    if (!allowedFields.has(key)) {
      return `Field "${key}" is not allowed for this page.`;
    }
  }

  const state = { nodes: 0 };
  const validationError = validateValue(content, "", 0, state);

  if (validationError) {
    return validationError;
  }

  let serializedContent;

  try {
    serializedContent = JSON.stringify(content);
  } catch {
    return "Content could not be serialized.";
  }

  if (
    typeof serializedContent !== "string" ||
    Buffer.byteLength(serializedContent, "utf8") > MAX_CONTENT_BYTES
  ) {
    return "Page content is too large.";
  }

  return null;
};
