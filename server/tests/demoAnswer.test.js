import test from "node:test";
import assert from "node:assert/strict";
import { demoAnswer } from "../routes/chat.js";

test("gives different demo replies for BCA/MCA comparison and post-BCA study options", () => {
  const comparison = demoAnswer("Suggest ways to compare colleges for BCA and MCA.");
  const postBca = demoAnswer("What courses can I study after BCA?");

  assert.notEqual(comparison, postBca);
  assert.match(comparison, /For a BCA college/);
  assert.match(comparison, /For an MCA college/);
  assert.match(postBca, /MCA/);
  assert.match(postBca, /MBA/);
});

test("uses distinct focused replies for common college questions", () => {
  const replies = [
    demoAnswer("How should I compare colleges?"),
    demoAnswer("Explain the general college admission process."),
    demoAnswer("How do I evaluate placements?"),
    demoAnswer("What should I check in the curriculum?")
  ];

  assert.equal(new Set(replies).size, replies.length);
});
