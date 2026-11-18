import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { buscarPedidosCozinha, concluirItemCozinha, ConclusaoCozinha } from "../services/conclusaoCozinha";

export function usePedidoItemStatus() {
    const queryClient = useQueryClient();

    const { mutateAsync } = useMutation({
        mutationFn: (itemId: number) => concluirItemCozinha(api, itemId),
        retry: false,
        networkMode: 'always',
    });
    const gestor = useMemo(() => new ConclusaoCozinha(queryClient, {
        concluir: itemId => mutateAsync(itemId),
        consultar: signal => buscarPedidosCozinha(api, signal),
    }), [queryClient, mutateAsync]);
    const operacoes = useSyncExternalStore(gestor.assinar, gestor.obterEstado);
    useEffect(() => () => gestor.limpar(), [gestor]);
    return { operacoes, concluir: gestor.concluir, verificar: gestor.verificar };
}
