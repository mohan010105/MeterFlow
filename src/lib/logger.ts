// Lightweight logger utility
// Uses import.meta.env for Vite compatibility (process.env is not available in browser)
export const logger = {
  debug: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug("[DEBUG]", ...args);
    }
  },
  info: (...args: any[]) => {
    console.info("[INFO]", ...args);
  },
  warn: (...args: any[]) => {
    console.warn("[WARN]", ...args);
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args);
  },
};

export default logger;
