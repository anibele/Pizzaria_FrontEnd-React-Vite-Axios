import React, { useState } from "react";

interface ModalPagamentoProps {
    isOpen: boolean;
    onClose: (formaPagamentoConcluida?: 'PIX' | 'CARTAO' | 'DINHEIRO') => void;
}

export default function ModalPagamento({ isOpen, onClose }: ModalPagamentoProps) {
    const [passo, setPasso] = useState<1 | 2>(1);
    const [formaEscolhida, setFormaEscolhida] = useState<'PIX' | 'CARTAO' | 'DINHEIRO' | "">("");

    if (!isOpen) return null;

    const handleEscolherForma = (forma: 'PIX' | 'CARTAO' | 'DINHEIRO') => {
        setFormaEscolhida(forma);
        setPasso(2);
    };

    const handleFechar = () => {
        if (passo === 2 && formaEscolhida !== "") {
            onClose(formaEscolhida);
        } else {
            onClose();
        }
        setTimeout(() => setPasso(1), 300);
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: "#fff", padding: "30px", borderRadius: "8px",
                width: "400px", textAlign: "center", position: "relative",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}>

                {passo === 1 ? (
                    <>
                        <button onClick={handleFechar} style={btnFecharStyle}>X</button>
                        <h2 style={{ marginTop: 0 }}>Como deseja pagar?</h2>
                        <p style={{ color: "#666", marginBottom: "20px" }}>Selecione a forma de pagamento abaixo:</p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {/* Mudado aqui para enviar exatamente as Strings aceitas pelo seu hook */}
                            <button style={btnOpcaoStyle} onClick={() => handleEscolherForma("PIX")}>💠 PIX</button>
                            <button style={btnOpcaoStyle} onClick={() => handleEscolherForma("CARTAO")}>💳 Cartão (Crédito/Débito)</button>
                            <button style={btnOpcaoStyle} onClick={() => handleEscolherForma("DINHEIRO")}>💵 Dinheiro</button>
                        </div>
                    </>
                ) : (
                    <>
                        <button onClick={handleFechar} style={btnFecharStyle}>X</button>
                        <h2 style={{ marginTop: 0, color: "#2e7d32" }}>Pronto!</h2>
                        <p style={{ fontSize: "1.1em", lineHeight: "1.5", color: "#333" }}>
                            Obrigado por desfrutar esse momento conosco.
                            Aguarde o nosso funcionário na sua mesa para finalizar o pagamento.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

const btnFecharStyle: React.CSSProperties = {
    position: "absolute", top: "10px", right: "15px", background: "transparent",
    border: "none", fontSize: "1.5em", fontWeight: "bold", cursor: "pointer", color: "#999"
};

const btnOpcaoStyle: React.CSSProperties = {
    padding: "15px", fontSize: "1.1em", backgroundColor: "#f5f5f5",
    border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer",
    fontWeight: "bold", transition: "background 0.2s"
};