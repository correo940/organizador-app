extends RefCounted
## Las altas esferas: familias de los señores, relaciones entre ellos, guerras, paces, alianzas,
## bodas nobles, torneos y la vida de corte con el jugador.

const FEMALE_TITLE := {"Conde": "Condesa", "Barón": "Baronesa", "Señor": "Señora", "Duque": "Duquesa"}
const MAX_HOUSES := 10


static func reg() -> Dictionary:
	return GS.data["region"]


static func lord(i: int) -> Dictionary:
	return reg()["lords"][i]


static func title_of(l: Dictionary) -> String:
	return l["title"] if l["male"] else FEMALE_TITLE.get(l["title"], l["title"])


static func full(l: Dictionary) -> String:
	return "%s %s" % [title_of(l), l["first"]]


static func _key(a: int, b: int) -> String:
	return "%d-%d" % [mini(a, b), maxi(a, b)]


## Relación entre dos señores (-100 a 100). -1 es el jugador.
static func rel(a: int, b: int) -> int:
	if a == -1:
		return int(lord(b)["rel"]) - 50
	if b == -1:
		return int(lord(a)["rel"]) - 50
	return int(reg()["lrel"].get(_key(a, b), 0))


static func add_rel(a: int, b: int, n: int) -> void:
	if a == -1 or b == -1:
		var l := lord(b if a == -1 else a)
		l["rel"] = clampi(int(l["rel"]) + n, 0, 100)
		return
	reg()["lrel"][_key(a, b)] = clampi(rel(a, b) + n, -100, 100)


static func at_war(a: int, b: int) -> bool:
	return reg()["wars"].any(func(w): return (int(w[0]) == a and int(w[1]) == b) or (int(w[0]) == b and int(w[1]) == a))


static func allied(a: int, b: int) -> bool:
	return reg()["alliances"].any(func(w): return (int(w[0]) == a and int(w[1]) == b) or (int(w[0]) == b and int(w[1]) == a))


static func name_of(i: int) -> String:
	return "ti" if i == -1 else full(lord(i))


static func ensure() -> void:
	var r := reg()
	if r.has("lrel"):
		return
	r["lrel"] = {}
	r["wars"] = []
	r["alliances"] = []
	r["events"] = []
	for i in r["lords"].size():
		var l = r["lords"][i]
		# Las partidas creadas antes guardaban el título dentro del nombre.
		var parts: PackedStringArray = String(l["name"]).split(" ", true, 1)
		var male: bool = not parts[0] in FEMALE_TITLE.values()
		l["male"] = male
		l["title"] = parts[0] if male else FEMALE_TITLE.find_key(parts[0])
		l["first"] = parts[1] if parts.size() > 1 else GS.rng_name(male)
		l["age"] = randi_range(28, 55)
		l["spouse"] = {"name": GS.rng_name(not male), "age": int(l["age"]) + randi_range(-8, 4)} if randf() < 0.75 else null
		l["kids"] = []
		for k in randi_range(0, 4):
			var m := randf() < 0.5
			l["kids"].append({"name": GS.rng_name(m), "male": m, "age": randi_range(1, 22)})
		l["visit"] = -1
		l["feast"] = -1
		l["hunt"] = -1
	for a in r["lords"].size():
		for b in range(a + 1, r["lords"].size()):
			r["lrel"][_key(a, b)] = randi_range(-30, 40)


