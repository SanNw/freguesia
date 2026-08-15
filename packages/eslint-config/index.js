"use strict";

module.exports = {
  root: true,
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  env: { node: true, es2022: true },
  rules: {
    "no-unused-vars": "off",
    "no-console": "off",
  },
};
