import React from 'react';
import Folder from '../Folder';
import './Casa.css';

function Casa({ onNavigate }) {
  return (
    <div className="app-container">
      <Folder name="MANUALES" onClick={() => onNavigate('manuales')} />
    </div>
  );
}

export default Casa;
