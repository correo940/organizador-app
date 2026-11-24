extends RefCounted
## Vida económica de los aldeanos: oficios, producción, consumo, comercio entre ellos,
## prosperidad del pueblo, terrenos nuevos y llegada de forasteros.

const JOBS := {
	"leñador": {"m": "Leñador", "f": "Leñadora", "out": {"madera": 3.0}},
	"cantero": {"m": "Cantero", "f": "Cantera", "out": {"piedra": 3.0}},
	"agricultor": {"m": "Agricultor", "f": "Agricultora", "out": {"trigo": 3.0, "zanahoria": 2.0}, "no_winter": true},
	"pescador": {"m": "Pescador", "f": "Pescadora", "out": {"pescado": 2.0}},
	"cazador": {"m": "Cazador", "f": "Cazadora", "out": {"carne": 1.0, "cuero": 0.3}},
	"pastor": {"m": "Pastor", "f": "Pastora", "out": {"lana": 1.0, "leche": 2.0}},
	"minero": {"m": "Minero", "f": "Minera", "out": {"hierro": 1.0, "piedra": 1.0}},
	"panadero": {"m": "Panadero", "f": "Panadera", "in": {"trigo": 2}, "out": {"pan": 3.0}},
	"tejedor": {"m": "Tejedor", "f": "Tejedora", "in": {"lana": 2}, "out": {"tela": 1.0}},
	"herrero": {"m": "Herrero", "f": "Herrera", "in": {"hierro": 2, "madera": 1}, "out": {"herramientas": 1.0}},
}
## Terrenos del barrio nuevo (metros) y prosperidad necesaria para que se abran.
const LANDS := [Vector2(30, 88), Vector2(48, 88), Vector2(66, 88), Vector2(84, 88), Vector2(102, 88), Vector2(14, 86)]
const LAND_THRESH := [110, 170, 240, 320, 410, 510]
const TOOL_DAYS := 20


static func land_price(i: int) -> int:
	return 80 + 40 * i


static func job_name(v: Dictionary) -> String:
	return JOBS[v["job"]]["m" if v["male"] else "f"]


static func price(k: String) -> int:
	if k == "madera" or k == "piedra":
		return 1
	return int(GS.ITEMS[k][1])


static func edible(k: String) -> bool:
	return GS.ITEMS.has(k) and int(GS.ITEMS[k][2]) > 0


static func vinv(v: Dictionary, k: String) -> int:
	return int(v["inv"].get(k, 0))


static func vadd(v: Dictionary, k: String, n: int) -> void:
	v["inv"][k] = vinv(v, k) + n
	if v["inv"][k] <= 0:
		v["inv"].erase(k)


## Lo que un aldeano quiere conservar de cada cosa (lo demás lo vende).
static func keep(v: Dictionary, k: String) -> int:
	var j = JOBS[v["job"]]
	if j.has("in") and j["in"].has(k):
		return int(j["in"][k]) * 3
	if edible(k):
		return 6
	if k == "herramientas":
		return 1
	return 0


## Cosas que el aldeano compraría ahora mismo (para comerciar con el jugador).
static func wants(v: Dictionary) -> Dictionary:
	var w := {}
	var j = JOBS[v["job"]]
	if j.has("in"):
		for k in j["in"]:
			var need: int = int(j["in"][k]) * 3 - vinv(v, k)
			if need > 0:
				w[k] = need
	var food := 0
	for k in v["inv"]:
		if edible(k):
			food += vinv(v, k) * int(GS.ITEMS[k][2])
	if food < 5:
		for k in ["pan", "queso", "carne", "pescado", "manzana", "zanahoria"]:
			w[k] = 3
	if int(v.get("tools", 0)) <= 0 and vinv(v, "herramientas") == 0:
		w["herramientas"] = 1
	if int(v["gold"]) > 50:
		for k in ["cerveza", "tela", "miel", "queso"]:
			if not w.has(k):
				w[k] = 1
	return w


static func setup(v: Dictionary) -> void:
	if not v.has("job"):
		v["job"] = JOBS.keys().pick_random()
	if not v.has("gold"):
		v["gold"] = randi_range(8, 20)
	if not v.has("inv"):
		v["inv"] = {"pan": 3, "zanahoria": 3}
	if not v.has("acc"):
		v["acc"] = {}
	if not v.has("mood"):
		v["mood"] = 60
	if not v.has("tools"):
		v["tools"] = randi_range(0, TOOL_DAYS)
	if not v.has("kids"):
		v["kids"] = []


