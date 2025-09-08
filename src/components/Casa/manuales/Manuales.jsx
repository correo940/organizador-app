import React, { useState, useEffect } from 'react';
import './Manuales.css';

function Manuales() {
  // Estado para manuales con carga desde localStorage
  const [manuales, setManuales] = useState(() => {
    const savedManuales = localStorage.getItem('manuales');
    return savedManuales ? JSON.parse(savedManuales) : [];
  });
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [selectedManual, setSelectedManual] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' o 'detail'
  const [detailMedia, setDetailMedia] = useState({ photos: [], videos: [] });

  // IndexedDB helpers
  const openDB = () => new Promise((resolve, reject) => {
    const request = window.indexedDB.open('manuales_db', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('media')) {
        const store = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const saveBlob = async (type, file) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      const data = { type, blob: file, name: file.name };
      const req = store.add(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const getBlob = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readonly');
      const store = tx.objectStore('media');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const deleteBlob = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  };

  // Guardar manuales en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('manuales', JSON.stringify(manuales));
  }, [manuales]);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      url: URL.createObjectURL(file),
      name: file.name
    }));
    setPhotos([...photos, ...newPhotos]);
  };

  const handleVideoChange = (e) => {
    const files = Array.from(e.target.files);
    const newVideos = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      url: URL.createObjectURL(file),
      name: file.name
    }));
    setVideos([...videos, ...newVideos]);
  };

  const handleRemovePhoto = (id) => {
    const p = photos.find(x => x.id === id);
    if (p?.url) URL.revokeObjectURL(p.url);
    setPhotos(photos.filter(photo => photo.id !== id));
  };

  const handleRemoveVideo = (id) => {
    const v = videos.find(x => x.id === id);
    if (v?.url) URL.revokeObjectURL(v.url);
    setVideos(videos.filter(video => video.id !== id));
  };

  const handleAddManual = async () => {
    if (title.trim() === '' || content.trim() === '') return;
    // Guardar blobs en IndexedDB y conservar solo ids/nombres
    const savedPhotoIds = [];
    for (const photo of photos) {
      // photo.file es un File
      const id = await saveBlob('photo', photo.file);
      savedPhotoIds.push({ id, name: photo.name });
    }
    const savedVideoIds = [];
    for (const video of videos) {
      const id = await saveBlob('video', video.file);
      savedVideoIds.push({ id, name: video.name });
    }

    const newManual = {
      id: Date.now(),
      title: title.trim(),
      content: content.trim(),
      photos: savedPhotoIds,
      videos: savedVideoIds,
      createdAt: new Date().toISOString()
    };
    
    setManuales([...manuales, newManual]);
    setTitle('');
    setContent('');
    // Liberar URLs temporales
    photos.forEach(p => p.url && URL.revokeObjectURL(p.url));
    videos.forEach(v => v.url && URL.revokeObjectURL(v.url));
    setPhotos([]);
    setVideos([]);
  };

  const handleViewManual = async (manual) => {
    setSelectedManual(manual);
    setViewMode('detail');
    // Cargar blobs y construir URLs temporales
    const loadedPhotos = [];
    for (const p of manual.photos || []) {
      const record = await getBlob(p.id);
      if (record?.blob) loadedPhotos.push({ id: p.id, url: URL.createObjectURL(record.blob), name: p.name });
    }
    const loadedVideos = [];
    for (const v of manual.videos || []) {
      const record = await getBlob(v.id);
      if (record?.blob) loadedVideos.push({ id: v.id, url: URL.createObjectURL(record.blob), name: v.name });
    }
    setDetailMedia({ photos: loadedPhotos, videos: loadedVideos });
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedManual(null);
    // Liberar URLs de detalle
    detailMedia.photos.forEach(p => p.url && URL.revokeObjectURL(p.url));
    detailMedia.videos.forEach(v => v.url && URL.revokeObjectURL(v.url));
    setDetailMedia({ photos: [], videos: [] });
  };

  const handleDeleteManual = async (id) => {
    const manual = manuales.find(m => m.id === id);
    // Borrar blobs asociados
    if (manual) {
      for (const p of manual.photos || []) { 
        try { 
          await deleteBlob(p.id); 
        } catch (error) {
          console.error('Error deleting photo blob:', error);
        }
      }
      for (const v of manual.videos || []) { 
        try { 
          await deleteBlob(v.id); 
        } catch (error) {
          console.error('Error deleting video blob:', error);
        }
      }
    }
    setManuales(manuales.filter(manual => manual.id !== id));
    if (selectedManual && selectedManual.id === id) {
      handleBackToList();
    }
  };

  // Vista de lista de manuales
  const renderManualsList = () => (
    <>
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
        
        {/* Sección para subir fotos */}
        <div className="media-upload">
          <label className="upload-label">
            <span>📷 Añadir fotos</span>
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handlePhotoChange} 
              style={{ display: 'none' }}
            />
          </label>
          
          {photos.length > 0 && (
            <div className="media-preview">
              {photos.map(photo => (
                <div key={photo.id} className="media-item">
                  <img src={photo.url} alt={photo.name} />
                  <button onClick={() => handleRemovePhoto(photo.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Sección para subir videos */}
        <div className="media-upload">
          <label className="upload-label">
            <span>🎬 Añadir videos</span>
            <input 
              type="file" 
              accept="video/*" 
              multiple 
              onChange={handleVideoChange} 
              style={{ display: 'none' }}
            />
          </label>
          
          {videos.length > 0 && (
            <div className="media-preview">
              {videos.map(video => (
                <div key={video.id} className="media-item">
                  <video src={video.url} controls />
                  <button onClick={() => handleRemoveVideo(video.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <button onClick={handleAddManual}>Añadir Manual</button>
      </div>
      
      <div className="manuales-list">
        {manuales.length === 0 ? (
          <div className="no-manuales">No hay manuales todavía. ¡Añade el primero!</div>
        ) : (
          manuales.map((manual) => (
            <div key={manual.id} className="manual-card">
              <h2>{manual.title}</h2>
              <p className="manual-content-preview">{manual.content.substring(0, 100)}...</p>
              
              {manual.photos && manual.photos.length > 0 && (
                <div className="manual-media-count">📷 {manual.photos.length} foto(s)</div>
              )}
              
              {manual.videos && manual.videos.length > 0 && (
                <div className="manual-media-count">🎬 {manual.videos.length} video(s)</div>
              )}
              
              <div className="manual-actions">
                <button onClick={() => handleViewManual(manual)} className="view-button">Ver</button>
                <button onClick={() => handleDeleteManual(manual.id)} className="delete-button">Eliminar</button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  // Vista detallada de un manual
  const renderManualDetail = () => {
    if (!selectedManual) return null;
    
    return (
      <div className="manual-detail">
        <button onClick={handleBackToList} className="back-button">← Volver</button>
        
        <h1>{selectedManual.title}</h1>
        <div className="manual-content">{selectedManual.content}</div>
        
        {detailMedia.photos && detailMedia.photos.length > 0 && (
          <div className="manual-media-section">
            <h2>Fotos</h2>
            <div className="manual-photos">
              {detailMedia.photos.map(photo => (
                <div key={photo.id} className="manual-photo">
                  <img src={photo.url} alt={photo.name} />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {detailMedia.videos && detailMedia.videos.length > 0 && (
          <div className="manual-media-section">
            <h2>Videos</h2>
            <div className="manual-videos">
              {detailMedia.videos.map(video => (
                <div key={video.id} className="manual-video">
                  <video src={video.url} controls />
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="manual-footer">
          <small>Creado el: {new Date(selectedManual.createdAt).toLocaleDateString()}</small>
        </div>
      </div>
    );
  };

  return (
    <div className="manuales-container">
      {viewMode === 'list' ? renderManualsList() : renderManualDetail()}
    </div>
  );
}

export default Manuales;
