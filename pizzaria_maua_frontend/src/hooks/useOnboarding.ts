import { useContext } from 'react';
import { OnboardingContext } from '../contexts/OnboardingContext';

export const useOnboarding = () => {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error('useOnboarding deve ser utilizado dentro de um OnboardingProvider');
    }
    return context;
};