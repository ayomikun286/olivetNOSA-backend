
import maxmind from "maxmind";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databasePath = path.resolve(
  __dirname,
  "../data/GeoLite2-Country.mmdb"
);

let countryReader = null;

export const initializeGeoLocation = async () => {
  try {
    countryReader = await maxmind.open(databasePath);

    console.log("GeoLite2 Country database loaded successfully");
  } catch (error) {
    console.error("Failed to load GeoLite2 database:", error.message);
    throw error;
  }
};

export const getCountryFromIP = (ip) => {
  if (!countryReader || !ip) return null;

  const result = countryReader.get(ip);

  if (!result) return null;

  return {
    country: result.country?.names?.en || null,
    countryCode: result.country?.iso_code || null,
  };
};