static func ensure() -> void:
	var d = GS.data
	var seen := [d["player"]["name"]] if d.has("player") else []
	if d.get("spouse") != null:
		seen.append(d["spouse"]["name"])
	for c in d.get("children", []):
		seen.append(c["name"])
	for v in d["villagers"]:
		setup(v)
		# Partidas antiguas: nombres repetidos y aldeanos sin apellido.
		if v["name"] in seen:
			v["name"] = GS.rng_name(v["male"])
		seen.append(v["name"])
		if v.get("surname", "") == "":
			v["surname"] = GS.rng_surname()
	if not d.has("lands"):
		d["lands"] = []
		for i in LANDS.size():
			d["lands"].append({"open": false, "owner": "", "since": 0, "built": 0})
	if not d.has("player_land"):
		d["player_land"] = -1
	if not d.has("prosperity"):
		d["prosperity"] = 50
	if not d.has("commons"):
		d["commons"] = 0
	if not d.has("tier"):
		d["tier"] = 0
	if not d.has("town"):
		d["town"] = TOWN_NAMES.pick_random()


# ---------------- Comercio entre aldeanos ----------------

## El aldeano 'v' intenta conseguir 'n' unidades de 'k' comprándolas a vecinos o a mercaderes.
static func _acquire(v: Dictionary, k: String, n: int) -> void:
	for s in GS.data["villagers"]:
		if n <= 0:
			return
		if is_same(s, v):
			continue
		var spare: int = vinv(s, k) - keep(s, k)
		if spare <= 0:
			continue
		var q: int = mini(spare, n)
		q = mini(q, int(v["gold"]) / maxi(price(k), 1))
		if q <= 0:
			return
		vadd(s, k, -q)
		vadd(v, k, q)
		v["gold"] -= q * price(k)
		s["gold"] += q * price(k)
		n -= q
	# Lo que falte, a un mercader de fuera más caro.
	var p := int(ceil(price(k) * 1.4))
	var q2: int = mini(n, int(v["gold"]) / maxi(p, 1))
	if q2 > 0:
		vadd(v, k, q2)
		v["gold"] -= q2 * p


static func _eat(v: Dictionary, need: int) -> bool:
	for k in GS.EAT_ORDER:
		while need > 0 and vinv(v, k) > 0:
			vadd(v, k, -1)
			need -= int(GS.ITEMS[k][2])
	return need <= 0


## Un día de vida del pueblo.
static func day() -> void:
	var d = GS.data
	var vil: Array = d["villagers"]
	var winter := int(d["season"]) == 3
	var produced := 0.0
	var order := vil.duplicate()
	order.shuffle()
	for v in order:
		var j = JOBS[v["job"]]
		var mult := 1.0 + (0.5 if int(v["tools"]) > 0 else 0.0)
		if j.get("no_winter", false) and winter:
			mult = 0.0
		if winter and v["job"] == "pastor":
			mult *= 0.5
		v["tools"] = maxi(0, int(v["tools"]) - 1)
		var batches := 2
		if j.has("in"):
			for k in j["in"]:
				_acquire(v, k, int(j["in"][k]) * 2 - vinv(v, k))
			for k in j["in"]:
				batches = mini(batches, vinv(v, k) / int(j["in"][k]))
			for k in j["in"]:
				vadd(v, k, -int(j["in"][k]) * batches)
		for k in j["out"]:
			var amount: float = float(j["out"][k]) * mult
			if j.has("in"):
				amount = float(j["out"][k]) * batches * (1.5 if int(v["tools"]) > 0 else 1.0)
			var acc: float = float(v["acc"].get(k, 0.0)) + amount
			var whole := int(floor(acc))
			v["acc"][k] = acc - whole
			vadd(v, k, whole)
			produced += whole * price(k)
	for v in vil:
		var mouths: int = 1 + v["kids"].size()
		var fed := _eat(v, mouths)
		if not fed:
			for k in ["pan", "pescado", "carne", "zanahoria", "manzana", "queso"]:
				_acquire(v, k, 2 * mouths)
				if _eat(v, mouths):
					fed = true
					break
		v["mood"] = clampi(int(v["mood"]) + (2 if fed else -10), 0, 100)
	for v in vil:
		# Herramientas: se gastan y se compran al herrero.
		if int(v["tools"]) <= 0:
			if vinv(v, "herramientas") == 0:
				_acquire(v, "herramientas", 1)
			if vinv(v, "herramientas") > 0:
				vadd(v, "herramientas", -1)
				v["tools"] = TOOL_DAYS
		# Lo que sobra se vende a los mercaderes que pasan por el pueblo.
		for k in v["inv"].keys():
			var extra: int = vinv(v, k) - keep(v, k) - (4 if edible(k) else 0)
			if extra > 0:
				vadd(v, k, -extra)
				v["gold"] += int(extra * price(k) * 0.8)
		# Los que van sobrados se dan caprichos: el oro circula por el pueblo.
		if int(v["gold"]) > 70:
			var other = vil.pick_random()
			if not is_same(other, v):
				v["gold"] -= 6
				other["gold"] += 6
				v["mood"] = mini(100, int(v["mood"]) + 2)
	_social()
	_update_prosperity(produced)
	_grow_commons()
	_lands_and_settlers()


