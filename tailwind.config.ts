import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 10px 30px rgba(15, 23, 42, 0.08)",
      },
      colors: {
        canvas: "#f7f8fa",
        ink: "#132033",
      },
    },
  },
  plugins: [],
};

export default config;
