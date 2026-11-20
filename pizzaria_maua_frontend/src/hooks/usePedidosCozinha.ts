import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { PedidoDados } from "../interfaces/PedidoDados";
import { adaptarParaCaixa } from '../services/adapter';
import { buscarPedidosCozinha, CHAVE_COZINHA, preservarItensProntos } from "../services/conclusaoCozinha";

function validarPedidos(pedidos: PedidoDados[]): PedidoDados[] {
    if (!Array.isArray(pedidos)) throw new Error('Resposta de pedidos inválida.');
    pedidos.forEach(adaptarParaCaixa);
    return pedidos;
}

export function usePedidosCozinha() {
    return useQuery({
        queryKey: CHAVE_COZINHA,
        queryFn: ({ signal }): Promise<PedidoDados[]> => buscarPedidosCozinha(api, signal),
        select: validarPedidos,
        structuralSharing: preservarItensProntos,
        refetchInterval: 2000,
        staleTime: 0,
        gcTime: 0,             
    });
}
