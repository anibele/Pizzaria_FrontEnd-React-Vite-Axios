import type { ProdutoDados } from "../interfaces/ProdutoDados";
import CardProduto from "./CardProduto";

import {
    Pizza,
    IceCreamBowl,
    UtensilsCrossed,
    CakeSlice,
    CupSoda,
    Wine,
} from "lucide-react";

import "../styles/listaCardapio.css";

interface ListaCardapioProps {
    produtos: ProdutoDados[];
    onVerDetalhes: (produto: ProdutoDados) => void;
    onAdicionar: (produto: ProdutoDados) => void;
}

export default function ListaCardapio({ produtos, onVerDetalhes, onAdicionar }: ListaCardapioProps) {

    // 1. SEPARAÇÃO DAS PIZZAS (Banco retorna "PIZZAS")
    const todasPizzas = produtos.filter(p => p.categoria?.toUpperCase() === "PIZZAS");

    const palavrasChaveDoces = ["CHOCOLATE", "BANANA", "PRESTÍGIO", "PRESTIGIO", "MAÇÃ", "MACA", "MORANGO", "DOCE"];

    const pizzasDoces = todasPizzas.filter(p =>
        palavrasChaveDoces.some(termo => p.nome?.toUpperCase().includes(termo))
    );
    const pizzasSalgadas = todasPizzas.filter(p =>
        !palavrasChaveDoces.some(termo => p.nome?.toUpperCase().includes(termo))
    );

    // 2. SEPARAÇÃO DAS BEBIDAS (Banco retorna "BEBIDAS")
    const todasBebidas = produtos.filter(p => p.categoria?.toUpperCase() === "BEBIDAS");

    const palavrasChaveAlcool = ["CHOPP", "GIN", "VINHO", "CERVEJA", "TÔNICA", "TONICA", "CAIPIRINHA"];

    const bebidasAlcoolicas = todasBebidas.filter(p =>
        palavrasChaveAlcool.some(termo => p.nome?.toUpperCase().includes(termo))
    );
    const bebidas = todasBebidas.filter(p =>
        !palavrasChaveAlcool.some(termo => p.nome?.toUpperCase().includes(termo))
    );

    // 3. OUTRAS CATEGORIAS DIRETAS DO BANCO
    const acompanhamentos = produtos.filter(p => p.categoria?.toUpperCase() === "ACOMPANHAMENTOS");
    const sobremesas = produtos.filter(p => p.categoria?.toUpperCase() === "SOBREMESAS");

    // Estrutura mapeada das seções
    const secoes = [
        {
            titulo: "Pizzas Salgadas",
            icone: Pizza,
            itens: pizzasSalgadas,
        },
        {
            titulo: "Pizzas Doces",
            icone: IceCreamBowl,
            itens: pizzasDoces,
        },
        {
            titulo: "Acompanhamentos",
            icone: UtensilsCrossed,
            itens: acompanhamentos,
        },
        {
            titulo: "Sobremesas",
            icone: CakeSlice,
            itens: sobremesas,
        },
        {
            titulo: "Bebidas",
            icone: CupSoda,
            itens: bebidas,
        },
        {
            titulo: "Bebidas Alcoólicas",
            icone: Wine,
            itens: bebidasAlcoolicas,
        },
    ];

    return (
        <div className="lista-cardapio-container">
            {secoes.map((secao, index) => {
                if (secao.itens.length === 0) return null;
                const Icone = secao.icone;

                return (
                    <section key={index} className="secao-cardapio">
                        {/* Título da Categoria sem o contador de itens */}
                        <div className="secao-header">
                            <h2 className="secao-titulo">
                                <Icone size={26} strokeWidth={2.2} />
                                <span>{secao.titulo}</span>
                            </h2>
                        </div>

                        {/* Grid contendo os Cards */}
                        <div className="produtos-grid">
                            {secao.itens.map(produto => (
                                <CardProduto
                                    key={produto.id}
                                    produto={produto}
                                    onVerDetalhes={onVerDetalhes}
                                    onAdicionar={onAdicionar}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}