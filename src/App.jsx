import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Folder from './components/Folder';
import Tareas from './components/Tareas';
import Contrasenas from './components/Contrasenas'; // Nuevo import
import './App.css';

function MainPage() {
  return (
    <div className="app-container">
      <Folder name="QUOKKA" />
      <Link to="/aplicaciones" className="folder-link">
        <Folder name="APLICACIONES" />
      </Link>
    </div>
  );
}

function AplicacionesPage() {
  return (
    <div className="app-container">
      <Link to="/tareas" className="folder-link">
        <Folder name="TAREAS" />
      </Link>
      <Link to="/contrasenas" className="folder-link">
        <Folder name="CONTRASEÑAS" />
      </Link>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/aplicaciones" element={<AplicacionesPage />} />
      <Route path="/tareas" element={<Tareas />} />
      <Route path="/contrasenas" element={<Contrasenas />} /> {/* Nueva ruta */}
    </Routes>
  );
}

export default App;