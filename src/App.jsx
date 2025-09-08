import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Folder from './components/Folder';
import Tareas from './components/Tareas';
import Contrasenas from './components/Contrasenas';
import Calendario from './components/Calendario';
import Casa from './components/Casa/Casa';
import Manuales from './components/Casa/manuales/Manuales';
import ToastContainer from './components/ToastContainer';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useToast } from './hooks/useToast';

// Vista principal: QUOKKA, APLICACIONES, CALENDARIO
function HomeView({ onNavigate }) {
  return (
    <div className="home-view">
      <div className="folder-container">
        <Folder 
          name="QUOKKA" 
          color="#FF6B6B" 
          onClick={() => onNavigate('/quokka')}
        />
        <Folder 
          name="APLICACIONES" 
          color="#4ECDC4"
          onClick={() => onNavigate('/aplicaciones')}
        />
        <Folder 
          name="CALENDARIO" 
          color="#45B7D1"
          onClick={() => onNavigate('/calendario')}
        />
      </div>
    </div>
  );
}

// Vista de aplicaciones: TAREAS, CONTRASEÑAS, CASA
function ApplicationsView({ onNavigate }) {
  return (
    <div className="applications-view">
      <div className="back-button" onClick={() => onNavigate('/')}>
        ← Volver
      </div>
      <div className="folder-container">
        <Folder 
          name="TAREAS" 
          color="#96CEB4"
          onClick={() => onNavigate('/aplicaciones/tareas')}
        />
        <Folder 
          name="CONTRASEÑAS" 
          color="#FECA57"
          onClick={() => onNavigate('/aplicaciones/contrasenas')}
        />
        <Folder 
          name="CASA" 
          color="#FF9FF3"
          onClick={() => onNavigate('/casa')}
        />
      </div>
    </div>
  );
}

// Vista de casa: MANUALES
function HouseView({ onNavigate }) {
  return (
    <div className="house-view">
      <div className="back-button" onClick={() => onNavigate('/aplicaciones')}>
        ← Volver a Aplicaciones
      </div>
      <div className="folder-container">
        <Folder 
          name="MANUALES" 
          color="#A8E6CF"
          onClick={() => onNavigate('/casa/manuales')}
        />
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useLocalStorage('current-view', '/');
  const { toasts, addToast } = useToast();
  const [tasks, setTasks] = useState([]);

  const handleNavigate = (path) => {
    setView(path);
  };

  const renderCurrentView = () => {
    switch (view) {
      case '/':
        return <HomeView onNavigate={handleNavigate} />;
      case '/aplicaciones':
        return <ApplicationsView onNavigate={handleNavigate} />;
      case '/aplicaciones/tareas':
        return (
          <div>
            <div className="back-button" onClick={() => handleNavigate('/aplicaciones')}>
              ← Volver a Aplicaciones
            </div>
            <Tareas 
              tasks={tasks} 
              setTasks={setTasks} 
              addToast={addToast}
            />
          </div>
        );
      case '/aplicaciones/contrasenas':
        return (
          <div>
            <div className="back-button" onClick={() => handleNavigate('/aplicaciones')}>
              ← Volver a Aplicaciones
            </div>
            <Contrasenas addToast={addToast} />
          </div>
        );
      case '/calendario':
        return (
          <div>
            <div className="back-button" onClick={() => handleNavigate('/')}>
              ← Volver al Inicio
            </div>
            <Calendario addToast={addToast} />
          </div>
        );
      case '/casa':
        return <HouseView onNavigate={handleNavigate} />;
      case '/casa/manuales':
        return (
          <div>
            <div className="back-button" onClick={() => handleNavigate('/casa')}>
              ← Volver a Casa
            </div>
            <Manuales addToast={addToast} />
          </div>
        );
      default:
        return <HomeView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="App">
      <div className="app-container">
        {renderCurrentView()}
        <ToastContainer toasts={toasts} />
      </div>
    </div>
  );
}

export default App;