## Nace una casa noble nueva (reutiliza el hueco de una casa sin tierras). Devuelve su índice o -1.
static func new_house() -> int:
	var r := reg()
	var idx := -1
	for i in r["lords"].size():
		if not _landed(i) and not r["armies"].any(func(a): return int(a["lord"]) == i):
			idx = i
			break
	if idx == -1:
		if r["lords"].size() >= MAX_HOUSES:
			return -1
		r["lords"].append({})
		idx = r["lords"].size() - 1
	var male := randf() < 0.75
	var l := {"title": ["Señor", "Barón", "Conde"].pick_random(), "male": male, "first": GS.rng_name(male), "age": randi_range(24, 45),
		"kids": [], "color": [randf_range(0.1, 0.75), randf_range(0.1, 0.75), randf_range(0.1, 0.75)], "rel": 50, "visit": -1, "feast": -1, "hunt": -1}
	l["spouse"] = {"name": GS.rng_name(not male), "age": int(l["age"])} if randf() < 0.6 else null
	for k in randi_range(0, 3):
		var m := randf() < 0.5
		l["kids"].append({"name": GS.rng_name(m), "male": m, "age": randi_range(1, 18)})
	_sync_name(l)
	r["lords"][idx] = l
	r["wars"] = r["wars"].filter(func(w): return int(w[0]) != idx and int(w[1]) != idx)
	r["alliances"] = r["alliances"].filter(func(w): return int(w[0]) != idx and int(w[1]) != idx)
	for j in r["lords"].size():
		if j != idx:
			r["lrel"][_key(idx, j)] = randi_range(-10, 20)
	return idx


## Los señores con demasiados pueblos sufren revueltas: un pueblo lejano se independiza.
static func revolts() -> void:
	var r := reg()
	for i in r["lords"].size():
		var mine: Array = r["towns"].filter(func(t): return t["owner"] == "señor" and int(t["lord"]) == i and not t["vassal"])
		if mine.size() <= 4 or randf() > (mine.size() - 4) * 0.08:
			continue
		mine.sort_custom(func(a, b): return int(a["pop"]) > int(b["pop"]))
		var cap = mine[0]
		mine.sort_custom(func(a, b): return Vector2(a["x"], a["z"]).distance_to(Vector2(cap["x"], cap["z"])) > Vector2(b["x"], b["z"]).distance_to(Vector2(cap["x"], cap["z"])))
		var t = mine[0]
		var old := full(lord(i))
		var ni := new_house()
		if ni == -1:
			return
		t["lord"] = ni
		t["troops"] = int(t["troops"]) + 5
		GS.say("¡Revuelta! %s se subleva contra %s: nace la casa de %s." % [t["name"], old, full(lord(ni))])
		declare_war(i, ni)


static func _landed(i: int) -> bool:
	return reg()["towns"].any(func(t): return t["owner"] == "señor" and int(t["lord"]) == i)


static func _sync_name(l: Dictionary) -> void:
	l["name"] = full(l)


# ---------------- Guerra, paz y alianzas ----------------

static func declare_war(a: int, b: int) -> void:
	if at_war(a, b):
		return
	reg()["wars"].append([a, b, int(GS.data["total_days"])])
	reg()["alliances"] = reg()["alliances"].filter(func(w): return not ((int(w[0]) == a and int(w[1]) == b) or (int(w[0]) == b and int(w[1]) == a)))
	add_rel(a, b, -30)
	if a == -1:
		GS.say("¡Guerra! Declaras la guerra a %s." % name_of(b))
	elif b == -1:
		GS.say("¡Guerra! %s te declara la guerra." % name_of(a))
	else:
		GS.say("¡Guerra! %s declara la guerra a %s." % [name_of(a), name_of(b)])
	# Los aliados acuden en ayuda del atacado.
	for i in reg()["lords"].size():
		if i != a and i != b and allied(i, b) and not at_war(i, a):
			reg()["wars"].append([i, a, int(GS.data["total_days"])])
			GS.say("%s se une a la guerra en apoyo de su aliado." % name_of(i))


static func make_peace(a: int, b: int) -> void:
	reg()["wars"] = reg()["wars"].filter(func(w): return not ((int(w[0]) == a and int(w[1]) == b) or (int(w[0]) == b and int(w[1]) == a)))
	add_rel(a, b, 25)
	if a == -1 or b == -1:
		lord(b if a == -1 else a).erase("peace_offer")
		GS.say("Firmas la paz con %s." % name_of(b if a == -1 else a))
	else:
		GS.say("Paz entre %s y %s." % [name_of(a), name_of(b)])


static func make_alliance(a: int, b: int) -> void:
	if not allied(a, b):
		reg()["alliances"].append([a, b])
	if a == -1 or b == -1:
		GS.say("Firmas una alianza con %s." % name_of(b if a == -1 else a))
	else:
		GS.say("Alianza entre %s y %s." % [name_of(a), name_of(b)])


