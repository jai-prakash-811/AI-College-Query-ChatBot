
import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import Chat from "../models/Chat.js";
import College from "../models/College.js";
import {
  isBhopalTopFiveQuestion,
  isTopFiveCollegeQuestion,
  isCollegeDataFollowUp,
  isRankConversationMessage,
  cutoffMatchesRank,
  parseRankDetails,
  rankQueryText,
  previousCollegeIds
} from "../utils/collegeChatContext.js";
import { bhopalTopFiveAnswer, bhopalTopFiveSources } from "../utils/bhopalTopFive.js";

const router = Router();

const SYSTEM_PROMPT = `
You are College Query Chatbot, a helpful and careful college guidance assistant.
Help students with college selection, BCA/MCA and other courses, admissions,
eligibility, fees, scholarships, hostels, documents, and counselling.

Be friendly, clear, and practical. Use short headings or numbered steps when useful.
Never invent current fees, cutoffs, admission dates, seat availability, or official rules.
If an answer depends on year, category, rank, state, or counselling round, ask for details.
Remind students to verify college-specific information on official websites.
Do not claim that you checked a live website unless you actually did so.
When college database records are provided, use them as the only source for Bhopal college facts, curriculum details, placement figures, and fees. Never infer, estimate, or invent missing information. If a verified fact is absent, say it is not available in the database and cite the official source links provided.
`;

export function demoAnswer(question) {
  const q = question.toLowerCase();

  if (
    /compar|compare|difference/.test(q) &&
    /\b(bca|mca)\b/.test(q)
  ) {
    return "For a BCA college, compare programming fundamentals, lab time, internships, and support for building projects. For an MCA college, focus more on advanced computing subjects, specialisations, research or industry projects, and placement roles. For both, compare accreditation, faculty, total costs, and independently verifiable placement data. Which city or colleges are you considering?";
  }

  if (
    /after\s+(?:completing\s+)?bca|bca\s+(?:ke\s+)?baad|after\s+bachelor/.test(q)
  ) {
    return "After BCA, possible paths include:\n\n- MCA for advanced computer applications (check each university's eligibility and entrance requirements).\n- An MBA if you want to move toward business or management.\n- An MSc in computer science, IT, data science, or a related subject where eligible.\n- A job or internship, supported by focused skills and projects.\n- A relevant postgraduate diploma or certification.\n\nChoose based on your interests, eligibility, budget, and career goal; course names and admission rules vary by institution.";
  }

  if (/placement|placements|internship|internships|package|salary/.test(q)) {
    return "To assess placements, ask each college for the latest course-specific placement report: batch size, number placed, median salary, role types, internship support, and how many employers recruited students. Separate verified figures from promotional highest-package claims, and check the report year before comparing.";
  }

  if (/accreditation|accredited|approval|approved|affiliation/.test(q)) {
    return "Check the college's current affiliation and programme approval on the relevant university or regulator's official website. Also verify accreditation status, the institution or programme it covers, and its validity period—an approval for one course or campus does not automatically apply to every programme.";
  }

  if (/curriculum|syllabus|subjects|course content|what will i study/.test(q)) {
    return "Compare the latest course syllabus semester by semester. Look for core subjects, electives, practical labs, current tools, project work, internship or industry exposure, and opportunities to update electives. Ask the department for the current curriculum rather than relying on an old brochure.";
  }

  if (/fee|fees|cost|tuition/.test(q)) {
    return "College fees depend on the institution, course, academic year, category, and facilities. Check the latest official fee notice and confirm tuition, examination, hostel, transport, and other charges.";
  }

  if (/admission|apply|eligib/.test(q)) {
    return "Admission checklist:\n\n1. Check course eligibility and entrance exams.\n2. Read the latest admission notice.\n3. Register on the official portal.\n4. Prepare marksheets, ID, photos, and required certificates.\n5. Track merit lists and seat allotment.\n\nConfirm the exact process on the official college or counselling website.";
  }

  if (/scholarship/.test(q)) {
    return "Check the National Scholarship Portal, your state scholarship portal, and the college's scholarship policies. Verify eligibility, documents, and deadlines on official websites.";
  }

  if (/hostel/.test(q)) {
    return "When comparing hostels, check room sharing, hostel and mess fees, electricity, Wi-Fi, security, distance from campus, and refund policy.";
  }

  if (/rank|cutoff|counselling/.test(q)) {
    return "College options depend on your entrance exam, rank, category, domicile, course, and counselling round. Share these details to help build a shortlist. Verify closing ranks on the official counselling website.";
  }

  if (/compar|compare|shortlist|choose|choosing|select/.test(q)) {
    return "Build a shortlist using the same checklist for every college: recognised affiliation, course syllabus, faculty and lab access, course-specific placement evidence, internships, full three-year or two-year cost, commute or hostel, and student support. Give each factor a score based on what matters to you, then verify key claims with official sources and current students.";
  }

  if (/college|bca|mca|course/.test(q)) {
    return "To compare colleges, check accreditation, curriculum, faculty, placements, internships, total fees, location, and hostel facilities. Tell me your course, preferred city, budget, and entrance rank if applicable.";
  }

  return "I can help with college selection, courses, admissions, fees, scholarships, hostels, and counselling. Which course, college, or city are you interested in?";
}

