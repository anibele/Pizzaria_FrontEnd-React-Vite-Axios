import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Definindo a interface para refletir o novo fluxo
interface CriarMesaComUsuarioPayload {
    numero: number;
    criarUsuario: boolean;
    username?: string;
    password?: string;
}

async function salvarMesa(payload: CriarMesaComUsuarioPayload) {
    // Envia o JSON completo para o endpoint POST /mesas do Spring Boot
    const response = await api.post('/mesas', payload);
    return response.data;
}

export function useMesaDadosMutate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: salvarMesa,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mesa-dados"] });
        }
    });
}