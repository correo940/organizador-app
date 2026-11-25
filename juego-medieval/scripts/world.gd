extends RefCounted
## Más allá de la región: reinos vecinos (embajadas, invasiones, bodas reales), personajes errantes
## (caballeros andantes, bardos, mercenarios) y la temporada de torneos con su clasificación.

const KINGDOMS := ["Reino de Montealto", "Reino de las Marismas", "Reino de Valdemar"]
const KNIGHT_NAMES := ["Ser Gonzalo el Tuerto", "Ser Mendo de la Torre", "Dama Elvira la Roja", "Ser Fortún el Bravo", "Ser Lope Garras", "Dama Toda de Aranda"]
const BARD_NAMES := ["Martín el Juglar", "Sancha la Trovadora", "Rodrigo el Cantor", "Oria de las Coplas"]


static func ensure() -> void:
	var d = GS.data
	if not d.has("kingdoms"):
		d["kingdoms"] = []
		for k in KINGDOMS:
			d["kingdoms"].append({"name": k, "rel": randi_range(30, 60), "wed": false})
	if not d.has("companions"):
		d["companions"] = []
	if not d.has("tourney"):
		d["tourney"] = {}


# ---------------- Reinos vecinos ----------------

static func kingdoms_panel(v) -> void:
	ensure()
	var d = GS.data
	var lines := ["Más allá de la región hay reinos poderosos. Con buena relación no te invadirán y pueden ofrecer bodas reales.", ""]
	var opts := []
	for k in d["kingdoms"]:
		lines.append("%s · relación %d/100%s" % [k["name"], int(k["rel"]), " · unidos por boda real" if k["wed"] else ""])
		opts.append(["Enviar una embajada a %s (50 oro): +15 relación" % k["name"], func():
			d["gold"] = int(d["gold"]) - 50
			k["rel"] = mini(100, int(k["rel"]) + 15)
			kingdoms_panel(v), int(d["gold"]) >= 50])
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Reinos vecinos", "\n".join(lines), opts)


## Cada estación: embajadas, bodas reales e invasiones de los reinos vecinos.
static func season() -> void:
	ensure()
	var d = GS.data
	if int(d["title"]) < 1 or int(d["total_days"]) < 40:
		return
	var k: Dictionary = d["kingdoms"].pick_random()
	var roll := randf()
	var kings: bool = d.get("king", false)
	if roll < 0.03 + (0.02 if kings else 0.0) and int(k["rel"]) < 60 and not k["wed"]:
		_invasion(k)
	elif roll < 0.15:
		_embassy(k)
	elif roll < 0.22 and kings:
		_royal_wedding(k)


static func _embassy(k: Dictionary) -> void:
	var d = GS.data
	var gift := randi_range(30, 80)
	GS.popups.append({"title": "Embajada del %s" % k["name"], "text": "Llegan embajadores del %s con regalos (%d de oro) y proponen amistad entre vuestras tierras." % [k["name"], gift], "options": [
		["Recibirlos con un banquete (20 oro)", func():
			d["gold"] = int(d["gold"]) - 20 + gift
			k["rel"] = mini(100, int(k["rel"]) + 20)
			d["prestige"] += 5
			GS.say("La embajada del %s se marcha encantada. (+20 relación)" % k["name"])],
		["Aceptar los regalos sin más", func():
			d["gold"] = int(d["gold"]) + gift
			k["rel"] = mini(100, int(k["rel"]) + 5)],
		["Despedirlos con frialdad", func():
			k["rel"] = maxi(0, int(k["rel"]) - 15)
			GS.say("El %s toma nota de tu desprecio." % k["name"])],
	]})


static func _invasion(k: Dictionary) -> void:
	var d = GS.data
	var troops := int((20 + int(d["tier"]) * 15 + randi_range(0, 15)) * GS.diff_mult(0.7, 1.3))
	var tribute := maxi(50, int(int(d["gold"]) * 0.3))
	GS.chronicle("El %s invade la región con %d soldados." % [k["name"], troops])
	GS.popups.append({"title": "¡Invasión!", "text": "Un ejército del %s (%d soldados) ha cruzado la frontera y saquea tus tierras." % [k["name"], troops], "options": [
		["Salir a su encuentro con tu ejército", func():
			d["battle"] = {"kind": "invasion", "kingdom": k["name"], "enemy": "el ejército del %s" % k["name"], "troops": troops, "wall": 0}
			GS.save_game()
			Engine.get_main_loop().root.get_node("Main").start_battle()],
		["Pagarles para que se vayan (%d oro)" % tribute, func():
			if int(d["gold"]) >= tribute:
				d["gold"] = int(d["gold"]) - tribute
				GS.say("Pagas %d de oro y el ejército del %s se retira." % [tribute, k["name"]])
			else:
				invasion_lost(k["name"])],
	]})