static func _update_prosperity(produced: float) -> void:
	var d = GS.data
	var wealth := 0
	var mood := 0
	for v in d["villagers"]:
		wealth += int(v["gold"])
		mood += int(v["mood"])
	var pop: int = d["villagers"].size()
	var target: float = wealth / 14.0 + pop * 5.0 + int(d["commons"]) / 4.0 + d["buildings"].size() * 8.0 + (mood / maxf(pop, 1)) / 2.0 + produced / 6.0
	d["prosperity"] = int(lerpf(float(d["prosperity"]), target, 0.25))


static func _lands_and_settlers() -> void:
	var d = GS.data
	var lands: Array = d["lands"]
	for i in lands.size():
		var l = lands[i]
		if not l["open"]:
			if int(d["prosperity"]) >= LAND_THRESH[i]:
				l["open"] = true
				l["since"] = int(d["total_days"])
				GS.say("El pueblo prospera: se ha abierto un terreno nuevo al sur (%d oro)." % land_price(i))
			break
	for i in lands.size():
		var l = lands[i]
		if l["open"] and l["owner"] == "" and int(d["total_days"]) - int(l["since"]) >= 6 and randf() < 0.12:
			_settle_family(i)
			break


## Llega una familia de fuera: un matrimonio y de 0 a 3 hijos.
static func _settle_family(i: int) -> void:
	var d = GS.data
	var home: Vector2 = LANDS[i] / 0.05
	var a := GS.new_villager(home)
	a["male"] = true
	a["name"] = GS.rng_name(true)
	a["gold"] = randi_range(20, 40)
	d["villagers"].append(a)
	var b := GS.new_villager(home)
	b["male"] = false
	b["name"] = GS.rng_name(false)
	b["surname"] = a["surname"]
	b["age"] = clampi(int(a["age"]) + randi_range(-5, 3), 17, 40)
	b["gold"] = randi_range(10, 25)
	a["partner"] = b["name"]
	b["partner"] = a["name"]
	d["villagers"].append(b)
	var kids := []
	for n in randi_range(0, 3):
		var m := randf() < 0.5
		var k := {"name": GS.rng_name(m), "male": m, "age": randi_range(1, 13)}
		a["kids"].append(k)
		kids.append(k["name"])
	d["lands"][i]["owner"] = "familia " + a["surname"]
	d["lands"][i]["built"] = int(d["total_days"]) + 2
	var text := "Llega la familia %s: %s (%s) y %s (%s)" % [a["surname"], a["name"], job_name(a).to_lower(), b["name"], job_name(b).to_lower()]
	if not kids.is_empty():
		text += ", con %s %s" % ["su hijo" if kids.size() == 1 else "sus hijos", ", ".join(kids)]
	GS.say(text + ". Compran un terreno y se instalan en el pueblo.")


## Cada año crecen los hijos de los aldeanos; a los 16 empiezan a trabajar.
static func year() -> void:
	var d = GS.data
	_old_age()
	var grown := []
	for v in d["villagers"]:
		for k in v["kids"].duplicate():
			k["age"] += 1
			if int(k["age"]) >= 16:
				v["kids"].erase(k)
				grown.append([k, v])
	for g in grown:
		var k = g[0]
		var parent = g[1]
		var nv := GS.new_villager(Vector2(parent["hx"], parent["hy"]))
		nv["name"] = k["name"]
		nv["male"] = k["male"]
		nv["age"] = k["age"]
		nv["surname"] = parent["surname"]
		nv["gold"] = 5
		d["villagers"].append(nv)
		GS.say("%s %s se hace mayor y empieza a trabajar como %s." % [nv["name"], nv["surname"], job_name(nv).to_lower()])


