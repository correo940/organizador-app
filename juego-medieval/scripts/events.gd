extends RefCounted
## Eventos del pueblo: sequías, plagas, incendios, fiebres, fiestas, peregrinos, pleitos...
## Cada uno abre una ventana con opciones; lo que elijas tiene consecuencias.

const COOLDOWN := 6  # días mínimos entre eventos


static func day() -> void:
	var d = GS.data
	if int(d["total_days"]) < 6 or int(d["total_days"]) - int(d.get("last_event", 0)) < COOLDOWN:
		return
	if randf() > 0.09:
		return
	var s := int(d["season"])
	var pool := ["fuego", "peregrinos", "ratas", "mercader", "rumor"]
	if s in [0, 1]:
		pool.append("fiesta")
	if s == 1:
		pool.append_array(["sequia", "sequia"])
	if s in [1, 2]:
		pool.append("cosecha")
	if s in [2, 3]:
		pool.append_array(["fiebre", "fiebre"])
	if int(d["title"]) == 1:
		pool.append_array(["pleito", "pleito", "ladron"])
	else:
		pool.append("robo")
	d["last_event"] = int(d["total_days"])
	trigger(pool.pick_random())


static func trigger(id: String) -> void:
	match id:
		"fuego": _fire()
		"peregrinos": _pilgrims()
		"ratas": _rats()
		"mercader": _merchant()
		"fiesta": _feast()
		"sequia": _drought()
		"cosecha": _harvest()
		"fiebre": _fever()
		"pleito": _lawsuit()
		"rumor": _rumor()
		"ladron": _thief()
		"robo": _robbed()


static func _popup(title: String, text: String, options: Array) -> void:
	SFX.play("campana")
	GS.popups.append({"title": title, "text": text, "options": options})


static func _mood_all(n: int) -> void:
	for v in GS.data["villagers"]:
		v["mood"] = clampi(int(v["mood"]) + n, 0, 100)


static func _lose_commons(frac: float) -> int:
	var n := int(int(GS.data["commons"]) * frac * (0.5 if GS.has_building("hospital") else 1.0))
	GS.data["commons"] = int(GS.data["commons"]) - n
	return n


# ---------------- Eventos ----------------

static func _fire() -> void:
	var d = GS.data
	var who: String = d["villagers"].pick_random()["name"] if not d["villagers"].is_empty() else "un vecino"
	_popup("¡Fuego!", "Arde el pajar de %s y las llamas amenazan las casas vecinas." % who, [
		["Organizar una cadena de cubos y apagarlo tú mismo (-15 salud)", func():
			d["player"]["health"] = maxf(1.0, float(d["player"]["health"]) - 15.0)
			d["prestige"] += 8
			_mood_all(5)
			GS.say("Apagas el fuego con los vecinos. Te lo agradecen. (+8 prestigio)")],
		["Pagar a unos jornaleros para que lo apaguen (25 oro)", func():
			if int(d["gold"]) < 25:
				_burn()
				return
			d["gold"] = int(d["gold"]) - 25
			GS.say("Los jornaleros apagan el fuego. Solo se pierde el pajar.")],
		["Ponerte a salvo y dejar que se apague solo", _burn],
	])


static func _burn() -> void:
	var d = GS.data
	var lost := _lose_commons(0.08)
	d["wood"] = maxi(0, int(d["wood"]) - 20)
	_mood_all(-10)
	GS.say("El fuego se extiende: arden varias casas y se pierde madera.%s" % (" %d vecinos se marchan." % lost if lost > 0 else ""))


