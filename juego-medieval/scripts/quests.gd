extends RefCounted
## Objetivos guía: una cadena de metas, de campesino a señor de ciudades, con pista y recompensa.

const LIST := [
	{"id": "madera", "goal": "Consigue 20 de madera", "tip": "Ve al bosque del oeste, acércate a un árbol y mantén pulsada E.", "gold": 10},
	{"id": "piedra", "goal": "Consigue 10 de piedra", "tip": "Las rocas están al suroeste, junto a la mina. Mantén E para picar.", "gold": 10},
	{"id": "casa", "goal": "Construye tu casa", "tip": "Ve a tu parcela (está marcada) y pulsa E. Una choza cuesta 20 de madera y 10 de piedra.", "gold": 20},
	{"id": "campo", "goal": "Siembra un campo", "tip": "Los campos están al este. Compra una parcela con E y luego siembra en ella; las semillas cuestan unas monedas.", "gold": 15},
	{"id": "comercio", "goal": "Comercia con un vecino", "tip": "Habla con cualquier vecino (E) y elige «Comerciar»: compra, vende o cambia productos.", "gold": 15},
	{"id": "boda", "goal": "Cásate", "tip": "Habla con un vecino soltero cada día y hazle regalos. Con afecto 100 podrás pedirle matrimonio.", "gold": 30},
	{"id": "prestigio", "goal": "Llega a 60 de prestigio", "tip": "Gana prestigio mejorando tu casa, acudiendo cuando el rey te llame a la guerra y en las fiestas del pueblo.", "gold": 30},
	{"id": "casa2", "goal": "Mejora tu casa hasta Casa de piedra", "tip": "En tu casa (E) puedes ampliarla. Junta madera, piedra y oro.", "gold": 30},
	{"id": "jefe", "goal": "Conviértete en jefe del pueblo", "tip": "Con 150 de prestigio y una Casa de piedra, ve a la Casa del Concejo de la plaza y reclama la jefatura.", "gold": 50},
	{"id": "villa", "goal": "Haz crecer el pueblo hasta villa", "tip": "La gente llega si hay comida, buen ánimo y edificios. Mira en el concejo lo que falta.", "gold": 60},
	{"id": "tropas", "goal": "Recluta 10 soldados", "tip": "En la villa aparece el cuartel, al este. Hacen falta oro, hierro y gente del pueblo llano.", "gold": 40},
	{"id": "visita", "goal": "Visita otro pueblo de la región", "tip": "Pulsa M para abrir el mapa, viaja hasta un pueblo y elige «Pasear por…».", "gold": 30},
	{"id": "ciudad", "goal": "Haz crecer el pueblo hasta ciudad", "tip": "Más gente, más edificios y murallas. Puedes fundar aldeas nuevas en el mapa para ganar tributos.", "gold": 100},
	{"id": "conquista", "goal": "Conquista o vasalla otro pueblo", "tip": "Desde el mapa, ataca un pueblo de un señor con tu ejército y elige qué hacer con él al vencer.", "gold": 150},
]


static func current() -> Dictionary:
	var i := int(GS.data.get("quest", 0))
	return LIST[i] if i < LIST.size() else {}


static func done(id: String) -> bool:
	var d = GS.data
	match id:
		"madera":
			return int(d["wood"]) >= 20 or int(d["house_level"]) >= 1
		"piedra":
			return int(d["stone"]) >= 10 or int(d["house_level"]) >= 1
		"casa":
			return int(d["house_level"]) >= 1
		"campo":
			return d["fields"].any(func(f): return f["owned"] and f["crop"] != "")
		"comercio":
			return d.get("traded", false)
		"boda":
			return d["spouse"] != null
		"prestigio":
			return int(d["prestige"]) >= 60 or int(d["title"]) >= 1
		"casa2":
			return int(d["house_level"]) >= 2
		"jefe":
			return int(d["title"]) >= 1
		"villa":
			return int(d["tier"]) >= 1
		"tropas":
			return GS.ARMY.total() >= 10
		"visita":
			return d.get("visited", false)
		"ciudad":
			return int(d["tier"]) >= 2
		"conquista":
			return GS.REGION.region()["towns"].any(func(t): return (t["owner"] == "jugador" and not t.get("home", false) and not t.get("founded", false)) or t.get("vassal", false))
	return false


## Comprueba el objetivo actual; si está cumplido, da la recompensa y pasa al siguiente.
static func check() -> void:
	var d0 = GS.data
	if not d0.has("quest"):
		# Partida guardada antes de existir los objetivos: se salta en silencio lo ya hecho.
		d0["quest"] = 0
		while not current().is_empty() and done(current()["id"]):
			d0["quest"] = int(d0["quest"]) + 1
		return
	var q := current()
	if q.is_empty() or not done(q["id"]):
		return
	var d = GS.data
	d["quest"] = int(d.get("quest", 0)) + 1
	d["gold"] = int(d["gold"]) + int(q["gold"])
	var nx := current()
	var text := "%s\nRecompensa: +%d de oro." % [q["goal"], int(q["gold"])]
	if nx.is_empty():
		text += "\n\nHas cumplido todos los objetivos. A partir de aquí, la historia de tu linaje la escribes tú."
	else:
		text += "\n\nSiguiente objetivo: %s\n%s" % [nx["goal"], nx["tip"]]
	SFX.play("campana")
	GS.popups.append({"title": "Objetivo cumplido", "text": text, "button": "Continuar"})
	check()
