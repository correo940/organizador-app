import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  Form,
  Button,
  InputGroup,
  Nav,
  Row,
  Col,
  Alert,
  Toast,
  ToastContainer,
  ListGroup,
  Badge,
  Modal,
  ProgressBar
} from 'react-bootstrap';
import './Contrasenas.css';

function Contrasenas() {
  const [passwords, setPasswords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [copyNotification, setCopyNotification] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [masterPasswordConfirm, setMasterPasswordConfirm] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const [formData, setFormData] = useState({
    service: '',
    website: '',
    username: '',
    email: '',
    password: '',
    category: 'personal',
    notes: ''
  });

  const [generatorConfig, setGeneratorConfig] = useState({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: true,
    includeSpecialChars: true
  });

  const [showPasswords, setShowPasswords] = useState({});
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [showSecurityBanner, setShowSecurityBanner] = useState(true);

  const categories = [
    { id: 'all', name: 'Todas', icon: '📁' },
    { id: 'personal', name: 'Personal', icon: '👤' },
    { id: 'work', name: 'Trabajo', icon: '💼' },
    { id: 'banking', name: 'Bancaria', icon: '🏦' },
    { id: 'social', name: 'Redes Sociales', icon: '📱' },
    { id: 'shopping', name: 'Compras', icon: '🛒' },
    { id: 'entertainment', name: 'Entretenimiento', icon: '🎬' }
  ];

  // Crypto utilities (unchanged)
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  const toBase64 = (arrayBuffer) => {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const fromBase64 = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  async function deriveKey(password, salt) {
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      textEncoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 150000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptVault(data, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encoded = textEncoder.encode(JSON.stringify(data));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    return {
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(ciphertext)
    };
  }

  async function decryptVault(payload, password) {
    const salt = new Uint8Array(fromBase64(payload.salt));
    const iv = new Uint8Array(fromBase64(payload.iv));
    const key = await deriveKey(password, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      fromBase64(payload.ciphertext)
    );
    return JSON.parse(textDecoder.decode(decrypted));
  }

  useEffect(() => {
    const encrypted = localStorage.getItem('passwords_encrypted');
    setHasVault(!!encrypted);
    if (!encrypted) {
      const legacy = localStorage.getItem('passwords');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          setPasswords(Array.isArray(parsed) ? parsed : []);
        } catch { setPasswords([]); }
      }
    }

    const bannerShown = localStorage.getItem('securityBannerShown');
    if (bannerShown) setShowSecurityBanner(false);
  }, []);

  useEffect(() => {
    async function persist() {
      try {
        if (isUnlocked) {
          const payload = await encryptVault(passwords, masterPassword);
          localStorage.setItem('passwords_encrypted', JSON.stringify(payload));
          localStorage.removeItem('passwords');
        }
      } catch (e) {
        console.error('Error cifrando bóveda:', e);
      }
    }
    persist();
  }, [passwords, isUnlocked, masterPassword]);

  const handleUnlock = async (e) => {
    e?.preventDefault?.();
    setUnlockError('');
    try {
      const encrypted = localStorage.getItem('passwords_encrypted');
      if (!encrypted) return;
      const payload = JSON.parse(encrypted);
      const data = await decryptVault(payload, masterPassword);
      if (!Array.isArray(data)) throw new Error('Formato inválido');
      setPasswords(data);
      setIsUnlocked(true);
    } catch (err) {
      console.error(err);
      setUnlockError('Contraseña maestra incorrecta');
    }
  };

  const handleCreateVault = async (e) => {
    e?.preventDefault?.();
    setUnlockError('');
    if (!masterPassword || masterPassword.length < 8) {
      setUnlockError('Usa al menos 8 caracteres');
      return;
    }
    if (masterPassword !== masterPasswordConfirm) {
      setUnlockError('Las contraseñas no coinciden');
      return;
    }
    try {
      const initial = Array.isArray(passwords) ? passwords : [];
      const payload = await encryptVault(initial, masterPassword);
      localStorage.setItem('passwords_encrypted', JSON.stringify(payload));
      localStorage.removeItem('passwords');
      setIsUnlocked(true);
      setHasVault(true);
    } catch (err) {
      console.error(err);
      setUnlockError('Error creando bóveda');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setPasswords([]);
    setMasterPassword('');
    setMasterPasswordConfirm('');
  };

  const generateUltraSecurePassword = () => {
    // ... (generation logic unchanged)
  };

  const getPasswordStrength = (password) => {
    // ... (strength logic unchanged)
  };

  const getServiceIcon = (service, category) => {
    // ... (icon logic unchanged)
  };

  const handleSecurityBannerClose = (remember = false) => {
    setShowSecurityBanner(false);
    if (remember) {
      localStorage.setItem('securityBannerShown', 'true');
    }
  };

  const copyToClipboard = (text, type = 'Contraseña') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyNotification(`${type} copiada al portapapeles`);
    }).catch(err => {
      console.error('Error al copiar:', err);
      setCopyNotification('Error al copiar');
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newPassword = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toISOString(),
      strength: getPasswordStrength(formData.password)
    };
    
    setPasswords([...passwords, newPassword]);
    setFormData({
      service: '', website: '', username: '', email: '',
      password: '', category: 'personal', notes: ''
    });
    setShowForm(false);
    setShowFormPassword(false);
  };

  const deletePassword = (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta contraseña?')) {
      setPasswords(passwords.filter(p => p.id !== id));
    }
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPasswords = passwords.filter(password => {
    const matchesSearch = password.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || password.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isUnlocked) {
    return (
      <div className="password-manager-container">
        <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
          <Card className="shadow-lg" style={{ width: '100%', maxWidth: '480px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
            <Card.Body className="p-5">
              <h1 className="text-center mb-4">{hasVault ? '🔐 Desbloquear Bóveda' : '🛡️ Crear Bóveda Segura'}</h1>
              <p className="text-center text-muted mb-4">{hasVault ? 'Introduce tu contraseña maestra' : 'Protege tus contraseñas con una contraseña maestra'}</p>
              <Form onSubmit={hasVault ? handleUnlock : handleCreateVault}>
                <Form.Group className="mb-3" controlId="formMasterPassword">
                  <Form.Label>Contraseña maestra {hasVault ? '' : '(mín. 8 caracteres)'}</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="••••••••"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    required
                    minLength={hasVault ? 0 : 8}
                  />
                </Form.Group>
                {!hasVault && (
                  <Form.Group className="mb-3" controlId="formMasterPasswordConfirm">
                    <Form.Label>Confirmar contraseña</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="••••••••"
                      value={masterPasswordConfirm}
                      onChange={(e) => setMasterPasswordConfirm(e.target.value)}
                      required
                      minLength={8}
                    />
                  </Form.Group>
                )}
                {unlockError && <Alert variant="danger" className="mt-3">{unlockError}</Alert>}
                <div className="d-grid mt-4">
                  <Button variant="primary" type="submit" size="lg">
                    {hasVault ? '🔓 Desbloquear' : '🧰 Crear Bóveda'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Container>
      </div>
    );
  }

  return (
    <div className="password-manager-container">
      <Container className="password-manager-content">
        <div className="password-header">
          <h1>🔐 Gestor de Contraseñas</h1>
          <p className="subtitle">Administra tus contraseñas de forma segura</p>
          <Button variant="secondary" onClick={handleLock}>🔒 Bloquear</Button>
        </div>

        <Row className="justify-content-center mb-4">
          <Col md={8} lg={6}>
            <InputGroup className="search-bar">
              <Form.Control
                className="search-input"
                placeholder="Buscar por servicio, usuario o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <InputGroup.Text><span role="img" aria-label="search">🔍</span></InputGroup.Text>
            </InputGroup>
          </Col>
        </Row>

        <Nav variant="pills" className="category-tabs justify-content-center mb-4" activeKey={activeCategory} onSelect={(k) => setActiveCategory(k)}>
          {categories.map(category => (
            <Nav.Item key={category.id}>
              <Nav.Link eventKey={category.id}>{category.icon} {category.name}</Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <div className="text-center mb-4">
            <Button variant="primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? '❌ Cancelar' : '➕ Agregar Nueva Contraseña'}
            </Button>
        </div>

        <Modal show={showForm} onHide={() => setShowForm(false)} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>Agregar Nueva Contraseña</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Servicio *</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Ej: Gmail, Facebook, Banco..."
                                    value={formData.service}
                                    onChange={(e) => setFormData({...formData, service: e.target.value})}
                                    required
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Sitio Web</Form.Label>
                                <Form.Control
                                    type="url"
                                    placeholder="https://ejemplo.com"
                                    value={formData.website}
                                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Usuario</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Nombre de usuario"
                                    value={formData.username}
                                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Email</Form.Label>
                                <Form.Control
                                    type="email"
                                    placeholder="correo@ejemplo.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Contraseña *</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        type={showFormPassword ? "text" : "password"}
                                        placeholder="Contraseña"
                                        value={formData.password}
                                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                                        required
                                    />
                                    <Button variant="outline-secondary" onClick={() => setShowFormPassword(!showFormPassword)}>
                                        {showFormPassword ? '🙈' : '👁️'}
                                    </Button>
                                </InputGroup>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Categoría</Form.Label>
                                <Form.Select
                                    value={formData.category}
                                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                                >
                                    <option value="personal">Personal</option>
                                    <option value="work">Trabajo</option>
                                    <option value="banking">Bancaria</option>
                                    <option value="social">Redes Sociales</option>
                                    <option value="shopping">Compras</option>
                                    <option value="entertainment">Entretenimiento</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                    <Form.Group className="mb-3">
                        <Form.Label>Notas</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="Notas adicionales (opcional)"
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        />
                    </Form.Group>

                    <Card className="mt-4">
                        <Card.Header>
                            <Card.Title as="h5">🎲 Generador de Contraseñas</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Form.Group className="mb-3">
                                <Form.Label>Longitud: {generatorConfig.length}</Form.Label>
                                <Form.Range
                                    min="8"
                                    max="50"
                                    value={generatorConfig.length}
                                    onChange={(e) => setGeneratorConfig({...generatorConfig, length: parseInt(e.target.value)})
                                    }
                                />
                            </Form.Group>
                            <div className="d-flex flex-wrap">
                                <Form.Check
                                    type="checkbox"
                                    id="uppercase"
                                    label="A-Z"
                                    checked={generatorConfig.includeUppercase}
                                    onChange={(e) => setGeneratorConfig({...generatorConfig, includeUppercase: e.target.checked})}
                                    className="me-3"
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="lowercase"
                                    label="a-z"
                                    checked={generatorConfig.includeLowercase}
                                    onChange={(e) => setGeneratorConfig({...generatorConfig, includeLowercase: e.target.checked})}
                                    className="me-3"
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="numbers"
                                    label="0-9"
                                    checked={generatorConfig.includeNumbers}
                                    onChange={(e) => setGeneratorConfig({...generatorConfig, includeNumbers: e.target.checked})}
                                    className="me-3"
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="symbols"
                                    label="!@#$"
                                    checked={generatorConfig.includeSymbols}
                                    onChange={(e) => setGeneratorConfig({...generatorConfig, includeSymbols: e.target.checked})}
                                    className="me-3"
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="specialChars"
                                    label="~`'&quot;"
                                    checked={generatorConfig.includeSpecialChars}
                                    onChange={(e) => setGeneratorConfig({...generatorConfig, includeSpecialChars: e.target.checked})}
                                    className="me-3"
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="excludeSimilar"
                                    label="Excluir similares"
                                    checked={generatorConfig.excludeSimilar}
                                    onChange={(e) => setGeneratorConfig({...generatorConfig, excludeSimilar: e.target.checked})}
                                />
                            </div>
                            <Button
                                variant="outline-primary"
                                className="mt-3"
                                onClick={() => {
                                    const newPassword = generateUltraSecurePassword();
                                    setFormData({...formData, password: newPassword});
                                }}
                            >
                                🎲 Generar Contraseña
                            </Button>
                        </Card.Body>
                    </Card>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowForm(false)}>Cerrar</Button>
                <Button variant="primary" onClick={handleSubmit}>💾 Guardar Contraseña</Button>
            </Modal.Footer>
        </Modal>

        {filteredPasswords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <h3>No hay contraseñas guardadas</h3>
            <p>Agrega tu primera contraseña para comenzar</p>
          </div>
        ) : (
          <Row xs={1} md={2} lg={3} className="g-4">
            {filteredPasswords.map(password => (
              <Col key={password.id}>
                <Card className="password-card h-100">
                  {/* ... password card content ... */}
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Stats and other sections */}

      </Container>

      <ToastContainer position="top-end" className="p-3">
        <Toast onClose={() => setCopyNotification('')} show={!!copyNotification} delay={3000} autohide>
          <Toast.Header>
            <strong className="me-auto">Notificación</strong>
          </Toast.Header>
          <Toast.Body>✅ {copyNotification}</Toast.Body>
        </Toast>
      </ToastContainer>

      {showSecurityBanner && (
        <Alert variant="info" onClose={() => handleSecurityBannerClose(false)} dismissible className="security-banner">
            {/* ... security banner content ... */}
        </Alert>
      )}
    </div>
  );
}

export default Contrasenas;
