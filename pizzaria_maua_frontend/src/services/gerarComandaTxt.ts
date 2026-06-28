import type { PedidoCaixaDados } from "../interfaces/PedidoDadosCaixa";

export const baixarComandaTxt = (pedido: PedidoCaixaDados) => {
    let conteudo = `====================================\n`;
    conteudo += `           MESA ${pedido.numeroMesa ?? "Avulsa"}           \n`;
    conteudo += `====================================\n`;

    const data = new Date(pedido.dataHora).toLocaleString('pt-BR');
    conteudo += `Data: ${data}\n`;
    conteudo += `Status: ${pedido.status}\n`;
    conteudo += `------------------------------------\n`;
    conteudo += `ITENS CONSUMIDOS:\n\n`;

    // Blindagem aplicada aqui também
    pedido.itens.forEach(item => {
        const totalItem = item.quantidade * item.precoUnitario;
        conteudo += `${item.quantidade}x ${item.produtoNome.padEnd(20, ' ')} R$ ${totalItem.toFixed(2)}\n`;
    });

    conteudo += `------------------------------------\n`;
    conteudo += `TOTAL A PAGAR:       R$ ${pedido.faturamento.toFixed(2)}\n`;
    conteudo += `Forma Pagamento:     ${pedido.formaPagamento ?? "Não informada"}\n`;
    conteudo += `====================================\n`;
    conteudo += `        Obrigado pela visita!       \n`;
    conteudo += `====================================\n`;

    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Comanda_Mesa_${pedido.numeroMesa?? "Avulsa"}.txt`;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};