export interface DetalhesDescricao {
    breveDescricao: string | null;
    tempoMedioPreparo: string | null;
    pratoVegano: boolean;
    ingredientes: string[] | null;
}

export interface ProdutoDados {
    id?: number;
    nome: string;
    descricao?: DetalhesDescricao | null;
    categoria: string;
    precoBase: number;
    imagemUrl: string;
    ativo: boolean;
    qtdEstoque: number;
}

export type CategoriaProduto = 'PIZZAS' | 'BEBIDAS' | 'SOBREMESAS' | 'ACOMPANHAMENTOS';
export interface ProdutoResposta extends ProdutoDados {
    id: number;
    categoria: CategoriaProduto;
    descricao: DetalhesDescricao | null;
}
