import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string; // Allow optional className prop for flexibility
}

export const Container: React.FC<ContainerProps> = ({ children, className }) => {
  return (
    <div className={`mx-auto max-w-7xl px-6 lg:px-8 ${className || ''}`}>
      {children}
    </div>
  );
}; 