// Applies the saved theme before first paint so a reload never flashes the wrong theme. Shared with
// next.config.ts, which allows exactly this script in the Content-Security-Policy by its SHA-256 hash:
// any edit here changes the hash automatically on the next build.
export const THEME_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("prism-store")||"{}").state||{};if(s.theme)document.documentElement.setAttribute("data-theme",s.theme);if(s.fontSize)document.documentElement.setAttribute("data-fontsize",s.fontSize)}catch(e){}`
