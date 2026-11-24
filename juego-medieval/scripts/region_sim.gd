extends RefCounted
## La región: pueblos de otros señores y tuyos, crecimiento, fundaciones, tributos y asaltos.

const SIZE := 300.0
const HOME := Vector2(150, 150)
const LORD_TITLES := ["Conde", "Barón", "Señor", "Duque"]
const LORD_COLORS := [[0.6, 0.1, 0.1], [0.15, 0.45, 0.15], [0.5, 0.35, 0.05], [0.4, 0.1, 0.45], [0.1, 0.4, 0.45]]
const TOWN_NAMES := ["Valdeoscuro", "Peñaflor", "Castronuño", "Torremolinos", "Villalba", "Fuentesaúco", "Montenegro", "Rioseco", "Navarredonda", "Peñarroya", "Valverde", "Robledillo", "Cuevas Altas", "Alcázar", "Villafranca", "Torrelobatón", "Hontanares", "Matilla", "San Esteban", "Olmedillo"]
const FOUND_COST := {"oro": 100, "madera": 30, "piedra": 20}
const SETTLERS := 20
const DAY_DIST := 22.0  # distancia que recorre el ejército en un día


static func tier_of(pop: int) -> int:
	return 0 if pop < 100 else (1 if pop < 400 else 2)


static func tier_name(t: int) -> String:
	return ["Aldea", "Villa", "Ciudad"][t]


## Crea la región la primera vez: lugares, señores y sus pueblos.
static func ensure() -> void:
	var d = GS.data
	if d.has("region"):
		return
	var r := RandomNumberGenerator.new()
	r.randomize()
	var sites := []
	var tries := 0
	while sites.size() < 22 and tries < 4000:
		tries += 1
		var p := Vector2(r.randf_range(25, SIZE - 25), r.randf_range(25, SIZE - 25))
		if p.distance_to(HOME) < 45:
			continue
		if sites.any(func(s): return Vector2(s[0], s[1]).distance_to(p) < 38):
			continue
		sites.append([p.x, p.y])
	var used_names := [d.get("town", "")]
	var towns := []
	towns.append({"id": 0, "name": d.get("town", "Tu pueblo"), "x": HOME.x, "z": HOME.y, "owner": "jugador", "home": true})
	var lords := []
	for i in 4:
		var male := r.randf() < 0.75
		lords.append({"name": "%s %s" % [LORD_TITLES[i] if male else ["Condesa", "Baronesa", "Señora", "Duquesa"][i], GS.rng_name(male)], "color": LORD_COLORS[i], "rel": 50})
	# Cada señor empieza con un pueblo importante y alguna aldea.
	var si := 0
	for li in lords.size():
		for k in (2 if li < 2 else 1):
			if si >= sites.size():
				break
			var name: String = _free_name(used_names)
			used_names.append(name)
			var pop := r.randi_range(150, 350) if k == 0 else r.randi_range(40, 90)
			towns.append(_town(towns.size(), name, sites[si][0], sites[si][1], li, pop))
			si += 1
	d["region"] = {"sites": sites, "towns": towns, "lords": lords, "party": [HOME.x, HOME.y + 10], "walked": 0.0}


static func _free_name(used: Array) -> String:
	var pool := TOWN_NAMES.filter(func(n): return not n in used)
	return pool.pick_random() if not pool.is_empty() else "Nueva %s" % TOWN_NAMES.pick_random()


static func _town(id: int, name: String, x: float, z: float, lord: int, pop: int) -> Dictionary:
	return {"id": id, "name": name, "x": x, "z": z, "owner": "señor", "lord": lord, "pop": pop,
		"troops": int(pop * 0.08) + 4, "gold": pop, "wall": 2 if pop > 300 else (1 if pop > 120 else 0), "vassal": false, "garrison": 0}


static func region() -> Dictionary:
	return GS.data["region"]


static func town(id: int) -> Dictionary:
	for t in region()["towns"]:
		if int(t["id"]) == id:
			return t
	return {}


## Población del pueblo (el tuyo principal se lee del propio pueblo).
static func pop_of(t: Dictionary) -> int:
	if t.get("home", false):
		return GS.SIM.total_pop()
	return int(t["pop"])


static func owner_text(t: Dictionary) -> String:
	if t.get("home", false):
		return "tu pueblo"
	if t["owner"] == "jugador":
		return "tuyo"
	var l = region()["lords"][int(t["lord"])]
	return l["name"] + (" (tu vasallo)" if t["vassal"] else "")


static func free_sites() -> Array:
	var out := []
	var reg := region()
	for i in reg["sites"].size():
		var s = reg["sites"][i]
		if not reg["towns"].any(func(t): return Vector2(t["x"], t["z"]).distance_to(Vector2(s[0], s[1])) < 5.0):
			out.append(i)
	return out


# ---------------- Paso del tiempo ----------------

static func day() -> void:
	var d = GS.data
	if not d.has("region"):
		return
	var reg := region()
	var income := 0.0
	for t in reg["towns"]:
		if t.get("home", false):
			continue
		var pop: int = t["pop"]
		var cap: int = [100, 400, 1200][mini(2, tier_of(pop) + 1)]
		t["pop"] = mini(cap, pop + maxi(1 if randf() < 0.5 else 0, int(pop * 0.004)))
		if t["owner"] == "jugador":
			income += pop / 40.0
		else:
			t["gold"] = int(t["gold"]) + pop / 20
			var target := int(pop * 0.08) + 4
			if int(t["troops"]) < target and randf() < 0.5:
				t["troops"] = int(t["troops"]) + 1
	reg["income_acc"] = float(reg.get("income_acc", 0.0)) + income
	if float(reg["income_acc"]) >= 1.0:
		var g := int(floor(float(reg["income_acc"])))
		d["gold"] = int(d["gold"]) + g
		reg["income_acc"] = float(reg["income_acc"]) - g


