import React from 'react';
import './Folder.css';

const Folder = ({ name, onClick }) => {
  return (
    <div
      className="folder"
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${name}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    >
      <div className="folder-content">
        <span className="folder-icon">📁</span>
        <span className="folder-name">{name}</span>
      </div>
    </div>
  );
};

export default Folder;
