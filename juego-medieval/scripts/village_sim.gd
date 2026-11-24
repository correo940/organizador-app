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


static func ensure() -> void:
	var d = GS.data
	for v in d["villagers"]:
		setup(v)
	if not d.has("lands"):
		d["lands"] = []
		for i in LANDS.size():
			d["lands"].append({"open": false, "owner": "", "since": 0, "built": 0})
	if not d.has("player_land"):
		d["player_land"] = -1
	if not d.has("prosperity"):
		d["prosperity"] = 50


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
		var fed := _eat(v, 1)
		if not fed:
			for k in ["pan", "pescado", "carne", "zanahoria", "manzana", "queso"]:
				_acquire(v, k, 2)
				if _eat(v, 1):
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
	_update_prosperity(produced)
	_lands_and_settlers()


static func _update_prosperity(produced: float) -> void:
	var d = GS.data
	var wealth := 0
	var mood := 0
	for v in d["villagers"]:
		wealth += int(v["gold"])
		mood += int(v["mood"])
	var pop: int = d["villagers"].size()
	var target: float = wealth / 14.0 + pop * 5.0 + d["buildings"].size() * 8.0 + (mood / maxf(pop, 1)) / 2.0 + produced / 6.0
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
			var p: Vector2 = LANDS[i]
			var v := GS.new_villager(p / 0.05)
			setup(v)
			v["gold"] = randi_range(20, 40)
			d["villagers"].append(v)
			l["owner"] = v["name"]
			l["built"] = int(d["total_days"]) + 2
			GS.say("Llegan forasteros: %s (%s) compra un terreno y se instala en el pueblo." % [v["name"], job_name(v).to_lower()])
			break


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
				GS.say("%s deja de ser %s y se hace %s." % [v["name"], old.to_lower(), job_name(v).to_lower()])


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