## El jugador propone la paz: la aceptan si no le odian o si les va mal.
static func ask_peace(i: int) -> bool:
	var power_me := GS.ARMY.total()
	var power_them := 0
	for t in reg()["towns"]:
		if t["owner"] == "señor" and int(t["lord"]) == i:
			power_them += int(t["troops"])
	if rel(-1, i) >= -15 or power_me > power_them * 1.3:
		make_peace(-1, i)
		return true
	return false


static func ask_alliance(i: int) -> bool:
	if int(lord(i)["rel"]) >= 70 and not at_war(-1, i):
		make_alliance(-1, i)
		return true
	return false


# ---------------- Estaciones y años ----------------

static func season() -> void:
	var r := reg()
	var n: int = r["lords"].size()
	var day := int(GS.data["total_days"])
	# Las relaciones se mueven solas un poco.
	for a in n:
		for b in range(a + 1, n):
			add_rel(a, b, randi_range(-8, 6) + (5 if allied(a, b) else 0))
	# Guerras nuevas entre señores que se odian.
	for a in n:
		for b in range(a + 1, n):
			if not at_war(a, b) and not allied(a, b) and rel(a, b) < -40 and randf() < 0.5 and _landed(a) and _landed(b):
				declare_war(a, b)
	# Un señor muy enemistado contigo te declara la guerra.
	for i in n:
		if not at_war(-1, i) and not allied(-1, i) and int(lord(i)["rel"]) < 20 and randf() < 0.3 and _landed(i):
			declare_war(i, -1)
	# Paces: las guerras largas acaban cansando.
	for w in r["wars"].duplicate():
		if day - int(w[2]) <= 15 or randf() > 0.35:
			continue
		if int(w[0]) != -1 and int(w[1]) != -1:
			make_peace(int(w[0]), int(w[1]))
		else:
			var i: int = int(w[1]) if int(w[0]) == -1 else int(w[0])
			if not lord(i).has("peace_offer"):
				lord(i)["peace_offer"] = true
				GS.say("%s te ofrece la paz. Respóndele desde la diplomacia (tecla D en el mapa)." % full(lord(i)))
	# Alianzas entre buenos amigos.
	for a in n:
		for b in range(a + 1, n):
			if not allied(a, b) and not at_war(a, b) and rel(a, b) > 60 and randf() < 0.4:
				make_alliance(a, b)
	_noble_weddings()
	# Torneos.
	r["events"] = r["events"].filter(func(e): return int(e["until"]) > day)
	if randf() < 0.5:
		var i := randi() % n
		var towns: Array = r["towns"].filter(func(t): return t["owner"] == "señor" and int(t["lord"]) == i)
		if not towns.is_empty():
			towns.sort_custom(func(x, y): return int(x["pop"]) > int(y["pop"]))
			r["events"].append({"type": "torneo", "lord": i, "town": int(towns[0]["id"]), "until": day + 12})
			GS.say("%s celebra un torneo en %s. ¡Están invitados todos los caballeros!" % [full(lord(i)), towns[0]["name"]])


## Bodas entre hijos de señores: unen a las casas.
static func _noble_weddings() -> void:
	var r := reg()
	var n: int = r["lords"].size()
	if randf() > 0.35:
		return
	for a in n:
		for b in n:
			if a == b or at_war(a, b) or rel(a, b) < 10:
				continue
			var sons: Array = lord(a)["kids"].filter(func(k): return k["male"] and int(k["age"]) >= 16 and not k.has("wed"))
			var daughters: Array = lord(b)["kids"].filter(func(k): return not k["male"] and int(k["age"]) >= 16 and not k.has("wed"))
			if sons.is_empty() or daughters.is_empty():
				continue
			var s = sons[0]
			var dgt = daughters[0]
			s["wed"] = dgt["name"]
			lord(b)["kids"].erase(dgt)
			add_rel(a, b, 40)
			GS.say("Boda noble: %s, hijo de %s, se casa con %s, hija de %s." % [s["name"], full(lord(a)), dgt["name"], full(lord(b))])
			if rel(a, b) > 50:
				make_alliance(a, b)
			return


