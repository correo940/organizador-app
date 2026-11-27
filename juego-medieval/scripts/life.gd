extends RefCounted
## Vida del pueblo a largo plazo: encargos con plazo, preparar el invierno, amistades y enemistades
## con los vecinos, sucesos con decisiones e hitos para ascender.

const ITEMS_WANTED := ["trigo", "pan", "zanahoria", "pescado", "carne", "lana", "queso", "huevos", "leche", "cuero", "manzana"]


static func ensure() -> void:
	var d = GS.data
	if not d.has("contracts"):
		d["contracts"] = []
		d["contracts_done"] = 0


# ---------------- Encargos ----------------

## Genera un encargo nuevo: un vecino, el concejo o el señor piden algo con plazo.
static func _new_contract() -> Dictionary:
	var d = GS.data
	var who_kind: int = randi() % 3
	var who: String
	var v_name := ""
	match who_kind:
		0:
			var v = d["villagers"].pick_random()
			v_name = v["name"]
			who = GS.full_name(v)
		1:
			who = "El concejo"
		_:
			who = "El señor de la comarca"
	var c := {"who": who, "v": v_name, "until": int(d["total_days"]) + randi_range(5, 9)}
	match randi() % 3:
		0:
			var it: String = ITEMS_WANTED.pick_random()
			var n := randi_range(4, 10)
			c["kind"] = "item"
			c["item"] = it
			c["n"] = n
			c["text"] = "%s pide %d de %s" % [who, n, String(GS.ITEMS[it][0]).to_lower()]
			c["gold"] = int(ceil(GS.ITEMS[it][1] * n * 1.8))
		1:
			var res: String = ["wood", "stone"].pick_random()
			var n2 := randi_range(15, 35)
			c["kind"] = "res"
			c["item"] = res
			c["n"] = n2
			c["text"] = "%s necesita %d de %s para una obra" % [who, n2, "madera" if res == "wood" else "piedra"]
			c["gold"] = n2
		_:
			c["kind"] = "gold"
			c["n"] = randi_range(20, 50)
			c["text"] = "%s pide un préstamo de %d de oro (devolverá el doble en prestigio y favor)" % [who, c["n"]]
			c["gold"] = 0
	c["prestige"] = 5 + who_kind * 5
	return c


static func contracts() -> Array:
	ensure()
	return GS.data["contracts"]


static func can_fulfil(c: Dictionary) -> bool:
	var d = GS.data
	match c["kind"]:
		"item": return GS.inv(c["item"]) >= int(c["n"])
		"res": return int(d[c["item"]]) >= int(c["n"])
		_: return int(d["gold"]) >= int(c["n"])


static func fulfil(i: int) -> void:
	var d = GS.data
	var c: Dictionary = d["contracts"][i]
	match c["kind"]:
		"item": GS.take(c["item"], int(c["n"]))
		"res": d[c["item"]] = int(d[c["item"]]) - int(c["n"])
		_: d["gold"] = int(d["gold"]) - int(c["n"])
	d["gold"] = int(d["gold"]) + int(c["gold"])
	d["prestige"] = int(d["prestige"]) + int(c["prestige"]) * (2 if c["kind"] == "gold" else 1)
	if c["v"] != "":
		_affect(c["v"], 20)
	d["contracts_done"] = int(d.get("contracts_done", 0)) + 1
	d["contracts"].remove_at(i)
	SFX.play("monedas")
	GS.say("Cumples el encargo: %s. (+%d oro, +%d prestigio)" % [c["text"], int(c["gold"]), int(c["prestige"])])


static func contracts_text() -> Array:
	var out := []
	for c in contracts():
		out.append("• %s (%d días)" % [c["text"], maxi(0, int(c["until"]) - int(GS.data["total_days"]))])
	return out


