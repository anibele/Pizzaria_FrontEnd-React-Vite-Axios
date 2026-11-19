import axios from 'axios';
import { controleHttpSessao, instalarInterceptoresSessao } from './httpSessao';

const backendIp = import.meta.env.VITE_BACKEND_IP;
const api = axios.create({ baseURL: `http://${backendIp}:8080` });
instalarInterceptoresSessao(api, { getItem: key => localStorage.getItem(key) }, controleHttpSessao);
export default api;