## Cada estación: tributos de vasallos, nuevas aldeas de los señores y asaltos.
static func season() -> void:
	var d = GS.data
	if not d.has("region"):
		return
	var reg := region()
	var tribute := 0
	for t in reg["towns"]:
		if t["owner"] == "señor" and t["vassal"]:
			var g := int(t["pop"]) / 8
			t["gold"] = maxi(0, int(t["gold"]) - g)
			tribute += g
	if tribute > 0:
		d["gold"] = int(d["gold"]) + tribute
		GS.say("Tus vasallos te pagan %d de oro de tributo." % tribute)
	# Un señor rico funda una aldea nueva.
	var free := free_sites()
	for li in reg["lords"].size():
		var mine: Array = reg["towns"].filter(func(t): return t["owner"] == "señor" and int(t["lord"]) == li)
		var rich := mine.filter(func(t): return int(t["gold"]) > 500)
		if rich.is_empty() or free.is_empty() or randf() > 0.25:
			continue
		var src = rich.pick_random()
		free.sort_custom(func(a, b): return Vector2(reg["sites"][a][0], reg["sites"][a][1]).distance_to(Vector2(src["x"], src["z"])) < Vector2(reg["sites"][b][0], reg["sites"][b][1]).distance_to(Vector2(src["x"], src["z"])))
		var si: int = free.pop_front()
		src["gold"] = int(src["gold"]) - 400
		var name := _free_name(reg["towns"].map(func(t): return t["name"]))
		reg["towns"].append(_town(_next_id(), name, reg["sites"][si][0], reg["sites"][si][1], li, 30))
		GS.say("%s funda una aldea nueva: %s." % [reg["lords"][li]["name"], name])
	# Asaltos a tus aldeas mal defendidas.
	for t in reg["towns"]:
		if t["owner"] != "jugador" or t.get("home", false):
			continue
		var defense := int(t["garrison"]) * 3 + int(t["wall"]) * 15
		for li in reg["lords"].size():
			var l = reg["lords"][li]
			if int(l["rel"]) >= 35 or randf() > 0.25:
				continue
			var power := 0
			for o in reg["towns"]:
				if o["owner"] == "señor" and int(o["lord"]) == li and not o["vassal"]:
					power += int(o["troops"])
			if power * 0.4 > defense:
				if int(t["garrison"]) == 0 and randf() < 0.35:
					t["owner"] = "señor"
					t["lord"] = li
					t["troops"] = int(power * 0.2)
					GS.say("¡%s ha tomado tu aldea de %s!" % [l["name"], t["name"]])
				else:
					var lost := int(int(t["pop"]) * 0.2)
					t["pop"] = int(t["pop"]) - lost
					t["garrison"] = int(int(t["garrison"]) * 0.5)
					GS.say("Las tropas de %s asaltan %s: mueren o huyen %d personas." % [l["name"], t["name"], lost])
				break


static func _next_id() -> int:
	var m := 0
	for t in region()["towns"]:
		m = maxi(m, int(t["id"]))
	return m + 1


# ---------------- Acciones del jugador ----------------

static func found_village(site: int) -> String:
	var d = GS.data
	if int(d["title"]) < 1:
		return "Solo el jefe de un pueblo puede fundar aldeas."
	if int(d["commons"]) < SETTLERS:
		return "Necesitas %d colonos del pueblo llano." % SETTLERS
	if not GS.can_pay(FOUND_COST):
		return "Te faltan: " + GS.cost_text(FOUND_COST)
	GS.pay(FOUND_COST)
	d["commons"] = int(d["commons"]) - SETTLERS
	var reg := region()
	var name := _free_name(reg["towns"].map(func(t): return t["name"]))
	var t := _town(_next_id(), name, reg["sites"][site][0], reg["sites"][site][1], 0, SETTLERS)
	t["owner"] = "jugador"
	t["troops"] = 0
	t["wall"] = 0
	reg["towns"].append(t)
	d["prestige"] += 20
	GS.say("Has fundado la aldea de %s. (+20 prestigio)" % name)
	return ""


## Resultado de una victoria contra un pueblo: saquear, conquistar o vasallaje.
static func after_victory(id: int, choice: String) -> String:
	var t := town(id)
	var d = GS.data
	var l = region()["lords"][int(t["lord"])]
	l["rel"] = maxi(0, int(l["rel"]) - 25)
	t["troops"] = 0
	match choice:
		"saquear":
			var loot := int(t["gold"]) / 2 + int(t["pop"]) / 2
			t["gold"] = int(t["gold"]) / 2
			t["pop"] = int(int(t["pop"]) * 0.8)
			d["gold"] = int(d["gold"]) + loot
			return "Saqueas %s: +%d de oro." % [t["name"], loot]
		"conquistar":
			t["owner"] = "jugador"
			t["vassal"] = false
			t["garrison"] = 0
			d["prestige"] += 30
			return "%s es ahora tuyo. (+30 prestigio) Deja guarnición para defenderlo." % t["name"]
		_:
			t["vassal"] = true
			l["rel"] = mini(100, int(l["rel"]) + 30)
			d["prestige"] += 15
			return "%s acepta ser tu vasallo y te pagará tributo cada estación. (+15 prestigio)" % l["name"]
