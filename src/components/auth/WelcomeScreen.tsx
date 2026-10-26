import React from 'react';
import { ModernOnboardingAuth } from './ModernOnboardingAuth';

interface WelcomeScreenProps {
  onNavigateToVerify?: (email: string) => void;
  initialShowLogin?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  onNavigateToVerify,
  initialShowLogin = false
}) => {
  return (
    <ModernOnboardingAuth
      onNavigateToVerify={onNavigateToVerify}
      initialShowLogin={initialShowLogin}
    />
  );
};
