# Sangre y Linaje

Juego de estrategia medieval para PC (Windows) hecho con Godot 4.3.

**Fase 1 (actual):** controlas a un personaje en una aldea. Talas, picas piedra, cultivas y comercias. Construyes y mejoras tu casa, te casas y tienes hijos, que heredan cuando mueres. El rey te llama a la guerra y luchas en batallas en tiempo real. Con prestigio llegas a jefe del pueblo.

**Próximas fases:** gobernar el pueblo y dirigir ejércitos (fase 2), y un mapa del mundo para viajar y combatir (fase 3).

## Controles
- WASD / flechas: moverse · E: interactuar (mantén E para recoger recursos) · T: velocidad del tiempo · Esc: menú · F5: guardar
- En batalla: clic izquierdo para atacar, clic derecho (mantener) para bloquear

## Compilar
1. Abre la carpeta con Godot 4.3 y usa Proyecto → Exportar → "Windows Desktop" (genera `build/SangreYLinaje.exe`).
2. Opcional: `makensis installer.nsi` crea `build/SangreYLinaje_Instalador.exe`.
