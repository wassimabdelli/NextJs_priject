import assert from "node:assert/strict";
import test from "node:test";
import { redactPII } from "../lib/ai/redact";

test("redacts email addresses, Tunisian phone numbers, and apartment numbers", () => {
  const text = "Contact user@example.com at +216 22 333 444 about appartement 12.";

  const redacted = redactPII(text);
  assert.match(redacted, /\[EMAIL\]/);
  assert.match(redacted, /\[TEL\]/);
  assert.match(redacted, /\[APPT\]/);
  assert.doesNotMatch(redacted, /user@example\.com|\+216 22 333 444|appartement 12/);
});
