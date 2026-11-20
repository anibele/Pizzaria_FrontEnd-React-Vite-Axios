import type { PedidoCaixaDados } from "../interfaces/PedidoDadosCaixa";

// Para conteúdo textual HTML, inclusive o título; não usar em scripts ou URLs.
const escaparTextoHtml = (valor: unknown): string => String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const imprimirComanda = (pedido: PedidoCaixaDados) => {
    // 1. Lógica para centralizar a janela do popup no meio do monitor
    const width = 450;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    // Passamos as coordenadas top e left para o navegador saber onde abrir
    const printWindow = window.open('', '', `width=${width},height=${height},top=${top},left=${left}`);

    if (!printWindow) {
        alert("Por favor, permita os pop-ups para imprimir a comanda.");
        return;
    }

    const dataFormatada = new Date(pedido.dataHora).toLocaleString('pt-BR');

    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
            <head>
                <title>Cupom - Mesa ${escaparTextoHtml(pedido.numeroMesa ?? "Avulsa")}</title>
                <style>
                    /* 🌟 REGRA DE OURO: Garante que os paddings não estiquem a div para fora da tela */
                    * { box-sizing: border-box; }

                    /* Estilo da tela de fundo escuro antes de imprimir */
                    @media screen {
                        body {
                            background-color: #525659;
                            display: flex;
                            justify-content: center;
                            padding: 20px;
                            margin: 0;
                        }
                        .cupom {
                            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                        }
                    }

                    /* Na hora de imprimir, tira o fundo e as sombras */
                    @media print {
                        @page { margin: 0; }
                        body {
                            margin: 0;
                            background-color: transparent;
                            display: block; /* Remove o flex para não tentar centralizar na folha A4 */
                        }
                        .cupom {
                            box-shadow: none;
                            margin: 0; /* Imprime alinhado na esquerda da folha */
                        }
                    }

                    /* 🌟 A BLINDAGEM DO TAMANHO (Isso resolve o seu print) */
                    .cupom {
                        background-color: #fff;
                        width: 300px; /* LARGURA FIXA: O sistema não consegue mais esticar isso */
                        max-width: 300px;
                        padding: 15px;
                        font-family: 'Courier New', Courier, monospace; 
                        font-size: 12px;
                        color: #000;
                        line-height: 1.2;
                        text-transform: uppercase;
                    }

                    h2, h3, p { margin: 0; padding: 2px 0; }
                    .text-center { text-align: center; }
                    .text-left { text-align: left; }
                    .bold { font-weight: bold; }

                    .separator {
                        border-top: 1px dashed #000;
                        margin: 8px 0;
                    }

                    table { width: 100%; border-collapse: collapse; margin: 8px 0; table-layout: fixed; }
                    th, td { vertical-align: top; padding: 4px 0; }
                    th { border-bottom: 1px dashed #000; }
                    
                    /* Medidas exatas para as colunas não se empurrarem */
                    .col-qtd { width: 15%; }
                    .col-nome { width: 55%; padding-right: 5px; word-break: break-word; }
                    .col-preco { width: 30%; text-align: right; }

                    .total-box {
                        font-size: 15px;
                        display: flex;
                        justify-content: space-between;
                        margin-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="cupom">
                    <div class="text-center">
                        <h2 class="bold">PIZZARIA MAUÁ</h2>
                        <p>Rua Exemplo, 123 - Centro</p>
                        <p>CNPJ: 00.000.000/0001-00</p>
                        <div class="separator"></div>
                        <h3 class="bold">CUPOM NÃO FISCAL</h3>
                        <h3>MESA ${escaparTextoHtml(pedido.numeroMesa ?? "AVULSA")}</h3>
                    </div>
                    
                    <div class="separator"></div>
                    <p>DATA: ${escaparTextoHtml(dataFormatada)}</p>
                    <p>STATUS: ${escaparTextoHtml(pedido.status)}</p>
                    <div class="separator"></div>

                    <table>
                        <thead>
                            <tr>
                                <th class="col-qtd text-left">QTD</th>
                                <th class="col-nome text-left">ITEM</th>
                                <th class="col-preco">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pedido.itens.map(item => `
                                <tr>
                                    <td class="col-qtd">${escaparTextoHtml(item.quantidade)}x</td>
                                    <td class="col-nome">${escaparTextoHtml(item.produtoNome)}</td>
                                    <td class="col-preco">R$ ${escaparTextoHtml((item.quantidade * item.precoUnitario).toFixed(2))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="separator"></div>
                    
                    <div class="total-box bold">
                        <span>TOTAL:</span>
                        <span>R$ ${escaparTextoHtml(pedido.faturamento.toFixed(2))}</span>
                    </div>
                    
                    <p style="margin-top: 10px;">PAGAMENTO: ${escaparTextoHtml(pedido.formaPagamento ?? "NÃO INFORMADA")}</p>

                    <div class="separator"></div>
                    <div class="text-center">
                        <p>OBRIGADO PELA PREFERÊNCIA!</p>
                        <p>Volte Sempre</p>
                    </div>
                </div>

                <script>
                    setTimeout(function() {
                        window.print();
                    }, 300);

                    window.onafterprint = function() {
                        window.close();
                    };
                </script>
            </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};
