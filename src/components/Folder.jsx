import React from 'react';

const Folder = ({ name }) => {
  return (
    <div className="folder">
      <div className="folder-content">
        <span className="folder-icon">📁</span>
        <span className="folder-name">{name}</span>
      </div>
    </div>
  );
};

export default Folder;
