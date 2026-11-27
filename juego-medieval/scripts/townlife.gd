extends RefCounted
## Trabajo y economía del pueblo: gremios (privilegios o huelgas), día de mercado semanal,
## obras públicas que se ven avanzar, y molino de viento y cantera que dan trabajo.

const GUILDS := {
	"artesanos": {"name": "Gremio de artesanos", "jobs": ["tejedor", "herrero", "carpintero", "curtidor", "sastre", "alfarero"]},
	"labriegos": {"name": "Gremio de labriegos", "jobs": ["agricultor", "pastor", "apicultor"]},
	"canteros": {"name": "Gremio de canteros y leñadores", "jobs": ["cantero", "minero", "leñador", "carbonero"]},
	"vituallas": {"name": "Gremio de panaderos y taberneros", "jobs": ["molinero", "panadero", "cervecero", "quesero", "tabernero"]},
}
const WORKS := {
	"empedrado": {"name": "Empedrar las calles", "cost": {"piedra": 80, "oro": 40}, "days": 6, "desc": "Calles limpias: el pueblo está más contento."},
	"fuente": {"name": "Fuente pública", "cost": {"piedra": 50, "madera": 20, "oro": 30}, "days": 5, "desc": "Agua limpia: +1 de salud al día y los incendios se apagan antes."},
	"puente": {"name": "Puente de piedra", "cost": {"piedra": 100, "madera": 30, "oro": 60}, "days": 8, "desc": "Llegan más mercaderes: vendes un 5% más caro en el mercado."},
	"murallas": {"name": "Murallas del pueblo", "cost": {"piedra": 200, "oro": 100}, "days": 12, "desc": "Tu pueblo resiste mucho mejor los asaltos (+30 de defensa)."},
}


static func _g() -> Dictionary:
	if not GS.data.has("guilds"):
		GS.data["guilds"] = {}
	return GS.data["guilds"]


static func guild_of(job: String) -> String:
	for g in GUILDS:
		if job in GUILDS[g]["jobs"]:
			return g
	return ""


static func members(g: String) -> int:
	return GS.data["villagers"].filter(func(v): return v["job"] in GUILDS[g]["jobs"]).size()


## Multiplicador de producción de un oficio: privilegios, huelgas, molino y cantera.
static func job_mult(job: String) -> float:
	var d = GS.data
	var g := guild_of(job)
	var m := 1.0
	if g != "":
		var st: Dictionary = _g().get(g, {})
		if int(st.get("strike", -1)) >= int(d["total_days"]):
			return 0.0
		if st.get("priv", false):
			m *= 1.25
	var boost := 1.3 + 0.2 * int(d["tier"])
	if job == "panadero" and GS.has_building("molino"):
		m *= boost
	if job in ["cantero", "minero"] and GS.has_building("cantera"):
		m *= boost
	return m


static func guilds_text() -> String:
	var lines := []
	for g in GUILDS:
		var n := members(g)
		var st: Dictionary = _g().get(g, {})
		var state := "sin gremio (hacen falta 2 oficiales)" if n < 2 else ("en huelga" if int(st.get("strike", -1)) >= int(GS.data["total_days"]) else ("con privilegios (+25% de producción)" if st.get("priv", false) else "sin privilegios"))
		lines.append("%s: %d miembros · %s" % [GUILDS[g]["name"], n, state])
	return "\n".join(lines)


static func guild_options(v) -> Array:
	var d = GS.data
	var opts := []
	for g in GUILDS:
		var st: Dictionary = _g().get(g, {})
		if members(g) >= 2 and not st.get("priv", false):
			opts.append(["Conceder privilegios al %s (60 oro)" % GUILDS[g]["name"].to_lower(), func():
				d["gold"] = int(d["gold"]) - 60
				_g()[g] = {"priv": true, "refused": 0}
				for vv in d["villagers"]:
					if guild_of(vv["job"]) == g:
						vv["mood"] = mini(100, int(vv["mood"]) + 15)
				GS.say("Concedes privilegios al %s. Trabajarán con más ganas." % GUILDS[g]["name"].to_lower())
				v._close_panel(), int(d["gold"]) >= 60])
	return opts


