import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        techBlue: "#00BFFF",
        graphite: "#1F2933",
        darkGray: "#111827",
        cyanSoft: "#67E8F9"
      },
      boxShadow: {
        broadcast: "0 0 40px rgba(0, 191, 255, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;
