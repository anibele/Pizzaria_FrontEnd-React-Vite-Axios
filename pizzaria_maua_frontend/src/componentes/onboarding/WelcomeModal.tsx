import React from 'react';
import { useOnboarding } from "../../hooks/useOnboarding";
import { Pizza, Sparkles, X, Play } from 'lucide-react';
import './onboarding.css';

export const WelcomeModal: React.FC = () => {
    const { status, startTutorial, skipTutorial } = useOnboarding();

    // Se o status já for FINISHED (recuperado do sessionStorage no F5), o modal não pisca na tela
    if (status !== 'WELCOME') return null;

    return (
        <div className="onboarding-backdrop">
            <div className="onboarding-modal">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ position: 'relative' }}>
                        <Pizza size={56} color="#e11d48" />
                        <Sparkles size={24} color="#eab308" style={{ position: 'absolute', top: -4, right: -8 }} />
                    </div>
                </div>

                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
                    Bem-vindo à Pizzaria Mauá!
                </h2>
                <p style={{ color: '#4b5563', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>
                    Preparamos um cardápio digital interativo para você fazer seu pedido diretamente deste tablet. Gostaria de conhecer as principais funções?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                        onClick={startTutorial}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            background: '#e11d48', color: '#fff', border: 'none', padding: '14px',
                            borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer'
                        }}
                    >
                        <Play size={18} fill="#fff" /> Iniciar Tutorial
                    </button>
                    <button
                        onClick={skipTutorial}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            background: '#f3f4f6', color: '#4b5563', border: 'none', padding: '12px',
                            borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer'
                        }}
                    >
                        <X size={18} /> Pular Tutorial
                    </button>
                </div>
            </div>
        </div>
    );
};