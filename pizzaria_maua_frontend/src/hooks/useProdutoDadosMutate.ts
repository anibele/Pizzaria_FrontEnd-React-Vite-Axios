import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProdutoDados } from "../interfaces/ProdutoDados";

async function salvarProduto(produto: ProdutoDados) {
    const response = await api.post('/produtos', produto);
    return response.data;
}

export function useProdutoDadosMutate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: salvarProduto,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["produto-dados"]
            });
        }
    });
}