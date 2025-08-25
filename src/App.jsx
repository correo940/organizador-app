import React, { useState, useEffect } from 'react';
import Folder from './components/Folder';
import Tareas from './components/Tareas';
import Contrasenas from './components/Contrasenas';
import Calendario from './components/Calendario';
import './App.css';

// Vista principal: QUOKKA, APLICACIONES, CALENDARIO
function HomeView({ onNavigate }) {
  return (
    <div className="app-container">
      <Folder name="QUOKKA" />
      <Folder name="APLICACIONES" onClick={() => onNavigate('aplicaciones')} />
      <Folder name="CALENDARIO" onClick={() => onNavigate('calendario')} />
    </div>
  );
}

// Vista de Aplicaciones: TAREAS, CONTRASEÑAS
function AplicacionesView({ onNavigate }) {
  return (
    <div className="app-container">
      <Folder name="TAREAS" onClick={() => onNavigate('tareas')} />
      <Folder name="CONTRASEÑAS" onClick={() => onNavigate('contrasenas')} />
    </div>
  );
}

function App() {
  // Estado para saber qué vista mostrar: 'home', 'aplicaciones', 'tareas', 'calendario', 'contrasenas'
  const [currentView, setCurrentView] = useState('home');
  
  // Estado centralizado para las tareas. Se carga desde localStorage.
  const [tasks, setTasks] = useState(() => {
    const savedTasks = localStorage.getItem('tasks');
    return savedTasks ? JSON.parse(savedTasks) : [];
  });

  // Guardar tareas en localStorage cada vez que cambien
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Función para añadir una nueva tarea a la lista
  const handleAddTask = (newTask) => {
    setTasks(prevTasks => [newTask, ...prevTasks]);
  };
  
  // Función para actualizar la lista de tareas (borrar, completar, etc.)
  const handleUpdateTasks = (updatedTasks) => {
    setTasks(updatedTasks);
  }

  // Lógica para el botón "Volver"
  const handleBack = () => {
    if (['tareas', 'contrasenas'].includes(currentView)) {
      setCurrentView('aplicaciones');
    } else {
      setCurrentView('home');
    }
  };

  // Navegación y renderizado
  const renderContent = () => {
    switch (currentView) {
      case 'aplicaciones':
        return <AplicacionesView onNavigate={setCurrentView} />;
      case 'tareas':
        return <Tareas tasks={tasks} onAddTask={handleAddTask} onUpdateTasks={handleUpdateTasks} />;
      case 'calendario':
        return <Calendario tasks={tasks} />;
      case 'contrasenas':
        return <Contrasenas />;
      default:
        return <HomeView onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="app-wrapper">
      {currentView !== 'home' && (
        <button onClick={handleBack} className="back-to-home">
          ‹ Volver
        </button>
      )}
      {renderContent()}
    </div>
  );
}

export default App;