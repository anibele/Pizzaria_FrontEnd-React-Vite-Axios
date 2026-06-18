import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function deletarMesa(numero: number) {
    await api.delete(`/mesas/${numero}`);
}

export function useMesaDeletar() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletarMesa,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mesa-dados"] });
        }
    });
}