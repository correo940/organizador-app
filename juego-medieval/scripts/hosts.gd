extends RefCounted
## Ejércitos que tus hijos capitanes mandan por su cuenta en el mapa, y los señores prisioneros en tus mazmorras.

const R := preload("res://scripts/region_sim.gd")
const N := preload("res://scripts/nobles.gd")


static func hosts() -> Array:
	if not GS.data.has("hosts"):
		GS.data["hosts"] = []
	return GS.data["hosts"]


static func free_captains() -> Array:
	var busy := hosts().map(func(h): return h["leader"])
	return GS.data["children"].filter(func(c): return c.get("role", "") == "capitan" and int(c["age"]) >= 16 and not c["name"] in busy)


## Opciones del panel de un pueblo enemigo: mandar a un hijo con parte de tu ejército.
static func town_options(v, t: Dictionary) -> Array:
	var opts := []
	if t["owner"] != "señor" or not N.at_war(-1, int(t["lord"])):
		return opts
	for c in free_captains():
		var n := GS.ARMY.total() / 2
		var cn: String = c["name"]
		opts.append(["Enviar a %s con %d soldados contra %s" % [cn, n, t["name"]], func():
			send(cn, int(t["id"]), n)
			v._say("%s parte al frente de %d soldados contra %s. Te llegarán noticias." % [cn, n, t["name"]]), n >= 5])
	return opts


static func send(leader: String, town_id: int, n: int) -> void:
	var d = GS.data
	var left := n
	for k in ["milicia", "lancero", "arquero", "infante", "arquero_jinete", "jinete"]:
		var take := mini(left, int(d["army"][k]))
		d["army"][k] = int(d["army"][k]) - take
		left -= take
	var home := R.home()
	hosts().append({"id": randi(), "leader": leader, "troops": n - left, "x": home.x, "z": home.y, "target": town_id})


static func _child(n: String) -> Dictionary:
	for c in GS.data["children"]:
		if c["name"] == n:
			return c
	return {}


## Cada día los ejércitos de tus hijos avanzan; al llegar, asaltan el pueblo.
static func day() -> void:
	var d = GS.data
	for h in hosts().duplicate():
		var t := R.town(int(h["target"]))
		var c := _child(h["leader"])
		if c.is_empty() or t.is_empty() or t["owner"] != "señor" or not N.at_war(-1, int(t["lord"])):
			d["army"]["milicia"] = int(d["army"]["milicia"]) + int(h["troops"])
			hosts().erase(h)
			GS.say("El ejército de %s vuelve a casa." % h["leader"])
			continue
		var to := Vector2(t["x"], t["z"]) - Vector2(h["x"], h["z"])
		if to.length() > R.DAY_DIST * 0.8:
			var step := to.normalized() * R.DAY_DIST * 0.8
			h["x"] = float(h["x"]) + step.x
			h["z"] = float(h["z"]) + step.y
			continue
		hosts().erase(h)
		var att: float = int(h["troops"]) * (1.0 + 0.05 * int(c.get("xp", 0))) * GS.battle_bonus(c)[1] * randf_range(0.8, 1.2)
		var dfn: float = int(t["troops"]) * (1.0 + 0.25 * int(t["wall"])) * randf_range(0.8, 1.2)
		if att > dfn:
			var survivors := maxi(1, int(int(h["troops"]) * clampf(1.0 - dfn / maxf(att, 1.0) * 0.6, 0.3, 0.95)))
			t["owner"] = "jugador"
			t["vassal"] = false
			t["troops"] = 0
			t["garrison"] = survivors
			c["role"] = "gobernador"
			c["town"] = int(t["id"])
			c["xp"] = int(c.get("xp", 0)) + 2
			d["prestige"] += 25
			GS.chronicle("%s conquista %s al frente de su propio ejército." % [c["name"], t["name"]])
			GS.popups.append({"title": "¡%s ha tomado %s!" % [c["name"], t["name"]], "text": "Tu %s %s ha conquistado %s. Queda allí como gobernador con %d soldados de guarnición. (+25 prestigio)" % ["hijo" if c["male"] else "hija", c["name"], t["name"], survivors], "button": "Continuar"})
		else:
			t["troops"] = maxi(0, int(t["troops"]) - int(int(h["troops"]) * 0.5))
			var fate := randf()
			var text := "El ejército de %s ha sido derrotado ante los muros de %s." % [c["name"], t["name"]]
			if fate < 0.25:
				d["children"].erase(c)
				text += " %s ha muerto en el asalto." % c["name"]
				GS.chronicle("%s muere asaltando %s." % [c["name"], t["name"]])
			elif fate < 0.5:
				d["children"].erase(c)
				var ransom := 150 + 50 * int(c.get("xp", 0))
				text += " %s ha caído prisionero de %s, que pide %d de oro de rescate." % [c["name"], N.full(N.lord(int(t["lord"]))), ransom]
				var cc := c
				GS.popups.append({"title": "Derrota de %s" % c["name"], "text": text, "options": [
					["Pagar el rescate (%d oro)" % ransom, func():
						if int(d["gold"]) >= ransom:
							d["gold"] = int(d["gold"]) - ransom
							cc["role"] = ""
							d["children"].append(cc)
							GS.say("%s vuelve a casa tras pagar el rescate." % cc["name"])
						else:
							GS.say("No tienes oro para el rescate. %s se queda en sus mazmorras." % cc["name"])],
					["No pagar", func(): GS.say("%s queda preso para siempre." % cc["name"])],
				]})
				continue
			else:
				text += " %s consigue huir y vuelve a casa." % c["name"]
			GS.popups.append({"title": "Derrota de %s" % c["name"], "text": text, "button": "Continuar"})


