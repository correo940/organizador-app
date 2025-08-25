import React, { useState, useEffect } from 'react';
import './Tareas.css';

function Tareas() {
  const [tasks, setTasks] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, completed, overdue
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [alarmDate, setAlarmDate] = useState('');
  const [alarmTime, setAlarmTime] = useState('');
  const [alarms, setAlarms] = useState(new Map()); // Para rastrear alarmas activas

  // Cargar tareas del localStorage al iniciar
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
    
    // Solicitar permisos de notificación
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Guardar tareas en localStorage cada vez que cambien
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Verificar alarmas cada minuto
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.alarmDateTime && !task.completed && !task.alarmFired) {
          const alarmTime = new Date(task.alarmDateTime);
          if (now >= alarmTime) {
            // Disparar alarma
            showNotification(task);
            playAlarmSound();
            
            // Marcar alarma como disparada
            setTasks(prevTasks => 
              prevTasks.map(t => 
                t.id === task.id ? { ...t, alarmFired: true } : t
              )
            );
          }
        }
      });
    };

    const interval = setInterval(checkAlarms, 60000); // Verificar cada minuto
    return () => clearInterval(interval);
  }, [tasks]);

  const showNotification = (task) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification(`⏰ Recordatorio de Tarea`, {
        body: `Es hora de: ${task.text}`,
        icon: '📝',
        tag: `task-${task.id}`
      });
      
      // Cerrar notificación después de 10 segundos
      setTimeout(() => notification.close(), 10000);
    }
  };

  const playAlarmSound = () => {
    // Crear un sonido de alarma simple
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Repetir 3 veces
    setTimeout(() => playAlarmSound(), 600);
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (inputValue.trim() === '') return;
    
    let dueDatetime = null;
    let alarmDatetime = null;
    
    if (dueDate && dueTime) {
      dueDatetime = new Date(`${dueDate}T${dueTime}`).toISOString();
    }
    
    if (alarmDate && alarmTime) {
      alarmDatetime = new Date(`${alarmDate}T${alarmTime}`).toISOString();
    }
    
    const newTask = {
      id: Date.now(),
      text: inputValue.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      dueDateTime: dueDatetime,
      alarmDateTime: alarmDatetime,
      alarmFired: false
    };
    
    setTasks([newTask, ...tasks]);
    
    // Limpiar formulario
    setInputValue('');
    setDueDate('');
    setDueTime('');
    setAlarmDate('');
    setAlarmTime('');
    setShowAdvancedForm(false);
  };

  const toggleTaskCompletion = (taskId) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const startEditing = (taskId, currentText) => {
    setEditingId(taskId);
    setEditValue(currentText);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = (taskId) => {
    if (editValue.trim() === '') {
      deleteTask(taskId);
      return;
    }
    
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, text: editValue.trim() } : task
    ));
    setEditingId(null);
    setEditValue('');
  };

  const clearCompleted = () => {
    setTasks(tasks.filter(task => !task.completed));
  };

  const markAllCompleted = () => {
    const allCompleted = tasks.every(task => task.completed);
    setTasks(tasks.map(task => ({ ...task, completed: !allCompleted })));
  };

  const resetAlarm = (taskId) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, alarmFired: false } : task
    ));
  };

  // Función para determinar si una tarea está vencida
  const isTaskOverdue = (task) => {
    if (!task.dueDateTime || task.completed) return false;
    return new Date() > new Date(task.dueDateTime);
  };

  // Filtrar tareas según el filtro seleccionado
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    if (filter === 'overdue') return isTaskOverdue(task);
    return true;
  });

  const activeTasks = tasks.filter(task => !task.completed).length;
  const completedTasks = tasks.filter(task => task.completed).length;
  const overdueTasks = tasks.filter(task => isTaskOverdue(task)).length;

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1); // Al menos 1 minuto en el futuro
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="tasks-app-container">
      <div className="tasks-header">
        <h1>📝 Gestor de Tareas</h1>
        <p>Organiza tu día con recordatorios y fechas límite</p>
      </div>
      
      <div className="tasks-body">
        {/* Formulario para añadir tareas */}
        <form onSubmit={handleAddTask} className="add-task-form">
          <div className="main-input-row">
            <input
              type="text"
              className="add-task-input"
              placeholder="¿Qué necesitas hacer hoy?"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              maxLength={200}
            />
            <button 
              type="button" 
              className="add-btn"
              onClick={() => setShowAdvancedForm(!showAdvancedForm)}
              title="Añadir tarea"
            >
              <span>+</span>
            </button>
          </div>
          
          {showAdvancedForm && (
            <div className="advanced-form">
              <div className="datetime-section">
                <div className="datetime-group">
                  <label>📅 Fecha límite:</label>
                  <div className="datetime-inputs">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="datetime-group">
                  <label>⏰ Recordatorio:</label>
                  <div className="datetime-inputs">
                    <input
                      type="date"
                      value={alarmDate}
                      onChange={(e) => setAlarmDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <input
                      type="time"
                      value={alarmTime}
                      onChange={(e) => setAlarmTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="clear-form-btn"
                  onClick={() => {
                    setDueDate('');
                    setDueTime('');
                    setAlarmDate('');
                    setAlarmTime('');
                  }}
                >
                  Limpiar fechas
                </button>
                <button 
                  type="submit" 
                  className="submit-task-btn" 
                  disabled={!inputValue.trim()}
                >
                  ✅ Crear Tarea
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Estadísticas y controles */}
        {tasks.length > 0 && (
          <div className="task-controls">
            <div className="task-stats">
              <span className="stat-item">
                📋 Total: {tasks.length}
              </span>
              <span className="stat-item">
                ⏳ Pendientes: {activeTasks}
              </span>
              <span className="stat-item">
                ✅ Completadas: {completedTasks}
              </span>
              {overdueTasks > 0 && (
                <span className="stat-item overdue">
                  ⚠️ Vencidas: {overdueTasks}
                </span>
              )}
            </div>
            
            <div className="bulk-actions">
              <button 
                onClick={markAllCompleted} 
                className="bulk-btn"
                title={tasks.every(task => task.completed) ? "Marcar todas como pendientes" : "Marcar todas como completadas"}
              >
                {tasks.every(task => task.completed) ? "↩️" : "✅"}
              </button>
              {completedTasks > 0 && (
                <button onClick={clearCompleted} className="bulk-btn clear-btn" title="Eliminar completadas">
                  🗑️
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filtros */}
        {tasks.length > 0 && (
          <div className="task-filters">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Todas ({tasks.length})
            </button>
            <button 
              className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Pendientes ({activeTasks})
            </button>
            <button 
              className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completadas ({completedTasks})
            </button>
            {overdueTasks > 0 && (
              <button 
                className={`filter-btn overdue-filter ${filter === 'overdue' ? 'active' : ''}`}
                onClick={() => setFilter('overdue')}
              >
                Vencidas ({overdueTasks})
              </button>
            )}
          </div>
        )}

        {/* Lista de tareas */}
        <div className="task-list-container">
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              {tasks.length === 0 ? (
                <div>
                  <p>🎯</p>
                  <h3>¡Comienza a organizarte!</h3>
                  <p>Añade tu primera tarea con recordatorios</p>
                </div>
              ) : (
                <div>
                  <p>🔍</p>
                  <h3>No hay tareas {filter === 'active' ? 'pendientes' : filter === 'completed' ? 'completadas' : 'vencidas'}</h3>
                  <p>
                    {filter === 'active' ? '¡Buen trabajo! No tienes tareas pendientes.' : 
                     filter === 'completed' ? 'Completa algunas tareas para verlas aquí.' :
                     '¡Excelente! No tienes tareas vencidas.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <ul className="task-list">
              {filteredTasks.map(task => (
                <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''} ${isTaskOverdue(task) ? 'overdue' : ''}`}>
                  <div className="task-content">
                    <input
                      type="checkbox"
                      className="task-checkbox"
                      checked={task.completed}
                      onChange={() => toggleTaskCompletion(task.id)}
                    />
                    
                    {editingId === task.id ? (
                      <div className="edit-form">
                        <input
                          type="text"
                          className="edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(task.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          maxLength={200}
                          autoFocus
                        />
                        <div className="edit-actions">
                          <button onClick={() => saveEdit(task.id)} className="save-btn">
                            ✓
                          </button>
                          <button onClick={cancelEditing} className="cancel-btn">
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="task-text-container">
                        <span 
                          className="task-text"
                          onDoubleClick={() => !task.completed && startEditing(task.id, task.text)}
                          title={task.completed ? "Tarea completada" : "Doble clic para editar"}
                        >
                          {task.text}
                        </span>
                        
                        <div className="task-metadata">
                          <div className="task-date">
                            Creada: {new Date(task.createdAt).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          
                          {task.dueDateTime && (
                            <div className={`due-date ${isTaskOverdue(task) ? 'overdue' : ''}`}>
                              📅 Vence: {formatDateTime(task.dueDateTime)}
                            </div>
                          )}
                          
                          {task.alarmDateTime && (
                            <div className={`alarm-date ${task.alarmFired ? 'fired' : ''}`}>
                              ⏰ Alarma: {formatDateTime(task.alarmDateTime)}
                              {task.alarmFired && <span className="alarm-status"> (Sonó)</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {editingId !== task.id && (
                    <div className="task-actions">
                      {task.alarmFired && (
                        <button 
                          onClick={() => resetAlarm(task.id)}
                          className="action-btn reset-alarm-btn"
                          title="Reactivar alarma"
                        >
                          🔄
                        </button>
                      )}
                      {!task.completed && (
                        <button 
                          onClick={() => startEditing(task.id, task.text)}
                          className="action-btn edit-btn"
                          title="Editar tarea"
                        >
                          ✏️
                        </button>
                      )}
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="action-btn delete-btn"
                        title="Eliminar tarea"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Progreso */}
        {tasks.length > 0 && (
          <div className="progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0}%` }}
              ></div>
            </div>
            <p className="progress-text">
              {completedTasks === tasks.length && tasks.length > 0 
                ? "🎉 ¡Todas las tareas completadas! Excelente trabajo." 
                : `Progreso: ${completedTasks} de ${tasks.length} tareas completadas`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Tareas;