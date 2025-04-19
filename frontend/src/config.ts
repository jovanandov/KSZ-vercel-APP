export const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://jovanandov.pythonanywhere.com/api'
  : 'http://localhost:8000/api'; 