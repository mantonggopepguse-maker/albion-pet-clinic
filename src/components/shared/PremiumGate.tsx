import React from 'react';

interface PremiumGateProps {
  children: React.ReactNode;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({ children }) => {
  return <>{children}</>;
};