## Cada estación, quien va mal cambia de oficio hacia lo que más escasea.
static func season() -> void:
	var stock := {}
	for v in GS.data["villagers"]:
		for k in JOBS[v["job"]]["out"]:
			stock[k] = int(stock.get(k, 0)) + 1
	for v in GS.data["villagers"]:
		if int(v["gold"]) < 6 and int(v["mood"]) < 45 and randf() < 0.5:
			var best: String = v["job"]
			var best_n := 999
			for j in JOBS:
				var n := 0
				for k in JOBS[j]["out"]:
					n += int(stock.get(k, 0))
				if n < best_n:
					best_n = n
					best = j
			if best != v["job"]:
				var old := job_name(v)
				v["job"] = best
				GS.say("%s deja de ser %s y se hace %s." % [GS.full_name(v), old.to_lower(), job_name(v).to_lower()])


static func buy_land(i: int) -> String:
	var d = GS.data
	var l = d["lands"][i]
	if not l["open"] or l["owner"] != "":
		return "Ese terreno no está a la venta."
	if int(d["gold"]) < land_price(i):
		return "Necesitas %d de oro." % land_price(i)
	d["gold"] -= land_price(i)
	l["owner"] = "jugador"
	d["prestige"] += 10
	GS.say("Has comprado un terreno grande en el barrio nuevo. (+10 prestigio)")
	return ""


# ---------------- Vida social: noviazgos, bodas, nacimientos y vejez ----------------

const MAX_POP := 40
const MAX_KIDS := 4


static func by_name(n: String) -> Variant:
	for v in GS.data["villagers"]:
		if v["name"] == n:
			return v
	return null


static func _single(v: Dictionary) -> bool:
	return not v.has("partner") and int(v["age"]) >= 17 and int(v["age"]) <= 45


static func _social() -> void:
	var d = GS.data
	var vil: Array = d["villagers"]
	# Noviazgos que avanzan: boda o ruptura.
	for v in vil:
		if not v.has("suitor") or not v["male"]:
			continue
		var w = by_name(v["suitor"])
		if w == null or not _single(w) or not _single(v):
			v.erase("suitor")
			if w != null:
				w.erase("suitor")
			continue
		v["court"] = int(v.get("court", 0)) + 1
		if int(v["court"]) >= 8 and randf() < 0.12:
			_wedding(v, w)
		elif randf() < 0.015:
			v.erase("suitor")
			w.erase("suitor")
			v.erase("court")
			GS.say("%s y %s lo han dejado." % [v["name"], w["name"]])
	# Nuevos noviazgos entre solteros.
	for v in vil:
		if not v["male"] or not _single(v) or v.has("suitor") or randf() > 0.015:
			continue
		var options := vil.filter(func(w): return not w["male"] and _single(w) and not w.has("suitor") and absi(int(w["age"]) - int(v["age"])) <= 12)
		if options.is_empty():
			continue
		var w = options.pick_random()
		v["suitor"] = w["name"]
		w["suitor"] = v["name"]
		v["court"] = 0
		GS.say("%s %s y %s %s se han hecho novios." % [v["name"], v["surname"], w["name"], w["surname"]])
	# Nacimientos en los matrimonios.
	if _population() < MAX_POP:
		for v in vil:
			if not v["male"] or not v.has("partner"):
				continue
			var w = by_name(v["partner"])
			if w == null or int(w["age"]) > 42 or v["kids"].size() >= MAX_KIDS or randf() > 0.015:
				continue
			var m := randf() < 0.5
			var k := {"name": GS.rng_name(m), "male": m, "age": 0}
			v["kids"].append(k)
			v["mood"] = mini(100, int(v["mood"]) + 15)
			w["mood"] = mini(100, int(w["mood"]) + 15)
			GS.say("¡Ha nacido %s %s, %s de %s y %s!" % [k["name"], v["surname"], "hijo" if m else "hija", v["name"], w["name"]])


static func _population() -> int:
	var n := 0
	for v in GS.data["villagers"]:
		n += 1 + v["kids"].size()
	return n


static func _wedding(v: Dictionary, w: Dictionary) -> void:
	for x in [v, w]:
		x.erase("suitor")
		x.erase("court")
		x["mood"] = mini(100, int(x["mood"]) + 20)
	v["partner"] = w["name"]
	w["partner"] = v["name"]
	# La pareja vive en casa de él.
	w["hx"] = v["hx"]
	w["hy"] = v["hy"]
	GS.say("¡Boda en el pueblo! %s %s y %s %s se casan." % [v["name"], v["surname"], w["name"], w["surname"]])
	if int(w["affection"]) >= 50 and GS.data["spouse"] == null:
		GS.say("%s, a quien tanto apreciabas, ya no está libre." % w["name"])


