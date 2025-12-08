/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        docker: "#2496ED", 
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
  ],
};
