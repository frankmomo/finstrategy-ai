import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#05070b",
          panel: "#0b111b",
          border: "#1f2937",
          text: "#d7e0ea",
          muted: "#7d8da1",
          green: "#00d084",
          red: "#ff4d5e",
          amber: "#f6c343",
          cyan: "#43d9ff"
        }
      }
    }
  },
  plugins: []
};

export default config;
