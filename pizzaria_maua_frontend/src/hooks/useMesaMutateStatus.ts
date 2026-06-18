import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface AlterarStatusProps {
    numero: number;
    status: 'LIVRE' | 'OCUPADA';
}

async function atualizarStatusMesa({ numero, status }: AlterarStatusProps) {
    await api.patch(`/mesas/${numero}/status?status=${status}`);
}

export function useMesaMutateStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: atualizarStatusMesa,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mesa-dados"] });
        }
    });
}