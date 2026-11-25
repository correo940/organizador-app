extends RefCounted
## Vida social del pueblo: favores de los vecinos, el cura de la capilla y las ferias y torneos que organizas.

const FAVOR_ITEMS := ["carne", "pan", "pescado", "lana", "queso", "manzana", "huevos", "leche", "cuero"]


## Cada día, algún vecino puede pedirte un favor; si no lo cumples a tiempo, se disgusta.
static func day() -> void:
	var d = GS.data
	var f = d.get("favor", null)
	if f != null:
		if int(d["total_days"]) > int(f["until"]):
			var v := _villager(f["v"])
			if not v.is_empty():
				v["affection"] = maxi(0, int(v["affection"]) - 10)
			GS.say("No llegaste a tiempo con el encargo de %s. Se ha llevado un disgusto." % f["v"])
			d["favor"] = null
		return
	if d["villagers"].is_empty() or randf() > 0.07:
		return
	var v = d["villagers"].pick_random()
	var item: String = FAVOR_ITEMS.pick_random()
	var n := randi_range(3, 7)
	var reward := int(ceil(GS.ITEMS[item][1] * n * 1.6))
	d["favor"] = {"v": v["name"], "item": item, "n": n, "reward": reward, "until": int(d["total_days"]) + 6}
	GS.say("%s te pide un favor: necesita %d de %s antes de 6 días (+%d oro)." % [v["name"], n, String(GS.ITEMS[item][0]).to_lower(), reward])


static func _villager(n: String) -> Dictionary:
	for v in GS.data["villagers"]:
		if v["name"] == n:
			return v
	return {}


static func favor_text() -> String:
	var f = GS.data.get("favor", null)
	if f == null:
		return ""
	return "Encargo de %s: %d de %s (quedan %d días)" % [f["v"], int(f["n"]), String(GS.ITEMS[f["item"]][0]).to_lower(), maxi(0, int(f["until"]) - int(GS.data["total_days"]))]


## Opción para el panel del vecino si te ha pedido un favor.
static func favor_option(v: Dictionary, refresh: Callable) -> Array:
	var d = GS.data
	var f = d.get("favor", null)
	if f == null or f["v"] != v["name"]:
		return []
	var n := int(f["n"])
	return ["Entregarle el encargo: %d de %s (+%d oro)" % [n, String(GS.ITEMS[f["item"]][0]).to_lower(), int(f["reward"])], func():
		GS.take(f["item"], n)
		d["gold"] = int(d["gold"]) + int(f["reward"])
		v["affection"] = mini(100, int(v["affection"]) + 25)
		d["prestige"] += 2
		d["favor"] = null
		SFX.play("monedas")
		GS.say("Cumples el encargo de %s. Te lo agradece de corazón. (+%d oro)" % [v["name"], int(f["reward"])])
		refresh.call(), GS.inv(f["item"]) >= n]


static func _msg(v, text: String) -> void:
	v._open_panel("", text, [["Continuar", v._close_panel]])


# ---------------- El cura ----------------

static func priest_options(v) -> Array:
	var d = GS.data
	var si := GS.season_index()
	var opts := []
	opts.append(["Pagar el diezmo (20 oro, una vez por estación): +5 prestigio y el pueblo más contento", func():
		d["gold"] = int(d["gold"]) - 20
		d["tithe"] = si
		d["prestige"] += 5
		GS.REALM.devotion_add(10)
		for vv in d["villagers"]:
			vv["mood"] = mini(100, int(vv["mood"]) + 5)
		_msg(v, "El párroco agradece tu generosidad desde el púlpito."), int(d["gold"]) >= 20 and int(d.get("tithe", -1)) != si])
	if d.get("church", {}).get("excommunicated", false):
		opts.append(["Hacer penitencia pública (200 oro): levanta la excomunión", func(): GS.REALM.penance(v)])
	opts.append(["Pedir su bendición para la próxima batalla (10 oro)", func():
		d["gold"] = int(d["gold"]) - 10
		d["blessed"] = true
		_msg(v, "El párroco bendice tu espada. En la próxima batalla tus hombres perderán el ánimo mucho más despacio."), int(d["gold"]) >= 10 and not d.get("blessed", false)])
	opts.append(["Confesarte (una vez por estación): +15 salud", func():
		d["confessed"] = si
		d["player"]["health"] = minf(100.0, float(d["player"]["health"]) + 15.0)
		_msg(v, "Sales de la capilla en paz contigo mismo. (+15 salud)"), int(d.get("confessed", -1)) != si])
	return opts


# ---------------- Feria y torneo del pueblo ----------------

static func hall_options(v) -> Array:
	var d = GS.data
	if int(d["title"]) < 1 or int(d["tier"]) < 1:
		return []
	var y := int(d["year"])
	var opts := []
	opts.append(["Organizar una feria (80 oro, una vez al año)", func():
		d["gold"] = int(d["gold"]) - 80
		d["fair_year"] = y
		d["prestige"] += 15
		d["commons"] = int(d["commons"]) + 8
		for vv in d["villagers"]:
			vv["mood"] = mini(100, int(vv["mood"]) + 15)
		for i in GS.REGION.region()["lords"].size():
			GS.REGION.NOBLES.add_rel(-1, i, 5)
		GS.EVENTS.trigger("mercader")
		_msg(v, "¡Feria en %s! Llegan mercaderes, juglares y gentes de toda la comarca. Algunas familias deciden quedarse. (+15 prestigio, mejora tu relación con los señores)" % d["town"]), int(d["gold"]) >= 80 and int(d.get("fair_year", 0)) != y])
	var lords: Array = GS.REGION.region()["lords"]
	var guests := range(lords.size()).filter(func(i): return not GS.REGION.NOBLES.at_war(-1, i) and not GS.REGION.lord_towns(i).is_empty())
	opts.append(["Organizar un torneo (150 oro, una vez al año) y luchar en él", func():
		d["gold"] = int(d["gold"]) - 150
		d["tourney_year"] = y
		var li: int = guests.pick_random()
		for i in guests:
			GS.REGION.NOBLES.add_rel(-1, i, 5)
		d["prestige"] += 10
		d["battle"] = {"kind": "torneo", "lord": li, "enemy": "el campeón de %s" % GS.REGION.NOBLES.full(GS.REGION.NOBLES.lord(li)), "troops": 1, "wall": 0, "home": true}
		GS.save_game()
		v.main.start_battle(), int(d["gold"]) >= 150 and int(d.get("tourney_year", 0)) != y and not guests.is_empty()])
	return opts
