// Integration tests run against TEST_DATABASE_URL (never the dev database).
// Unit tests get a placeholder URL so env validation passes; they never connect.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://unused:unused@localhost:1/unused";
process.env.PULSE_ENABLE_DEMO = "true";
process.env.YOUTUBE_API_KEY = "";
process.env.TIKTOK_PROVIDER = "";
process.env.INSTAGRAM_PROVIDER = "meta";
process.env.ENSEMBLEDATA_TOKEN = "";
