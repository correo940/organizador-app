import React from 'react';
import Folder from './components/Folder';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Folder name="QUOKKA" />
      <Folder name="APLICACIONES" />
    </div>
  );
}

export default App;