static func board(v) -> void:
	var opts := []
	var cs := contracts()
	for i in cs.size():
		var c: Dictionary = cs[i]
		opts.append(["Cumplir: %s" % c["text"], func():
			fulfil(i)
			board(v), can_fulfil(c)])
	opts.append(["Cerrar", v._close_panel])
	var text := "Encargos del pueblo. Cumplirlos a tiempo da oro, prestigio y el aprecio de quien lo pide; si no llegas, se enfadan.\nEncargos cumplidos: %d" % int(GS.data.get("contracts_done", 0))
	if cs.is_empty():
		text += "\n\nAhora mismo nadie pide nada. Vuelve en unos días."
	v._open_panel("Tablón de encargos", text, opts)


# ---------------- Día y estación ----------------

static func day() -> void:
	ensure()
	var d = GS.data
	# Encargos que vencen.
	for c in d["contracts"].duplicate():
		if int(d["total_days"]) > int(c["until"]):
			d["contracts"].erase(c)
			d["prestige"] = maxi(0, int(d["prestige"]) - 5)
			if c["v"] != "":
				_affect(c["v"], -15)
			GS.say("No cumpliste a tiempo: %s. (-5 prestigio)" % c["text"])
	if d["contracts"].size() < 3 and randf() < 0.35:
		var c := _new_contract()
		d["contracts"].append(c)
		GS.say("Nuevo encargo en el tablón del concejo: %s." % c["text"])
	# Invierno: hace falta leña para calentar la casa.
	if int(d["season"]) == 3 and int(d["house_level"]) >= 1:
		var need: int = 1 + GS.family_size() / 3
		if int(d["wood"]) >= need:
			d["wood"] = int(d["wood"]) - need
		else:
			d["player"]["health"] = float(d["player"]["health"]) - 6.0
			GS.say("No queda leña para el fuego: pasáis frío en casa. (-6 salud)")
	_neighbours()


static func season() -> void:
	var d = GS.data
	match int(d["season"]):
		2:
			var winter_food: int = GS.family_size() * GS.DAYS_PER_SEASON
			var wood: int = (1 + GS.family_size() / 3) * GS.DAYS_PER_SEASON
			GS.popups.append({"title": "Prepara el invierno", "text": "Llega el otoño. Para pasar el invierno tu familia necesitará unas %d raciones de comida guardadas y %d de leña para el fuego.\n\nAhora tienes %d raciones y %d de madera. En invierno no se siembra y casi no hay caza ni pesca." % [winter_food, wood, GS.food_total(), int(d["wood"])], "button": "Entendido"})
		0:
			if int(d["year"]) > 1100:
				GS.popups.append({"title": "Llega la primavera", "text": "La tierra se ablanda: es tiempo de sembrar. Lo que plantes ahora se cosecha en verano y otoño.", "button": "A sembrar"})


# ---------------- Amistades y enemistades ----------------

static func _affect(vname: String, n: int) -> void:
	for v in GS.data["villagers"]:
		if v["name"] == vname:
			v["affection"] = clampi(int(v["affection"]) + n, 0, 100)


static func relation(v: Dictionary) -> String:
	var a := int(v.get("affection", 0))
	if a >= 70: return "amigo íntimo"
	if a >= 45: return "amigo"
	if a <= 10: return "enemigo"
	if a <= 25: return "receloso"
	return "conocido"


