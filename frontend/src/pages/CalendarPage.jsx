import React from 'react';
import { useData } from '../context/DataContext';
import CalendarView from '../components/CalendarView';

export default function CalendarPage() {
  const { events, addEvent, deleteEvent } = useData();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <CalendarView
        events={events}
        onAddEvent={addEvent}
        onDeleteEvent={deleteEvent}
      />
    </div>
  );
}
