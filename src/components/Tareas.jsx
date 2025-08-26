import React, { useState, useEffect } from 'react';
import './Tareas.css';

function DisneyTaskManager() {
  const [tasks, setTasks] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [magicPoints, setMagicPoints] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  const categories = {
    personal: { emoji: '🌟', name: 'Personal', color: '#FF6B9D' },
    work: { emoji: '💼', name: 'Trabajo', color: '#4ECDC4' },
    health: { emoji: '💪', name: 'Salud', color: '#45B7D1' },
    home: { emoji: '🏠', name: 'Hogar', color: '#96CEB4' },
    learning: { emoji: '📚', name: 'Aprender', color: '#FFEAA7' },
    fun: { emoji: '🎉', name: 'Diversión', color: '#FD79A8' }
  };

  // Cargar tareas guardadas
  useEffect(() => {
    const saved = localStorage.getItem("magicTasks");
    if (saved) setTasks(JSON.parse(saved));
  }, []);

  // Guardar tareas
  useEffect(() => {
    localStorage.setItem("magicTasks", JSON.stringify(tasks));
  }, [tasks]);

  const triggerCelebration = () => {
    setShowCelebration(true);
    setMagicPoints(prev => prev + 10);
    setCurrentStreak(prev => prev + 1);
    setTimeout(() => setShowCelebration(false), 2000);
  };

  const handleAddTask = () => {
    if (inputValue.trim() === '') return;
    const newTask = {
      id: Date.now(),
      text: inputValue.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      category: 'personal'
    };
    setTasks([...tasks, newTask]);
    setInputValue('');
    setShowForm(false);
  };

  const toggleTaskCompletion = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task.completed) triggerCelebration();
    setTasks(tasks.map(task => task.id === taskId ? { ...task, completed: !task.completed } : task));
  };

  const deleteTask = (taskId) => setTasks(tasks.filter(task => task.id !== taskId));

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleAddTask();
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  const completedTasks = tasks.filter(task => task.completed).length;
  const progressPercentage = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

  return (
    <div className="disney-task-manager">
      {/* Estrellitas decorativas */}
      {[...Array(10)].map((_, i) => <div key={i} className="floating-star">✨</div>)}

      {/* HEADER */}
      <div className="header">
        <h1>✨ Tareas Mágicas</h1>
        <div className="stats">
          <span>⭐ {magicPoints} pts</span>
          <span>🔥 {currentStreak} racha</span>
        </div>
      </div>

      {/* LISTA DE TAREAS */}
      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="no-tasks">
            {tasks.length === 0 ? '🌟 ¡Tu aventura comienza aquí!' : '🔍 No hay tareas que coincidan'}
          </div>
        ) : filteredTasks.map(task => (
          <div key={task.id} className={`task ${task.completed ? 'completed' : ''}`}>
            <button onClick={() => toggleTaskCompletion(task.id)}>
              {task.completed ? '✓' : '○'}
            </button>
            <span>{categories[task.category].emoji} {task.text}</span>
            <button onClick={() => deleteTask(task.id)}>🗑️</button>
          </div>
        ))}
      </div>

      {/* PROGRESO */}
      {tasks.length > 0 && (
        <div className="progress">
          <div className="bar" style={{ width: `${progressPercentage}%` }} />
        </div>
      )}

      {/* FILTROS */}
      {tasks.length > 0 && (
        <div className="filters">
          <button onClick={() => setFilter('all')}>🌍 Todas</button>
          <button onClick={() => setFilter('active')}>⚡ Activas</button>
          <button onClick={() => setFilter('completed')}>✅ Completadas</button>
        </div>
      )}

      {/* BOTÓN FLOTANTE */}
      <button className="add-task-btn" onClick={() => setShowForm(true)}>+</button>

      {/* MODAL */}
      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <button className="close" onClick={() => setShowForm(false)}>×</button>
            <div className="task-form">
              <input
                type="text"
                placeholder="¿Qué aventura te espera hoy?"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button onClick={handleAddTask}>🌟 Crear Tarea</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFETTI */}
      {showCelebration && <div className="confetti">🎉🎊✨💫🌟</div>}
    </div>
  );
}

export default DisneyTaskManager;

