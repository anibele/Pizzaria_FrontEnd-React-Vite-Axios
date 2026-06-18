import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { ProdutoDados } from "../interfaces/ProdutoDados";

const buscarProdutosAtivos = async (): Promise<ProdutoDados[]> => {
    const response = await api.get<ProdutoDados[]>('/produtos/ativos');
    return response.data;
};

export function useProdutosAtivos() {
    return useQuery({
        queryKey: ["produtos-ativos"],
        queryFn: buscarProdutosAtivos,
        retry: 2,
    });
}