function isBhopalCollegeQuestion(question) {
  return /\bbhopal\b/i.test(question) &&
    /\b(colleges?|universit(?:y|ies)|BCA|MCA|B\.?\s?Tech|BTech|fee|tuition|placement|package|curriculum|syllabus|study|course|subject|salary|highest|median)\b/i.test(question);
}

export function shouldLookupCollegeData(question, history) {
  return isBhopalCollegeQuestion(question) ||
    isRankConversationMessage(question, history) ||
    isCollegeDataFollowUp(question) && previousCollegeIds(history).length > 0;
}

function requestedPrograms(question) {
  return [
    ["BCA", /\bBCA\b/i],
    ["MCA", /\bMCA\b/i],
    ["B.Tech", /\bB\.?\s?Tech\b|\bBTech\b|engineering/i]
  ]
    .filter(([, pattern]) => pattern.test(question))
    .map(([program]) => program);
}

async function getRelevantColleges(question, history) {
  if (!globalThis.mongoConnected) return [];

  const colleges = await College.find({ city: "Bhopal" })
    .select("name city address officialWebsite affiliation description courses")
    .sort({ name: 1 })
    .limit(100)
    .lean();
  const requested = requestedPrograms(question);
  const normalizedQuestion = question.toLowerCase();
  const ignoredNameWords = new Set([
    "college", "colleges", "university", "institute", "institutes", "of",
    "the", "and", "technology", "bhopal", "school", "engineering"
  ]);
  const ignoredQuestionWords = new Set([
    ...ignoredNameWords,
    "private", "public", "all", "best", "top", "list", "fees", "fee",
    "structure", "program", "programs", "course", "courses", "placement",
    "placements", "package", "packages", "study", "details", "about",
    "what", "which", "does", "have", "has", "in", "for", "with", "bca",
    "mca", "btech", "tech", "curriculum", "syllabus", "subjects", "salary",
    "highest", "median", "tell", "give", "show", "compare", "information",
    "near", "me", "are", "good", "can", "from", "their", "they",
    "offer", "offers", "offering", "provide", "provides", "available",
    "options", "there", "any", "among", "having", "choose", "ke", "kaun",
    "se", "hain", "hai"
  ]);

  const named = colleges.filter((college) => {
    const words = college.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !ignoredNameWords.has(word));
    return words.some((word) => normalizedQuestion.includes(word));
  });
  const containsUnmatchedCollegeName = (normalizedQuestion.match(/[a-z0-9]+/g) || [])
    .some((word) => word.length > 3 && !ignoredQuestionWords.has(word) &&
      !/\b(?:bca|mca|btech)\b/.test(word));
  const priorIds = isCollegeDataFollowUp(question)
    ? previousCollegeIds(history)
    : [];
  const candidates = named.length
    ? named
    : priorIds.length
      ? colleges.filter((college) => priorIds.includes(String(college._id)))
      : containsUnmatchedCollegeName
      ? []
      : requested.length
      ? colleges.filter((college) => college.courses.some((course) => requested.includes(course.program)))
      : colleges;

  return candidates.slice(0, isTopFiveCollegeQuestion(question) ? 5 : 10).map((college) => ({
    ...college,
    courses: requested.length
      ? college.courses.filter((course) => requested.includes(course.program))
      : college.courses
  }));
}

