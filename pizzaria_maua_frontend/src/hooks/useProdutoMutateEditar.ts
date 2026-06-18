import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProdutoDados } from "../interfaces/ProdutoDados";

async function editarProduto(produto: ProdutoDados) {
    const response = await api.put(`/produtos/${produto.id}`, produto);
    return response.data;
}

export function useProdutoMutateEditar() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: editarProduto,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["produto-dados"]
            });
        }
    });
}