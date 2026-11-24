extends RefCounted
## La región: pueblos de otros señores y tuyos, crecimiento, fundaciones, tributos y asaltos.

const SIZE := 300.0  # tamaño en partidas antiguas
const HOME := Vector2(150, 150)
const NEW_SIZE := 420.0
const RESERVED_R := 70.0  # alrededor de tu pueblo, los lugares quedan para ti
const LORD_TITLES := ["Conde", "Barón", "Señor", "Duque"]
const LORD_COLORS := [[0.6, 0.1, 0.1], [0.15, 0.45, 0.15], [0.5, 0.35, 0.05], [0.4, 0.1, 0.45], [0.1, 0.4, 0.45]]
const TOWN_NAMES := ["Valdeoscuro", "Peñaflor", "Castronuño", "Torremolinos", "Villalba", "Fuentesaúco", "Montenegro", "Rioseco", "Navarredonda", "Peñarroya", "Valverde", "Robledillo", "Cuevas Altas", "Alcázar", "Villafranca", "Torrelobatón", "Hontanares", "Matilla", "San Esteban", "Olmedillo"]
const FOUND_COST := {"oro": 100, "madera": 30, "piedra": 20}
const SETTLERS := 20
const DAY_DIST := 22.0  # distancia que recorre el ejército en un día
const NOBLES := preload("res://scripts/nobles.gd")
const TRADE_ITEMS := ["trigo", "harina", "pan", "zanahoria", "calabaza", "manzana", "carne", "pescado", "lana", "cuero", "tela", "piel", "queso", "cerveza", "miel", "hierro", "herramientas", "madera", "piedra"]


static func tier_of(pop: int) -> int:
	return 0 if pop < 100 else (1 if pop < 400 else 2)


static func tier_name(t: int) -> String:
	return ["Aldea", "Villa", "Ciudad"][t]


## Crea la región la primera vez: lugares, señores y sus pueblos.
static func ensure() -> void:
	var d = GS.data
	if not d.has("region"):
		_create()
	var reg := region()
	NOBLES.ensure()
	if not reg.has("armies"):
		reg["armies"] = []
		reg["caravans"] = []
	for t in reg["towns"]:
		_ensure_market(t)


static func _ensure_market(t: Dictionary) -> void:
	if t.get("home", false) or t.has("market"):
		return
	var items := TRADE_ITEMS.duplicate()
	items.shuffle()
	t["market"] = {"spec": items.slice(0, 3), "want": items.slice(3, 6), "mult": {}}


static func _create() -> void:
	var d = GS.data
	var r := RandomNumberGenerator.new()
	r.randomize()
	var sites := []
	var tries := 0
	var home_new := Vector2(NEW_SIZE / 2, NEW_SIZE / 2)
	while sites.size() < 42 and tries < 6000:
		tries += 1
		var p := Vector2(r.randf_range(25, NEW_SIZE - 25), r.randf_range(25, NEW_SIZE - 25))
		if p.distance_to(home_new) < 45:
			continue
		if sites.any(func(s): return Vector2(s[0], s[1]).distance_to(p) < 38):
			continue
		sites.append([p.x, p.y])
	# Al menos 3 lugares en tu zona reservada.
	for tries2 in 500:
		if sites.filter(func(s): return Vector2(s[0], s[1]).distance_to(home_new) <= RESERVED_R).size() >= 3:
			break
		var a := r.randf() * TAU
		var p := home_new + Vector2(cos(a), sin(a)) * r.randf_range(45, RESERVED_R - 5)
		if not sites.any(func(s): return Vector2(s[0], s[1]).distance_to(p) < 30):
			sites.append([p.x, p.y])
	var used_names := [d.get("town", "")]
	var towns := []
	towns.append({"id": 0, "name": d.get("town", "Tu pueblo"), "x": home_new.x, "z": home_new.y, "owner": "jugador", "home": true})
	var lords := []
	for i in 4:
		var male := r.randf() < 0.75
		lords.append({"name": "%s %s" % [LORD_TITLES[i] if male else ["Condesa", "Baronesa", "Señora", "Duquesa"][i], GS.rng_name(male)], "color": LORD_COLORS[i], "rel": 50})
	# Cada señor empieza con un pueblo importante y alguna aldea, fuera de tu zona reservada.
	sites.sort_custom(func(a, b): return Vector2(a[0], a[1]).distance_to(home_new) > Vector2(b[0], b[1]).distance_to(home_new))
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
	# Los señores empiezan lejos de tu pueblo: los lugares cercanos quedan reservados para ti.
	d["region"] = {"sites": sites, "towns": towns, "lords": lords, "party": [home_new.x, home_new.y + 10], "walked": 0.0, "size": NEW_SIZE}