function collegeSources(colleges) {
  const sources = new Map();
  for (const college of colleges) {
    sources.set(college.officialWebsite, {
      label: `${college.name} official website`,
      url: college.officialWebsite
    });
    for (const course of college.courses) {
      if (course.studyDetails && course.studySourceVerified && course.studySourceUrl) {
        sources.set(course.studySourceUrl, {
          label: `${college.name} ${course.program} course details`,
          url: course.studySourceUrl
        });
      }
      if (course.annualTuitionFee != null && course.feeSourceVerified && course.feeSourceUrl) {
        sources.set(course.feeSourceUrl, {
          label: `${college.name} ${course.program} fees (${course.academicYear})`,
          url: course.feeSourceUrl
        });
      }
      if (course.admissionUrl) {
        sources.set(course.admissionUrl, {
          label: `${college.name} ${course.program} admissions`,
          url: course.admissionUrl
        });
      }
      if (course.placementSourceVerified && course.placementSourceUrl) {
        sources.set(course.placementSourceUrl, {
          label: `${college.name} ${course.program} placements (${course.placementYear})`,
          url: course.placementSourceUrl
        });
      }
      for (const cutoff of course.cutoffs || []) {
        if (cutoff.sourceVerified && cutoff.sourceUrl) {
          sources.set(cutoff.sourceUrl, {
            label: `${college.name} ${course.program} cutoff (${cutoff.exam}, ${cutoff.admissionYear}, ${cutoff.round})`,
            url: cutoff.sourceUrl
          });
        }
      }
    }
  }
  return [...sources.values()].slice(0, 20);
}

function formatCollegeContext(colleges) {
  return JSON.stringify(
    colleges.map((college) => ({
      name: college.name,
      city: college.city,
      address: college.address,
      officialWebsite: college.officialWebsite,
      affiliation: college.affiliation,
      description: college.description,
      courses: college.courses.map((course) => ({
        program: course.program,
        durationYears: course.durationYears,
        annualTuitionFee:
          course.annualTuitionFee != null && course.feeSourceVerified
            ? course.annualTuitionFee
            : null,
        academicYear: course.academicYear,
        feeSourceTitle: course.feeSourceTitle,
        feeSourceUrl: course.feeSourceVerified ? course.feeSourceUrl : null,
        studyDetails:
          course.studyDetails && course.studySourceVerified
            ? course.studyDetails
            : null,
        studySourceTitle: course.studySourceTitle,
        studySourceUrl:
          course.studySourceVerified ? course.studySourceUrl : null,
        placementMedianLpa:
          course.placementSourceVerified ? course.placementMedianLpa : null,
        placementHighestLpa:
          course.placementSourceVerified ? course.placementHighestLpa : null,
        placementYear: course.placementYear,
        placementSourceTitle: course.placementSourceTitle,
        placementSourceUrl:
          course.placementSourceVerified ? course.placementSourceUrl : null,
        cutoffs: (course.cutoffs || [])
          .filter((cutoff) => cutoff.sourceVerified)
          .map((cutoff) => ({
            exam: cutoff.exam,
            admissionYear: cutoff.admissionYear,
            category: cutoff.category,
            quota: cutoff.quota,
            round: cutoff.round,
            metric: cutoff.metric,
            value: cutoff.value,
            sourceTitle: cutoff.sourceTitle,
            sourceUrl: cutoff.sourceUrl
          })),
        admissionUrl: course.admissionUrl,
        details: course.details
      }))
    })),
    null,
    2
  );
}

