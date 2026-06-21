import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { CardProdutoGerente } from "./CardProdutoGerente";
import { Pizza, Wine, CupSoda, IceCream, UtensilsCrossed, Candy } from "lucide-react";

interface ListaProdutosGerenteProps {
    produtos: ProdutoDados[];
    onEditar: (produto: ProdutoDados) => void;
    onDeletar: (produto: ProdutoDados) => void;
}

export function ListaProdutosGerente({ produtos, onEditar, onDeletar }: ListaProdutosGerenteProps) {
    // 1. SEPARAÇÃO DAS PIZZAS
    const todasPizzas = produtos.filter(p => p.categoria?.toUpperCase() === "PIZZAS");
    const palavrasChaveDoces = ["CHOCOLATE", "BANANA", "PRESTÍGIO", "PRESTIGIO", "MAÇÃ", "MACA", "MORANGO", "DOCE"];

    const pizzasDoces = todasPizzas.filter(p =>
        palavrasChaveDoces.some(termo => p.nome?.toUpperCase().includes(termo))
    );
    const pizzasSalgadas = todasPizzas.filter(p =>
        !palavrasChaveDoces.some(termo => p.nome?.toUpperCase().includes(termo))
    );

    // 2. SEPARAÇÃO DAS BEBIDAS
    const todasBebidas = produtos.filter(p => p.categoria?.toUpperCase() === "BEBIDAS");
    const palavrasChaveAlcool = ["CHOPP", "GIN", "VINHO", "CERVEJA", "TÔNICA", "TONICA", "CAIPIRINHA"];

    const bebidasAlcoolicas = todasBebidas.filter(p =>
        palavrasChaveAlcool.some(termo => p.nome?.toUpperCase().includes(termo))
    );
    const bebidas = todasBebidas.filter(p =>
        !palavrasChaveAlcool.some(termo => p.nome?.toUpperCase().includes(termo))
    );

    // 3. OUTRAS CATEGORIAS
    const acompanhamentos = produtos.filter(p => p.categoria?.toUpperCase() === "ACOMPANHAMENTOS");
    const sobremesas = produtos.filter(p => p.categoria?.toUpperCase() === "SOBREMESAS");

    // Estrutura mapeada das seções com ícones do Lucide
    const secoes = [
        { titulo: "Pizzas Salgadas", icone: Pizza, itens: pizzasSalgadas, corIcone: "#ea580c" },
        { titulo: "Pizzas Doces", icone: Candy, itens: pizzasDoces, corIcone: "#8b5cf6" },
        { titulo: "Acompanhamentos", icone: UtensilsCrossed, itens: acompanhamentos, corIcone: "#eab308" },
        { titulo: "Sobremesas", icone: IceCream, itens: sobremesas, corIcone: "#ec4899" },
        { titulo: "Bebidas", icone: CupSoda, itens: bebidas, corIcone: "#3b82f6" },
        { titulo: "Bebidas Alcoólicas", icone: Wine, itens: bebidasAlcoolicas, corIcone: "#9f1239" },
    ];

    return (
        <div className="lista-gerente-container">
            {secoes.map((secao, index) => {
                if (secao.itens.length === 0) return null;

                const Icone = secao.icone;

                return (
                    <section key={index} className="secao-gerente">
                        <div className="secao-gerente-header">
                            <h3 className="secao-gerente-titulo">
                                <Icone size={24} color={secao.corIcone} />
                                {secao.titulo}
                            </h3>
                            <span className="secao-gerente-contador">
                                {secao.itens.length} {secao.itens.length === 1 ? 'item' : 'itens'}
                            </span>
                        </div>

                        <div className="grid-produtos">
                            {secao.itens.map(produto => (
                                <CardProdutoGerente
                                    key={produto.id}
                                    produto={produto}
                                    onEditar={onEditar}
                                    onDeletar={onDeletar}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}