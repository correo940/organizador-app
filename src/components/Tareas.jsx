import React, { useState, useEffect } from 'react';
import './Tareas.css';

// El componente ahora recibe las tareas y las funciones para manipularlas como props
function Tareas({ tasks, onAddTask, onUpdateTasks }) {
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, completed, overdue
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [alarmDate, setAlarmDate] = useState('');
  const [alarmTime, setAlarmTime] = useState('');

  // El manejo de alarmas y notificaciones sigue siendo local del componente
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkAlarms = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.alarmDateTime && !task.completed && !task.alarmFired) {
          const alarmTime = new Date(task.alarmDateTime);
          if (now >= alarmTime) {
            showNotification(task);
            playAlarmSound();
            const updatedTasks = tasks.map(t =>
              t.id === task.id ? { ...t, alarmFired: true } : t
            );
            onUpdateTasks(updatedTasks);
          }
        }
      });
    };

    const interval = setInterval(checkAlarms, 15000); // Verificar cada 15 segundos
    return () => clearInterval(interval);
  }, [tasks, onUpdateTasks]);

  const showNotification = (task) => {
    if (Notification.permission === 'granted') {
      new Notification(`⏰ Recordatorio de Tarea`, {
        body: `Es hora de: ${task.text}`,
        icon: '📝',
      });
    }
  };

  const playAlarmSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), 500);
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (inputValue.trim() === '') return;

    const newTask = {
      id: Date.now(),
      text: inputValue.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      dueDateTime: dueDate && dueTime ? new Date(`${dueDate}T${dueTime}`).toISOString() : null,
      alarmDateTime: alarmDate && alarmTime ? new Date(`${alarmDate}T${alarmTime}`).toISOString() : null,
      alarmFired: false,
    };

    onAddTask(newTask); // Llama a la función del padre para añadir la tarea

    // Limpiar formulario
    setInputValue('');
    setDueDate('');
    setDueTime('');
    setAlarmDate('');
    setAlarmTime('');
    setShowAdvancedForm(false);
  };

  // Las funciones de manipulación ahora llaman a onUpdateTasks con la nueva lista
  const toggleTaskCompletion = (taskId) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    onUpdateTasks(updatedTasks);
  };

  const deleteTask = (taskId) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    onUpdateTasks(updatedTasks);
  };

  const saveEdit = (taskId) => {
    if (editValue.trim() === '') {
      deleteTask(taskId);
      return;
    }
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, text: editValue.trim() } : task
    );
    onUpdateTasks(updatedTasks);
    setEditingId(null);
    setEditValue('');
  };
  
  const clearCompleted = () => {
    const updatedTasks = tasks.filter(task => !task.completed);
    onUpdateTasks(updatedTasks);
  };

  const markAllCompleted = () => {
    const allCompleted = tasks.every(task => task.completed);
    const updatedTasks = tasks.map(task => ({ ...task, completed: !allCompleted }));
    onUpdateTasks(updatedTasks);
  };
  
  const resetAlarm = (taskId) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, alarmFired: false } : task
    );
    onUpdateTasks(updatedTasks);
  };

  // El resto de la lógica de renderizado y filtrado permanece mayormente igual
  const startEditing = (taskId, currentText) => {
    setEditingId(taskId);
    setEditValue(currentText);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  const isTaskOverdue = (task) => {
    if (!task.dueDateTime || task.completed) return false;
    return new Date() > new Date(task.dueDateTime);
  };

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
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // El JSX es prácticamente el mismo, solo que ahora depende del estado que viene por props
  return (
    <div className="tasks-app-container">
      <div className="tasks-header">
        <h1>📝 Gestor de Tareas</h1>
        <p>Organiza tu día con recordatorios y fechas límite</p>
      </div>
      
      <div className="tasks-body">
        <form onSubmit={handleAddTask} className="add-task-form">
          <div className="main-input-row">
            <input
              type="text"
              className="add-task-input"
              placeholder="¿Qué necesitas hacer hoy?"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <button 
              type="button" 
              className="add-btn"
              onClick={() => setShowAdvancedForm(!showAdvancedForm)}
              title="Opciones avanzadas"
            >
              <span>+</span>
            </button>
          </div>
          
          {showAdvancedForm && (
            <div className="advanced-form">
              <div className="datetime-section">
                <div className="datetime-group">
                  <label>📅 Fecha límite:</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
                </div>
                <div className="datetime-group">
                  <label>⏰ Recordatorio:</label>
                  <input type="date" value={alarmDate} onChange={(e) => setAlarmDate(e.target.value)} />
                  <input type="time" value={alarmTime} onChange={(e) => setAlarmTime(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="submit-task-btn" disabled={!inputValue.trim()}>
                ✅ Crear Tarea
              </button>
            </div>
          )}
        </form>

        {tasks.length > 0 && (
          <div className="task-controls">
            <div className="task-stats">
              <span>Total: {tasks.length}</span>
              <span>Pendientes: {activeTasks}</span>
              <span>Completadas: {completedTasks}</span>
              {overdueTasks > 0 && <span className="overdue">Vencidas: {overdueTasks}</span>}
            </div>
            <div className="bulk-actions">
              <button onClick={markAllCompleted}>Marcar Todas</button>
              {completedTasks > 0 && <button onClick={clearCompleted}>Limpiar Completadas</button>}
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="task-filters">
            <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>Todas</button>
            <button onClick={() => setFilter('active')} className={filter === 'active' ? 'active' : ''}>Pendientes</button>
            <button onClick={() => setFilter('completed')} className={filter === 'completed' ? 'active' : ''}>Completadas</button>
            {overdueTasks > 0 && <button onClick={() => setFilter('overdue')} className={`${filter === 'overdue' ? 'active' : ''} overdue-filter`}>Vencidas</button>}
          </div>
        )}

        <div className="task-list-container">
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <h3>{tasks.length === 0 ? 'Añade tu primera tarea' : 'No hay tareas que coincidan'}</h3>
            </div>
          ) : (
            <ul className="task-list">
              {filteredTasks.map(task => (
                <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''} ${isTaskOverdue(task) ? 'overdue' : ''}`}>
                  <div className="task-content">
                    <input type="checkbox" checked={task.completed} onChange={() => toggleTaskCompletion(task.id)} />
                    {editingId === task.id ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(task.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(task.id)}
                        autoFocus
                      />
                    ) : (
                      <span onDoubleClick={() => startEditing(task.id, task.text)}>{task.text}</span>
                    )}
                  </div>
                  <div className="task-metadata">
                    {task.dueDateTime && <div className="due-date">Vence: {formatDateTime(task.dueDateTime)}</div>}
                    {task.alarmDateTime && <div className="alarm-date">Alarma: {formatDateTime(task.alarmDateTime)} {task.alarmFired && '(Sonó)'}</div>}
                  </div>
                  <div className="task-actions">
                    {task.alarmFired && <button onClick={() => resetAlarm(task.id)}>🔄</button>}
                    <button onClick={() => startEditing(task.id, task.text)}>✏️</button>
                    <button onClick={() => deleteTask(task.id)}>🗑️</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Tareas;
