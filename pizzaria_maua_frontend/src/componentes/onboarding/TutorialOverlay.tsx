import React, { useEffect, useState } from 'react';
import { useOnboarding } from "../../hooks/useOnboarding";
import { ArrowRight, CheckCircle, HelpCircle } from 'lucide-react';
import './onboarding.css';

interface StepConfig {
    message: string;
    buttonText: string;
}

const STEPS_DATA: Record<number, StepConfig> = {
    1: { message: "Toque em qualquer produto para visualizar fotos, ingredientes e opções adicionais.", buttonText: "Próximo" },
    2: { message: "Adicione itens diretamente ao seu pedido utilizando este botão rápido.", buttonText: "Próximo" },
    3: { message: "Os produtos escolhidos e os valores parciais aparecerão organizados aqui no seu carrinho.", buttonText: "Próximo" },
    4: { message: "Quando estiver pronto, envie seu pedido finalizado diretamente para a nossa cozinha!", buttonText: "Finalizar" }
};

export const TutorialOverlay: React.FC = () => {
    const { status, currentStep, nextStep } = useOnboarding();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (status !== 'TUTORIAL') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTargetRect(null);
            return;
        }

        const targetSelector = `[data-tour="step-${currentStep}"]`;

        // Função que localiza o elemento na tela e extrai suas dimensões/posição
        const updateHighlightPosition = () => {
            const target = document.querySelector(targetSelector);
            if (target) {
                setTargetRect(target.getBoundingClientRect());
            }
        };

        // 1. Ao iniciar o passo, rola a página suavemente até o elemento
        const targetElement = document.querySelector(targetSelector);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // 2. Aguarda a rolagem terminar (400ms) e captura a posição exata
        const scrollTimer = setTimeout(() => {
            updateHighlightPosition();
        }, 400);

        // 3. Se a tela for redimensionada ou houver scroll manual, o buraco acompanha o elemento
        window.addEventListener('resize', updateHighlightPosition);
        window.addEventListener('scroll', updateHighlightPosition, true);

        return () => {
            clearTimeout(scrollTimer);
            window.removeEventListener('resize', updateHighlightPosition);
            window.removeEventListener('scroll', updateHighlightPosition, true);
        };
    }, [currentStep, status]);

    if (status !== 'TUTORIAL') return null;

    const stepInfo = STEPS_DATA[currentStep];

    return (
        <>
            {/* MÁSCARA SVG: Cria o fundo escuro e recorta o buraco perfeito sobre o elemento */}
            <svg
                style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    zIndex: 9999990, pointerEvents: 'auto'
                }}
            >
                <defs>
                    <mask id="hole-mask">
                        {/* A tela inteira fica branca (visível para a máscara escurecer) */}
                        <rect width="100%" height="100%" fill="white" />
                        {/* O buraco preto (torna a máscara transparente nesta área exata) */}
                        {targetRect && (
                            <rect
                                x={targetRect.left - 4}
                                y={targetRect.top - 4}
                                width={targetRect.width + 8}
                                height={targetRect.height + 8}
                                fill="black"
                                rx="8" // Bordas arredondadas do buraco
                            />
                        )}
                    </mask>
                </defs>
                {/* O fundo escuro em si, aplicando a máscara */}
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.75)"
                    mask="url(#hole-mask)"
                />
            </svg>

            {/* CAIXA DE TEXTO: Fica sempre no rodapé */}
            <div className="onboarding-popover">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ background: '#ffe4e6', borderRadius: '50%', padding: '6px', display: 'flex' }}>
                        <HelpCircle size={16} color="#e11d48" />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e11d48', letterSpacing: '0.05em' }}>
                        PASSO {currentStep} DE 4
                    </span>
                </div>

                <p style={{ color: '#374151', fontSize: '15px', lineHeight: '1.5', marginBottom: '18px' }}>
                    {stepInfo.message}
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={nextStep}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: '#1e293b', color: '#fff', border: 'none',
                            padding: '10px 20px', borderRadius: '8px', fontSize: '14px',
                            fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        {stepInfo.buttonText}
                        {currentStep === 4 ? <CheckCircle size={15} /> : <ArrowRight size={15} />}
                    </button>
                </div>
            </div>
        </>
    );
};