static func _pilgrims() -> void:
	var d = GS.data
	_popup("Peregrinos", "Un grupo de peregrinos camino del santuario pide cobijo y comida para pasar la noche.", [
		["Acogerlos (6 raciones de comida)", func():
			if not GS.eat(3):
				GS.say("No tienes comida que ofrecerles; siguen su camino.")
				return
			d["prestige"] += 6
			if randf() < 0.35:
				d["commons"] = int(d["commons"]) + 5
				GS.say("Los peregrinos bendicen tu casa. Una familia decide quedarse a vivir en el pueblo. (+6 prestigio)")
			else:
				GS.say("Los peregrinos bendicen tu casa y siguen su camino. (+6 prestigio)")],
		["Darles unas monedas y despedirlos (5 oro)", func():
			d["gold"] = maxi(0, int(d["gold"]) - 5)
			d["prestige"] += 2
			GS.say("Los peregrinos te dan las gracias. (+2 prestigio)")],
		["Negarte", func():
			_mood_all(-3)
			GS.say("Los peregrinos se marchan murmurando. A los vecinos no les ha gustado.")],
	])


static func _rats() -> void:
	var d = GS.data
	var grain := GS.inv("trigo") + GS.inv("harina") + GS.inv("pan")
	_popup("Ratas en el granero", "Las ratas se han metido en los graneros y están dando cuenta del grano (tienes %d entre trigo, harina y pan)." % grain, [
		["Traer gatos del pueblo vecino (8 oro)", func():
			d["gold"] = maxi(0, int(d["gold"]) - 8)
			_eat_grain(0.1)
			GS.say("Los gatos acaban con la plaga. Se pierde muy poco grano.")],
		["Limpiar y tapar los graneros tú mismo (medio día de trabajo)", func():
			_eat_grain(0.2)
			d["player"]["health"] = maxf(1.0, float(d["player"]["health"]) - 5.0)
			GS.say("Tapas los agujeros y salvas casi todo el grano.")],
		["No hacer nada", func():
			var n := _eat_grain(0.45)
			GS.say("Las ratas se comen %d de grano y harina." % n)],
	])


static func _eat_grain(frac: float) -> int:
	var lost := 0
	for k in ["trigo", "harina", "pan"]:
		var n := int(ceil(GS.inv(k) * frac))
		GS.take(k, n)
		lost += n
	return lost


static func _merchant() -> void:
	var d = GS.data
	var offers := [["hierro", 6, 10], ["herramientas", 2, 30], ["tela", 4, 40], ["miel", 5, 20], ["piel", 3, 40]]
	var o: Array = offers.pick_random()
	_popup("Un mercader ambulante", "Llega un mercader de tierras lejanas con su carro. Te ofrece %d de %s por %d de oro, más barato que en el mercado." % [o[1], String(GS.ITEMS[o[0]][0]).to_lower(), o[2]], [
		["Comprar", func():
			if int(d["gold"]) < int(o[2]):
				GS.say("No tienes oro suficiente. El mercader se encoge de hombros y sigue su camino.")
				return
			d["gold"] = int(d["gold"]) - int(o[2])
			GS.add(o[0], int(o[1]))
			SFX.play("monedas")
			GS.say("Compras %d de %s al mercader." % [o[1], String(GS.ITEMS[o[0]][0]).to_lower()])],
		["Dejar que venda a los vecinos", func():
			_mood_all(4)
			GS.say("El mercader monta su puesto en la plaza. Los vecinos están contentos.")],
	])


static func _feast() -> void:
	var d = GS.data
	_popup("Fiesta del pueblo", "Los vecinos quieren celebrar la fiesta del patrón con música, baile y una gran comida. Esperan que tú pongas algo.", [
		["Pagar la fiesta (40 oro)", func():
			if int(d["gold"]) < 40:
				GS.say("No tienes oro para la fiesta. La celebran de forma sencilla.")
				_mood_all(3)
				return
			d["gold"] = int(d["gold"]) - 40
			d["prestige"] += 12
			_mood_all(20)
			GS.say("¡Una fiesta memorable! Se baila hasta el amanecer. (+12 prestigio)")],
		["Poner unas monedas (10 oro)", func():
			d["gold"] = maxi(0, int(d["gold"]) - 10)
			d["prestige"] += 3
			_mood_all(8)
			GS.say("La fiesta sale bien. (+3 prestigio)")],
		["No poner nada", func():
			_mood_all(-6)
			GS.say("Los vecinos celebran la fiesta sin ti y te miran de reojo.")],
	])


