import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { SolicitacaoPagamento } from "../services/solicitacaoPagamento";
import type { FormaPagamento, PedidoPagamento } from "../services/solicitacaoPagamento";
import { contextoAtualAdicao } from "../services/sessaoAdicao";

interface FinalizarPedidoProps {
    pedidoId: number;
    formaPagamento: FormaPagamento;
    signal: AbortSignal;
}

async function finalizarPedido({ pedidoId, formaPagamento, signal }: FinalizarPedidoProps) {
    const response = await api.patch<PedidoPagamento>(`/pedidos/${pedidoId}/finalizar?formaPagamento=${formaPagamento}`, null,
        { timeout: 15000, signal });
    return response.data;
}

export function usePedidoFinalizar(numeroMesa: number) {
    const queryClient = useQueryClient();

    const { mutateAsync } = useMutation({
        mutationFn: finalizarPedido,
        retry: false,
        networkMode: 'always',
    });
    const gestor = useMemo(() => {
        const contexto = contextoAtualAdicao(numeroMesa);
        const atual = () => contexto !== null && JSON.stringify(contextoAtualAdicao(numeroMesa)) === JSON.stringify(contexto);
        return new SolicitacaoPagamento({
        consultar: async signal => {
            if (!atual()) throw new Error('A sessão mudou.');
            try {
                const response = await api.get<PedidoPagamento>(`/pedidos/mesa/${numeroMesa}/aberto`, { timeout: 15000, signal });
                return response.data;
            } catch (erro: unknown) {
                if ((erro as { response?: { status?: number } })?.response?.status === 404) return null;
                throw erro;
            }
        },
        solicitar: (pedidoId, formaPagamento, signal) => {
            if (!atual()) return Promise.reject(new Error('A sessão mudou.'));
            return mutateAsync({ pedidoId, formaPagamento, signal });
        },
        atualizar: pedido => {
            if (!atual()) return;
            queryClient.setQueryData(["pedido-mesa-aberto", numeroMesa], pedido);
            if (pedido?.status === 'AGUARDANDO_PAGAMENTO') {
                void queryClient.invalidateQueries({ queryKey: ["mesa-dados"] });
                void queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
            }
        },
    });
    }, [numeroMesa, mutateAsync, queryClient]);
    const estado = useSyncExternalStore(gestor.assinar, gestor.obterEstado);
    useEffect(() => () => gestor.reiniciar(), [gestor]);
    return { ...estado, solicitar: gestor.solicitar, verificar: gestor.verificar, reiniciar: gestor.reiniciar };
}
