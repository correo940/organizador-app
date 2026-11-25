extends RefCounted
## La Iglesia (devoción, obispo, excomunión y peregrinación al santuario), el clima del mapa
## (nieve en los pasos, crecidas y sequías) y el río navegable con sus barcas.

const R := preload("res://scripts/region_sim.gd")
const N := preload("res://scripts/nobles.gd")


static func ensure() -> void:
	var reg := R.region()
	if reg.is_empty():
		return
	var s: float = R.size()
	if not reg.has("shrine"):
		# El santuario, en un paraje apartado: lo más lejos posible de pueblos y lugares libres.
		var best := Vector2(s * 0.85, s * 0.15)
		var bd := -1.0
		var r0 := RandomNumberGenerator.new()
		r0.seed = int(s) * 13 + 1
		for k in 60:
			var c := Vector2(r0.randf_range(s * 0.1, s * 0.9), r0.randf_range(s * 0.1, s * 0.9))
			var md := INF
			for t in reg["towns"]:
				md = minf(md, c.distance_to(Vector2(t["x"], t["z"])))
			for st in reg["sites"]:
				md = minf(md, c.distance_to(Vector2(st[0], st[1])))
			if md > bd:
				bd = md
				best = c
		reg["shrine"] = [best.x, best.y]
	if not reg.has("river"):
		var pts := []
		var r := RandomNumberGenerator.new()
		r.seed = int(s) * 7 + 3
		for i in 13:
			var x := s * i / 12.0
			pts.append([x, s * 0.35 + s * 0.3 * i / 12.0 + sin(i * 1.3) * s * 0.06 + r.randf_range(-8, 8)])
		reg["river"] = pts
	var d = GS.data
	if not d.has("church"):
		d["church"] = {"devotion": 30, "excommunicated": false, "pilgrim_year": 0}


# ---------------- Iglesia ----------------

static func devotion_add(n: int) -> void:
	ensure()
	var c: Dictionary = GS.data["church"]
	c["devotion"] = clampi(int(c["devotion"]) + n, 0, 100)


static func church_text() -> String:
	ensure()
	var c: Dictionary = GS.data["church"]
	return "Devoción de tu casa: %d/100%s" % [int(c["devotion"]), " · ¡EXCOMULGADO!" if c["excommunicated"] else ""]


## Cada estación: el obispo pide, y si tu devoción es baja y le desafías, te excomulga.
static func season() -> void:
	ensure()
	var d = GS.data
	var c: Dictionary = d["church"]
	if c["excommunicated"]:
		for v in d["villagers"]:
			v["mood"] = maxi(0, int(v["mood"]) - 5)
	if int(d["title"]) < 1 or randf() > 0.12 or int(c.get("bishop_year", 0)) == int(d["year"]):
		return
	c["bishop_year"] = int(d["year"])
	var tithe := 40 + 20 * int(d["tier"])
	GS.popups.append({"title": "El obispo", "text": "El obispo de la región exige a tu casa una contribución de %d de oro para la nueva catedral. (%s)" % [tithe, church_text()], "options": [
		["Pagar (%d oro): +20 devoción" % tithe, func():
			if int(d["gold"]) < tithe:
				_defy()
				return
			d["gold"] = int(d["gold"]) - tithe
			devotion_add(20)
			d["prestige"] += 5
			GS.say("El obispo bendice tu casa desde el púlpito. (+5 prestigio)")],
		["Negarte", _defy],
	]})


static func _defy() -> void:
	var d = GS.data
	var c: Dictionary = d["church"]
	devotion_add(-20)
	if int(c["devotion"]) < 20 and not c["excommunicated"]:
		c["excommunicated"] = true
		d["prestige"] = maxi(0, int(d["prestige"]) - 30)
		for i in R.region()["lords"].size():
			N.add_rel(-1, i, -10)
		GS.chronicle("El obispo excomulga a %s." % d["player"]["name"])
		GS.popups.append({"title": "¡Excomunión!", "text": "El obispo te excomulga. Los señores te dan la espalda y el pueblo murmura cada estación. Solo una penitencia (en la capilla o peregrinando al santuario) lo arreglará. (-30 prestigio)", "button": "Continuar"})
	else:
		GS.say("El obispo se marcha ofendido. (-20 devoción)")


