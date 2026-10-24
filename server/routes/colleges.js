import { Router } from "express";
import College from "../models/College.js";

const router = Router();
const programs = new Set(["BCA", "MCA", "B.Tech"]);
const cutoffExams = new Set([
  "JEE Main / MP DTE",
  "CUET UG",
  "CUET PG",
  "College-specific"
]);
const cutoffMetrics = new Set(["Rank", "Score", "Percentile"]);
const csvHeaders = [
  "name",
  "city",
  "address",
  "officialWebsite",
  "affiliation",
  "description",
  "program",
  "durationYears",
  "annualTuitionFee",
  "academicYear",
  "feeSourceTitle",
  "feeSourceUrl",
  "feeSourceVerified",
  "studyDetails",
  "studySourceTitle",
  "studySourceUrl",
  "studySourceVerified",
  "placementMedianLpa",
  "placementHighestLpa",
  "placementYear",
  "placementSourceTitle",
  "placementSourceUrl",
  "placementSourceVerified",
  "cutoffExam",
  "cutoffAdmissionYear",
  "cutoffCategory",
  "cutoffQuota",
  "cutoffRound",
  "cutoffMetric",
  "cutoffValue",
  "cutoffSourceTitle",
  "cutoffSourceUrl",
  "cutoffSourceVerified",
  "admissionUrl",
  "courseDetails"
];

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isHttpsUrl(value, label, optional = false) {
  if (!value && optional) return;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS.`);
  }
}

function cleanText(value, label, maxLength, optional = false) {
  if (value == null && optional) return "";
  if (typeof value !== "string") {
    throw new Error(`${label} must be text.`);
  }
  const result = value.trim();
  if (!result && optional) return "";
  if (!result || result.length > maxLength) {
    throw new Error(`${label} is required and must be under ${maxLength} characters.`);
  }
  return result;
}

function normalizeCollege(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("College data must be an object.");
  }

  const name = cleanText(input.name, "College name", 200);
  const city = cleanText(input.city || "Bhopal", "City", 100);
  if (city.toLowerCase() !== "bhopal") {
    throw new Error("Only colleges located in Bhopal can be added.");
  }

  const officialWebsite = cleanText(input.officialWebsite, "Official website", 1000);
  isHttpsUrl(officialWebsite, "Official website");

  if (!Array.isArray(input.courses) || input.courses.length < 1 || input.courses.length > 30) {
    throw new Error("Add between 1 and 30 course entries.");
  }

  const courses = input.courses.map((course, index) => {
    if (!course || !programs.has(course.program)) {
      throw new Error(`Course ${index + 1} must be BCA, MCA, or B.Tech.`);
    }

    const normalized = {
      program: course.program,
      details: cleanText(course.details, "Course details", 2000, true),
      studyDetails: cleanText(course.studyDetails, "Study details", 3000, true),
      admissionUrl: cleanText(course.admissionUrl, "Admission URL", 1000, true)
    };

    if (normalized.studyDetails) {
      normalized.studySourceTitle = cleanText(course.studySourceTitle, "Study source title", 200);
      normalized.studySourceUrl = cleanText(course.studySourceUrl, "Study source URL", 1000);
      isHttpsUrl(normalized.studySourceUrl, `Course ${index + 1} study source URL`);
      if (course.studySourceVerified !== true) {
        throw new Error(`Confirm the official study source for course ${index + 1} before saving.`);
      }
      normalized.studySourceVerified = true;
    }

    if (normalized.admissionUrl) {
      isHttpsUrl(normalized.admissionUrl, `Course ${index + 1} admission URL`);
    }

    if (course.durationYears !== "" && course.durationYears != null) {
      const durationYears = Number(course.durationYears);
      if (!Number.isFinite(durationYears) || durationYears < 1 || durationYears > 8) {
        throw new Error(`Course ${index + 1} duration must be between 1 and 8 years.`);
      }
      normalized.durationYears = durationYears;
    }

    if (course.annualTuitionFee !== "" && course.annualTuitionFee != null) {
      const annualTuitionFee = Number(course.annualTuitionFee);
      if (!Number.isFinite(annualTuitionFee) || annualTuitionFee < 0) {
        throw new Error(`Course ${index + 1} fee must be a non-negative number.`);
      }

      normalized.annualTuitionFee = annualTuitionFee;
      normalized.academicYear = cleanText(course.academicYear, "Fee academic year", 20);
      normalized.feeSourceTitle = cleanText(course.feeSourceTitle, "Fee source title", 200);
      normalized.feeSourceUrl = cleanText(course.feeSourceUrl, "Fee source URL", 1000);
      isHttpsUrl(normalized.feeSourceUrl, `Course ${index + 1} fee source URL`);
      if (course.feeSourceVerified !== true) {
        throw new Error(`Confirm the official fee source for course ${index + 1} before saving.`);
      }
      normalized.feeSourceVerified = true;
    }

    const placementFields = [
      "placementMedianLpa",
      "placementHighestLpa"
    ];
    for (const field of placementFields) {
      if (course[field] === "" || course[field] == null) continue;
      const amount = Number(course[field]);
      if (!Number.isFinite(amount) || amount < 0 || amount > 1000) {
        throw new Error(`Course ${index + 1} placement figures must be non-negative LPA values.`);
      }
      normalized[field] = amount;
    }

    if (normalized.placementMedianLpa != null || normalized.placementHighestLpa != null) {
      normalized.placementYear = cleanText(course.placementYear, "Placement year", 20);
      normalized.placementSourceTitle = cleanText(course.placementSourceTitle, "Placement source title", 200);
      normalized.placementSourceUrl = cleanText(course.placementSourceUrl, "Placement source URL", 1000);
      isHttpsUrl(normalized.placementSourceUrl, `Course ${index + 1} placement source URL`);
      if (course.placementSourceVerified !== true) {
        throw new Error(`Confirm the official placement source for course ${index + 1} before saving.`);
      }
      normalized.placementSourceVerified = true;
    }

    if (Array.isArray(course.cutoffs)) {
      if (course.cutoffs.length > 50) {
        throw new Error(`Course ${index + 1} can have at most 50 cutoff records.`);
      }
      normalized.cutoffs = course.cutoffs.map((cutoff, cutoffIndex) => {
        if (!cutoff || !cutoffExams.has(cutoff.exam)) {
          throw new Error(`Cutoff ${cutoffIndex + 1} for course ${index + 1} has an unsupported exam.`);
        }
        if (!cutoffMetrics.has(cutoff.metric)) {
          throw new Error(`Cutoff ${cutoffIndex + 1} for course ${index + 1} must use Rank, Score, or Percentile.`);
        }
        const value = Number(cutoff.value);
        if (cutoff.value === "" || cutoff.value == null || !Number.isFinite(value) || value < 0) {
          throw new Error(`Cutoff ${cutoffIndex + 1} for course ${index + 1} must have a non-negative threshold.`);
        }
        const normalizedCutoff = {
          exam: cutoff.exam,
          admissionYear: cleanText(cutoff.admissionYear, "Cutoff admission year", 20),
          category: cleanText(cutoff.category, "Cutoff category", 50),
          quota: cleanText(cutoff.quota, "Cutoff quota / domicile", 100),
          round: cleanText(cutoff.round, "Cutoff round", 50),
          metric: cutoff.metric,
          value,
          sourceTitle: cleanText(cutoff.sourceTitle, "Cutoff source title", 200),
          sourceUrl: cleanText(cutoff.sourceUrl, "Cutoff source URL", 1000)
        };
        isHttpsUrl(normalizedCutoff.sourceUrl, `Cutoff ${cutoffIndex + 1} source URL`);
        if (cutoff.sourceVerified !== true) {
          throw new Error(`Confirm the official cutoff source for course ${index + 1} before saving.`);
        }
        normalizedCutoff.sourceVerified = true;
        return normalizedCutoff;
      });
    }

    if (normalized.cutoffs?.length) {
      const cutoffKeys = normalized.cutoffs.map((cutoff) =>
        [cutoff.exam, cutoff.admissionYear, cutoff.category, cutoff.quota, cutoff.round, cutoff.metric].join(":").toLowerCase()
      );
      if (new Set(cutoffKeys).size !== cutoffKeys.length) {
        throw new Error(`Course ${index + 1} has duplicate cutoff records for the same exam, year, category, quota, round, and metric.`);
      }
    }

    return normalized;
  });

  const courseKeys = courses.map((course) => `${course.program}:${course.academicYear || ""}`);
  if (new Set(courseKeys).size !== courseKeys.length) {
    throw new Error("Each course and academic year combination must be unique per college.");
  }

  return {
    name,
    slug: slugify(name),
    city: "Bhopal",
    ownership: "Private",
    address: cleanText(input.address, "Address", 500, true),
    officialWebsite,
    affiliation: cleanText(input.affiliation, "Affiliation", 250, true),
    description: cleanText(input.description, "Description", 3000, true),
    courses
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvToColleges(csv) {
  if (typeof csv !== "string" || !csv.trim()) {
    throw new Error("Upload a non-empty CSV file.");
  }
  if (Buffer.byteLength(csv, "utf8") > 1_500_000) {
    throw new Error("CSV must be smaller than 1.5 MB.");
  }

  const rows = parseCsv(csv);
  const headers = rows.shift()?.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim()
  );

  if (!headers || headers.length !== csvHeaders.length ||
      headers.some((header, index) => header !== csvHeaders[index])) {
    throw new Error(`CSV headers must match the template exactly: ${csvHeaders.join(", ")}`);
  }
  if (!rows.length || rows.length > 500) {
    throw new Error("CSV must contain between 1 and 500 course rows.");
  }

  const colleges = new Map();
  rows.forEach((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${values.length} columns; expected ${headers.length}.`);
    }
    const row = Object.fromEntries(headers.map((header, col) => [header, values[col].trim()]));
    const key = slugify(row.name);
    if (!key) throw new Error(`CSV row ${index + 2} needs a college name.`);

    if (!colleges.has(key)) {
      colleges.set(key, {
        name: row.name,
        city: row.city || "Bhopal",
        address: row.address,
        officialWebsite: row.officialWebsite,
        affiliation: row.affiliation,
        description: row.description,
        courses: []
      });
    }

    const course = {
      program: row.program,
      durationYears: row.durationYears,
      annualTuitionFee: row.annualTuitionFee,
      academicYear: row.academicYear,
      feeSourceTitle: row.feeSourceTitle,
      feeSourceUrl: row.feeSourceUrl,
      feeSourceVerified: row.feeSourceVerified.toLowerCase() === "true",
      studyDetails: row.studyDetails,
      studySourceTitle: row.studySourceTitle,
      studySourceUrl: row.studySourceUrl,
      studySourceVerified: row.studySourceVerified.toLowerCase() === "true",
      placementMedianLpa: row.placementMedianLpa,
      placementHighestLpa: row.placementHighestLpa,
      placementYear: row.placementYear,
      placementSourceTitle: row.placementSourceTitle,
      placementSourceUrl: row.placementSourceUrl,
      placementSourceVerified: row.placementSourceVerified.toLowerCase() === "true",
      admissionUrl: row.admissionUrl,
      details: row.courseDetails
    };
    const hasCutoff = row.cutoffExam.trim() || row.cutoffAdmissionYear.trim() ||
      row.cutoffCategory.trim() || row.cutoffQuota.trim() || row.cutoffRound.trim() ||
      row.cutoffMetric.trim() || row.cutoffValue.trim() || row.cutoffSourceTitle.trim() ||
      row.cutoffSourceUrl.trim();
    if (hasCutoff) {
      course.cutoffs = [{
        exam: row.cutoffExam,
        admissionYear: row.cutoffAdmissionYear,
        category: row.cutoffCategory,
        quota: row.cutoffQuota,
        round: row.cutoffRound,
        metric: row.cutoffMetric,
        value: row.cutoffValue,
        sourceTitle: row.cutoffSourceTitle,
        sourceUrl: row.cutoffSourceUrl,
        sourceVerified: row.cutoffSourceVerified.toLowerCase() === "true"
      }];
    }

    const collegeCourses = colleges.get(key).courses;
    const existingCourse = collegeCourses.find((item) =>
      item.program === course.program &&
      String(item.academicYear || "") === String(course.academicYear || "")
    );
    if (existingCourse && course.cutoffs?.length) {
      if (!existingCourse.cutoffs) existingCourse.cutoffs = [];
      existingCourse.cutoffs.push(...course.cutoffs);
    } else {
      collegeCourses.push(course);
    }
  });

  return [...colleges.values()].map(normalizeCollege);
}

router.get("/", async (req, res, next) => {
  try {
    const program = req.query.program;
    if (program && !programs.has(program)) {
      return res.status(400).json({ error: "Program must be BCA, MCA, or B.Tech." });
    }

    const colleges = await College.find({ city: "Bhopal" })
      .sort({ name: 1 })
      .limit(100)
      .lean();
    const filtered = program
      ? colleges.filter((college) => college.courses.some((course) => course.program === program))
      : colleges;
    return res.json({ colleges: filtered });
  } catch (error) {
    return next(error);
  }
});

export { csvHeaders, csvToColleges, normalizeCollege, parseCsv };
export default router;
