import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { ProdutoDados } from "../interfaces/ProdutoDados";

const buscarDados = async (): Promise<ProdutoDados[]> => {
    const response = await api.get<ProdutoDados[]>('/produtos');
    return response.data;
};

export function useProdutoDados() {
    return useQuery({
        queryKey: ["produto-dados"],
        queryFn: buscarDados,
        retry: 2,
    });
}