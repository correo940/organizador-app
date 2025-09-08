import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Calendario from './components/Calendario';
import Tareas from './components/Tareas';
import Contrasenas from './components/Contrasenas';
import Casa from './components/Casa/Casa';
import Manuales from './components/Casa/manuales/Manuales';
import './index.css';

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/aplicaciones/tareas', element: <Tareas /> },
  { path: '/calendario', element: <Calendario /> },
  { path: '/aplicaciones/contrasenas', element: <Contrasenas /> },
  { path: '/casa', element: <Casa /> },
  { path: '/casa/manuales', element: <Manuales /> },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);