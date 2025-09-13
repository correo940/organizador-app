import React, { useState } from 'react';
import { Card, ListGroup, ProgressBar, ButtonGroup, Button, Badge, Form, Modal } from 'react-bootstrap';
import './Tareas.css';

function Tareas({ tasks = [], onAddTask, onUpdateTasks }) {
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
    onAddTask?.(newTask);
    setInputValue('');
    setShowForm(false);
  };

  const toggleTaskCompletion = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task.completed) triggerCelebration();
    const updated = tasks.map(task => task.id === taskId ? { ...task, completed: !task.completed } : task);
    onUpdateTasks?.(updated);
  };

  const deleteTask = (taskId) => {
    const updated = tasks.filter(task => task.id !== taskId);
    onUpdateTasks?.(updated);
  };

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
    <Card className="disney-task-manager shadow-lg">
      {[...Array(10)].map((_, i) => <div key={i} className="floating-star">✨</div>)}
      <Card.Body>
        <div className="text-center mb-4">
          <Card.Title as="h1">✨ Tareas Mágicas</Card.Title>
          <div>
            <Badge bg="warning" text="dark" className="me-2">⭐ {magicPoints} pts</Badge>
            <Badge bg="danger">🔥 {currentStreak} racha</Badge>
          </div>
        </div>

        <ListGroup variant="flush">
          {filteredTasks.length === 0 ? (
            <ListGroup.Item className="text-center text-muted">
              {tasks.length === 0 ? '🌟 ¡Tu aventura comienza aquí!' : '🔍 No hay tareas que coincidan'}
            </ListGroup.Item>
          ) : filteredTasks.map(task => (
            <ListGroup.Item key={task.id} className={`d-flex justify-content-between align-items-center ${task.completed ? 'completed' : ''}`}>
              <Form.Check
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTaskCompletion(task.id)}
                aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
              />
              <span className="ms-2 me-auto">{categories[task.category].emoji} {task.text}</span>
              <Button variant="link" onClick={() => deleteTask(task.id)} aria-label="Eliminar tarea">
                🗑️
              </Button>
            </ListGroup.Item>
          ))}
        </ListGroup>

        {tasks.length > 0 && (
          <div className="mt-4">
            <ProgressBar now={progressPercentage} style={{ height: '10px' }} />
          </div>
        )}

        {tasks.length > 0 && (
          <div className="d-flex justify-content-center mt-3">
            <ButtonGroup>
              <Button variant={filter === 'all' ? 'primary' : 'outline-primary'} onClick={() => setFilter('all')}>🌍 Todas</Button>
              <Button variant={filter === 'active' ? 'primary' : 'outline-primary'} onClick={() => setFilter('active')}>⚡ Activas</Button>
              <Button variant={filter === 'completed' ? 'primary' : 'outline-primary'} onClick={() => setFilter('completed')}>✅ Completadas</Button>
            </ButtonGroup>
          </div>
        )}

        <Button
          className="add-task-btn"
          onClick={() => setShowForm(true)}
          aria-label="Añadir tarea"
        >
          +
        </Button>

        <Modal show={showForm} onHide={() => setShowForm(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>🌟 Crear Tarea</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Control
              type="text"
              placeholder="¿Qué aventura te espera hoy?"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              aria-label="Descripción de la tarea"
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={handleAddTask}>
              Crear Tarea
            </Button>
          </Modal.Footer>
        </Modal>

        {showCelebration && <div className="confetti">🎉🎊✨💫🌟</div>}
      </Card.Body>
    </Card>
  );
}

export default Tareas;