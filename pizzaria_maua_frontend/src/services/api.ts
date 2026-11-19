import { controleHttpSessao } from './httpSessao';
import { criarApi } from './configuracaoApi';

const api = criarApi(import.meta.env, window.location.protocol,
    { getItem: key => localStorage.getItem(key) }, controleHttpSessao);
export default api;
