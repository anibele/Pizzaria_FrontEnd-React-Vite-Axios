import React, { createContext, useState, useEffect } from 'react';

export type OnboardingStatus = 'STANDBY' | 'WELCOME' | 'TUTORIAL' | 'FINISHED';

interface OnboardingContextType {
    status: OnboardingStatus;
    currentStep: number;
    startTutorial: () => void;
    skipTutorial: () => void;
    nextStep: () => void;
    resetOnboarding: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
    children: React.ReactNode;
    statusMesa: string;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children, statusMesa }) => {
    const [status, setStatus] = useState<OnboardingStatus>('STANDBY');
    const [currentStep, setCurrentStep] = useState<number>(1);

    useEffect(() => {
        const jaFeitoNestaSessao = sessionStorage.getItem('pizzaria_tutorial_concluido');

        // 🔥 CORREÇÃO 1: Agora escutamos 'LIVRE' em vez de 'DISPONIVEL'
        if (statusMesa === 'LIVRE') {
            sessionStorage.removeItem('pizzaria_tutorial_concluido');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus('WELCOME');
            setCurrentStep(1);
        } else if (statusMesa === 'STANDBY') {
            setStatus('STANDBY');
        } else if (statusMesa === 'OCUPADA') {
            if (jaFeitoNestaSessao === 'true') {
                setStatus('FINISHED');
            } else {
                setStatus('WELCOME');
            }
        }
    }, [statusMesa]);

    const startTutorial = () => {
        setStatus('TUTORIAL');
        setCurrentStep(1);
    };

    const skipTutorial = () => {
        sessionStorage.setItem('pizzaria_tutorial_concluido', 'true');
        setStatus('FINISHED');
    };

    const nextStep = () => {
        if (currentStep < 4) {
            setCurrentStep(prev => prev + 1);
        } else {
            sessionStorage.setItem('pizzaria_tutorial_concluido', 'true');
            setStatus('FINISHED');
        }
    };

    const resetOnboarding = () => {
        sessionStorage.removeItem('pizzaria_tutorial_concluido');
        setStatus('WELCOME');
        setCurrentStep(1);
    };

    return (
        <OnboardingContext.Provider value={{ status, currentStep, startTutorial, skipTutorial, nextStep, resetOnboarding }}>
            {children}
        </OnboardingContext.Provider>
    );
};