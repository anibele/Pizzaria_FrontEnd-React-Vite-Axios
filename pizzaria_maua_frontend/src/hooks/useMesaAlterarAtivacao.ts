import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface AlterarAtivacaoProps {
    numero: number;
    ativo: boolean;
}

async function atualizarAtivacaoMesa({ numero, ativo }: AlterarAtivacaoProps) {
    // Faz a chamada para PATCH /mesas/{numero}/ativacao?ativo=true|false
    await api.patch(`/mesas/${numero}/ativacao?ativo=${ativo}`);
}

export function useMesaAlterarAtivacao() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: atualizarAtivacaoMesa,
        onSuccess: () => {
            // Recarrega o grid de mesas instantaneamente após ativar/desativar
            queryClient.invalidateQueries({ queryKey: ["mesa-dados"] });
        }
    });
}