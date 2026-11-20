import api from "../services/api";
import { useMutation } from "@tanstack/react-query";
import { alterarAtivacaoMesa } from "../services/acoesMesa";

interface AlterarAtivacaoProps {
    numero: number;
    ativo: boolean;
}

export function useMesaAlterarAtivacao() {
    return useMutation({
        mutationFn: (dados: AlterarAtivacaoProps) => alterarAtivacaoMesa(api, dados),
        retry: false,
        networkMode: 'always',
    });
}