static func _old_age() -> void:
	var d = GS.data
	for v in d["villagers"].duplicate():
		if int(v["age"]) < 55 or randf() > (int(v["age"]) - 50) * 0.03:
			continue
		d["villagers"].erase(v)
		var p = by_name(v.get("partner", ""))
		if p != null:
			p.erase("partner")
			p["mood"] = maxi(0, int(p["mood"]) - 25)
			p["kids"].append_array(v["kids"])
		elif not v["kids"].is_empty():
			GS.say("Los hijos de %s se van a vivir con parientes de fuera." % v["name"])
		GS.say("Ha fallecido %s %s a los %d años." % [v["name"], v["surname"], int(v["age"])])


# ---------------- Población y crecimiento de aldea a ciudad ----------------

const TIERS := [
	{"name": "Aldea", "cap": 100},
	{"name": "Villa", "cap": 400},
	{"name": "Ciudad", "cap": 1200},
]
const TOWN_NAMES := ["Peñalba", "Valdemora", "Torrecilla", "Fuenterrobles", "Villanueva del Río", "Castrojeriz", "Montealegre", "Robledo", "Arroyofrío", "Navalosa", "Tordesillas", "Peñafiel"]


static func total_pop() -> int:
	var soldiers := 0
	for k in GS.data.get("army", {}):
		soldiers += int(GS.data["army"][k])
	return _population() + int(GS.data["commons"]) + soldiers


static func town_title() -> String:
	return "%s de %s" % [TIERS[int(GS.data["tier"])]["name"], GS.data["town"]]


## Requisitos del siguiente nivel: [población, prosperidad, edificios] o [] si ya es ciudad.
static func next_tier_req() -> Array:
	match int(GS.data["tier"]):
		0:
			return [90, 150, 2]
		1:
			return [360, 400, 5]
	return []


static func next_tier_text() -> String:
	var r := next_tier_req()
	if r.is_empty():
		return "Ya es una ciudad."
	return "Para ser %s: %d habitantes, %d de prosperidad y %d edificios tuyos (tienes %d, %d y %d)." % [TIERS[int(GS.data["tier"]) + 1]["name"].to_lower(), r[0], r[1], r[2], total_pop(), int(GS.data["prosperity"]), GS.data["buildings"].size()]


## Llega gente de fuera según lo atractivo que sea el pueblo y el sitio que quede.
static func _grow_commons() -> void:
	var d = GS.data
	var cap: int = TIERS[int(d["tier"])]["cap"]
	var free := cap - total_pop()
	if free > 0:
		var mood := 0.0
		for v in d["villagers"]:
			mood += int(v["mood"])
		mood /= maxf(d["villagers"].size(), 1)
		var appeal: float = clampf(mood / 60.0, 0.2, 1.6) * (1.0 + d["buildings"].size() * 0.05)
		if int(d["season"]) == 3:
			appeal *= 0.4
		if int(d["taxed"]) == GS.season_index():
			appeal *= 0.8
		var g: float = free * 0.03 * appeal
		var n := int(floor(g)) + (1 if randf() < g - floor(g) else 0)
		d["commons"] = int(d["commons"]) + n
	var r := next_tier_req()
	if not r.is_empty() and total_pop() >= r[0] and int(d["prosperity"]) >= r[1] and d["buildings"].size() >= r[2]:
		d["tier"] = int(d["tier"]) + 1
		var t: int = d["tier"]
		var text := "%s ha crecido tanto que ahora es una %s.\n\n" % [d["town"], TIERS[t]["name"].to_lower()]
		if t == 1:
			text += "Se abre un barrio nuevo al este, se levanta una empalizada, llegan más mercaderes y se construye un cuartel."
		else:
			text += "Se abren barrios al norte, se levantan murallas de piedra y se alza una catedral."
		text += "\nCabe hasta %d habitantes." % int(TIERS[t]["cap"])
		GS.popups.append({"title": "¡%s!" % town_title(), "text": text, "button": "Continuar"})
		GS.say("%s es ahora %s. (+%d prestigio)" % [d["town"], "una villa" if t == 1 else "una ciudad", 40 * t])
		d["prestige"] += 40 * t
