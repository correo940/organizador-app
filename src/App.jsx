import React, { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
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
    <Container className="home-view text-center mt-5">
      <Row>
        <Col>
          <Folder
            name="QUOKKA"
            color="#2d5a2d"
            onClick={() => onNavigate('/quokka')}
          />
        </Col>
        <Col>
          <Folder
            name="APLICACIONES"
            color="#90ee90"
            onClick={() => onNavigate('/aplicaciones')}
          />
        </Col>
        <Col>
          <Folder
            name="CALENDARIO"
            color="#1a4a1a"
            onClick={() => onNavigate('/calendario')}
          />
        </Col>
      </Row>
    </Container>
  );
}

// Vista de aplicaciones: TAREAS, CONTRASEÑAS, CASA
function ApplicationsView({ onNavigate }) {
  return (
    <Container className="applications-view mt-5">
      <Button variant="light" onClick={() => onNavigate('/')} className="mb-3">
        ← Volver
      </Button>
      <Row className="text-center">
        <Col>
          <Folder
            name="TAREAS"
            color="#4a7c59"
            onClick={() => onNavigate('/aplicaciones/tareas')}
          />
        </Col>
        <Col>
          <Folder
            name="CONTRASEÑAS"
            color="#66bb6a"
            onClick={() => onNavigate('/aplicaciones/contrasenas')}
          />
        </Col>
        <Col>
          <Folder
            name="CASA"
            color="#81c784"
            onClick={() => onNavigate('/casa')}
          />
        </Col>
      </Row>
    </Container>
  );
}

// Vista de casa: MANUALES
function HouseView({ onNavigate }) {
  return (
    <Container className="house-view mt-5">
      <Button variant="light" onClick={() => onNavigate('/aplicaciones')} className="mb-3">
        ← Volver a Aplicaciones
      </Button>
      <Row className="text-center">
        <Col>
          <Folder
            name="MANUALES"
            color="#a5d6a7"
            onClick={() => onNavigate('/casa/manuales')}
          />
        </Col>
      </Row>
    </Container>
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
          <Container className="mt-5">
            <Button variant="light" onClick={() => handleNavigate('/aplicaciones')} className="mb-3">
              ← Volver a Aplicaciones
            </Button>
            <Tareas
              tasks={tasks}
              setTasks={setTasks}
              addToast={addToast}
            />
          </Container>
        );
      case '/aplicaciones/contrasenas':
        return (
          <Container className="mt-5">
            <Button variant="light" onClick={() => handleNavigate('/aplicaciones')} className="mb-3">
              ← Volver a Aplicaciones
            </Button>
            <Contrasenas addToast={addToast} />
          </Container>
        );
      case '/calendario':
        return (
          <Container className="mt-5">
            <Button variant="light" onClick={() => handleNavigate('/')} className="mb-3">
              ← Volver al Inicio
            </Button>
            <Calendario addToast={addToast} />
          </Container>
        );
      case '/casa':
        return <HouseView onNavigate={handleNavigate} />;
      case '/casa/manuales':
        return (
          <Container className="mt-5">
            <Button variant="light" onClick={() => handleNavigate('/casa')} className="mb-3">
              ← Volver a Casa
            </Button>
            <Manuales addToast={addToast} />
          </Container>
        );
      default:
        return <HomeView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="App">
      {renderCurrentView()}
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;