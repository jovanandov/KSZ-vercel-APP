export const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://kontrolni-seznam-api.vercel.app/api'
  : 'http://localhost:8000/api'; 