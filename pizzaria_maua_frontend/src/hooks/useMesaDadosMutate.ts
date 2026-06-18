import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function salvarMesa(mesa: { numero: number }) {
    const response = await api.post('/mesas', mesa);
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