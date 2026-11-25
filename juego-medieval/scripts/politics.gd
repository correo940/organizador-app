extends RefCounted
## Alta política: coronarte rey, el consejo de tu corte y las intrigas (sobornos, espías, revueltas,
## asesinatos y conspiraciones contra ti).

const R := preload("res://scripts/region_sim.gd")
const N := preload("res://scripts/nobles.gd")
const CROWN_PRESTIGE := 500
const CROWN_TOWNS := 4
const CROWN_GOLD := 300
const COUNCIL := {
	"canciller": "Canciller: +2 de relación con todos los señores cada estación",
	"mariscal": "Mariscal: tus tropas hacen un 10% más de daño",
	"tesorero": "Tesorero: +15% de rentas de tus pueblos",
}


static func is_king() -> bool:
	return GS.data.get("king", false)


static func my_towns() -> Array:
	return R.region()["towns"].filter(func(t): return not t.get("home", false) and (t["owner"] == "jugador" or t.get("vassal", false)))


# ---------------- La corona ----------------

static func crown_text() -> String:
	var d = GS.data
	return "Para coronarte rey necesitas una ciudad, %d pueblos tuyos o vasallos (tienes %d), %d de prestigio (tienes %d) y %d de oro." % [CROWN_TOWNS, my_towns().size(), CROWN_PRESTIGE, int(d["prestige"]), CROWN_GOLD]


static func can_crown() -> bool:
	var d = GS.data
	return not is_king() and int(d["title"]) >= 1 and int(d["tier"]) >= 2 and my_towns().size() >= CROWN_TOWNS and int(d["prestige"]) >= CROWN_PRESTIGE and int(d["gold"]) >= CROWN_GOLD


static func crown() -> void:
	var d = GS.data
	d["gold"] = int(d["gold"]) - CROWN_GOLD
	d["king"] = true
	if not d.has("life"):
		d["life"] = {"since": int(d["year"])}
	d["life"]["crowned"] = true
	d["prestige"] += 100
	var loyal := []
	var rebels := []
	var lords: Array = R.region()["lords"]
	for i in lords.size():
		if R.lord_towns(i).is_empty():
			continue
		if int(lords[i]["rel"]) >= 45 or N.allied(-1, i):
			loyal.append(N.full(lords[i]))
			for t in R.lord_towns(i):
				t["vassal"] = true
			if N.at_war(-1, i):
				N.make_peace(-1, i)
		else:
			rebels.append(N.full(lords[i]))
			if not N.at_war(-1, i):
				N.declare_war(-1, i)
	var text := "En la catedral de %s te ciñen la corona. Ahora eres %s de la región. (+100 prestigio)\n\n" % [d["town"], "rey" if d["player"]["male"] else "reina"]
	text += "Te juran lealtad y te pagarán tributo: %s.\n\n" % (", ".join(loyal) if not loyal.is_empty() else "nadie")
	text += "Se niegan a reconocerte y se alzan en armas: %s." % (", ".join(rebels) if not rebels.is_empty() else "nadie")
	GS.popups.append({"title": "¡Larga vida al rey!" if d["player"]["male"] else "¡Larga vida a la reina!", "text": text, "button": "Continuar"})
	GS.say("Te coronas %s de la región." % ("rey" if d["player"]["male"] else "reina"))
	GS.chronicle("%s se corona %s de la región." % [d["player"]["name"], "rey" if d["player"]["male"] else "reina"])


# ---------------- El consejo ----------------

static func council_of(role: String) -> Dictionary:
	var d = GS.data
	var n: String = d.get("council", {}).get(role, "")
	if n == "":
		return {}
	for c in d["children"]:
		if c["name"] == n and int(c["age"]) >= 16:
			return c
	if d["spouse"] != null and d["spouse"]["name"] == n:
		return d["spouse"]
	return {}


static func has(role: String) -> bool:
	return not council_of(role).is_empty()


static func council_panel(v) -> void:
	var d = GS.data
	if not d.has("council"):
		d["council"] = {}
	var lines := ["Tu consejo de corte: nombra a tu cónyuge o a tus hijos adultos.", ""]
	var opts := []
	var people := []
	if d["spouse"] != null:
		people.append(d["spouse"])
	for c in d["children"]:
		if int(c["age"]) >= 16 and c.get("role", "") == "":
			people.append(c)
	for role in COUNCIL:
		var who := council_of(role)
		lines.append("%s — %s" % [COUNCIL[role], who["name"] if not who.is_empty() else "vacante"])
		for p in people:
			if p["name"] != d["council"].get(role, ""):
				var r: String = role
				var pn: String = p["name"]
				opts.append(["%s: %s" % [role.capitalize(), pn], func():
					for k in d["council"].keys():
						if d["council"][k] == pn:
							d["council"].erase(k)
					d["council"][r] = pn
					council_panel(v)])
	if people.is_empty():
		lines.append("")
		lines.append("No tienes a nadie para el consejo: cásate o espera a que tus hijos crezcan (los que ya son capitanes o gobernadores no cuentan).")
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Consejo", "\n".join(lines), opts)


## Efectos del consejo y conspiraciones contra ti (cada estación).
static func season() -> void:
	var d = GS.data
	if has("canciller"):
		for i in R.region()["lords"].size():
			N.add_rel(-1, i, 2)
	var enemies := 0
	for i in R.region()["lords"].size():
		if N.at_war(-1, i) or int(R.region()["lords"][i]["rel"]) < 25:
			enemies += 1
	if enemies > 0 and int(d["title"]) >= 1 and randf() < 0.05 + 0.02 * enemies:
		_conspiracy()