static func _drought() -> void:
	var d = GS.data
	_popup("Sequía", "Hace semanas que no llueve. Los pozos bajan y los campos se agostan.", [
		["Pagar aguadores que traigan agua del río (30 oro)", func():
			if int(d["gold"]) < 30:
				_dry()
				return
			d["gold"] = int(d["gold"]) - 30
			GS.say("Los aguadores salvan tus cultivos.")],
		["Rezar en procesión por la lluvia", func():
			if randf() < 0.4:
				d["prestige"] += 3
				_mood_all(5)
				GS.say("¡Llueve a los dos días! El pueblo lo celebra.")
			else:
				_dry()],
		["Aguantar", _dry],
	])


static func _dry() -> void:
	var n := 0
	for f in GS.data["fields"]:
		if f["owned"] and f["crop"] != "":
			f["age"] = maxi(0, int(f["age"]) - 4)
			n += 1
	_mood_all(-8)
	GS.say("La sequía retrasa %s y los vecinos pasan apuros." % ("tus cosechas (%d campos)" % n if n > 0 else "las cosechas del pueblo"))


static func _harvest() -> void:
	var d = GS.data
	_popup("Año de buena cosecha", "El tiempo ha acompañado y los campos del pueblo rebosan. Los vecinos te traen parte de lo recogido.", [
		["Guardarlo en tu despensa (+12 trigo)", func():
			GS.add("trigo", 12)
			GS.say("Guardas 12 de trigo.")],
		["Repartirlo entre los más pobres", func():
			d["prestige"] += 6
			_mood_all(10)
			GS.say("Repartes el grano entre los pobres. (+6 prestigio)")],
	])


static func _fever() -> void:
	var d = GS.data
	_popup("Fiebres", "Unas fiebres se extienden por el pueblo. Ya hay varios enfermos y algunos temen por los niños.", [
		["Traer un físico de la ciudad (35 oro)", func():
			if int(d["gold"]) < 35:
				_sick(0.08)
				return
			d["gold"] = int(d["gold"]) - 35
			_lose_commons(0.02)
			GS.say("El físico atiende a los enfermos. Pocos mueren.")],
		["Aislar a los enfermos fuera del pueblo", func():
			var n := _lose_commons(0.05)
			_mood_all(-5)
			GS.say("El aislamiento frena las fiebres%s." % (", aunque mueren %d vecinos" % n if n > 0 else ""))],
		["Confiar en remedios caseros", func(): _sick(0.12)],
	])


static func _sick(frac: float) -> void:
	var d = GS.data
	var n := _lose_commons(frac)
	_mood_all(-10)
	var extra := ""
	if randf() < 0.3:
		d["player"]["health"] = maxf(1.0, float(d["player"]["health"]) - 25.0)
		extra = " Tú también caes enfermo (-25 salud)."
	GS.say("Las fiebres se llevan a %d vecinos.%s" % [n, extra] if n > 0 else "Las fiebres pasan sin muertes, pero dejan al pueblo débil.%s" % extra)


static func _lawsuit() -> void:
	var d = GS.data
	if d["villagers"].size() < 2:
		return
	var vs: Array = d["villagers"].duplicate()
	vs.shuffle()
	var a = vs[0]
	var b = vs[1]
	_popup("Pleito entre vecinos", "%s y %s discuten por una linde entre sus huertos y acuden a ti, como jefe, para que decidas." % [a["name"], b["name"]], [
		["Dar la razón a %s" % a["name"], func(): _judge(a, b)],
		["Dar la razón a %s" % b["name"], func(): _judge(b, a)],
		["Repartir la tierra a medias", func():
			d["prestige"] += 2
			GS.say("Partes la linde a medias. Ninguno queda del todo contento, pero aceptan.")],
	])


