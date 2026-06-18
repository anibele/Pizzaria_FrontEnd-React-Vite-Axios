import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { MesaDados } from "../interfaces/MesaDados";

const buscarMesas = async (): Promise<MesaDados[]> => {
    const response = await api.get<MesaDados[]>('/mesas');
    return response.data;
};

export function useMesaDados() {
    return useQuery({
        queryKey: ["mesa-dados"],
        queryFn: buscarMesas,
        retry: 2,
    });
}