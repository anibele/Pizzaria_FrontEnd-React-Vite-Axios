import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CriarPedidoInput } from "../interfaces/PedidoDados";

async function criarPedido(dados: CriarPedidoInput) {
    const response = await api.post('/pedidos', dados);
    return response.data;
}

export function usePedidoCriar() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: criarPedido,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["mesa-dados"] });
            queryClient.invalidateQueries({ queryKey: ["pedido-mesa-aberto", variables.numeroMesa] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
        }
    });
}