static func _judge(win: Dictionary, lose: Dictionary) -> void:
	win["mood"] = mini(100, int(win["mood"]) + 20)
	win["affection"] = mini(100, int(win.get("affection", 0)) + 15)
	lose["mood"] = maxi(0, int(lose["mood"]) - 20)
	lose["affection"] = maxi(0, int(lose.get("affection", 0)) - 15)
	GS.data["prestige"] += 4
	GS.say("Das la razón a %s. %s se marcha enfadado. (+4 prestigio)" % [win["name"], lose["name"]])


static func _rumor() -> void:
	var d = GS.data
	var who: String = d["villagers"].pick_random()["name"] if not d["villagers"].is_empty() else "alguien"
	var what: String = ["tu familia esconde deudas con un prestamista", "has pactado en secreto con un señor vecino", "tu casa está maldita", "tu cosecha es robada"].pick_random()
	_popup("Habladurías", "En la fuente se murmura que %s. Parece que todo empezó con %s." % [what, who], [
		["Invitar a vino a todo el pueblo para acallarlo (15 oro)", func():
			d["gold"] = maxi(0, int(d["gold"]) - 15)
			_mood_all(6)
			GS.say("Con unas jarras de vino, el rumor se olvida pronto.")],
		["Desmentirlo en público", func():
			if randf() < 0.6:
				d["prestige"] += 3
				GS.say("Desmientes el rumor con aplomo y la gente te cree. (+3 prestigio)")
			else:
				d["prestige"] = maxi(0, int(d["prestige"]) - 6)
				GS.say("Nadie te cree del todo; el rumor sigue corriendo. (-6 prestigio)")],
		["Hablar con %s" % who, func():
			var v := _find(who)
			if not v.is_empty():
				v["affection"] = maxi(0, int(v["affection"]) - 10)
			GS.say("%s jura que no fue con mala intención. El rumor se apaga, pero queda cierta frialdad entre vosotros." % who)],
	])


static func _find(n: String) -> Dictionary:
	for v in GS.data["villagers"]:
		if v["name"] == n:
			return v
	return {}


static func _thief() -> void:
	var d = GS.data
	var thief: String = GS.rng_name(true)
	_popup("Un ladrón", "Los vecinos han atrapado a %s, un forastero, robando gallinas y aperos. Esperan que el jefe haga justicia." % thief, [
		["Ponerlo en el cepo de la plaza", func():
			_mood_all(5)
			d["prestige"] += 3
			GS.say("%s pasa dos días en el cepo. Los vecinos se sienten más seguros. (+3 prestigio)" % thief)],
		["Imponerle una multa (+15 oro)", func():
			d["gold"] = int(d["gold"]) + 15
			GS.say("%s paga la multa y se marcha del pueblo. (+15 oro)" % thief)],
		["Perdonarlo y darle trabajo", func():
			d["commons"] = int(d["commons"]) + 1
			if randf() < 0.3:
				d["gold"] = maxi(0, int(d["gold"]) - 20)
				GS.say("%s se escapa una noche con 20 de tu oro. Lección aprendida." % thief)
			else:
				d["prestige"] += 2
				GS.say("%s se queda en el pueblo y resulta ser un buen trabajador. (+2 prestigio)" % thief)],
	])


static func _robbed() -> void:
	var d = GS.data
	var lost := mini(int(d["gold"]), randi_range(8, 20))
	d["gold"] = int(d["gold"]) - lost
	_popup("¡Te han robado!", "Al volver a casa ves la puerta forzada: te faltan %d monedas de oro." % lost, [
		["Denunciarlo ante el jefe del pueblo", func():
			if randf() < 0.45:
				d["gold"] = int(d["gold"]) + lost
				GS.say("El jefe atrapa al ladrón y recuperas tu oro.")
			else:
				GS.say("Nadie vio nada. Tu oro no aparece.")],
		["Poner una buena cerradura (5 oro)", func():
			d["gold"] = maxi(0, int(d["gold"]) - 5)
			GS.say("Con la cerradura nueva duermes más tranquilo.")],
	])
