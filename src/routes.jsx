import React from 'react';
import App, { HomeView, ApplicationsView, HouseView } from './App';
import Calendario from './components/Calendario';
import Tareas from './components/Tareas';
import Contrasenas from './components/Contrasenas';
import Manuales from './components/Casa/manuales/Manuales';

export const routes = [
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomeView />,
      },
      {
        path: 'aplicaciones',
        element: <ApplicationsView />,
      },
      {
        path: 'aplicaciones/tareas',
        element: <Tareas />,
      },
      {
        path: 'aplicaciones/contrasenas',
        element: <Contrasenas />,
      },
      {
        path: 'calendario',
        element: <Calendario />,
      },
      {
        path: 'casa',
        element: <HouseView />,
      },
      {
        path: 'casa/manuales',
        element: <Manuales />,
      },
    ],
  },
];
