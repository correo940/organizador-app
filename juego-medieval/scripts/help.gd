extends RefCounted
## Ayuda: todas las teclas y un resumen de cada sistema del juego (F1 o desde la pausa).

const TEXT := """CONTROLES EN EL PUEBLO
WASD andar · Shift correr · clic derecho y ratón girar la cámara · rueda zoom · E usar (mantén para talar o picar) · I inventario · M mapa de la región · H montar o desmontar el caballo · T velocidad del tiempo · F5 guardar · F1 esta ayuda · Esc pausa

CONTROLES EN EL MAPA
Clic izquierdo marchar · rueda zoom · E entrar o hablar · D diplomacia y torneos · G gestor de tus pueblos · F1 ayuda · Esc pausa

CONTROLES EN BATALLA
WASD mover · Shift correr · clic izquierdo atacar · clic derecho (mantener) bloquear · 1 ¡Cargad! · 2 Mantened · 3 Seguidme · Tab elegir grupo (todos, infantería, arqueros, caballería) · F formación (línea, muro de escudos, cuña) · V vista táctica (clic izquierdo coloca al grupo, clic derecho carga) · R aceptar el duelo del campeón · Esc soltar el ratón

TU VIDA
Recoge, cultiva y comercia; construye tu casa, cásate y ten hijos. Sigue los objetivos de arriba a la derecha. En tu casa: familia, cargos de los hijos, crónica del linaje, mayordomo, físico y entrar a verla por dentro.

EL PUEBLO
Cada vecino tiene carácter, gustos, amigos y enemigos. Fiestas el día 3 de cada estación (juegos populares en la plaza), mercado semanal, bodas y funerales. En el Concejo (como jefe): impuestos, obras públicas, gremios, alguacil, feria y torneo, consejo de la corte, reinos vecinos, mazmorras y la corona. Apaga incendios con cubos del pozo, atrapa ladrones y animales sueltos.

GUERRA
Recluta en el cuartel (villa) y construye maquinaria de asedio. En el mapa: ataca, pon cerco, tiende emboscadas o manda a tus hijos capitanes con su propio ejército. La moral decide las batallas: los heridos huyen y un bando hundido huye entero. Los veteranos (★) son más fuertes.

EL REINO
Funda aldeas, conquista o vasalla pueblos y gobiérnalos (especialidad, impuestos, gobernador). Caravanas, intrigas, prisioneros y rescates. Con una ciudad, 4 pueblos y 500 de prestigio puedes coronarte rey."""


static func open(v) -> void:
	var l := Label.new()
	l.text = TEXT
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x = 740
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(780, 460)
	sc.add_child(l)
	v._open_custom("Ayuda", sc)
