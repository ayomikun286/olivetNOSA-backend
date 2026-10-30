import Counter from "../models/Counter.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";

const generateAlumniId = async (
  yearSetId,
  chapterId,
  graduationYear,
  session
) => {
  const yearSet = await YearSet.findById(yearSetId).session(session);
  const chapter = await Chapter.findById(chapterId).session(session);

  if (!yearSet) throw new Error("Year Set not found");
  if (!chapter) throw new Error("Chapter not found");

  if (!yearSet.isActive) throw new Error("Year Set is inactive");
  if (!chapter.isActive) throw new Error("Chapter is inactive");

  if (!graduationYear) {
    throw new Error("Graduation year is required");
  }

  const counter = await Counter.findOneAndUpdate(
    { name: "globalAlumniId" },
    { $inc: { sequence: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    }
  );

  const sequence = String(counter.sequence).padStart(5, "0");

  return `NOSA${graduationYear}${sequence}`;
};

export default generateAlumniId;