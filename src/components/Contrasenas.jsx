import React, { useState, useEffect } from 'react';
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

  // Estado del formulario
  const [formData, setFormData] = useState({
    service: '',
    website: '',
    username: '',
    email: '',
    password: '',
    category: 'personal',
    notes: ''
  });

  // Estado del generador de contraseñas
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

  // Utilidades de cifrado
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

  // Carga inicial: detectar bóveda cifrada o migrar
  useEffect(() => {
    const encrypted = localStorage.getItem('passwords_encrypted');
    setHasVault(!!encrypted);
    if (!encrypted) {
      // Migración opcional desde almacenamiento plano si existiera
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

  // Guardado cifrado automático cuando se modifica y está desbloqueado
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwords]);

  const handleUnlock = async (e) => {
    e?.preventDefault?.();
    setUnlockError('');
    try {
      const encrypted = localStorage.getItem('passwords_encrypted');
      if (!encrypted) return; // no hay bóveda aún
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
      // Si existen contraseñas cargadas (legado), se migran; si no, iniciar vacío
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

  // Función para generar contraseñas ultra seguras
  const generateUltraSecurePassword = () => {
    const { length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeSimilar, includeSpecialChars } = generatorConfig;
    
    let charset = '';
    
    // Caracteres más diversos y seguros
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (includeSpecialChars) charset += '~`"\'\\\/';
    
    // Excluir caracteres que se pueden confundir
    if (excludeSimilar) {
      charset = charset.replace(/[0Oo1IlL|]/g, '');
    }
    
    if (!charset) return '';
    
    // Algoritmo mejorado para mayor seguridad
    let password = '';
    const typesUsed = [];
    
    // Asegurar que se use al menos un carácter de cada tipo seleccionado
    if (includeUppercase && charset.match(/[A-Z]/)) {
      const upperChars = charset.match(/[A-Z]/g);
      password += upperChars[Math.floor(Math.random() * upperChars.length)];
      typesUsed.push('upper');
    }
    if (includeLowercase && charset.match(/[a-z]/)) {
      const lowerChars = charset.match(/[a-z]/g);
      password += lowerChars[Math.floor(Math.random() * lowerChars.length)];
      typesUsed.push('lower');
    }
    if (includeNumbers && charset.match(/[0-9]/)) {
      const numberChars = charset.match(/[0-9]/g);
      password += numberChars[Math.floor(Math.random() * numberChars.length)];
      typesUsed.push('number');
    }
    if (includeSymbols && charset.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/)) {
      const symbolChars = charset.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/g);
      password += symbolChars[Math.floor(Math.random() * symbolChars.length)];
      typesUsed.push('symbol');
    }
    
    // Completar la longitud restante con caracteres aleatorios
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Mezclar los caracteres para evitar patrones predecibles
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  // Función para evaluar la fortaleza de la contraseña (mejorada)
  const getPasswordStrength = (password) => {
    if (!password) return { level: 'weak', score: 0 };
    
    let score = 0;
    
    // Longitud (más peso a contraseñas largas)
    if (password.length >= 8) score += 15;
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 25;
    if (password.length >= 20) score += 15;
    
    // Complejidad de caracteres
    if (/[a-z]/.test(password)) score += 8;
    if (/[A-Z]/.test(password)) score += 8;
    if (/[0-9]/.test(password)) score += 8;
    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) score += 12;
    if (/[~`"'\\\/]/.test(password)) score += 8;
    
    // Diversidad de caracteres
    const uniqueChars = new Set(password.split('')).size;
    if (uniqueChars >= password.length * 0.7) score += 10;
    
    // Penalizar patrones comunes
    if (/(.)\1{2,}/.test(password)) score -= 10; // Caracteres repetidos
    if (/123|abc|qwe|password|admin/i.test(password)) score -= 20; // Patrones comunes
    
    let level = 'weak';
    if (score >= 85) level = 'strong';
    else if (score >= 65) level = 'good';
    else if (score >= 40) level = 'fair';
    
    return { level, score: Math.min(100, Math.max(0, score)) };
  };

  // Función para obtener el icono del servicio
  const getServiceIcon = (service, category) => {
    const serviceIcons = {
      gmail: '📧', google: '🔍', facebook: '📘', instagram: '📷',
      twitter: '🐦', linkedin: '💼', netflix: '🎬', spotify: '🎵',
      amazon: '📦', paypal: '💰', youtube: '📺', whatsapp: '💬',
      github: '🐙', discord: '💬', telegram: '📱', tiktok: '🎵'
    };
    
    const categoryIcons = {
      personal: '👤', work: '💼', banking: '🏦',
      social: '📱', shopping: '🛒', entertainment: '🎬'
    };
    
    const serviceName = service.toLowerCase();
    return serviceIcons[serviceName] || categoryIcons[category] || service.charAt(0).toUpperCase();
  };

  // Función para cerrar el banner de seguridad
  const handleSecurityBannerClose = (remember = false) => {
    setShowSecurityBanner(false);
    if (remember) {
      localStorage.setItem('securityBannerShown', 'true');
    }
  };

  // Función para copiar al portapapeles
  const copyToClipboard = (text, type = 'Contraseña') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyNotification(`${type} copiada al portapapeles`);
      setTimeout(() => setCopyNotification(''), 3000);
    }).catch(err => {
      console.error('Error al copiar:', err);
      setCopyNotification('Error al copiar');
      setTimeout(() => setCopyNotification(''), 3000);
    });
  };

  // Función para agregar contraseña
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

  // Función para eliminar contraseña
  const deletePassword = (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta contraseña?')) {
      setPasswords(passwords.filter(p => p.id !== id));
    }
  };

  // Función para alternar visibilidad de contraseña
  const togglePasswordVisibility = (id) => {
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filtrar contraseñas
  const filteredPasswords = passwords.filter(password => {
    const matchesSearch = password.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || password.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Pantallas de bloqueo/desbloqueo
  if (!isUnlocked && hasVault) {
    return (
      <div className="password-manager-container">
        <div className="password-manager-content">
          <div className="password-header">
            <h1>🔐 Desbloquear Bóveda</h1>
            <p className="subtitle">Introduce tu contraseña maestra</p>
          </div>
          <form onSubmit={handleUnlock} className="add-password-section" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="form-group">
              <label className="form-label">Contraseña maestra</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                required
              />
            </div>
            {unlockError && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{unlockError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button type="submit" className="btn btn-primary">🔓 Desbloquear</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!isUnlocked && !hasVault) {
    return (
      <div className="password-manager-container">
        <div className="password-manager-content">
          <div className="password-header">
            <h1>🛡️ Crear Bóveda Segura</h1>
            <p className="subtitle">Protege tus contraseñas con una contraseña maestra</p>
          </div>
          <form onSubmit={handleCreateVault} className="add-password-section" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="form-group">
              <label className="form-label">Contraseña maestra (mín. 8)</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar contraseña</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={masterPasswordConfirm}
                onChange={(e) => setMasterPasswordConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {unlockError && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{unlockError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button type="submit" className="btn btn-primary">🧰 Crear Bóveda</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="password-manager-container">
      <div className="password-manager-content">
        <div className="password-header">
          <h1>🔐 Gestor de Contraseñas</h1>
          <p className="subtitle">Administra tus contraseñas de forma segura</p>
          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={handleLock}>🔒 Bloquear</button>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="search-section">
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por servicio, usuario o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>

        {/* Pestañas de categorías */}
        <div className="category-tabs">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </div>

        {/* Botón para mostrar/ocultar formulario */}
        <button
          className="btn btn-primary btn-toggle-form"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '❌ Cancelar' : '➕ Agregar Nueva Contraseña'}
        </button>

        {/* Formulario para agregar contraseñas */}
        {showForm && (
          <div className="add-password-section">
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Servicio *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Gmail, Facebook, Banco..."
                    value={formData.service}
                    onChange={(e) => setFormData({...formData, service: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sitio Web</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://ejemplo.com"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Usuario</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nombre de usuario"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="correo@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contraseña *</label>
                  <div className="password-input-group">
                    <input
                      type={showFormPassword ? "text" : "password"}
                      className="form-input"
                      placeholder="Contraseña"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                    >
                      {showFormPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    className="form-input"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="personal">Personal</option>
                    <option value="work">Trabajo</option>
                    <option value="banking">Bancaria</option>
                    <option value="social">Redes Sociales</option>
                    <option value="shopping">Compras</option>
                    <option value="entertainment">Entretenimiento</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notas</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Notas adicionales (opcional)"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              {/* Generador de contraseñas ultra seguras */}
              <div className="password-generator">
                <h3>🎲 Generador de Contraseñas Ultra Seguras</h3>
                
                <div className="generator-options">
                  <div className="length-control">
                    <label>Longitud: {generatorConfig.length}</label>
                    <input
                      type="range"
                      className="length-slider"
                      min="8"
                      max="50"
                      value={generatorConfig.length}
                      onChange={(e) => setGeneratorConfig({...generatorConfig, length: parseInt(e.target.value)})}
                    />
                  </div>

                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="uppercase"
                      checked={generatorConfig.includeUppercase}
                      onChange={(e) => setGeneratorConfig({...generatorConfig, includeUppercase: e.target.checked})}
                    />
                    <label htmlFor="uppercase">A-Z</label>
                  </div>

                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="lowercase"
                      checked={generatorConfig.includeLowercase}
                      onChange={(e) => setGeneratorConfig({...generatorConfig, includeLowercase: e.target.checked})}
                    />
                    <label htmlFor="lowercase">a-z</label>
                  </div>

                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="numbers"
                      checked={generatorConfig.includeNumbers}
                      onChange={(e) => setGeneratorConfig({...generatorConfig, includeNumbers: e.target.checked})}
                    />
                    <label htmlFor="numbers">0-9</label>
                  </div>

                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="symbols"
                      checked={generatorConfig.includeSymbols}
                      onChange={(e) => setGeneratorConfig({...generatorConfig, includeSymbols: e.target.checked})}
                    />
                    <label htmlFor="symbols">!@#$%</label>
                  </div>

                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="specialChars"
                      checked={generatorConfig.includeSpecialChars}
                      onChange={(e) => setGeneratorConfig({...generatorConfig, includeSpecialChars: e.target.checked})}
                    />
                    <label htmlFor="specialChars">~`"'\\/</label>
                  </div>

                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="excludeSimilar"
                      checked={generatorConfig.excludeSimilar}
                      onChange={(e) => setGeneratorConfig({...generatorConfig, excludeSimilar: e.target.checked})}
                    />
                    <label htmlFor="excludeSimilar">Excluir similares</label>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-generate"
                  onClick={() => {
                    const newPassword = generateUltraSecurePassword();
                    setFormData({...formData, password: newPassword});
                  }}
                >
                  🎲 Generar Contraseña Ultra Segura
                </button>
              </div>

              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button type="submit" className="btn btn-primary">
                  💾 Guardar Contraseña
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de contraseñas */}
        {filteredPasswords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <h3>No hay contraseñas guardadas</h3>
            <p>Agrega tu primera contraseña para comenzar</p>
          </div>
        ) : (
          <div className="passwords-grid">
            {filteredPasswords.map(password => (
              <div key={password.id} className="password-card">
                <div className="card-header">
                  <div className="service-info">
                    <div className="service-icon">
                      {getServiceIcon(password.service, password.category)}
                    </div>
                    <div>
                      <h3 className="service-name">{password.service}</h3>
                      {password.website && (
                        <p className="service-url">
                          <a href={password.website} target="_blank" rel="noopener noreferrer">
                            {password.website}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="card-actions">
                    <button
                      className="action-btn"
                      onClick={() => copyToClipboard(password.password)}
                      title="Copiar contraseña"
                      aria-label={`Copiar contraseña de ${password.service}`}
                    >
                      📋
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => togglePasswordVisibility(password.id)}
                      title={showPasswords[password.id] ? "Ocultar" : "Mostrar"}
                      aria-pressed={!!showPasswords[password.id]}
                      aria-label={`${showPasswords[password.id] ? 'Ocultar' : 'Mostrar'} contraseña de ${password.service}`}
                    >
                      {showPasswords[password.id] ? '🙈' : '👁️'}
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => deletePassword(password.id)}
                      title="Eliminar"
                      aria-label={`Eliminar ${password.service}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="password-details">
                  {password.username && (
                    <div className="password-field">
                      <div className="field-label">Usuario</div>
                      <div className="field-value">
                        {password.username}
                        <button
                          className="action-btn"
                          onClick={() => copyToClipboard(password.username, 'Usuario')}
                          style={{ marginLeft: '0.5rem', width: '25px', height: '25px' }}
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}

                  {password.email && (
                    <div className="password-field">
                      <div className="field-label">Email</div>
                      <div className="field-value">
                        {password.email}
                        <button
                          className="action-btn"
                          onClick={() => copyToClipboard(password.email, 'Email')}
                          style={{ marginLeft: '0.5rem', width: '25px', height: '25px' }}
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="password-field">
                    <div className="field-label">Contraseña</div>
                    <div className="field-value">
                      {showPasswords[password.id] ? (
                        password.password
                      ) : (
                        <span className="password-hidden">••••••••••••••••</span>
                      )}
                    </div>
                  </div>

                  {password.notes && (
                    <div className="password-field">
                      <div className="field-label">Notas</div>
                      <div className="field-value" style={{ fontFamily: 'inherit' }}>
                        {password.notes}
                      </div>
                    </div>
                  )}

                  {/* Indicador de fortaleza mejorado */}
                  <div className="strength-indicator">
                    <div className="strength-label">
                      Fortaleza: {password.strength.level === 'weak' ? '🔴 Débil' :
                                 password.strength.level === 'fair' ? '🟡 Regular' :
                                 password.strength.level === 'good' ? '🟢 Buena' : '💚 Ultra Fuerte'}
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                        ({password.strength.score}/100)
                      </span>
                    </div>
                    <div className="strength-bar">
                      <div 
                        className={`strength-fill strength-${password.strength.level}`}
                        style={{ width: `${password.strength.score}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="password-field" style={{ marginTop: '1rem' }}>
                    <div className="field-label">Categoría</div>
                    <div className="field-value" style={{ fontFamily: 'inherit' }}>
                      {categories.find(cat => cat.id === password.category)?.icon} {' '}
                      {categories.find(cat => cat.id === password.category)?.name}
                    </div>
                  </div>

                  <div className="password-field">
                    <div className="field-label">Creada</div>
                    <div className="field-value" style={{ fontFamily: 'inherit' }}>
                      {new Date(password.createdAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Estadísticas mejoradas */}
        {passwords.length > 0 && (
          <div className="stats-section">
            <h3 style={{ marginBottom: '1rem', color: '#374151' }}>📊 Estadísticas de Seguridad</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{passwords.length}</div>
                <div className="stat-label">Total de Contraseñas</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#059669' }}>
                  {passwords.filter(p => p.strength.level === 'strong').length}
                </div>
                <div className="stat-label">Ultra Fuertes</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#10b981' }}>
                  {passwords.filter(p => p.strength.level === 'good').length}
                </div>
                <div className="stat-label">Buenas</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#f59e0b' }}>
                  {passwords.filter(p => p.strength.level === 'fair').length}
                </div>
                <div className="stat-label">Regulares</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#ef4444' }}>
                  {passwords.filter(p => p.strength.level === 'weak').length}
                </div>
                <div className="stat-label">Débiles</div>
              </div>
            </div>
            
            {passwords.filter(p => p.strength.level === 'weak' || p.strength.level === 'fair').length > 0 && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: '#fef3c7', 
                borderRadius: '8px',
                color: '#92400e'
              }}>
                ⚠️ Tienes {passwords.filter(p => p.strength.level === 'weak' || p.strength.level === 'fair').length} contraseña(s) que necesitan mejorarse para mayor seguridad.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notificación de copia */}
      {copyNotification && (
        <div className="copy-notification">
          ✅ {copyNotification}
        </div>
      )}

      {/* Banner de Seguridad Local */}
      {showSecurityBanner && (
        <div className="security-banner">
          <div className="security-banner-header">
            <div className="security-avatar">🛡️</div>
            <div>
              <h3 className="security-title">¡Tus datos están seguros!</h3>
              <p className="security-subtitle">Gestor de contraseñas local</p>
            </div>
          </div>
          
          <div className="security-message">
            <strong>🔒 Privacidad Total:</strong> Todas tus contraseñas se guardan únicamente en tu dispositivo. No se envían a internet ni a servidores externos.
          </div>
          
          <ul className="security-features">
            <li>Sin conexión a internet requerida</li>
            <li>Datos encriptados localmente</li>
            <li>Control total de tu información</li>
            <li>Sin riesgo de filtración de datos</li>
          </ul>
          
          <div className="security-banner-actions">
            <button 
              className="btn-banner btn-banner-secondary"
              onClick={() => handleSecurityBannerClose(false)}
            >
              Entendido
            </button>
            <button 
              className="btn-banner btn-banner-primary"
              onClick={() => handleSecurityBannerClose(true)}
            >
              No volver a mostrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contrasenas;