## Si pierdes contra una invasión (o no puedes pagar), saquean tus tierras.
static func invasion_lost(kname: String) -> void:
	var d = GS.data
	var gold := int(int(d["gold"]) * 0.3)
	d["gold"] = int(d["gold"]) - gold
	d["commons"] = int(int(d["commons"]) * 0.9)
	var extra := ""
	var mine: Array = GS.ECON.my_towns()
	if not mine.is_empty():
		var t = mine.pick_random()
		t["pop"] = int(int(t["pop"]) * 0.6)
		t["garrison"] = 0
		extra = " %s queda arrasado." % t["name"]
	GS.popups.append({"title": "Saqueo extranjero", "text": "Las tropas del %s saquean tus tierras: se llevan %d de oro y mucha gente huye.%s" % [kname, gold, extra], "button": "Continuar"})


static func _royal_wedding(k: Dictionary) -> void:
	var d = GS.data
	var kids: Array = d["children"].filter(func(c): return int(c["age"]) >= 16 and not c.has("wife") and c.get("role", "") == "")
	if kids.is_empty():
		return
	var c = kids.pick_random()
	var royal: String = GS.rng_name(not c["male"])
	GS.popups.append({"title": "Propuesta de boda real", "text": "El %s propone casar a %s, %s de su rey, con tu %s %s. Uniría vuestras casas para siempre." % [k["name"], royal, "hija" if c["male"] else "hijo", "hijo" if c["male"] else "hija", c["name"]], "options": [
		["Aceptar la boda real", func():
			k["wed"] = true
			k["rel"] = 100
			d["prestige"] += 60
			if c["male"]:
				c["wife"] = royal
				GS.say("¡Boda real! Tu hijo %s se casa con la princesa %s. (+60 prestigio)" % [c["name"], royal])
			else:
				d["children"].erase(c)
				GS.say("¡Boda real! Tu hija %s se casa con el príncipe %s y se marcha a su corte. (+60 prestigio)" % [c["name"], royal])
			GS.chronicle("Boda real: %s se casa con %s, del %s." % [c["name"], royal, k["name"]])],
		["Rechazarla con cortesía", func():
			k["rel"] = maxi(0, int(k["rel"]) - 10)],
	]})


# ---------------- Personajes errantes ----------------

static func companions_text() -> String:
	ensure()
	var cs: Array = GS.data["companions"]
	var m = GS.data.get("mercs", null)
	var parts := cs.map(func(c): return "%s (%s)" % [c["name"], c["type"]])
	if m != null:
		parts.append("%d mercenarios (hasta el día %d)" % [int(m["n"]), int(m["until"])])
	return "Tu séquito: " + (", ".join(parts) if not parts.is_empty() else "nadie")


## Opciones de la taberna: contratar mercenarios, un caballero andante o un bardo.
static func tavern_options(v) -> Array:
	ensure()
	var d = GS.data
	var opts := []
	opts.append(["Contratar 10 mercenarios por una estación (90 oro)", func():
		d["gold"] = int(d["gold"]) - 90
		d["mercs"] = {"n": 10, "until": int(d["total_days"]) + GS.DAYS_PER_SEASON * 1 + 5}
		v._say("Diez mercenarios curtidos se unen a ti. Lucharán en tus batallas hasta que acabe su contrato."), int(d["gold"]) >= 90 and d.get("mercs", null) == null])
	var names: Array = d["companions"].map(func(c): return c["name"])
	var knights := KNIGHT_NAMES.filter(func(n): return not n in names)
	if not knights.is_empty():
		var kn: String = knights[(int(d["total_days"]) / 7) % knights.size()]
		opts.append(["Tomar a tu servicio a %s, caballero andante (60 oro + 1 oro/día)" % kn, func():
			d["gold"] = int(d["gold"]) - 60
			d["companions"].append({"name": kn, "type": "caballero"})
			v._say("%s jura servirte con su espada. Luchará a tu lado en cada batalla." % kn), int(d["gold"]) >= 60])
	var bards := BARD_NAMES.filter(func(n): return not n in names)
	if not bards.is_empty():
		var bn: String = bards[(int(d["total_days"]) / 7) % bards.size()]
		opts.append(["Contratar a %s, que cantará tus hazañas (30 oro + 1 oro/día): +4 prestigio por estación" % bn, func():
			d["gold"] = int(d["gold"]) - 30
			d["companions"].append({"name": bn, "type": "bardo"})
			v._say("%s compone una canción sobre tu linaje. Pronto la cantarán en toda la región." % bn), int(d["gold"]) >= 30])
	return opts


