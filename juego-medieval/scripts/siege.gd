extends RefCounted
## Asedio largo: cercas un pueblo enemigo durante días. Los defensores se debilitan por hambre y,
## si aguantas, se rinden. En cualquier momento puedes asaltarlo (a los 3 días ya tienes escalas).

const R := preload("res://scripts/region_sim.gd")
const N := preload("res://scripts/nobles.gd")


static func camp() -> Dictionary:
	var c = GS.data.get("siege_camp", null)
	return c if c != null else {}


static func days_needed(t: Dictionary) -> int:
	return 8 + 4 * int(t["wall"])


static func start(id: int) -> void:
	GS.data["siege_camp"] = {"town": id, "days": 0}
	GS.say("Pones cerco a %s. Nadie entra ni sale." % R.town(id)["name"])


static func lift(reason: String) -> void:
	GS.data["siege_camp"] = null
	GS.say(reason)


static func text(t: Dictionary) -> String:
	var c := camp()
	var left := maxi(0, days_needed(t) - int(c["days"]))
	return "\nLlevas %d días de cerco. Quedan unos %d defensores; si aguantas, se rendirán en unos %d días.%s" % [int(c["days"]), int(t["troops"]), left, "\nTus hombres ya han construido escalas para el asalto." if int(c["days"]) >= 3 else ""]


## Cada día de cerco: los sitiados pasan hambre y pierden hombres; al final se rinden.
static func day() -> void:
	var c := camp()
	if c.is_empty():
		return
	var d = GS.data
	var t := R.town(int(c["town"]))
	if t.is_empty() or t["owner"] != "señor" or not N.at_war(-1, int(t["lord"])):
		lift("El cerco termina.")
		return
	var party := Vector2(R.region()["party"][0], R.region()["party"][1])
	if party.distance_to(Vector2(t["x"], t["z"])) > 25.0:
		lift("Te alejas de %s: levantas el cerco." % t["name"])
		return
	if GS.ARMY.total() < 5:
		lift("Te quedas sin tropas para mantener el cerco de %s." % t["name"])
		return
	c["days"] = int(c["days"]) + 1
	t["troops"] = maxi(0, int(t["troops"]) - maxi(1, int(int(t["troops"]) * 0.06)))
	t["pop"] = int(int(t["pop"]) * 0.99)
	if int(c["days"]) >= days_needed(t) or int(t["troops"]) == 0:
		var id := int(t["id"])
		d["siege_camp"] = null
		d["prestige"] += 15
		var opts := []
		for choice in [["Saquearlo (botín de oro)", "saquear"], ["Conquistarlo (pasa a ser tuyo)", "conquistar"], ["Exigir vasallaje (tributo cada estación)", "vasallo"]]:
			var ch: String = choice[1]
			opts.append([choice[0], func(): GS.say(R.after_victory(id, ch))])
		GS.popups.append({"title": "¡%s se rinde!" % t["name"], "text": "Tras %d días de cerco, hambrientos y sin esperanza, los defensores de %s abren las puertas. (+15 prestigio)\n¿Qué haces con el pueblo?" % [int(c["days"]), t["name"]], "options": opts})


## Opciones del panel de un pueblo enemigo relacionadas con el cerco.
static func town_options(v, t: Dictionary) -> Array:
	var d = GS.data
	var id := int(t["id"])
	var c := camp()
	var opts := []
	if not c.is_empty() and int(c["town"]) == id:
		opts.append(["Lanzar el asalto%s" % (" con escalas" if int(c["days"]) >= 3 else ""), func():
			d["battle"] = {"kind": "asedio", "town": id, "enemy": "%s (%s)" % [t["name"], N.lord(int(t["lord"]))["name"]], "troops": int(t["troops"]), "wall": int(t["wall"]), "ladders": int(c["days"]) >= 3}
			d["siege_camp"] = null
			GS.save_game()
			v.main.start_battle()])
		for n in [1, 5]:
			opts.append(["Esperar %d día%s de cerco" % [n, "" if n == 1 else "s"], func():
				for k in n:
					if camp().is_empty():
						break
					GS.next_day()
				v._close_panel()])
		opts.append(["Levantar el cerco", func():
			lift("Levantas el cerco de %s." % t["name"])
			v._close_panel()])
	elif N.at_war(-1, int(t["lord"])) and not t["vassal"]:
		opts.append(["Poner cerco y rendirlo por hambre (necesitas 10 soldados)", func():
			start(id)
			v._close_panel(), GS.ARMY.total() >= 10 and c.is_empty()])
	return opts