static func _free_name(used: Array) -> String:
	var pool := TOWN_NAMES.filter(func(n): return not n in used)
	return pool.pick_random() if not pool.is_empty() else "Nueva %s" % TOWN_NAMES.pick_random()


static func _town(id: int, name: String, x: float, z: float, lord: int, pop: int) -> Dictionary:
	var t := {"id": id, "name": name, "x": x, "z": z, "owner": "señor", "lord": lord, "pop": pop,
		"troops": int(pop * 0.08) + 4, "gold": pop, "wall": 2 if pop > 300 else (1 if pop > 120 else 0), "vassal": false, "garrison": 0}
	_ensure_market(t)
	return t


static func size() -> float:
	return float(region().get("size", SIZE))


static func home() -> Vector2:
	var t = region()["towns"][0]
	return Vector2(t["x"], t["z"])


## Lugares libres que pueden ocupar los señores y colonos (no los de tu zona reservada).
static func ai_free_sites() -> Array:
	var reg := region()
	return free_sites().filter(func(si): return Vector2(reg["sites"][si][0], reg["sites"][si][1]).distance_to(home()) > RESERVED_R)


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
	_move_armies()
	_move_caravans()
	var income := 0.0
	for t in reg["towns"]:
		if t.get("home", false):
			continue
		var pop: int = t["pop"]
		var cap: int = [100, 400, 1200][mini(2, tier_of(pop) + 1)]
		t["pop"] = mini(cap, pop + maxi(1 if randf() < 0.5 else 0, int(pop * 0.004)))
		if t["owner"] == "jugador":
			income += pop / 40.0 * governor_mult(int(t["id"]))
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
	NOBLES.season()
	NOBLES.revolts()
	raise_armies()
	_settlers()
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
	var free := ai_free_sites()
	for li in reg["lords"].size():
		var mine: Array = reg["towns"].filter(func(t): return t["owner"] == "señor" and int(t["lord"]) == li)
		var rich := mine.filter(func(t): return int(t["gold"]) > 500) if mine.size() < 8 else []
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
			if not NOBLES.at_war(-1, li) or randf() > 0.25:
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

## Nombre del hijo o hija que gobierna el pueblo (o "").
static func governor_of(id: int) -> String:
	for c in GS.data["children"]:
		if c.get("role", "") == "gobernador" and int(c.get("town", -1)) == id:
			return c["name"]
	return ""


## Multiplicador de rentas por el gobernador: 1.5, más si sabe letras o es astuto.
static func governor_mult(id: int) -> float:
	var g := _child(governor_of(id))
	if g.is_empty():
		return 1.0
	return 1.5 + (0.25 if g.get("edu", "") == "letras" else 0.0) + (0.25 if GS.trait_of(g) == "astuto" else 0.0)


static func _child(n: String) -> Dictionary:
	for c in GS.data["children"]:
		if c["name"] == n:
			return c
	return {}


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
	t["founded"] = true
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


# ---------------- Ejércitos de los señores ----------------

static func lord_towns(i: int) -> Array:
	return region()["towns"].filter(func(t): return t["owner"] == "señor" and int(t["lord"]) == i and not t["vassal"])


static func lord_power(i: int) -> int:
	var p := 0
	for t in lord_towns(i):
		p += int(t["troops"])
	return p


static func enemies_of(i: int) -> Array:
	var out := []
	for w in region()["wars"]:
		if int(w[0]) == i:
			out.append(int(w[1]))
		elif int(w[1]) == i:
			out.append(int(w[0]))
	return out


## Pueblos que pertenecen a un bando (-1 = el jugador).
static func towns_of_side(side: int) -> Array:
	if side == -1:
		return region()["towns"].filter(func(t): return t["owner"] == "jugador")
	return lord_towns(side)