function collegeDataAnswer(colleges, question = "") {
  if (!colleges.length) {
    if (isTopFiveCollegeQuestion(question)) {
      return "I can't confirm Bhopal's top five colleges because there are no college records or verified ranking data available in the database yet.";
    }
    return globalThis.mongoConnected
      ? "There are no Bhopal college records in the database yet, so I can't verify college-specific information. Please check official college sources."
      : "I can't access the Bhopal college database right now, so I can't verify college details. Please try again after the backend database is connected.";
  }
  if (isTopFiveCollegeQuestion(question)) {
    const collegeNames = colleges.map((college) => `- ${college.name}`).join("\n");
    return `I don't have verified ranking data to confirm which colleges are the “top 5.” Here are up to five Bhopal colleges currently in the database, listed alphabetically (not ranked):\n${collegeNames}\n\nCheck each college's official website and compare course, fees, accreditation, and placements before choosing.`;
  }

  const lines = colleges.map((college) => {
    const courseLines = college.courses.map((course) => {
      const fee =
        course.annualTuitionFee != null && course.feeSourceVerified
          ? `Annual tuition: INR ${course.annualTuitionFee} (${course.academicYear}); source: ${course.feeSourceTitle}.`
          : "No verified fee amount is recorded.";
      const details = course.details ? ` ${course.details}` : "";
      const study = course.studyDetails && course.studySourceVerified
        ? `\n  Study: ${course.studyDetails}`
        : "\n  Study details: not recorded from an official source.";
      const hasPlacement =
        course.placementMedianLpa != null || course.placementHighestLpa != null;
      const placement = hasPlacement && course.placementSourceVerified
        ? `\n  Placements (${course.placementYear}): median ${course.placementMedianLpa ?? "not published"} LPA; highest ${course.placementHighestLpa ?? "not published"} LPA (${course.placementSourceTitle}).`
        : "\n  Placement figures: no verified official figures recorded.";
      return `- ${course.program}${course.durationYears ? ` (${course.durationYears} years)` : ""}: ${fee}${study}${placement}${details}`;
    });
    return `${college.name}${college.affiliation ? ` — ${college.affiliation}` : ""}\n${courseLines.join("\n")}`;
  });

  return `Bhopal college records:\n\n${lines.join("\n\n")}\n\nFees can change by academic year and category. Verify the linked official sources before making a decision.`;
}

async function findRankMatches(details) {
  if (!globalThis.mongoConnected) return [];

  const colleges = await College.find({ city: "Bhopal" })
    .select("name city address officialWebsite affiliation description courses")
    .sort({ name: 1 })
    .limit(100)
    .lean();
  return colleges.flatMap((college) => {
    const courses = college.courses
      .filter((course) => course.program === details.program)
      .map((course) => ({
        ...course,
        cutoffs: (course.cutoffs || []).filter((cutoff) => cutoffMatchesRank(cutoff, details))
      }))
      .filter((course) => course.cutoffs.length > 0);

    return courses.length ? [{ ...college, courses }] : [];
  });
}

function rankShortlistAnswer(details, colleges) {
  if (!globalThis.mongoConnected) {
    return "The college database is not connected, so I can't check verified cutoff records right now.";
  }
  if (!colleges.length) {
    return "I couldn't find a matching verified cutoff record for those details. Cutoffs depend on exam, course, category, quota, year, and round. Check the official counselling source or try another category/round if applicable.";
  }

  const list = colleges.map((college) => {
    const programs = college.courses.map((course) =>
      `${course.program} — ${course.cutoffs.map((cutoff) =>
        `${cutoff.exam}, ${cutoff.admissionYear}, ${cutoff.category}, ${cutoff.quota}, ${cutoff.round} (closing ${cutoff.metric.toLowerCase()}: ${cutoff.value}; source: ${cutoff.sourceTitle})`
      ).join("; ")}`
    );
    return `- ${college.name}: ${programs.join(" | ")}`;
  });
  return `Based on matching verified cutoff records:\n${list.join("\n")}\n\nThis is a historical cutoff-based indication, not a seat guarantee. Confirm the current round and eligibility on the linked official source.`;
}

