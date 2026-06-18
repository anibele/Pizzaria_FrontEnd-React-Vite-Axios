import axios from 'axios';
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080'
});

// Interceptor de Requisição: Injeta o token JWT em cada chamada ao Spring Boot
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Interceptor de Resposta: Captura erros globais do back-end (como Token Expirado)
api.interceptors.response.use(
    (response: AxiosResponse) => {
        // Se a requisição deu certo, apenas passa a resposta adiante
        return response;
    },
    (error: AxiosError) => {
        // Se o back-end retornar 401 (Não Autorizado / Token Expirado)
        if (error.response && error.response.status === 401) {
            // Limpa o localStorage para remover o token velho e os dados do usuário
            localStorage.clear();

            // Redireciona o navegador à força para a tela de login
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;