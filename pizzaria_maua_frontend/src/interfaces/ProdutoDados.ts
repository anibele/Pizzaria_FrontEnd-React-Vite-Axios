export interface ProdutoDados {
    id?: number;
    nome: string;
    descricao: string;
    categoria: string;
    precoBase: number;
    imagemUrl: string;
    ativo: boolean;
    qtdEstoque: number;
}