static func _conspiracy() -> void:
	var d = GS.data
	GS.popups.append({"title": "Una conspiración", "text": "Un criado te susurra que algunos enemigos de tu casa traman algo contra tu familia.", "options": [
		["Pagar a un informador para descubrirlos (50 oro)", func():
			if int(d["gold"]) < 50:
				_plot_strikes()
				return
			d["gold"] = int(d["gold"]) - 50
			d["prestige"] += 5
			GS.say("Tu informador destapa la conspiración. Los culpables huyen de la región. (+5 prestigio)")],
		["Reforzar la guardia y esperar", func():
			if randf() < 0.5:
				GS.say("Pasan las semanas y no ocurre nada. Quizá solo eran rumores.")
			else:
				_plot_strikes()],
	]})


static func _plot_strikes() -> void:
	var d = GS.data
	var adults: Array = d["children"].filter(func(c): return int(c["age"]) >= 12)
	if not adults.is_empty() and randf() < 0.5:
		var c = adults.pick_random()
		d["children"].erase(c)
		GS.popups.append({"title": "Asesinato", "text": "Los conspiradores asesinan a tu %s %s. La familia está de luto." % ["hijo" if c["male"] else "hija", c["name"]], "button": "Continuar"})
	else:
		d["player"]["health"] = maxf(1.0, float(d["player"]["health"]) - 40.0)
		GS.popups.append({"title": "Atentado", "text": "Un desconocido te ataca con un puñal en plena calle. Sobrevives, pero gravemente herido (-40 salud).", "button": "Continuar"})


# ---------------- Intrigas contra otros señores ----------------

static func intrigue_options(v, i: int, town_id: int) -> Array:
	var d = GS.data
	var l := N.lord(i)
	var opts := []
	opts.append(["Sobornar a su consejero (80 oro): +15 relación", func():
		d["gold"] = int(d["gold"]) - 80
		N.add_rel(-1, i, 15)
		v._say("El consejero de %s habla bien de ti a su señor. (+15 relación)" % N.full(l)), int(d["gold"]) >= 80])
	opts.append(["Enviar un espía (40 oro)", func():
		d["gold"] = int(d["gold"]) - 40
		var towns: Array = R.region()["towns"].filter(func(t): return t["owner"] == "señor" and int(t["lord"]) == i)
		var lines := towns.map(func(t): return "%s: %d soldados, %s" % [t["name"], int(t["troops"]), ["sin defensas", "empalizada", "murallas"][int(t["wall"])]])
		v._say("Tu espía vuelve con noticias de %s:\n%s\nSus enemigos: %s." % [N.full(l), "\n".join(lines), ", ".join(R.enemies_of(i).map(func(e): return N.name_of(int(e)))) if not R.enemies_of(i).is_empty() else "ninguno"]), int(d["gold"]) >= 40])
	opts.append(["Instigar una revuelta en uno de sus pueblos (120 oro)", func():
		d["gold"] = int(d["gold"]) - 120
		var towns := R.lord_towns(i).filter(func(t): return int(t["id"]) != town_id)
		if towns.is_empty() or randf() < 0.45:
			N.add_rel(-1, i, -20)
			v._say("Tus agentes son descubiertos. %s sabe que estás detrás. (-20 relación)" % N.full(l))
			return
		var t = towns.pick_random()
		var ni: int = N.new_house()
		if ni == -1:
			v._say("La revuelta no prende: no hay nadie dispuesto a encabezarla.")
			return
		t["lord"] = ni
		t["troops"] = int(t["troops"]) + 4
		N.declare_war(i, ni)
		N.add_rel(-1, ni, 30)
		v._say("¡%s se subleva contra %s! El nuevo señor, %s, te está agradecido." % [t["name"], N.full(l), N.full(N.lord(ni))]), int(d["gold"]) >= 120 and R.lord_towns(i).size() >= 2])
	var heirs: Array = l["kids"].filter(func(k): return int(k["age"]) >= 10)
	if not heirs.is_empty():
		opts.append(["Encargar el asesinato de su heredero (150 oro)", func():
			d["gold"] = int(d["gold"]) - 150
			heirs.sort_custom(func(a, b): return int(a["age"]) > int(b["age"]))
			var h = heirs[0]
			if randf() < 0.6:
				l["kids"].erase(h)
				GS.say("%s, heredero de %s, aparece muerto. Nadie sabe quién fue." % [h["name"], N.full(l)])
				v._say("El trabajo está hecho: %s ha muerto." % h["name"])
				if randf() < 0.3:
					N.declare_war(i, -1)
					d["prestige"] = maxi(0, int(d["prestige"]) - 30)
					GS.say("Pero corre la voz de que fuiste tú. %s te declara la guerra. (-30 prestigio)" % N.full(l))
			else:
				N.add_rel(-1, i, -40)
				d["prestige"] = maxi(0, int(d["prestige"]) - 30)
				if not N.at_war(-1, i):
					N.declare_war(-1, i)
				v._say("El asesino es capturado y confiesa. %s te declara la guerra. (-30 prestigio)" % N.full(l)), int(d["gold"]) >= 150])
	return opts
