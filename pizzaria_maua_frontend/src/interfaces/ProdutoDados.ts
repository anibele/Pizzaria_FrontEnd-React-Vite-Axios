export interface DetalhesDescricao {
    breveDescricao: string;
    tempoMedioPreparo: string;
    pratoVegano: boolean;
    ingredientes: string[];
}

export interface ProdutoDados {
    id?: number;
    nome: string;
    descricao?: DetalhesDescricao;
    categoria: string;
    precoBase: number;
    imagemUrl: string;
    ativo: boolean;
    qtdEstoque: number;
}