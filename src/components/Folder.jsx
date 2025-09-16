import React from 'react';
import { Card } from 'react-bootstrap';
import FolderIcon from './FolderIcon';
import './Folder.css';

const Folder = ({ name, color, onClick }) => {
  return (
    <Card
      className="folder-card shadow-sm"
      onClick={onClick}
      style={{ backgroundColor: color, cursor: 'pointer', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0, 0, 0, 0.05)' }}
    >
      <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
        <FolderIcon style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: 'var(--space-3)', width: '50px', height: '50px' }} />
        <Card.Title 
            className="folder-name" 
            style={{ 
                fontSize: 'var(--font-size-md)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--white)', 
                textTransform: 'uppercase',
                letterSpacing: '0.8px'
            }}
        >
            {name}
        </Card.Title>
      </Card.Body>
    </Card>
  );
};

export default Folder;