static func penance(v) -> void:
	var d = GS.data
	if int(d["gold"]) < 200:
		v._open_panel("Penitencia", "La penitencia cuesta 200 de oro en limosnas.", [["Cerrar", v._close_panel]])
		return
	d["gold"] = int(d["gold"]) - 200
	d["church"]["excommunicated"] = false
	devotion_add(30)
	GS.chronicle("%s hace penitencia y la Iglesia le perdona." % d["player"]["name"])
	v._open_panel("Penitencia", "Haces penitencia pública y repartes limosnas. El obispo levanta la excomunión.", [["Cerrar", v._close_panel]])


## Peregrinar al santuario (una vez al año): prestigio, salud, devoción y perdón.
static func pilgrimage(v) -> void:
	var d = GS.data
	var c: Dictionary = d["church"]
	if int(c["pilgrim_year"]) == int(d["year"]):
		v._say("Ya has peregrinado este año.")
		return
	c["pilgrim_year"] = int(d["year"])
	d["prestige"] += 25
	d["player"]["health"] = minf(100.0, float(d["player"]["health"]) + 20.0)
	devotion_add(30)
	var text := "Llegas al santuario tras un largo camino, rezas ante las reliquias y duermes en la hospedería de los monjes. (+25 prestigio, +20 salud, +30 devoción)"
	if c["excommunicated"]:
		c["excommunicated"] = false
		text += "\nEl abad te absuelve: se levanta la excomunión."
	var wounds: Array = d["player"].get("wounds", []).filter(func(x): return x != "cicatriz")
	if not wounds.is_empty() and randf() < 0.3:
		d["player"]["wounds"].erase(wounds[0])
		text += "\n¡Milagro! Tu herida sana."
	GS.chronicle("%s peregrina al santuario." % d["player"]["name"])
	v._say(text)


# ---------------- Clima del mapa ----------------

## Cada estación, el clima golpea alguna parte de la región.
static func climate_season() -> void:
	ensure()
	var d = GS.data
	var reg := R.region()
	for t in reg["towns"]:
		t.erase("flooded")
	var s := int(d["season"])
	if s == 0 and randf() < 0.25:
		var river_towns: Array = reg["towns"].filter(func(t): return t.has("pop") and near_river(Vector2(t["x"], t["z"]), 30.0))
		if not river_towns.is_empty():
			var t = river_towns.pick_random()
			t["pop"] = int(int(t["pop"]) * 0.85)
			t["flooded"] = true
			GS.say("Crecida del río: las aguas inundan %s." % t["name"])
			if t["owner"] == "jugador":
				GS.popups.append({"title": "Crecida del río", "text": "El río se ha desbordado e inunda %s: se pierden casas y cosechas." % t["name"], "button": "Continuar"})
	elif s == 1 and randf() < 0.2:
		for t in reg["towns"]:
			if t.has("market"):
				for k in ["trigo", "harina", "pan", "zanahoria"]:
					t["market"]["mult"][k] = maxf(float(t["market"]["mult"].get(k, 1.0)), 1.6)
		GS.say("Sequía en toda la región: el grano se encarece en los mercados.")


## En invierno la nieve cierra los pasos: se avanza más despacio por el mapa.
static func travel_mult() -> float:
	return 0.65 if int(GS.data["season"]) == 3 else 1.0


# ---------------- El río ----------------

static func near_river(p: Vector2, dist: float) -> bool:
	ensure()
	var pts: Array = R.region()["river"]
	for i in pts.size() - 1:
		var a := Vector2(pts[i][0], pts[i][1])
		var b := Vector2(pts[i + 1][0], pts[i + 1][1])
		if Geometry2D.get_closest_point_to_segment(p, a, b).distance_to(p) < dist:
			return true
	return false


## Barca sencilla: casco, mástil y vela.
static func boat(parent: Node, sail: Color) -> Node3D:
	var E := preload("res://scripts/engines.gd")
	var n := Node3D.new()
	parent.add_child(n)
	E._box(n, Vector3(2.0, 0.8, 6.0), Vector3(0, 0.4, 0), Color(0.4, 0.27, 0.15))
	E._box(n, Vector3(1.6, 0.1, 5.4), Vector3(0, 0.82, 0), Color(0.55, 0.4, 0.25))
	E._box(n, Vector3(0.2, 5.0, 0.2), Vector3(0, 3.0, 0.3), Color(0.35, 0.24, 0.13))
	E._box(n, Vector3(3.2, 3.0, 0.08), Vector3(0, 3.6, 0.3), sail)
	return n
