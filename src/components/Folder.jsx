import React from 'react';
import './Folder.css';

const Folder = ({ name, onClick }) => {
  return (
    <div className="folder" onClick={onClick}>
      <div className="folder-content">
        <span className="folder-icon">📁</span>
        <span className="folder-name">{name}</span>
      </div>
    </div>
  );
};

export default Folder;
