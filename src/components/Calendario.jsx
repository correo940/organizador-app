import React, { useState, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendario.css';
import 'moment/locale/es';

// Configurar moment en español
moment.locale('es');

const localizer = momentLocalizer(moment);

// Componente personalizado para el evento del calendario
const EventoCalendario = ({ event }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className="rbc-event-content" 
      title={event.title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transition: 'all 0.3s ease',
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <strong style={{ 
        fontSize: '0.9em',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)'
      }}>
        {event.title}
      </strong>
      {event.desc && (
        <p style={{ 
          margin: '2px 0 0 0', 
          fontSize: '0.75em',
          opacity: 0.9
        }}>
          {event.desc}
        </p>
      )}
    </div>
  );
};

// Componente personalizado para la barra de herramientas
const CustomToolbar = ({ label, onNavigate, onView, view }) => {
  const navigate = (action) => {
    onNavigate(action);
  };

  const viewNamesObj = {
    month: 'Mes',
    week: 'Semana', 
    day: 'Día',
    agenda: 'Agenda'
  };

  return (
    <div className="rbc-toolbar">
      <div className="rbc-btn-group">
        <button type="button" onClick={() => navigate('PREV')}>
          ‹ Anterior
        </button>
        <button type="button" onClick={() => navigate('TODAY')}>
          Hoy
        </button>
        <button type="button" onClick={() => navigate('NEXT')}>
          Siguiente ›
        </button>
      </div>
      
      <span className="rbc-toolbar-label">{label}</span>
      
      <div className="rbc-btn-group">
        {Object.keys(viewNamesObj).map(name => (
          <button
            key={name}
            type="button"
            className={view === name ? 'rbc-active' : ''}
            onClick={() => onView(name)}
          >
            {viewNamesObj[name]}
          </button>
        ))}
      </div>
    </div>
  );
};

function Calendario({ tasks = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');

  // Mapear las tareas al formato que react-big-calendar espera
  const events = tasks.map(task => ({
    id: task.id,
    title: task.text,
    desc: task.description || (task.completed ? '✓ Completada' : '⏳ Pendiente'),
    start: new Date(task.dueDateTime || task.createdAt),
    end: new Date(task.dueDateTime || task.createdAt),
    allDay: !task.dueDateTime,
    resource: task,
  }));

  const messages = {
    allDay: 'Todo el día',
    previous: '‹',
    next: '›',
    today: 'Hoy',
    month: 'Mes',
    week: 'Semana',
    day: 'Día',
    agenda: 'Agenda',
    date: 'Fecha',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'No hay eventos en este rango de fechas.',
    showMore: total => `+ Ver más (${total})`,
    work_week: 'Semana laboral',
    yesterday: 'Ayer',
    tomorrow: 'Mañana'
  };

  // Función para obtener estilos de evento personalizados
  const eventStyleGetter = useCallback((event) => {
    let backgroundColor = '#78c2ff';
    let borderColor = '#78c2ff';
    
    if (event.resource?.completed) {
      backgroundColor = '#5cb85c';
      borderColor = '#5cb85c';
    } else if (event.resource?.priority === 'high') {
      backgroundColor = '#ff6b6b';
      borderColor = '#ff6b6b';
    } else if (event.resource?.priority === 'medium') {
      backgroundColor = '#ffd93d';
      borderColor = '#ffd93d';
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        borderRadius: '8px',
        opacity: 0.9,
        color: '#ffffff',
        border: 'none',
        display: 'block',
        fontWeight: '600',
        boxShadow: `0 4px 12px ${backgroundColor}40`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }
    };
  }, []);

  // Función para manejar la selección de slots
  const handleSelectSlot = useCallback((slotInfo) => {
    console.log('Slot seleccionado:', slotInfo);
    // Aquí podrías agregar lógica para crear un nuevo evento
  }, []);

  // Función para manejar la selección de eventos
  const handleSelectEvent = useCallback((event) => {
    console.log('Evento seleccionado:', event);
    // Aquí podrías agregar lógica para editar el evento
  }, []);

  return (
    <div className="calendar-app-container">
      <div className="calendar-header">
        <h1>🚀 Calendario Futurista</h1>
        <p>Gestiona tus tareas con estilo del futuro • {tasks.length} tareas registradas</p>
      </div>
      
      <div className="calendar-wrapper">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          messages={messages}
          eventPropGetter={eventStyleGetter}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          popup
          date={currentDate}
          onNavigate={setCurrentDate}
          view={currentView}
          onView={setCurrentView}
          components={{
            event: EventoCalendario,
            toolbar: CustomToolbar
          }}
          formats={{
            dateFormat: 'DD',
            dayFormat: (date, culture, localizer) => 
              localizer.format(date, 'dddd', culture).toUpperCase(),
            dayHeaderFormat: (date, culture, localizer) => 
              localizer.format(date, 'dddd DD/MM', culture),
            monthHeaderFormat: (date, culture, localizer) => 
              localizer.format(date, 'MMMM YYYY', culture).toUpperCase(),
            agendaHeaderFormat: ({ start, end }, culture, localizer) => 
              `${localizer.format(start, 'DD MMMM', culture)} – ${localizer.format(end, 'DD MMMM YYYY', culture)}`,
            agendaDateFormat: (date, culture, localizer) => 
              localizer.format(date, 'dddd DD', culture),
            agendaTimeFormat: (date, culture, localizer) => 
              localizer.format(date, 'HH:mm', culture),
            agendaTimeRangeFormat: ({ start, end }, culture, localizer) => 
              `${localizer.format(start, 'HH:mm', culture)} – ${localizer.format(end, 'HH:mm', culture)}`
          }}
          dayLayoutAlgorithm="no-overlap"
          showMultiDayTimes
          step={60}
          timeslots={1}
          min={new Date(2024, 0, 1, 6, 0, 0)}
          max={new Date(2024, 0, 1, 23, 0, 0)}
        />
      </div>
      
      {/* Indicadores de estado */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        zIndex: 10
      }}>
        <div style={{
          padding: '8px 12px',
          background: 'linear-gradient(135deg, rgba(83, 52, 131, 0.8) 0%, rgba(15, 52, 96, 0.8) 100%)',
          borderRadius: '20px',
          color: '#ffffff',
          fontSize: '0.8em',
          fontWeight: '600',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(120, 119, 198, 0.3)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          📅 Total: {tasks.length}
        </div>
        <div style={{
          padding: '8px 12px',
          background: 'linear-gradient(135deg, rgba(92, 184, 92, 0.8) 0%, rgba(40, 167, 69, 0.8) 100%)',
          borderRadius: '20px',
          color: '#ffffff',
          fontSize: '0.8em',
          fontWeight: '600',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(92, 184, 92, 0.3)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          ✅ Completadas: {tasks.filter(t => t.completed).length}
        </div>
      </div>
    </div>
  );
}

export default Calendario;