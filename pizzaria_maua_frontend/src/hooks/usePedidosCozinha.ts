import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { PedidoDados } from "../interfaces/PedidoDados";
import { buscarPedidosCozinha, CHAVE_COZINHA, preservarItensProntos } from "../services/conclusaoCozinha";

export function usePedidosCozinha() {
    return useQuery({
        queryKey: CHAVE_COZINHA,
        queryFn: ({ signal }): Promise<PedidoDados[]> => buscarPedidosCozinha(api, signal),
        structuralSharing: preservarItensProntos,
        refetchInterval: 2000,
        staleTime: 0,
        gcTime: 0,             
    });
}
