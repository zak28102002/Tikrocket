// Integration tests run against TEST_DATABASE_URL (never the dev database).
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PULSE_ENABLE_DEMO = "true";
process.env.YOUTUBE_API_KEY = "";
process.env.TIKTOK_PROVIDER = "";
