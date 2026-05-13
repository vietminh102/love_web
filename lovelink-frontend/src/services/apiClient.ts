import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api', // URL của Backend FastAPI
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;