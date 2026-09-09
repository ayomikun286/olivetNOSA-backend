import Counter from "../models/Counter.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";

const generateAlumniId = async (yearSetId, chapterId) => {
  // 1. Find the Year Set
  const yearSet = await YearSet.findById(yearSetId);

  if (!yearSet) {
    throw new Error("Year Set not found");
  }

  // 2. Find the Chapter
  const chapter = await Chapter.findById(chapterId);

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  // 3. Make sure both are active
  if (!yearSet.isActive) {
    throw new Error("Year Set is inactive");
  }

  if (!chapter.isActive) {
    throw new Error("Chapter is inactive");
  }

  // 4. Get the next sequence number
  const counter = await Counter.findOneAndUpdate(
    {
      yearSet: yearSetId,
      chapter: chapterId,
    },
    {
      $inc: {
        sequence: 1,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  // 5. Format sequence number
  const sequence = String(counter.sequence).padStart(4, "0");

  // 6. Generate Alumni ID
  const alumniId = `NOSA${yearSet.year}${chapter.code}${sequence}`;

  // 7. Return the generated ID
  return alumniId;
};

export default generateAlumniId;