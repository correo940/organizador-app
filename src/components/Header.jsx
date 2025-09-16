import React from 'react';
import { Container, Navbar } from 'react-bootstrap';

const Header = () => {
  return (
    <Navbar bg="transparent" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand href="/" style={{ fontWeight: 'bold', color: '#333' }}>
          Quiova
        </Navbar.Brand>
      </Container>
    </Navbar>
  );
};

export default Header;
