import React from 'react';
import { Card } from 'react-bootstrap';
import './Folder.css';

const Folder = ({ name, color, onClick }) => {
  return (
    <Card
      className="folder-card shadow-lg"
      onClick={onClick}
      style={{ backgroundColor: color, cursor: 'pointer', border: 'none', borderRadius: 'var(--radius-xl)' }}
    >
      <Card.Body className="d-flex flex-column justify-content-center align-items-center">
        <div className="folder-icon" style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--space-2)' }}>📁</div>
        <Card.Title 
            className="folder-name" 
            style={{ 
                fontSize: 'var(--font-size-lg)', 
                fontWeight: 'var(--font-weight-semibold)', 
                color: 'var(--white)', 
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}
        >
            {name}
        </Card.Title>
      </Card.Body>
    </Card>
  );
};

export default Folder;