function getHttpStatus(error) {
  const message = String(error?.message || error);

  const statusFromError = Number(error?.status || error?.code);

  if (
    Number.isInteger(statusFromError) &&
    statusFromError >= 400 &&
    statusFromError <= 599
  ) {
    return statusFromError;
  }

  const match = message.match(/"code"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : 500;
}

function isTemporaryError(error) {
  const message = String(error?.message || error);
  const status = getHttpStatus(error);

  return (
    [408, 429, 500, 502, 503, 504].includes(status) ||
    /UNAVAILABLE|high demand|overloaded|temporarily unavailable/i.test(
      message
    )
  );
}

function canUseDemoFallback(error) {
  const message = String(error?.message || error);
  const status = getHttpStatus(error);

  return (
    [408, 429, 503, 504].includes(status) ||
    /quota|rate.?limit|resource.?exhausted/i.test(message) ||
    /timed?\s*out|timeout|deadline exceeded|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(
      message
    )
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateContentWithRetry(ai, request) {
  const maxRetries = 1;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      if (!isTemporaryError(error) || attempt >= maxRetries) {
        throw error;
      }

      const delayMs = 1000;

      console.warn(
        `Gemini temporarily unavailable. Retry ${attempt + 1}/${maxRetries} in ${delayMs}ms.`
      );

      await sleep(delayMs);
    }
  }
}

router.post("/", async (req, res) => {
  try {
    const message =
      typeof req.body?.message === "string"
        ? req.body.message.trim()
        : "";

    const history = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    if (!message) {
      return res.status(400).json({
        error: "Please enter a question."
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: "Please keep your question under 4,000 characters."
      });
    }

    if (isBhopalTopFiveQuestion(message)) {
      return res.json({
        answer: bhopalTopFiveAnswer(),
        mode: "college-data",
        saved: false,
        sources: bhopalTopFiveSources,
        collegeIds: []
      });
    }

    const relevantColleges = shouldLookupCollegeData(message, history)
      ? await getRelevantColleges(message, history)
      : [];
    const sources = collegeSources(relevantColleges);
    if (isRankConversationMessage(message, history)) {
      const details = parseRankDetails(rankQueryText(message, history));
      const missing = [
        ["entrance exam", details.exam],
        ["course (BCA, MCA, or B.Tech)", details.program],
        ["rank, score, or percentile", details.metric && details.value != null],
        ["admission year", details.year],
        ["category", details.category],
        ["quota / domicile", details.quota],
        ["counselling round", details.round]
      ]
        .filter(([, value]) => !value)
        .map(([label]) => label);
      if (missing.length) {
        return res.json({
          answer: `Please send these details so I can check relevant cutoff records: ${missing.join(", ")}. For example: “JEE Main rank 28,000, B.Tech, General, MP domicile, 2026, Round 1.”`,
          mode: "college-data",
          saved: false,
          sources: [],
          rankPrompt: true
        });
      }
      const rankMatches = await findRankMatches(details);
      return res.json({
        answer: rankShortlistAnswer(details, rankMatches),
        mode: "college-data",
        saved: false,
        sources: collegeSources(rankMatches),
        collegeIds: rankMatches.map((college) => String(college._id))
      });
    }
    if (
      isBhopalCollegeQuestion(message) ||
      relevantColleges.length > 0 && isCollegeDataFollowUp(message)
    ) {
      return res.json({
        answer: collegeDataAnswer(relevantColleges, message),
        mode: "college-data",
        saved: false,
        sources,
        collegeIds: relevantColleges.map((college) => String(college._id))
      });
    }

    let answer;
    let mode = "demo";
    let warning;

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });

      const safeHistory = history
        .filter(
          (item) =>
            item &&
            ["user", "assistant", "model"].includes(item.role) &&
            typeof item.content === "string"
        )
        .slice(-10)
        .map((item) => ({
          role: item.role === "user" ? "user" : "model",
          parts: [{ text: item.content.slice(0, 4000) }]
        }));

      // Use the model configured in server/.env.
      // If unavailable for your account, choose a supported model in Google AI Studio.
      const model =
        process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

      try {
        const response = await generateContentWithRetry(ai, {
          model,
          contents: [
            ...safeHistory,
            {
              role: "user",
              parts: [{
                text: relevantColleges.length
                  ? `${message}\n\nUse only this Bhopal college database for college facts and fees. Missing fees must be reported as unavailable, never guessed. Cite the source URLs in your reply.\n\nCollege records:\n${formatCollegeContext(relevantColleges)}`
                  : message
              }]
            }
          ],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.4,
            maxOutputTokens: 700,
            httpOptions: {
              timeout: 15000,
              retryOptions: { attempts: 1 }
            }
          }
        });

        answer = response.text?.trim();

        if (!answer) {
          throw new Error("Gemini returned an empty answer.");
        }

        mode = "ai";
      } catch (error) {
        if (!canUseDemoFallback(error)) {
          throw error;
        }

        console.warn(
          "Gemini did not respond in time or is temporarily unavailable; using a demo reply."
        );
        answer = relevantColleges.length
          ? collegeDataAnswer(relevantColleges, message)
          : demoAnswer(message);
        mode = "demo";
        warning =
          getHttpStatus(error) === 429 ||
          /quota|rate.?limit|resource.?exhausted/i.test(String(error?.message || error))
            ? "Gemini API quota or rate limit has been reached. This is a basic demo/data reply, not an AI-generated answer. Check your Google AI Studio usage and limits."
            : "Gemini is temporarily unavailable, so this is a basic demo/data reply rather than an AI-generated answer. Please try again later for an AI response.";
      }
    } else {
      answer = relevantColleges.length
        ? collegeDataAnswer(relevantColleges, message)
        : demoAnswer(message);
    }

    let saved = false;

    if (globalThis.mongoConnected) {
      try {
        await Chat.create({
          messages: [
            { role: "user", content: message },
            { role: "assistant", content: answer }
          ]
        });

        saved = true;
      } catch (dbError) {
        console.error(
          "Chat history could not be saved:",
          dbError.message
        );
      }
    }

    return res.json({
      answer,
      mode,
      saved,
      sources,
      collegeIds: relevantColleges.map((college) => String(college._id)),
      ...(warning ? { warning } : {})
    });
  } catch (error) {
    const status = getHttpStatus(error);
    const message = String(error?.message || error);

    console.error("Gemini Chat API error:", {
      status,
      message
    });

    let errorMessage =
      "The chatbot could not generate a reply. Please try again.";

    if (status === 401 || status === 403) {
      errorMessage =
        "Gemini API authentication or permission failed. Check your API key.";
    } else if (
      status === 429 ||
      /quota|rate.?limit|resource.?exhausted/i.test(message)
    ) {
      errorMessage =
        "Gemini API quota or rate limit reached. Please check your API usage and limits.";
    } else if (
      status === 503 ||
      /UNAVAILABLE|high demand|overloaded/i.test(message)
    ) {
      errorMessage =
        "Gemini is temporarily busy. Please wait a moment and try again.";
    } else if (
      status === 408 ||
      status === 504 ||
      /timed?\s*out|timeout|deadline exceeded|aborterror/i.test(message)
    ) {
      errorMessage =
        "Gemini took too long to respond. Please try again in a moment.";
    } else if (status === 404) {
      errorMessage =
        "The configured Gemini model is unavailable. Check GEMINI_MODEL in server/.env.";
    } else if (status === 400) {
      errorMessage =
        "Gemini rejected the request. Check that GEMINI_MODEL is available for your API key.";
    } else if (/api.?key/i.test(message)) {
      errorMessage =
        "Gemini API key configuration issue. Check GEMINI_API_KEY in server/.env.";
    } else if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(message)) {
      errorMessage =
        "The backend could not reach Gemini. Check your internet connection and try again.";
    } else {
      errorMessage =
        `Gemini request failed (HTTP ${status}). Check the backend terminal for details and try again.`;
    }

    const responseStatus = [408, 429, 503, 504].includes(status)
      ? status
      : 502;

    return res.status(responseStatus).json({
      error: errorMessage
    });
  }
});

export default router;
