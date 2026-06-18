import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function deletarProduto(id: number) {
    const response = await api.delete(`/produtos/${id}`);
    return response.data;
}

export function useProdutoDeletar() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletarProduto,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["produto-dados"]
            });
        }
    });
}