## Cada estación, los señores en guerra reúnen un ejército y marchan contra el enemigo.
static func raise_armies() -> void:
	var reg := region()
	for i in reg["lords"].size():
		if reg["armies"].any(func(a): return int(a["lord"]) == i):
			continue
		var foes := enemies_of(i)
		if foes.is_empty() or randf() > 0.6:
			continue
		var mine := lord_towns(i)
		if mine.is_empty():
			continue
		mine.sort_custom(func(a, b): return int(a["pop"]) > int(b["pop"]))
		var base = mine[0]
		var targets := []
		for f in foes:
			targets.append_array(towns_of_side(f))
		if targets.is_empty():
			continue
		targets.sort_custom(func(a, b): return Vector2(a["x"], a["z"]).distance_to(Vector2(base["x"], base["z"])) < Vector2(b["x"], b["z"]).distance_to(Vector2(base["x"], base["z"])))
		var troops := 0
		for t in mine:
			var n := int(int(t["troops"]) * 0.5)
			t["troops"] = int(t["troops"]) - n
			troops += n
		if troops < 12:
			base["troops"] = int(base["troops"]) + troops
			continue
		var tgt = targets[0]
		reg["armies"].append({"id": randi(), "lord": i, "x": float(base["x"]), "z": float(base["z"]) + 8.0, "troops": troops, "target": int(tgt["id"]), "home": int(base["id"])})
		GS.say("%s marcha con %d soldados contra %s." % [NOBLES.full(reg["lords"][i]), troops, tgt["name"]])


static func _move_armies() -> void:
	var reg := region()
	for a in reg["armies"].duplicate():
		var t := town(int(a["target"]))
		var side := -1 if t.get("owner", "") == "jugador" else int(t.get("lord", -2))
		if t.is_empty() or not NOBLES.at_war(int(a["lord"]), side):
			_disband(a)
			continue
		var to := Vector2(t["x"], t["z"]) - Vector2(a["x"], a["z"])
		if a.get("waiting", false):
			# Espera a que decidas si lo defiendes en persona; si no, ataca a los 3 días.
			a["wait"] = int(a.get("wait", 0)) + 1
			if int(a["wait"]) >= 3:
				a.erase("waiting")
				_assault(a, t)
		elif to.length() <= DAY_DIST * 0.8 and t["owner"] == "jugador" and not a.has("asked"):
			_ask_defense(a, t)
		elif to.length() <= DAY_DIST * 0.8:
			_assault(a, t)
		else:
			var step := to.normalized() * DAY_DIST * 0.8
			a["x"] = float(a["x"]) + step.x
			a["z"] = float(a["z"]) + step.y


static func _disband(a: Dictionary) -> void:
	var home := town(int(a["home"]))
	if not home.is_empty() and home["owner"] == "señor":
		home["troops"] = int(home["troops"]) + int(a["troops"])
	region()["armies"].erase(a)


## Un señor llega a uno de tus pueblos: puedes acudir a defenderlo en persona.
static func _ask_defense(a: Dictionary, t: Dictionary) -> void:
	a["asked"] = true
	a["waiting"] = true
	var lname := NOBLES.full(region()["lords"][int(a["lord"])])
	var aid := int(a["id"])
	var tid := int(t["id"])
	var wall: int = int(GS.data["tier"]) if t.get("home", false) else int(t["wall"])
	GS.popups.append({"title": "¡%s, atacado!" % t["name"], "text": "El ejército de %s (%d soldados) está a las puertas de %s.\n\nPuedes acudir a defenderlo tú mismo desde sus murallas, con tu ejército, la gente del pueblo y sus balistas, o dejar que se defiendan solos." % [lname, int(a["troops"]), t["name"]], "options": [
		["Acudir a defender %s" % t["name"], func():
			var arm := army_by_id(aid)
			if arm.is_empty():
				return
			GS.data["battle"] = {"kind": "defensa", "army": aid, "town": tid, "enemy": lname, "troops": int(arm["troops"]), "wall": wall}
			GS.save_game()
			Engine.get_main_loop().root.get_node("Main").start_battle()],
		["Dejar que se defiendan solos", func():
			var arm := army_by_id(aid)
			if not arm.is_empty():
				arm.erase("waiting")
				_assault(arm, town(tid))],
	]})


