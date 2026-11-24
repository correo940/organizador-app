extends RefCounted
## Paneles del mapa: mercado de cada pueblo, corte de los señores (diplomacia y vida social),
## ajedrez, bodas nobles y resumen de diplomacia.

const R := preload("res://scripts/region_sim.gd")
const N := preload("res://scripts/nobles.gd")
const CHESS := ["Ataque frontal", "Defensa cerrada", "Gambito"]


static func _name(k: String) -> String:
	return k.capitalize() if k == "madera" or k == "piedra" else GS.ITEMS[k][0]


static func _btn(text: String, cb: Callable, enabled := true) -> Button:
	var b := Button.new()
	b.text = text
	b.disabled = not enabled
	b.pressed.connect(cb)
	return b


static func _lbl(text: String, header := false) -> Label:
	var l := Label.new()
	l.text = text
	if header:
		l.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
	return l


# ---------------- Mercado ----------------

static func market(v, id: int) -> void:
	SFX.play("monedas", -6.0)
	var t := R.town(id)
	var d = GS.data
	var grid := GridContainer.new()
	grid.columns = 7
	grid.add_theme_constant_override("h_separation", 8)
	for h in ["Producto", "Tienes", "", "", "", "", ""]:
		grid.add_child(_lbl(h, true))
	for k in R.TRADE_ITEMS:
		var buy := R.market_price(t, k, true)
		var sell := R.market_price(t, k, false)
		var tag := ""
		if k in t["market"]["spec"]:
			tag = "  (barato aquí)"
		elif k in t["market"]["want"]:
			tag = "  (lo buscan)"
		grid.add_child(_lbl(_name(k) + tag))
		grid.add_child(_lbl(str(GS.res(k))))
		for n in [1, 10]:
			grid.add_child(_btn("Vender %d (+%d)" % [n, sell * n], func():
				GS.res_add(k, -n)
				d["gold"] = int(d["gold"]) + sell * n
				R.market_trade(t, k, n, false)
				market(v, id), GS.res(k) >= n))
		for n in [1, 10]:
			grid.add_child(_btn("Comprar %d (-%d)" % [n, buy * n], func():
				GS.res_add(k, n)
				d["gold"] = int(d["gold"]) - buy * n
				R.market_trade(t, k, n, true)
				market(v, id), int(d["gold"]) >= buy * n))
		grid.add_child(Control.new())
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(860, 420)
	scroll.add_child(grid)
	v._open_custom("Mercado de %s — Tu oro: %d" % [t["name"], int(d["gold"])], scroll)


# ---------------- Corte del señor ----------------

static func status_text(i: int) -> String:
	if N.at_war(-1, i):
		return "en guerra contigo"
	if N.allied(-1, i):
		return "tu aliado"
	return "en paz contigo"


