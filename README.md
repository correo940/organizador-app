# 🚀 Organizador App - Aplicación de Productividad Personal

Una aplicación web moderna y completa para organizar tareas, gestionar contraseñas, mantener un calendario y documentar manuales del hogar.

## ✨ Características Principales

### 📋 Gestión de Tareas
- **Interfaz mágica** con animaciones y confeti al completar tareas
- **Categorización** por tipo (personal, trabajo, salud, hogar, aprendizaje, diversión)
- **Filtros** para ver todas, activas o completadas
- **Progreso visual** con barra de progreso
- **Sistema de puntos** y rachas para gamificación
- **Persistencia local** con localStorage

### 🔐 Gestor de Contraseñas Seguro
- **Cifrado AES-GCM** con PBKDF2 para máxima seguridad
- **Bóveda cifrada** con contraseña maestra
- **Generador de contraseñas** ultra seguro con múltiples opciones
- **Evaluación de fortaleza** en tiempo real
- **Categorización** por tipo de servicio
- **Búsqueda rápida** por servicio, usuario o email
- **Copiado seguro** al portapapeles
- **Estadísticas** de seguridad

### 📅 Calendario Integrado
- **Vista múltiple**: mes, semana, día, agenda
- **Integración** con tareas existentes
- **Eventos visuales** con colores por prioridad/estado
- **Navegación intuitiva** con botones accesibles
- **Localización** en español
- **Horarios dinámicos** adaptables

### 🏠 Manuales del Hogar
- **Documentación multimedia** con fotos y videos
- **Almacenamiento persistente** en IndexedDB
- **Gestión eficiente** de memoria con URLs temporales
- **Vista de lista y detalle**
- **Categorización** por tipo de manual

### 🎨 Interfaz Moderna
- **Diseño responsivo** que se adapta a todos los dispositivos
- **Sistema de tokens** CSS para consistencia visual
- **Accesibilidad completa** con ARIA labels y navegación por teclado
- **Animaciones suaves** y transiciones
- **Tema unificado** con gradientes y sombras

### 🔔 Sistema de Notificaciones
- **Toasts informativos** para feedback de acciones
- **Múltiples tipos**: éxito, error, advertencia, información
- **Posicionamiento automático** con apilamiento
- **Duración configurable** y cierre manual

## 🛠️ Tecnologías Utilizadas

- **React 19** - Framework principal
- **Vite** - Build tool y desarrollo
- **React Router DOM** - Navegación SPA
- **Day.js** - Manipulación de fechas (ligero)
- **React Big Calendar** - Componente de calendario
- **Web Crypto API** - Cifrado seguro
- **IndexedDB** - Almacenamiento de archivos multimedia
- **CSS Variables** - Sistema de diseño unificado

## 🚀 Instalación y Uso

### Requisitos
- Node.js 16+ 
- npm o yarn

### Instalación
```bash
# Clonar el repositorio
git clone [url-del-repositorio]
cd organizador-app

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build
```

### Uso
1. **Tareas**: Navega a "APLICACIONES" → "TAREAS"
2. **Contraseñas**: Navega a "APLICACIONES" → "CONTRASEÑAS" (crea tu bóveda primero)
3. **Calendario**: Navega directamente a "CALENDARIO"
4. **Manuales**: Navega a "APLICACIONES" → "CASA" → "MANUALES"

## 🔒 Seguridad

### Gestor de Contraseñas
- **Cifrado local**: Todas las contraseñas se cifran con AES-GCM
- **Derivación de claves**: PBKDF2 con 150,000 iteraciones
- **Sin conexión**: No se envían datos a servidores externos
- **Bóveda bloqueable**: Opción de bloquear/desbloquear la bóveda

### Almacenamiento
- **localStorage**: Para datos de tareas y configuración
- **IndexedDB**: Para archivos multimedia de manuales
- **Memoria temporal**: URLs de blob se liberan automáticamente

## 📱 Características de Accesibilidad

- **Navegación por teclado** completa
- **ARIA labels** en todos los elementos interactivos
- **Contraste adecuado** y tipografía legible
- **Focus visible** en todos los elementos
- **Semántica HTML** correcta

## 🎯 Optimizaciones Implementadas

### Rendimiento
- **Bundle optimizado**: Migración de Moment.js a Day.js
- **Lazy loading**: Carga diferida de medios en manuales
- **Memoria eficiente**: Liberación automática de URLs de blob
- **CSS optimizado**: Variables CSS para consistencia

### UX/UI
- **Feedback visual**: Toasts para todas las acciones importantes
- **Estados de carga**: Indicadores visuales apropiados
- **Responsive design**: Adaptación a móviles y tablets
- **Animaciones suaves**: Transiciones CSS optimizadas

## 🔧 Estructura del Proyecto

```
src/
├── components/
│   ├── Calendario.jsx          # Calendario principal
│   ├── Contrasenas.jsx         # Gestor de contraseñas
│   ├── Folder.jsx              # Componente de carpeta
│   ├── Tareas.jsx              # Gestor de tareas
│   ├── Toast.jsx               # Componente de notificación
│   ├── ToastContainer.jsx      # Contenedor de toasts
│   └── Casa/
│       ├── Casa.jsx            # Vista principal de casa
│       └── manuales/
│           └── Manuales.jsx    # Gestor de manuales
├── hooks/
│   ├── useLocalStorage.js      # Hook para localStorage
│   └── useToast.js             # Hook para notificaciones
├── styles/
│   └── tokens.css              # Sistema de diseño
├── App.jsx                     # Componente principal
└── main.jsx                    # Punto de entrada
```

## 🚀 Próximas Mejoras

- [ ] **Sincronización en la nube** (opcional)
- [ ] **Temas oscuro/claro**
- [ ] **Exportación/importación** de datos
- [ ] **Notificaciones push** para tareas pendientes
- [ ] **Integración con calendarios** externos
- [ ] **Backup automático** de datos

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request para sugerencias y mejoras.

---

**Desarrollado con ❤️ para mejorar la productividad personal**
