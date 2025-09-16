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
import Header from './components/Header';

// Vista principal: QUOKKA, APLICACIONES, CALENDARIO
export function HomeView() {
  const navigate = useNavigate();
  return (
    <Container className="home-view text-center mt-5">
      <Row>
        <Col>
          <Folder
            name="Quiova"
            color="#4A7C59"
            onClick={() => navigate('/quokka')}
          />
        </Col>
        <Col>
          <Folder
            name="APLICACIONES"
            color="#6A994E"
            onClick={() => navigate('/aplicaciones')}
          />
        </Col>
        <Col>
          <Folder
            name="CALENDARIO"
            color="#84A98C"
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
      <Button onClick={() => navigate('/')} className="back-button mb-4">
        ← Volver
      </Button>
      <h2 className="view-title">Aplicaciones</h2>
      <Row className="text-center">
        <Col>
          <Folder
            name="TAREAS"
            color="#4A7C59"
            onClick={() => navigate('/aplicaciones/tareas')}
          />
        </Col>
        <Col>
          <Folder
            name="CONTRASEÑAS"
            color="#6A994E"
            onClick={() => navigate('/aplicaciones/contrasenas')}
          />
        </Col>
        <Col>
          <Folder
            name="CASA"
            color="#84A98C"
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
      <Button onClick={() => navigate('/aplicaciones')} className="back-button mb-4">
        ← Volver a Aplicaciones
      </Button>
      <h2 className="view-title">Casa</h2>
      <Row className="text-center">
        <Col>
          <Folder
            name="MANUALES"
            color="#4A7C59"
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
      <Header />
      <Outlet />
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;