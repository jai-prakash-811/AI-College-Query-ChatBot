import test from "node:test";
import assert from "node:assert/strict";
import chatRoutes from "../routes/chat.js";
import { bhopalTopFiveAnswer, bhopalTopFiveSources } from "../utils/bhopalTopFive.js";

test("loads the chatbot route with the Bhopal top-five handler", () => {
  assert.equal(typeof chatRoutes, "function");
  assert.ok(chatRoutes.stack.some((layer) => layer.route?.path === "/" && layer.route.methods.post));
});

test("includes the requested Bhopal colleges with official website sources", () => {
  const answer = bhopalTopFiveAnswer();
  for (const name of ["MANIT Bhopal", "SPA Bhopal", "IISER Bhopal", "NLIU Bhopal", "LNCT Bhopal"]) {
    assert.ok(answer.includes(name), `Expected the answer to include ${name}`);
  }
  assert.match(answer, /NIRF 2025/);
  assert.match(answer, /not a universal ranking/i);
  assert.deepEqual(
    bhopalTopFiveSources.map(({ url }) => new URL(url).protocol),
    Array(5).fill("https:")
  );
});