## Un ejército llega a su objetivo: se resuelve el asalto.
static func _assault(a: Dictionary, t: Dictionary) -> void:
	var d = GS.data
	var reg := region()
	var lname := NOBLES.full(reg["lords"][int(a["lord"])])
	var defense := 0.0
	if t.get("home", false):
		var party := Vector2(reg["party"][0], reg["party"][1])
		var eng: Dictionary = d.get("engines", {})
		defense = (GS.ARMY.total() if party.distance_to(home()) < 30 else 0) + int(d["commons"]) * 0.05 + int(d["tier"]) * 12 + int(eng.get("balista", 0)) * 8 + int(eng.get("catapulta", 0)) * 10
	elif t["owner"] == "jugador":
		defense = int(t["garrison"]) * 1.2 * (1.0 + 0.25 * int(t["wall"])) + int(t["pop"]) * 0.02 + int(t.get("towers", 0)) * 10
	else:
		defense = int(t["troops"]) * (1.0 + 0.25 * int(t["wall"]))
	var att := int(a["troops"]) * randf_range(0.8, 1.2)
	var dfn := defense * randf_range(0.8, 1.2)
	reg["armies"].erase(a)
	if att > dfn:
		var survivors := int(int(a["troops"]) * clampf(1.0 - dfn / maxf(att, 1.0) * 0.7, 0.2, 0.9))
		if t.get("home", false):
			var lost_gold := int(int(d["gold"]) * 0.3)
			d["gold"] = int(d["gold"]) - lost_gold
			d["commons"] = int(int(d["commons"]) * 0.9)
			GS.popups.append({"title": "¡Saqueo!", "text": "El ejército de %s ha asaltado %s.\nSe llevan %d de oro y muere o huye parte de la gente." % [lname, t["name"], lost_gold], "button": "Continuar"})
			GS.say("%s saquea %s." % [lname, t["name"]])
			var back := town(int(a["home"]))
			if not back.is_empty():
				back["troops"] = int(back["troops"]) + survivors
		else:
			var was_mine: bool = t["owner"] == "jugador"
			var old_lord: int = -1 if was_mine else int(t["lord"])
			# Un señor que ya tiene muchos pueblos no puede gobernar más: solo saquea.
			if not was_mine and lord_towns(int(a["lord"])).size() >= 6:
				t["troops"] = maxi(2, int(int(t["troops"]) * 0.3))
				t["gold"] = int(t["gold"]) / 2
				t["pop"] = int(int(t["pop"]) * 0.85)
				var back2 := town(int(a["home"]))
				if not back2.is_empty():
					back2["troops"] = int(back2["troops"]) + survivors
				GS.say("%s saquea %s, pero no puede quedárselo." % [lname, t["name"]])
				return
			t["owner"] = "señor"
			t["lord"] = int(a["lord"])
			t["vassal"] = false
			t["garrison"] = 0
			t["troops"] = survivors
			if was_mine:
				var gov := governor_of(int(t["id"]))
				var extra := ""
				if gov != "":
					for c in GS.data["children"]:
						if c["name"] == gov:
							c["role"] = ""
					extra = "\nTu %s %s, que lo gobernaba, consigue huir y vuelve a casa." % ["hijo" if _child(gov)["male"] else "hija", gov]
				GS.popups.append({"title": "Pueblo perdido", "text": "%s ha conquistado tu pueblo de %s.%s" % [lname, t["name"], extra], "button": "Continuar"})
			GS.say("%s conquista %s." % [lname, t["name"]])
			if old_lord >= 0 and lord_towns(old_lord).is_empty():
				reg["wars"] = reg["wars"].filter(func(w): return int(w[0]) != old_lord and int(w[1]) != old_lord)
				GS.say("%s ha perdido todas sus tierras y se retira a un monasterio." % NOBLES.full(reg["lords"][old_lord]))
	else:
		var loss := int(att * 0.5)
		if t.get("home", false):
			GS.say("¡%s resiste el asalto de %s!" % [t["name"], lname])
		elif t["owner"] == "jugador":
			t["garrison"] = maxi(0, int(t["garrison"]) - loss / 2)
			GS.say("Tu pueblo de %s rechaza el ataque de %s." % [t["name"], lname])
		else:
			t["troops"] = maxi(2, int(t["troops"]) - loss)
			GS.say("%s rechaza el ataque de %s." % [t["name"], lname])


