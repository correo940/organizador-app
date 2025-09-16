import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import Folder from './components/Folder';
import Tareas from './components/Tareas';
import Contrasenas from './components/Contrasenas';
import Calendario from './components/Calendario';
import Casa from './components/Casa/Casa';
import Manuales from './components/Casa/manuales/Manuales';
import ToastContainer from './components/ToastContainer';
import './App.css';
import { useToast } from './hooks/useToast';
import { Outlet, useNavigate } from 'react-router-dom';

// Vista principal: QUOKKA, APLICACIONES, CALENDARIO
export function HomeView() {
  const navigate = useNavigate();
  return (
    <Container className="home-view text-center mt-5">
      <Row>
        <Col>
          <Folder
            name="QUOKKA"
            color="#2d5a2d"
            onClick={() => navigate('/quokka')}
          />
        </Col>
        <Col>
          <Folder
            name="APLICACIONES"
            color="#90ee90"
            onClick={() => navigate('/aplicaciones')}
          />
        </Col>
        <Col>
          <Folder
            name="CALENDARIO"
            color="#1a4a1a"
            onClick={() => navigate('/calendario')}
          />
        </Col>
      </Row>
    </Container>
  );
}

// Vista de aplicaciones: TAREAS, CONTRASEÑAS, CASA
export function ApplicationsView() {
  const navigate = useNavigate();
  return (
    <Container className="applications-view mt-5">
      <Button variant="light" onClick={() => navigate('/')} className="mb-3">
        ← Volver
      </Button>
      <Row className="text-center">
        <Col>
          <Folder
            name="TAREAS"
            color="#4a7c59"
            onClick={() => navigate('/aplicaciones/tareas')}
          />
        </Col>
        <Col>
          <Folder
            name="CONTRASEÑAS"
            color="#66bb6a"
            onClick={() => navigate('/aplicaciones/contrasenas')}
          />
        </Col>
        <Col>
          <Folder
            name="CASA"
            color="#81c784"
            onClick={() => navigate('/casa')}
          />
        </Col>
      </Row>
    </Container>
  );
}

// Vista de casa: MANUALES
export function HouseView() {
  const navigate = useNavigate();
  return (
    <Container className="house-view mt-5">
      <Button variant="light" onClick={() => navigate('/aplicaciones')} className="mb-3">
        ← Volver a Aplicaciones
      </Button>
      <Row className="text-center">
        <Col>
          <Folder
            name="MANUALES"
            color="#a5d6a7"
            onClick={() => navigate('/casa/manuales')}
          />
        </Col>
      </Row>
    </Container>
  );
}

function App() {
  const { toasts } = useToast();

  return (
    <div className="App">
      <Outlet />
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;