## Los amigos te ayudan de vez en cuando; los enemigos te ponen trabas.
static func _neighbours() -> void:
	var d = GS.data
	for v in d["villagers"]:
		var a := int(v.get("affection", 0))
		if a >= 70 and randf() < 0.04:
			match randi() % 3:
				0:
					GS.add("pan", 2)
					GS.say("%s te trae pan recién hecho: «Para tu familia». (+2 pan)" % v["name"])
				1:
					d["wood"] = int(d["wood"]) + 8
					GS.say("%s te ayuda a cortar leña. (+8 madera)" % v["name"])
				_:
					d["prestige"] = int(d["prestige"]) + 3
					GS.say("%s habla bien de ti en la taberna. (+3 prestigio)" % v["name"])
		elif a <= 10 and randf() < 0.03:
			match randi() % 2:
				0:
					d["prestige"] = maxi(0, int(d["prestige"]) - 4)
					GS.say("%s va diciendo por ahí que no eres de fiar. (-4 prestigio)" % v["name"])
				_:
					var lost := mini(GS.inv("trigo"), 3)
					if lost > 0:
						GS.take("trigo", lost)
						GS.say("Alguien ha revuelto tu granero por la noche... sospechas de %s. (-%d trigo)" % [v["name"], lost])


static func friends() -> int:
	return GS.data["villagers"].filter(func(v): return int(v.get("affection", 0)) >= 45).size()


# ---------------- Hitos para ascender ----------------

static func chief_reqs() -> Array:
	var d = GS.data
	var need_friends := maxi(2, d["villagers"].size() / 3)
	return [
		["%d de prestigio" % GS.CHIEF_PRESTIGE, int(d["prestige"]) >= GS.CHIEF_PRESTIGE],
		["Casa de piedra", int(d["house_level"]) >= 2],
		["%d vecinos que te aprecien (tienes %d)" % [need_friends, friends()], friends() >= need_friends],
		["3 encargos cumplidos (llevas %d)" % int(d.get("contracts_done", 0)), int(d.get("contracts_done", 0)) >= 3],
		["Estar casado o casada", d["spouse"] != null],
	]


static func chief_ok() -> bool:
	return chief_reqs().all(func(r): return r[1])


static func chief_text() -> String:
	var lines := ["Para que el concejo te elija jefe necesitas:"]
	for r in chief_reqs():
		lines.append(("✔ " if r[1] else "✘ ") + r[0])
	return "\n".join(lines)


# ---------------- Sucesos con decisiones ----------------

static func plague_fields() -> void:
	var d = GS.data
	GS.EVENTS._popup("Plaga en los campos", "Una nube de langostas se posa sobre los sembrados del pueblo. Podéis quemar los rastrojos para salvar lo que queda o rezar para que se marchen.", [
		["Quemar los campos afectados (pierdes tus cultivos, salvas los del pueblo)", func():
			for f in d["fields"]:
				if f["owned"]:
					f["crop"] = ""
					f["age"] = 0
			d["prestige"] = int(d["prestige"]) + 10
			GS.EVENTS._mood_all(5)
			GS.say("Sacrificas tu cosecha por el pueblo. Los vecinos no lo olvidarán. (+10 prestigio)")],
		["Pagar al cura una rogativa (15 oro)", func():
			d["gold"] = maxi(0, int(d["gold"]) - 15)
			if randf() < 0.5:
				GS.say("Las langostas se marchan tras la procesión. ¡Milagro!")
			else:
				for f in d["fields"]:
					if f["owned"] and randf() < 0.6:
						f["crop"] = ""
				GS.say("La rogativa no sirve: las langostas arrasan parte de tus campos.")],
		["No hacer nada", func():
			for f in d["fields"]:
				if f["owned"] and randf() < 0.5:
					f["crop"] = ""
			GS.EVENTS._mood_all(-5)
			GS.say("La plaga devora la mitad de los campos.")],
	])


static func stranger() -> void:
	var d = GS.data
	GS.EVENTS._popup("Un forastero sospechoso", "Un hombre con capa raída pide cobijo por unos días. Dice ser un herrero de paso, pero lleva una daga de soldado y evita las miradas.", [
		["Acogerlo en tu casa", func():
			if randf() < 0.5:
				d["weapon"] = int(d["weapon"]) + (1 if int(d["weapon"]) < 3 else 0)
				GS.say("Era un antiguo soldado del rey: en agradecimiento te enseña a luchar mejor. (+1 espada)")
			else:
				var lost := mini(int(d["gold"]), randi_range(10, 30))
				d["gold"] = int(d["gold"]) - lost
				GS.say("Por la mañana el forastero ha desaparecido... y tu bolsa también. (-%d oro)" % lost)],
		["Darle pan y que siga su camino", func():
			GS.take("pan", mini(1, GS.inv("pan")))
			d["prestige"] = int(d["prestige"]) + 2
			GS.say("El forastero te da las gracias y se marcha.")],
		["Avisar a los vecinos y echarlo", func():
			GS.EVENTS._mood_all(3)
			GS.say("El pueblo agradece tu prudencia.")],
	])