## El jugador derrota a un ejército en campo abierto.
static func army_defeated(id: int) -> int:
	var reg := region()
	for a in reg["armies"]:
		if int(a["id"]) == id:
			var loot := int(a["troops"]) * 3
			reg["armies"].erase(a)
			GS.data["gold"] = int(GS.data["gold"]) + loot
			return loot
	return 0


static func army_by_id(id: int) -> Dictionary:
	for a in region()["armies"]:
		if int(a["id"]) == id:
			return a
	return {}


# ---------------- Comercio ----------------

static func _move_caravans() -> void:
	var reg := region()
	for c in reg["caravans"].duplicate():
		var t := town(int(c["to"]))
		if t.is_empty():
			reg["caravans"].erase(c)
			continue
		var to := Vector2(t["x"], t["z"]) - Vector2(c["x"], c["z"])
		if to.length() <= DAY_DIST * 0.7:
			t["gold"] = int(t.get("gold", 0)) + 25
			reg["caravans"].erase(c)
		else:
			var step := to.normalized() * DAY_DIST * 0.7
			c["x"] = float(c["x"]) + step.x
			c["z"] = float(c["z"]) + step.y
	if reg["caravans"].size() < 6 and randf() < 0.6:
		var towns: Array = reg["towns"]
		var a = towns.pick_random()
		var b = towns.pick_random()
		if a != b:
			var sa := -1 if a["owner"] == "jugador" else int(a["lord"])
			var sb := -1 if b["owner"] == "jugador" else int(b["lord"])
			if not NOBLES.at_war(sa, sb):
				reg["caravans"].append({"from": int(a["id"]), "to": int(b["id"]), "x": float(a["x"]), "z": float(a["z"])})
	for t in reg["towns"]:
		if t.has("market"):
			var m: Dictionary = t["market"]["mult"]
			for k in m.keys():
				m[k] = lerpf(float(m[k]), 1.0, 0.05)


## Precio de un producto en el mercado de un pueblo (para comprar o vender).
static func market_price(t: Dictionary, k: String, buying: bool) -> int:
	var base := float(GS.SIM.price(k))
	var mk: Dictionary = t["market"]
	var f := 1.0
	if k in mk["spec"]:
		f = 0.6
	elif k in mk["want"]:
		f = 1.7
	f *= float(mk["mult"].get(k, 1.0))
	var p := base * f * (1.15 if buying else 0.9)
	return maxi(1, int(round(p)))


static func market_trade(t: Dictionary, k: String, n: int, buying: bool) -> void:
	var mk: Dictionary = t["market"]["mult"]
	mk[k] = clampf(float(mk.get(k, 1.0)) + (0.03 if buying else -0.03) * n, 0.4, 2.5)


static func year() -> void:
	if GS.data.has("region"):
		NOBLES.year()
		_new_sites()


## Gente sin señor ocupa un lugar libre y funda su propio señorío.
static func _settlers() -> void:
	var free := ai_free_sites()
	if free.is_empty() or randf() > 0.2:
		return
	var ni := NOBLES.new_house()
	if ni == -1:
		return
	var reg := region()
	var si: int = free.pick_random()
	var name := _free_name(reg["towns"].map(func(t): return t["name"]))
	reg["towns"].append(_town(_next_id(), name, reg["sites"][si][0], reg["sites"][si][1], ni, 35))
	GS.say("Unos colonos fundan %s y forman un señorío nuevo: %s." % [name, NOBLES.full(reg["lords"][ni])])


## Cada año aparecen lugares nuevos donde asentarse: el mapa nunca se llena.
static func _new_sites() -> void:
	var reg := region()
	var added := 0
	for tries in 300:
		if added >= 2:
			break
		var p := Vector2(randf_range(20, size() - 20), randf_range(20, size() - 20))
		if p.distance_to(home()) < 40:
			continue
		if reg["sites"].any(func(s): return Vector2(s[0], s[1]).distance_to(p) < 32):
			continue
		if reg["towns"].any(func(t): return Vector2(t["x"], t["z"]).distance_to(p) < 32):
			continue
		reg["sites"].append([p.x, p.y])
		added += 1