static func court(v, i: int, town_id: int) -> void:
	var d = GS.data
	var l := N.lord(i)
	var si := GS.season_index()
	var lines := ["%s, %d años · %s · relación %d/100." % [N.full(l), int(l["age"]), status_text(i), int(l["rel"])]]
	if l["spouse"] != null:
		lines.append("Casado/a con %s." % l["spouse"]["name"])
	var kids := []
	for k in l["kids"]:
		kids.append("%s (%d)" % [k["name"], int(k["age"])])
	lines.append("Hijos: " + (", ".join(kids) if not kids.is_empty() else "ninguno"))
	var foes := []
	for f in R.enemies_of(i):
		if f != -1:
			foes.append(N.full(N.lord(f)))
	if not foes.is_empty():
		lines.append("Está en guerra con: " + ", ".join(foes))
	var err := N.can_court(i)
	var opts := []
	if N.at_war(-1, i):
		if l.has("peace_offer"):
			opts.append(["Aceptar la paz que te ofrece", func():
				N.make_peace(-1, i)
				court(v, i, town_id)])
		opts.append(["Proponer la paz", func():
			v._say("%s acepta la paz." % N.full(l) if N.ask_peace(i) else "%s rechaza la paz." % N.full(l))])
	else:
		opts.append(["Visitar la corte (una vez por estación)", func():
			l["visit"] = si
			N.add_rel(-1, i, 5)
			v._say("%s te recibe con cortesía. (+5 relación)" % N.full(l)), err == "" and int(l["visit"]) != si])
		opts.append(["Ofrecer un banquete (60 oro, una vez por estación)", func():
			l["feast"] = si
			d["gold"] = int(d["gold"]) - 60
			d["prestige"] += 5
			N.add_rel(-1, i, 15)
			v._say("El banquete es un éxito: música, vino y buena carne. (+15 relación, +5 prestigio)"), err == "" and int(l["feast"]) != si and int(d["gold"]) >= 60])
		opts.append(["Ir de cacería juntos (no en invierno)", func():
			l["hunt"] = si
			N.add_rel(-1, i, 10)
			GS.add("carne", 4)
			v._say("Cazáis un jabalí en los bosques de %s. (+10 relación, +4 carne)" % N.full(l)), err == "" and int(l["hunt"]) != si and int(d["season"]) != 3])
		opts.append(["Jugar al ajedrez (apuesta de 20 oro)", func(): chess(v, i, town_id, 0, 0), err == "" and int(d["gold"]) >= 20])
		var ev := N.tournament_at(town_id)
		if not ev.is_empty():
			opts.append(["¡Participar en el torneo!", func():
				d["battle"] = {"kind": "torneo", "lord": i, "enemy": "%s" % R.town(town_id)["name"], "troops": 1, "wall": 0}
				GS.save_game()
				v.main.start_battle(), err == ""])
		opts.append(["Proponer una boda entre vuestras casas", func(): marriage(v, i, town_id), err == ""])
		if not N.allied(-1, i):
			opts.append(["Proponer una alianza (hace falta relación 70)", func():
				v._say("%s acepta la alianza." % N.full(l) if N.ask_alliance(i) else "%s no se fía lo suficiente de ti." % N.full(l))])
		opts.append(["Declarar la guerra", func():
			N.declare_war(-1, i)
			court(v, i, town_id)])
	if err != "" and not N.at_war(-1, i):
		lines.append("")
		lines.append(err)
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Corte de %s" % N.full(l), "\n".join(lines), opts)


## Ajedrez al mejor de tres: cada jugada vence a una y pierde con otra.
static func chess(v, i: int, town_id: int, me: int, them: int) -> void:
	var l := N.lord(i)
	if me == 2 or them == 2:
		var d = GS.data
		if me == 2:
			d["gold"] = int(d["gold"]) + 20
			N.add_rel(-1, i, -2)
			v._say("¡Jaque mate! Ganas 20 de oro. %s no parece muy contento." % N.full(l))
		else:
			d["gold"] = int(d["gold"]) - 20
			N.add_rel(-1, i, 3)
			v._say("%s te gana la partida y se queda tus 20 de oro, de muy buen humor. (+3 relación)" % N.full(l))
		return
	var opts := []
	for m in 3:
		opts.append([CHESS[m], func():
			var ai := randi() % 3
			var text := "Tú: %s · %s: %s.\n" % [CHESS[m], N.full(l), CHESS[ai]]
			# Ataque gana a Gambito, Gambito gana a Defensa, Defensa gana a Ataque.
			var wins := (m == 0 and ai == 2) or (m == 2 and ai == 1) or (m == 1 and ai == 0)
			var nm := me + (1 if wins else 0)
			var nt := them + (1 if (m != ai and not wins) else 0)
			text += "¡Ganas esta jugada!" if wins else ("Tablas en esta jugada." if m == ai else "Pierdes esta jugada.")
			v._open_panel("Ajedrez — %d a %d" % [nm, nt], text, [["Seguir", func(): chess(v, i, town_id, nm, nt)]])])
	v._open_panel("Ajedrez — %d a %d" % [me, them], "Elige tu jugada. Ataque frontal vence al gambito, el gambito a la defensa cerrada y la defensa al ataque.\nGana quien llegue a 2.", opts)