static func dowry() -> void:
	var d = GS.data
	var vs: Array = d["villagers"].filter(func(v): return int(v.get("affection", 0)) >= 30)
	if vs.is_empty():
		return
	var v = vs.pick_random()
	GS.EVENTS._popup("Una boda sin dote", "%s quiere casar a su hija, pero no tiene dote y la familia del novio amenaza con romper el compromiso. Te pide ayuda." % GS.full_name(v), [
		["Pagar la dote (40 oro)", func():
			d["gold"] = int(d["gold"]) - 40
			v["affection"] = mini(100, int(v["affection"]) + 35)
			d["prestige"] = int(d["prestige"]) + 8
			GS.say("La boda se celebra y %s te jura amistad eterna. (+8 prestigio)" % v["name"]), int(d["gold"]) >= 40],
		["Regalar un cerdo o dos sacos de trigo", func():
			if GS.inv("trigo") >= 10:
				GS.take("trigo", 10)
			v["affection"] = mini(100, int(v["affection"]) + 15)
			GS.say("No es mucho, pero %s lo agradece." % v["name"])],
		["Lo siento, no puedo", func():
			v["affection"] = maxi(0, int(v["affection"]) - 15)
			GS.say("%s se va cabizbajo." % v["name"])],
	])


static func healer() -> void:
	var d = GS.data
	GS.EVENTS._popup("La curandera del bosque", "Una anciana que vive en el bosque baja al pueblo con remedios de hierbas. Algunos vecinos dicen que es bruja.", [
		["Comprarle un remedio (10 oro)", func():
			d["gold"] = int(d["gold"]) - 10
			d["player"]["health"] = minf(100.0, float(d["player"]["health"]) + 25.0)
			d["player"]["energy"] = 100.0
			GS.say("El remedio te devuelve las fuerzas. (+25 salud, fuerza al máximo)"), int(d["gold"]) >= 10],
		["Dejarla vender en la plaza", func():
			GS.EVENTS._mood_all(4)
			GS.say("La gente compra sus remedios y se siente mejor.")],
		["Expulsarla del pueblo", func():
			d["prestige"] = int(d["prestige"]) + 3
			GS.EVENTS._mood_all(-3)
			GS.say("La curandera se marcha maldiciendo en voz baja.")],
	])


static func dry_well() -> void:
	var d = GS.data
	GS.EVENTS._popup("El pozo se seca", "Con el calor, el pozo de la plaza apenas da agua. Hay que cavar más hondo o traer agua del lago cada día.", [
		["Pagar a los canteros para ahondarlo (20 piedra, 15 oro)", func():
			d["stone"] = int(d["stone"]) - 20
			d["gold"] = int(d["gold"]) - 15
			d["prestige"] = int(d["prestige"]) + 10
			GS.EVENTS._mood_all(6)
			GS.say("El pozo vuelve a dar agua fresca. El pueblo te lo agradece. (+10 prestigio)"), int(d["stone"]) >= 20 and int(d["gold"]) >= 15],
		["Que cada familia acarree agua del lago", func():
			GS.EVENTS._mood_all(-6)
			for v in d["villagers"]:
				v["mood"] = maxi(0, int(v["mood"]) - 2)
			GS.say("Los vecinos refunfuñan, cargados de cubos.")],
	])
