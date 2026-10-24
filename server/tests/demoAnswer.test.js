import test from "node:test";
import assert from "node:assert/strict";
import {
  demoAnswer,
  isQuickGuideQuestion,
  shouldLookupCollegeData
} from "../routes/chat.js";

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

test("answers each quick-question topic with a focused English reply", () => {
  const replies = [
    demoAnswer("Which colleges can I get with my rank?"),
    demoAnswer("What is the fee structure of MCA?"),
    demoAnswer("What is the admission process?"),
    demoAnswer("Best colleges for BCA / MCA?"),
    demoAnswer("How can I find scholarships?"),
    demoAnswer("What hostel facilities should I check?")
  ];

  assert.equal(new Set(replies).size, replies.length);
  assert.match(replies[0], /home-state quota/i);
  assert.match(replies[1], /MCA fees vary/i);
  assert.match(replies[2], /general BCA\/MCA admission process/i);
  assert.match(replies[3], /NIMCET|CUET-PG/i);
  assert.match(replies[3], /Christ|Symbiosis/i);
  assert.match(replies[4], /National Scholarship Portal/i);
  assert.match(replies[5], /Before choosing a hostel/i);
  assert.match(replies[2], /eligibility/i);
});

test("includes requested topics without presenting changing estimates as facts", () => {
  const rank = demoAnswer("Which colleges can I get with my rank?");
  const fees = demoAnswer("What is the fee structure of MCA?");
  const admission = demoAnswer("What is the admission process?");
  const best = demoAnswer("Best colleges for BCA / MCA?");
  const scholarships = demoAnswer("How can I find scholarships?");
  const hostel = demoAnswer("What hostel facilities should I check?");

  assert.match(rank, /entrance exam, course, rank\/score, category, home-state quota/i);
  assert.match(rank, /verified cutoff records/i);
  assert.match(fees, /latest official fee notice/i);
  assert.match(fees, /hostel and mess/i);
  assert.match(admission, /NIMCET, CUET-PG/i);
  assert.match(admission, /Class 10\/12 marksheets/i);
  assert.match(best, /MANIT Bhopal|NIT Trichy/);
  assert.match(best, /verify the current programme/i);
  assert.match(scholarships, /National Scholarship Portal/i);
  assert.match(scholarships, /Buddy4Study/i);
  assert.match(scholarships, /Vidya Lakshmi/i);
  assert.match(hostel, /CCTV\/security/i);
  assert.match(hostel, /deposit and refund policy/i);
});

test("uses fixed guides for the requested FAQs while preserving rank and AI flows", () => {
  for (const question of [
    "What is the fee structure of MCA?",
    "What is the admission process?",
    "Best colleges for BCA / MCA?",
    "How can I find scholarships?",
    "What hostel facilities should I check?"
  ]) {
    assert.equal(isQuickGuideQuestion(question), true, question);
  }

  assert.equal(isQuickGuideQuestion("Which colleges can I get with my rank?"), false);
  assert.equal(isQuickGuideQuestion("Tell me about computer science careers."), false);
});

test("only looks up college records for Bhopal, rank, and known college follow-ups", () => {
  assert.equal(shouldLookupCollegeData("Suggest ways to compare colleges for BCA and MCA.", []), false);
  assert.equal(shouldLookupCollegeData("What courses can I study after BCA?", []), false);
  assert.equal(shouldLookupCollegeData("Compare BCA colleges in Bhopal.", []), true);
  assert.equal(shouldLookupCollegeData("Which colleges can I get with my rank?", []), true);
  assert.equal(shouldLookupCollegeData("What are their fees?", [
    { role: "assistant", collegeIds: ["0123456789abcdef01234567"] }
  ]), true);
  assert.equal(shouldLookupCollegeData("What are their fees?", []), false);
});