static func marriage(v, i: int, town_id: int) -> void:
	var d = GS.data
	var l := N.lord(i)
	var theirs: Array = l["kids"].filter(func(k): return int(k["age"]) >= 16 and not k.has("wed"))
	var opts := []
	var p = d["player"]
	for k in theirs:
		if d["spouse"] == null and int(p["age"]) >= 16 and k["male"] != p["male"]:
			opts.append(["Casarte tú con %s (%d)" % [k["name"], int(k["age"])], func(): _wed(v, i, town_id, "tú", k["name"])])
		for c in d["children"]:
			if int(c["age"]) >= 16 and c["male"] != k["male"] and not c.has("wife"):
				opts.append(["Casar a tu %s %s con %s (%d)" % ["hijo" if c["male"] else "hija", c["name"], k["name"], int(k["age"])], func(): _wed(v, i, town_id, c["name"], k["name"])])
	var text := "Una boda une a las casas: trae alianza y prestigio. Aceptarán con más facilidad si la relación y tu prestigio son altos (relación %d/100)." % int(l["rel"])
	if opts.is_empty():
		text += "\n\nAhora no hay parejas posibles: hacen falta hijos solteros de 16 años o más en las dos casas (o que tú estés soltero/a)."
	opts.append(["Volver", func(): court(v, i, town_id)])
	v._open_panel("Bodas con la casa de %s" % N.full(l), text, opts)


static func _wed(v, i: int, town_id: int, who: String, kid: String) -> void:
	var err := N.propose_marriage(i, who, kid)
	v._say(err if err != "" else "¡Habrá boda! La alianza entre vuestras casas queda sellada.")


# ---------------- Resumen de diplomacia ----------------

static func diplomacy(v) -> void:
	var reg := R.region()
	var lines := []
	var opts := []
	for i in reg["lords"].size():
		var l = reg["lords"][i]
		lines.append("%s — %s · relación %d · %d soldados en sus pueblos" % [N.full(l), status_text(i), int(l["rel"]), R.lord_power(i)])
		if l.has("peace_offer") and N.at_war(-1, i):
			opts.append(["Aceptar la paz de %s" % N.full(l), func():
				N.make_peace(-1, i)
				diplomacy(v)])
	lines.append("")
	var wars := []
	for w in reg["wars"]:
		if int(w[0]) != -1 and int(w[1]) != -1:
			wars.append("%s contra %s" % [N.name_of(int(w[0])), N.name_of(int(w[1]))])
	lines.append("Guerras entre señores: " + (", ".join(wars) if not wars.is_empty() else "ninguna"))
	var al := []
	for a in reg["alliances"]:
		if int(a[0]) != -1 and int(a[1]) != -1:
			al.append("%s y %s" % [N.name_of(int(a[0])), N.name_of(int(a[1]))])
	lines.append("Alianzas: " + (", ".join(al) if not al.is_empty() else "ninguna"))
	var ev := []
	for e in reg["events"]:
		if int(e["until"]) > int(GS.data["total_days"]):
			ev.append("torneo de %s en %s" % [N.full(N.lord(int(e["lord"]))), R.town(int(e["town"]))["name"]])
	if not ev.is_empty():
		lines.append("Fiestas: " + ", ".join(ev))
	var marching := []
	for a in reg["armies"]:
		marching.append("%s (%d) hacia %s" % [N.full(N.lord(int(a["lord"]))), int(a["troops"]), R.town(int(a["target"])).get("name", "?")])
	lines.append("Ejércitos en marcha: " + (", ".join(marching) if not marching.is_empty() else "ninguno"))
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Diplomacia de la región", "\n".join(lines), opts)
