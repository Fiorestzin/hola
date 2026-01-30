// API Configuration
// In development: uses localhost
// In production: uses the environment variable set by Render

export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const APP_ENV = "PROD";

