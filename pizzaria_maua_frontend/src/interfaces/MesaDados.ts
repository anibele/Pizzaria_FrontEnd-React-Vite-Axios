export interface MesaDados {
    id?: number;
    numero: number;
    status: 'LIVRE' | 'OCUPADA' | 'MANUTENCAO' | 'RESERVADA';
    ativo: boolean;
}