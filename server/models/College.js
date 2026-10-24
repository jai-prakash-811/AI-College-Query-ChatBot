import mongoose from "mongoose";

const cutoffSchema = new mongoose.Schema(
  {
    exam: {
      type: String,
      enum: ["JEE Main / MP DTE", "CUET UG", "CUET PG", "College-specific"],
      required: true
    },
    admissionYear: { type: String, required: true, trim: true, maxlength: 20 },
    category: { type: String, required: true, trim: true, maxlength: 50 },
    quota: { type: String, required: true, trim: true, maxlength: 100 },
    round: { type: String, required: true, trim: true, maxlength: 50 },
    metric: { type: String, enum: ["Rank", "Score", "Percentile"], required: true },
    value: { type: Number, required: true, min: 0 },
    sourceTitle: { type: String, required: true, trim: true, maxlength: 200 },
    sourceUrl: { type: String, required: true, trim: true, maxlength: 1000 },
    sourceVerified: { type: Boolean, default: false }
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    program: {
      type: String,
      enum: ["BCA", "MCA", "B.Tech"],
      required: true
    },
    durationYears: { type: Number, min: 1, max: 8 },
    annualTuitionFee: { type: Number, min: 0 },
    academicYear: { type: String, trim: true, maxlength: 20 },
    feeSourceTitle: { type: String, trim: true, maxlength: 200 },
    feeSourceUrl: { type: String, trim: true, maxlength: 1000 },
    feeSourceVerified: { type: Boolean, default: false },
    studyDetails: { type: String, trim: true, maxlength: 3000 },
    studySourceTitle: { type: String, trim: true, maxlength: 200 },
    studySourceUrl: { type: String, trim: true, maxlength: 1000 },
    studySourceVerified: { type: Boolean, default: false },
    placementMedianLpa: { type: Number, min: 0 },
    placementHighestLpa: { type: Number, min: 0 },
    placementYear: { type: String, trim: true, maxlength: 20 },
    placementSourceTitle: { type: String, trim: true, maxlength: 200 },
    placementSourceUrl: { type: String, trim: true, maxlength: 1000 },
    placementSourceVerified: { type: Boolean, default: false },
    cutoffs: {
      type: [cutoffSchema],
      default: [],
      validate: {
        validator(cutoffs) {
          return cutoffs.length <= 50;
        },
        message: "A course can have at most 50 cutoff records."
      }
    },
    admissionUrl: { type: String, trim: true, maxlength: 1000 },
    details: { type: String, trim: true, maxlength: 2000 }
  },
  { _id: false }
);

const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, index: true },
    city: {
      type: String,
      required: true,
      trim: true,
      enum: ["Bhopal"]
    },
    ownership: { type: String, enum: ["Private"], default: "Private", required: true },
    address: { type: String, trim: true, maxlength: 500 },
    officialWebsite: { type: String, required: true, trim: true, maxlength: 1000 },
    affiliation: { type: String, trim: true, maxlength: 250 },
    description: { type: String, trim: true, maxlength: 3000 },
    courses: {
      type: [courseSchema],
      required: true,
      validate: {
        validator(courses) {
          return courses.length > 0 && courses.length <= 30;
        },
        message: "Add between 1 and 30 course entries."
      }
    }
  },
  { timestamps: true }
);

collegeSchema.pre("validate", function validateFeeSources(next) {
  for (const course of this.courses) {
    if (
      course.studyDetails &&
      (!course.studySourceTitle ||
        !course.studySourceUrl ||
        !course.studySourceVerified)
    ) {
      this.invalidate(
        "courses",
        "Study details require an official source title and URL, and source verification."
      );
      break;
    }

    if (
      course.annualTuitionFee != null &&
      (!course.academicYear ||
        !course.feeSourceTitle ||
        !course.feeSourceUrl ||
        !course.feeSourceVerified)
    ) {
      this.invalidate(
        "courses",
        "A fee requires an academic year, official source title and URL, and source verification."
      );
      break;
    }

    const hasPlacementValue =
      course.placementMedianLpa != null || course.placementHighestLpa != null;
    if (
      hasPlacementValue &&
      (!course.placementYear ||
        !course.placementSourceTitle ||
        !course.placementSourceUrl ||
        !course.placementSourceVerified)
    ) {
      this.invalidate(
        "courses",
        "Placement figures require a year, official source title and URL, and source verification."
      );
      break;
    }

    for (const cutoff of course.cutoffs) {
      if (!cutoff.sourceVerified || !cutoff.sourceTitle || !cutoff.sourceUrl) {
        this.invalidate(
          "courses",
          "Rank cutoffs require an official source title and URL, and source verification."
        );
        return next();
      }
    }
  }
  next();
});

collegeSchema.index({ city: 1 });

export default mongoose.models.College ||
  mongoose.model("College", collegeSchema);
