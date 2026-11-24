# Sangre y Linaje

Juego de estrategia medieval para PC (Windows) en 3D, hecho con Godot 4.3. Modelos CC0 de Quaternius (ver CREDITS.md).

**Fase 1 (actual):** controlas a un personaje en una aldea. Talas, picas piedra, cultivas y comercias. Construyes y mejoras tu casa, te casas y tienes hijos, que heredan cuando mueres. El rey te llama a la guerra y luchas en batallas en tiempo real. Con prestigio llegas a jefe del pueblo.

**Economía del pueblo:** parcelas de cultivo (trigo, zanahorias, remolachas, coles, calabazas), corral con gallinas, ovejas, cerdos y vacas, manzanos, bayas, setas, pesca en el estanque, caza de ciervos, molino (trigo → harina) y horno (harina → pan). Tecla I: inventario.

**Próximas fases:** gobernar el pueblo y dirigir ejércitos (fase 2), y un mapa del mundo para viajar y combatir (fase 3).

## Controles
- WASD: moverse · Shift: correr · Clic derecho + ratón: girar cámara · Rueda: zoom · E: interactuar (mantén E para recoger recursos) · T: velocidad del tiempo · Esc: menú · F5: guardar
- En batalla: el ratón mueve la cámara; clic izquierdo ataca, clic derecho (mantener) bloquea; Esc suelta el ratón

## Compilar
1. Abre la carpeta con Godot 4.3 y usa Proyecto → Exportar → "Windows Desktop" (genera `build/SangreYLinaje.exe`).
2. Opcional: `makensis installer.nsi` crea `build/SangreYLinaje_Instalador.exe`.
