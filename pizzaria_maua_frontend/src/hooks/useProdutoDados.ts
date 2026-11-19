import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { ProdutoResposta } from "../interfaces/ProdutoDados";

const buscarDados = async (): Promise<ProdutoResposta[]> => {
    const response = await api.get<ProdutoResposta[]>('/produtos');
    return response.data;
};

export function useProdutoDados() {
    return useQuery({
        queryKey: ["produto-dados"],
        queryFn: buscarDados,
        retry: 2,
    });
}
