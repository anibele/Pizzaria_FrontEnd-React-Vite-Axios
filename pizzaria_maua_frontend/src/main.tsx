import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";

// Tema visual (Ex existem vários, o Lara Light Indigo é o padrão limpo do Sakai)
import "primereact/resources/themes/lara-light-indigo/theme.css";
// Estrutura core do PrimeReact
import "primereact/resources/primereact.min.css";
// Pacote de ícones oficiais do PrimeReact
import "primeicons/primeicons.css";

import { PrimeReactProvider } from 'primereact/api';
import "primereact/resources/themes/lara-light-indigo/theme.css"; // Tema (pode mudar depois se quiser)
import "primereact/resources/primereact.min.css";                 // Core CSS do PrimeReact
import "primeicons/primeicons.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AuthProvider>
                    <PrimeReactProvider value={{ ripple: true }}>
                        <App />
                    </PrimeReactProvider>
                </AuthProvider>
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>
);