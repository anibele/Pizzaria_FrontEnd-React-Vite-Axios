import api from "../services/api";
import { useMutation } from "@tanstack/react-query";
import { excluirMesa } from "../services/acoesMesa";

export function useMesaDeletar() {
    return useMutation({
        mutationFn: (numero: number) => excluirMesa(api, numero),
        retry: false,
        networkMode: 'always',
    });
}
