import React, { useState } from 'react';
import './Manuales.css';

function Manuales() {
  const [manuales, setManuales] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleAddManual = () => {
    if (title.trim() === '' || content.trim() === '') return;
    const newManual = {
      id: Date.now(),
      title: title.trim(),
      content: content.trim(),
    };
    setManuales([...manuales, newManual]);
    setTitle('');
    setContent('');
  };

  return (
    <div className="manuales-container">
      <h1>Manuales de la Casa</h1>
      <div className="manual-form">
        <input
          type="text"
          placeholder="Título del manual (ej. Piscina)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Contenido del manual (ej. pH a 7.2, válvulas en posición de filtrado...)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button onClick={handleAddManual}>Añadir Manual</button>
      </div>
      <div className="manuales-list">
        {manuales.map((manual) => (
          <div key={manual.id} className="manual-card">
            <h2>{manual.title}</h2>
            <p>{manual.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Manuales;
