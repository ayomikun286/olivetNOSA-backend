import Counter from "../models/Counter.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";

const generateAlumniId = async (yearSetId, chapterId, session) => {
  // 1. Find the Year Set
  const yearSet = await YearSet.findById(yearSetId).session(session);

  const chapter = await Chapter.findById(chapterId).session(session);

  if (!yearSet) {
    throw new Error("Year Set not found");
  }

  if (!chapter) {
    throw new Error("Chapter not found");
  }


  if (!yearSet.isActive) {
    throw new Error("Year Set is inactive");
  }

  if (!chapter.isActive) {
    throw new Error("Chapter is inactive");
  }

 
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
       session,
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