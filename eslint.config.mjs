import next from "eslint-config-next";

const config = [
  ...next,
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  { ignores: [".next/**", "node_modules/**", "src/generated/**", "playwright-report/**", "test-results/**"] },
];

export default config;
