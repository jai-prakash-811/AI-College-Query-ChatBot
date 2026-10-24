import test from "node:test";
import assert from "node:assert/strict";
import { csvHeaders, csvToColleges, normalizeCollege, parseCsv } from "../routes/colleges.js";

const validCollege = {
  name: "Example University",
  city: "Bhopal",
  officialWebsite: "https://example.edu.in",
  courses: [{ program: "BCA" }]
};

test("normalizes a Bhopal college with a supported course", () => {
  const college = normalizeCollege(validCollege);
  assert.equal(college.slug, "example-university");
  assert.equal(college.city, "Bhopal");
  assert.equal(college.courses[0].program, "BCA");
});

test("rejects colleges outside Bhopal and unsupported courses", () => {
  assert.throws(() => normalizeCollege({ ...validCollege, city: "Indore" }), /Only colleges located in Bhopal/);
  assert.throws(
    () => normalizeCollege({ ...validCollege, courses: [{ program: "MBA" }] }),
    /must be BCA, MCA, or B.Tech/
  );
});

test("requires verified official source details when a fee is provided", () => {
  assert.throws(
    () => normalizeCollege({
      ...validCollege,
      courses: [{ program: "MCA", annualTuitionFee: 85000 }]
    }),
    /academic year|source title|source URL/i
  );

  const college = normalizeCollege({
    ...validCollege,
    courses: [{
      program: "MCA",
      annualTuitionFee: 85000,
      academicYear: "2026-27",
      feeSourceTitle: "Official fee notice",
      feeSourceUrl: "https://example.edu.in/fees",
      feeSourceVerified: true
    }]
  });
  assert.equal(college.courses[0].annualTuitionFee, 85000);
});

test("requires a verified official source for study details", () => {
  assert.throws(
    () => normalizeCollege({
      ...validCollege,
      courses: [{ program: "BCA", studyDetails: "Official curriculum details" }]
    }),
    /study source title|study source URL/i
  );

  const college = normalizeCollege({
    ...validCollege,
    courses: [{
      program: "BCA",
      studyDetails: "Official curriculum details",
      studySourceTitle: "BCA curriculum",
      studySourceUrl: "https://example.edu.in/courses/bca",
      studySourceVerified: true
    }]
  });
  assert.equal(college.courses[0].studySourceVerified, true);
});

test("requires a verified official source for rank cutoff records", () => {
  assert.throws(
    () => normalizeCollege({
      ...validCollege,
      courses: [{
        program: "B.Tech",
        cutoffs: [{
          exam: "JEE Main / MP DTE",
          admissionYear: "2026-27",
          category: "General",
          quota: "MP domicile",
          round: "Round 1",
          metric: "Rank",
          value: 28000,
          sourceTitle: "Official counselling cutoff",
          sourceUrl: "https://example.edu.in/cutoffs",
          sourceVerified: false
        }]
      }]
    }),
    /Confirm the official cutoff source/
  );

  const college = normalizeCollege({
    ...validCollege,
    courses: [{
      program: "B.Tech",
      cutoffs: [{
        exam: "JEE Main / MP DTE",
        admissionYear: "2026-27",
        category: "General",
        quota: "MP domicile",
        round: "Round 1",
        metric: "Rank",
        value: 28000,
        sourceTitle: "Official counselling cutoff",
        sourceUrl: "https://example.edu.in/cutoffs",
        sourceVerified: true
      }]
    }]
  });
  assert.equal(college.courses[0].cutoffs[0].value, 28000);
});

test("parses quoted commas in CSV cells", () => {
  assert.deepEqual(parseCsv('College,Program\n"Example, Bhopal",BCA'), [
    ["College", "Program"],
    ["Example, Bhopal", "BCA"]
  ]);
});

test("imports CSV rows with the exact template and rejects unverified fee rows", () => {
  const goodRow = Object.fromEntries(csvHeaders.map((header) => [header, ""]));
  Object.assign(goodRow, {
    name: "Example University",
    city: "Bhopal",
    officialWebsite: "https://example.edu.in",
    affiliation: "Example University",
    program: "BCA",
    durationYears: "3",
    studyDetails: "Core computer applications curriculum",
    studySourceTitle: "BCA curriculum",
    studySourceUrl: "https://example.edu.in/courses/bca",
    feeSourceVerified: "false",
    studySourceVerified: "true",
    placementSourceVerified: "false"
  });
  const rowToCsv = (row) => csvHeaders.map((header) => row[header]).join(",");
  const csv = `${csvHeaders.join(",")}\n${rowToCsv(goodRow)}`;
  const importedCourse = csvToColleges(csv)[0].courses[0];
  assert.equal(importedCourse.program, "BCA");
  assert.equal(importedCourse.studySourceUrl, "https://example.edu.in/courses/bca");

  const cutoffFields = {
    cutoffExam: "JEE Main / MP DTE",
    cutoffAdmissionYear: "2026-27",
    cutoffCategory: "General",
    cutoffQuota: "MP domicile",
    cutoffRound: "Round 1",
    cutoffMetric: "Rank",
    cutoffValue: "28000",
    cutoffSourceTitle: "Official counselling cutoff",
    cutoffSourceUrl: "https://example.edu.in/cutoffs",
    cutoffSourceVerified: "true"
  };
  const cutoffRow = { ...goodRow, ...cutoffFields };
  const cutoffCsv = `${csvHeaders.join(",")}\n${rowToCsv(goodRow)}\n${rowToCsv(cutoffRow)}`;
  const importedWithCutoff = csvToColleges(cutoffCsv)[0].courses[0];
  assert.equal(importedWithCutoff.cutoffs.length, 1);
  assert.equal(importedWithCutoff.cutoffs[0].value, 28000);

  const feeRow = {
    ...goodRow,
    annualTuitionFee: "85000",
    academicYear: "2026-27",
    feeSourceTitle: "Official fee notice",
    feeSourceUrl: "https://example.edu.in/fees"
  };
  assert.throws(
    () => csvToColleges(`${csvHeaders.join(",")}\n${rowToCsv(feeRow)}`),
    /Confirm the official fee source/
  );
});
