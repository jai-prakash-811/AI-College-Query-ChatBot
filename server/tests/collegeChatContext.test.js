import test from "node:test";
import assert from "node:assert/strict";
import {
  isCollegeDataFollowUp,
  isBhopalTopFiveQuestion,
  isTopFiveCollegeQuestion,
  isRankConversationMessage,
  isRankShortlistQuestion,
  cutoffMatchesRank,
  normalizeCutoffCategory,
  normalizeCutoffQuota,
  parseRankDetails,
  previousCollegeIds,
  rankQueryText
} from "../utils/collegeChatContext.js";

test("recognizes follow-up questions about a previously listed college", () => {
  assert.equal(isCollegeDataFollowUp("What are their fees?"), true);
  assert.equal(isCollegeDataFollowUp("Placement?"), true);
  assert.equal(isCollegeDataFollowUp("How do I apply for a scholarship?"), false);
});

test("recognizes the Hindi-English Bhopal top-five quick question", () => {
  assert.equal(isTopFiveCollegeQuestion("Bhopal ke top 5 colleges kaun se hain?"), true);
  assert.equal(isTopFiveCollegeQuestion("What are the top 5 colleges in Bhopal?"), true);
  assert.equal(isBhopalTopFiveQuestion("Bhopal ke top 5 colleges kaun se hain?"), true);
  assert.equal(isBhopalTopFiveQuestion("What are the top 5 colleges in Indore?"), false);
});

test("uses only valid college IDs from the latest assistant answer", () => {
  const firstId = "0123456789abcdef01234567";
  const secondId = "abcdef0123456789abcdef01";
  const ids = previousCollegeIds([
    { role: "assistant", collegeIds: [firstId] },
    { role: "assistant", collegeIds: [secondId, "invalid", secondId] }
  ]);

  assert.deepEqual(ids, [secondId]);
  assert.deepEqual(previousCollegeIds([{ role: "user", collegeIds: [firstId] }]), []);
});

test("recognizes rank-based college shortlist questions", () => {
  assert.equal(isRankShortlistQuestion("Which colleges can I get with my rank?"), true);
  assert.equal(isRankShortlistQuestion("What is the MCA course fee?"), false);
});

test("collects rank details across the follow-up chat turn", () => {
  const history = [
    { role: "user", content: "Which colleges can I get with my rank?" },
    {
      role: "assistant",
      content: "Share exam, rank, course, category, year, quota, and round.",
      rankPrompt: true
    }
  ];
  const reply = "JEE Main rank 28,000, B.Tech, General, MP domicile, 2026, Round 1";
  const combined = rankQueryText(reply, history);
  const details = parseRankDetails(combined);

  assert.equal(isRankConversationMessage(reply, history), true);
  assert.deepEqual(details, {
    exam: "JEE Main / MP DTE",
    program: "B.Tech",
    metric: "Rank",
    value: 28000,
    year: "2026",
    round: "Round 1",
    category: "General",
    quota: "MP domicile"
  });
  assert.equal(
    isRankConversationMessage("What are the fees?", [
      ...history,
      { role: "assistant", content: "Here are the colleges matching those cutoff records." }
    ]),
    false
  );
});

test("does not mistake an MCA fee question for a reply to a rank prompt", () => {
  const history = [
    { role: "user", content: "Which colleges can I get with my rank?" },
    {
      role: "assistant",
      content: "Please share your exam, rank, course, and category.",
      rankPrompt: true
    }
  ];

  assert.equal(isRankConversationMessage("What is the fee structure of MCA?", history), false);
  assert.equal(isRankConversationMessage("How much are MCA fees?", history), false);
  assert.equal(isRankConversationMessage("What are the hostel fees for MCA?", history), false);
  assert.equal(
    isRankConversationMessage("JEE Main rank 28,000, MCA, General, MP domicile, 2026, Round 1", history),
    true
  );
});

test("normalizes category aliases and MP domicile quota", () => {
  assert.equal(normalizeCutoffCategory("Unreserved"), "general");
  assert.equal(normalizeCutoffCategory("OBC-NCL"), "obcncl");
  assert.equal(normalizeCutoffQuota("Madhya Pradesh domicile"), "mpdomicile");
});

test("matches only verified cutoffs that qualify for the given rank or score", () => {
  const cutoff = {
    exam: "JEE Main / MP DTE",
    admissionYear: "2026-27",
    category: "UR",
    quota: "MP domicile",
    round: "Round 1",
    metric: "Rank",
    value: 28000,
    sourceVerified: true
  };
  const query = {
    exam: "JEE Main / MP DTE",
    year: "2026",
    category: "General",
    quota: "MP domicile",
    round: "Round 1",
    metric: "Rank",
    value: 25000
  };

  assert.equal(cutoffMatchesRank(cutoff, query), true);
  assert.equal(cutoffMatchesRank(cutoff, { ...query, value: 30000 }), false);
  assert.equal(cutoffMatchesRank({ ...cutoff, sourceVerified: false }, query), false);
  assert.equal(
    cutoffMatchesRank(
      { ...cutoff, metric: "Score", value: 80 },
      { ...query, metric: "Score", value: 85 }
    ),
    true
  );
});