# ---------------- Prisioneros ----------------

static func prisoners() -> Array:
	if not GS.data.has("prisoners"):
		GS.data["prisoners"] = []
	return GS.data["prisoners"]


static func is_prisoner(lord: int) -> bool:
	return prisoners().any(func(p): return int(p["lord"]) == lord)


static func capture(lord: int) -> void:
	if is_prisoner(lord):
		return
	prisoners().append({"lord": lord, "day": int(GS.data["total_days"])})
	GS.chronicle("%s cae prisionero de %s." % [N.full(N.lord(lord)), GS.data["player"]["name"]])


static func dungeon_panel(v) -> void:
	var d = GS.data
	var opts := []
	var lines := ["Mientras un señor esté en tus mazmorras, sus ejércitos no marchan.", ""]
	for p in prisoners():
		var li := int(p["lord"])
		var l := N.lord(li)
		lines.append("%s · preso desde hace %d días" % [N.full(l), int(d["total_days"]) - int(p["day"])])
		opts.append(["%s: pedir rescate (300 oro)" % l["name"], func():
			d["gold"] = int(d["gold"]) + 300
			N.add_rel(-1, li, -10)
			_free(p, "%s paga 300 de oro y vuelve a su corte." % N.full(l))
			dungeon_panel(v)])
		var towns := R.lord_towns(li)
		if not towns.is_empty():
			opts.append(["%s: exigir %s a cambio" % [l["name"], towns[0]["name"]], func():
				var t = towns[0]
				t["owner"] = "jugador"
				t["vassal"] = false
				t["garrison"] = int(t["troops"]) / 2
				t["troops"] = 0
				N.add_rel(-1, li, -25)
				_free(p, "%s te entrega %s a cambio de su libertad." % [N.full(l), t["name"]])
				dungeon_panel(v)])
		opts.append(["%s: liberarlo a cambio de paz y alianza" % l["name"], func():
			if N.at_war(-1, li):
				N.make_peace(-1, li)
			N.add_rel(-1, li, 30)
			N.make_alliance(-1, li)
			_free(p, "%s jura paz y alianza con tu casa." % N.full(l))
			dungeon_panel(v)])
		opts.append(["%s: ejecutarlo" % l["name"], func():
			d["prestige"] = maxi(0, int(d["prestige"]) - 40)
			for i in R.region()["lords"].size():
				N.add_rel(-1, i, -10)
			prisoners().erase(p)
			l["age"] = 200
			GS.chronicle("%s manda ejecutar a %s." % [d["player"]["name"], N.full(l)])
			GS.say("Ejecutas a %s. Toda la nobleza te mira con espanto. (-40 prestigio)" % N.full(l))
			dungeon_panel(v)])
	if prisoners().is_empty():
		lines.append("No tienes prisioneros.")
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Mazmorras", "\n".join(lines), opts)


static func _free(p: Dictionary, msg: String) -> void:
	prisoners().erase(p)
	GS.say(msg)
