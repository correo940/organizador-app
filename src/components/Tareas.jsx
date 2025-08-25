import React, { useState } from 'react';
import './Tareas.css';

function Tareas() {
  const [tasks, setTasks] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const handleAddTask = (e) => {
    e.preventDefault();
    if (inputValue.trim() === '') return;
    setTasks([...tasks, { id: Date.now(), text: inputValue, completed: false }]);
    setInputValue('');
  };

  const toggleTaskCompletion = (taskId) => {
    setTasks(
      tasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  return (
    <div className="tasks-app-container">
      <div className="tasks-header">
        <h1>Mis Tareas</h1>
      </div>
      <div className="tasks-body">
        <form onSubmit={handleAddTask} className="add-task-form">
          <input
            type="text"
            className="add-task-input"
            placeholder="Añadir una tarea..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit">+</button>
        </form>
        <ul className="task-list">
          {tasks.map(task => (
            <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTaskCompletion(task.id)}
              />
              <span>{task.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Tareas;