static func year() -> void:
	var r := reg()
	for i in r["lords"].size():
		var l = r["lords"][i]
		l["age"] = int(l["age"]) + 1
		if l["spouse"] != null:
			l["spouse"]["age"] = int(l["spouse"]["age"]) + 1
		for k in l["kids"]:
			k["age"] = int(k["age"]) + 1
		if l["spouse"] != null and int(l["spouse"]["age"]) < 44 and l["kids"].size() < 6 and randf() < 0.3:
			var m := randf() < 0.5
			var k := {"name": GS.rng_name(m), "male": m, "age": 0}
			l["kids"].append(k)
			GS.say("En la corte de %s nace %s." % [full(l), k["name"]])
		if int(l["age"]) > 50 and randf() < (int(l["age"]) - 47) * 0.03:
			_succession(i)


## Muere un señor: hereda su hijo mayor (o una casa nueva si no hay herederos).
static func _succession(i: int) -> void:
	var l := lord(i)
	var old := full(l)
	var heirs: Array = l["kids"].filter(func(k): return int(k["age"]) >= 14)
	heirs.sort_custom(func(a, b): return int(a["age"]) > int(b["age"]))
	if heirs.is_empty():
		var male := randf() < 0.7
		l["male"] = male
		l["first"] = GS.rng_name(male)
		l["age"] = randi_range(25, 40)
		l["kids"] = []
		l["spouse"] = null
		GS.say("Muere %s sin herederos. Sus tierras pasan a %s, de otra rama de la familia." % [old, full(l)])
	else:
		var h = heirs[0]
		l["kids"].erase(h)
		l["male"] = h["male"]
		l["first"] = h["name"]
		l["age"] = h["age"]
		l["spouse"] = {"name": h["wed"], "age": h["age"]} if h.has("wed") else null
		GS.say("Muere %s. Le sucede %s." % [old, full(l)])
	l["rel"] = int((int(l["rel"]) + 50) / 2)
	_sync_name(l)


# ---------------- Vida de corte con el jugador ----------------

static func can_court(i: int) -> String:
	if at_war(-1, i):
		return "Estáis en guerra."
	if int(GS.data["title"]) < 1:
		return "Solo te reciben en la corte si eres jefe de un pueblo."
	return ""


## Boda entre tu casa y la de un señor. who: "tú" o el nombre de tu hijo/a. kid: nombre del hijo/a del señor.
static func propose_marriage(i: int, who: String, kid: String) -> String:
	var d = GS.data
	var l := lord(i)
	var k = null
	for x in l["kids"]:
		if x["name"] == kid:
			k = x
	if k == null:
		return "Ya no está disponible."
	var chance := clampf((int(l["rel"]) - 40) / 60.0 + int(d["prestige"]) / 1000.0, 0.05, 0.95)
	if randf() > chance:
		add_rel(-1, i, -5)
		return "%s rechaza la propuesta. Quizá con más amistad y prestigio..." % full(l)
	l["kids"].erase(k)
	add_rel(-1, i, 25)
	d["prestige"] += 40
	if who == "tú":
		d["spouse"] = {"name": k["name"], "male": k["male"], "age": k["age"], "noble": full(l)}
		GS.say("¡Boda noble! Te casas con %s, %s de %s. (+40 prestigio)" % [k["name"], "hijo" if k["male"] else "hija", full(l)])
	else:
		for c in d["children"].duplicate():
			if c["name"] == who:
				if c["male"]:
					c["wife"] = k["name"]
					GS.say("¡Boda noble! Tu hijo %s se casa con %s, hija de %s, que viene a vivir con vosotros. (+40 prestigio)" % [who, k["name"], full(l)])
				else:
					d["children"].erase(c)
					GS.say("¡Boda noble! Tu hija %s se casa con %s, hijo de %s, y se marcha a su corte. (+40 prestigio)" % [who, k["name"], full(l)])
	if not allied(-1, i):
		make_alliance(-1, i)
	return ""


static func tournament_at(town_id: int) -> Dictionary:
	for e in reg()["events"]:
		if e["type"] == "torneo" and int(e["town"]) == town_id and int(e["until"]) > int(GS.data["total_days"]):
			return e
	return {}
