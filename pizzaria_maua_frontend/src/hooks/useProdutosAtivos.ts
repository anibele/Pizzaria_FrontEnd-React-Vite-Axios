import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { ProdutoResposta } from "../interfaces/ProdutoDados";

const buscarProdutosAtivos = async (): Promise<ProdutoResposta[]> => {
    const response = await api.get<ProdutoResposta[]>('/produtos/ativos');
    return response.data;
};

export function useProdutosAtivos() {
    return useQuery({
        queryKey: ["produtos-ativos"],
        queryFn: buscarProdutosAtivos,
        retry: 2,
    });
}
