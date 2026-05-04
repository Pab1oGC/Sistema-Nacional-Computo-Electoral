import axios from 'axios';

// En dev: vite proxy redirige /api/* y /health a localhost:8001.
// En prod (nginx): location /api/ y /health hacen reverse proxy a oficial_api:8000.
// El dashboard nunca llama IPs absolutas; siempre paths relativos.
export const apiClient = axios.create({
  baseURL: '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});
