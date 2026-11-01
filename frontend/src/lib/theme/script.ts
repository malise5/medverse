/** Shared by the root layout (server) and the theme hook (client). */
export const THEME_KEY = "mv-theme";

/** Runs before React (inline <script> in <head>): applies the saved theme before first paint. */
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