## Cada estación, un gremio sin privilegios puede pedirlos; si se les niega dos veces, hacen huelga.
static func guild_season() -> void:
	var d = GS.data
	if int(d["title"]) < 1:
		return
	for g in GUILDS:
		var st: Dictionary = _g().get(g, {"priv": false, "refused": 0})
		_g()[g] = st
		if members(g) < 2 or st.get("priv", false) or randf() > 0.25:
			continue
		GS.popups.append({"title": "Petición del %s" % GUILDS[g]["name"].to_lower(), "text": "Los maestros del %s piden al jefe del pueblo privilegios: exención de algunos impuestos y el monopolio de su oficio. A cambio prometen trabajar más y mejor." % GUILDS[g]["name"].to_lower(), "options": [
			["Concederlos (60 oro)", func():
				d["gold"] = maxi(0, int(d["gold"]) - 60)
				st["priv"] = true
				GS.say("El %s recibe sus privilegios." % GUILDS[g]["name"].to_lower())],
			["Negarlos", func():
				st["refused"] = int(st.get("refused", 0)) + 1
				if int(st["refused"]) >= 2:
					st["strike"] = int(d["total_days"]) + 5
					st["refused"] = 0
					GS.popups.append({"title": "¡Huelga!", "text": "El %s se declara en huelga: durante 5 días no trabajarán." % GUILDS[g]["name"].to_lower(), "button": "Continuar"})
				else:
					GS.say("El %s se marcha descontento." % GUILDS[g]["name"].to_lower())],
		]})


# ---------------- Día de mercado ----------------

static func market_day() -> bool:
	return int(GS.data["total_days"]) % 7 == 3


## Precios del mercado del pueblo: el día de mercado se vende más caro y se compra más barato.
static func sell_mult() -> float:
	return (1.2 if market_day() else 1.0) * (1.05 if "puente" in works_done() else 1.0)


static func buy_mult() -> float:
	return 0.85 if market_day() else 1.0


# ---------------- Obras públicas ----------------

static func _w() -> Dictionary:
	if not GS.data.has("works"):
		GS.data["works"] = {"done": [], "current": null}
	return GS.data["works"]


static func works_done() -> Array:
	return _w()["done"]


static func current_work() -> Variant:
	return _w()["current"]


static func works_panel(v) -> void:
	var d = GS.data
	var cur = current_work()
	var lines := ["Las obras las hacen los vecinos durante varios días; verás el andamio en la plaza.", ""]
	var opts := []
	for k in WORKS:
		var w: Dictionary = WORKS[k]
		var state := "terminada" if k in works_done() else ("en obras: faltan %d días" % int(cur["left"]) if cur != null and cur["id"] == k else GS.cost_text(w["cost"]) + ", %d días" % int(w["days"]))
		lines.append("%s — %s (%s)" % [w["name"], w["desc"], state])
		if not k in works_done() and cur == null:
			opts.append(["Encargar: %s" % w["name"], func():
				GS.pay(w["cost"])
				_w()["current"] = {"id": k, "left": int(w["days"])}
				GS.say("Empiezan las obras: %s." % w["name"].to_lower())
				works_panel(v), GS.can_pay(w["cost"])])
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Obras públicas", "\n".join(lines), opts)


static func day() -> void:
	var d = GS.data
	var cur = current_work()
	if cur != null:
		cur["left"] = int(cur["left"]) - 1
		if int(cur["left"]) <= 0:
			works_done().append(cur["id"])
			_w()["current"] = null
			d["prestige"] += 15
			for vv in d["villagers"]:
				vv["mood"] = mini(100, int(vv["mood"]) + (15 if cur["id"] == "empedrado" else 5))
			GS.chronicle("Se terminan las obras: %s." % WORKS[cur["id"]]["name"].to_lower())
			GS.popups.append({"title": "Obra terminada", "text": "¡%s! Todo el pueblo lo celebra. (+15 prestigio)\n%s" % [WORKS[cur["id"]]["name"], WORKS[cur["id"]]["desc"]], "button": "Continuar"})
	if "fuente" in works_done():
		d["player"]["health"] = minf(100.0, float(d["player"]["health"]) + 1.0)
	if "empedrado" in works_done() and randf() < 0.2:
		var v = d["villagers"].pick_random() if not d["villagers"].is_empty() else null
		if v != null:
			v["mood"] = mini(100, int(v["mood"]) + 2)
