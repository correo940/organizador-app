import React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendario.css';
import 'moment/locale/es'; // Importar localización en español

// Configurar moment en español
moment.locale('es');

const localizer = momentLocalizer(moment);

// Componente personalizado para el evento del calendario
const EventoCalendario = ({ event }) => (
  <div className="rbc-event-content" title={event.title}>
    <strong>{event.title}</strong>
    {event.desc && <p>{event.desc}</p>}
  </div>
);

function Calendario({ tasks }) {
  // Mapear las tareas al formato que react-big-calendar espera
  const events = tasks.map(task => ({
    id: task.id,
    title: task.text,
    start: new Date(task.dueDateTime || task.createdAt), // Usar fecha de vencimiento o de creación
    end: new Date(task.dueDateTime || task.createdAt),   // Mismo día si no hay duración
    allDay: !task.dueDateTime, // Considerar "todo el día" si no tiene hora de vencimiento
    resource: task, // Guardar la tarea original por si se necesita
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
    noEventsInRange: 'No hay eventos en este rango.',
    showMore: total => `+ Ver más (${total})`
  };

  return (
    <div className="calendar-app-container">
      <div className="calendar-header">
        <h1>📅 Calendario de Eventos</h1>
        <p>Visualiza tus tareas y fechas límite.</p>
      </div>
      <div className="calendar-wrapper">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 200px)' }} // Ajustar altura
          messages={messages} // Aplicar mensajes en español
          eventPropGetter={
            (event) => {
              const style = {
                backgroundColor: event.resource.completed ? '#5cb85c' : '#3174ad',
                borderRadius: '5px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block'
              };
              return { style };
            }
          }
          components={{
            event: EventoCalendario // Usar el componente de evento personalizado
          }}
        />
      </div>
    </div>
  );
}

export default Calendario;