## Paga diaria del séquito y fin de los contratos de mercenarios.
static func day() -> void:
	ensure()
	var d = GS.data
	var cs: Array = d["companions"]
	if not cs.is_empty():
		if int(d["gold"]) >= cs.size():
			d["gold"] = int(d["gold"]) - cs.size()
		else:
			var c = cs.pop_back()
			GS.say("Sin paga, %s abandona tu servicio." % c["name"])
	var m = d.get("mercs", null)
	if m != null and int(d["total_days"]) >= int(m["until"]):
		d["mercs"] = null
		GS.say("Termina el contrato de los mercenarios y se marchan.")


static func season_bards() -> void:
	ensure()
	var n: int = GS.data["companions"].filter(func(c): return c["type"] == "bardo").size()
	if n > 0:
		GS.data["prestige"] += 4 * n


## Un caballero andante puede ofrecerse por su cuenta (evento del pueblo).
static func knight_event() -> void:
	ensure()
	var d = GS.data
	var names: Array = d["companions"].map(func(c): return c["name"])
	var knights := KNIGHT_NAMES.filter(func(n): return not n in names)
	if knights.is_empty():
		return
	var kn: String = knights.pick_random()
	GS.popups.append({"title": "Un caballero andante", "text": "%s llega al pueblo buscando un señor digno a quien servir." % kn, "options": [
		["Tomarlo a tu servicio (60 oro + 1 oro/día)", func():
			if int(d["gold"]) < 60:
				GS.say("No puedes pagarle. %s sigue su camino." % kn)
				return
			d["gold"] = int(d["gold"]) - 60
			d["companions"].append({"name": kn, "type": "caballero"})
			GS.say("%s jura servirte." % kn)],
		["Invitarlo a seguir su camino", func(): pass],
	]})


# ---------------- Temporada de torneos ----------------

static func add_points(who: String, n: int) -> void:
	ensure()
	var t: Dictionary = GS.data["tourney"]
	t[who] = int(t.get(who, 0)) + n


static func ranking() -> Array:
	ensure()
	var t: Dictionary = GS.data["tourney"]
	var keys: Array = t.keys()
	keys.sort_custom(func(a, b): return int(t[a]) > int(t[b]))
	return keys.map(func(k): return [k, int(t[k])])


static func ranking_text() -> String:
	var r := ranking()
	if r.is_empty():
		return "Temporada de torneos: aún sin puntos."
	var lines := []
	for i in mini(5, r.size()):
		lines.append("%d. %s — %d puntos" % [i + 1, r[i][0], r[i][1]])
	return "Clasificación de torneos de este año:\n" + "\n".join(lines)


## Cada estación los campeones de los señores suman puntos; en invierno se corona al campeón del año.
static func tourney_season() -> void:
	ensure()
	var d = GS.data
	for l in GS.REGION.region()["lords"]:
		if randf() < 0.5:
			add_points("Campeón de " + GS.REGION.NOBLES.full(l), randi_range(1, 3))
	if int(d["season"]) != 3:
		return
	var r := ranking()
	if r.is_empty():
		return
	var me: String = d["player"]["name"]
	if r[0][0] == me:
		d["prestige"] += 50
		d["gold"] = int(d["gold"]) + 200
		GS.popups.append({"title": "¡Campeón del año!", "text": "Con %d puntos eres el gran campeón de los torneos de este año. Te entregan la corona de laurel y una bolsa de 200 de oro. (+50 prestigio)" % r[0][1], "button": "Continuar"})
		GS.chronicle("%s es proclamado campeón de los torneos del año." % me)
	else:
		GS.say("%s es el campeón de los torneos de este año." % r[0][0])
	d["tourney"] = {}
