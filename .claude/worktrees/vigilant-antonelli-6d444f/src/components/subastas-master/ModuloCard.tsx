
import React from 'react';

interface ModuloCardProps {
  title: string;
  description: string;
}

const ModuloCard: React.FC<ModuloCardProps> = ({ title, description }) => {
  return (
    <div style={{ border: '1px solid #ccc', padding: '16px', margin: '16px', borderRadius: '8px' }}>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
};

export default ModuloCard;
