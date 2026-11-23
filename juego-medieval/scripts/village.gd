extends Node2D
## La aldea: vida del personaje, recursos, casa, familia y llamadas del rey.

const Art = preload("res://scripts/art.gd")
const WORLD := Vector2(2400, 1600)
const SPEED := 230.0
const PLAZA := Vector2(1200, 800)
const PLOT := Vector2(1040, 640)
const MARKET := Vector2(1390, 880)
const HALL := Vector2(1200, 420)
const CAMP := Vector2(2230, 820)
const TUNICS := [Color(0.6, 0.3, 0.2), Color(0.3, 0.5, 0.3), Color(0.55, 0.45, 0.25), Color(0.45, 0.3, 0.5), Color(0.35, 0.45, 0.55), Color(0.6, 0.55, 0.4), Color(0.5, 0.2, 0.25), Color(0.25, 0.4, 0.35)]
const GREETINGS := ["Buenos días. Dicen que este invierno será duro.", "¿Has visto los lobos cerca del bosque?", "El rey sube los impuestos otra vez...", "Mi abuelo luchó en la frontera, ¿sabes?", "El pan del mercado está más caro cada día.", "Si necesitas ayuda con la cosecha, avísame."]

var main
var ppos := PLAZA + Vector2(0, -60)
var walk := 0.0
var cooldown := 0.0
var trees: Array = []
var rocks: Array = []
var fields: Array = []
var flowers: Array = []
var vpos: Array = []
var vtarget: Array = []
var floats: Array = []
var inter := {}
var font: Font
var cam: Camera2D
var shade: CanvasModulate
var lbl_res: Label
var lbl_info: Label
var lbl_log: Label
var lbl_prompt: Label
var panel: PanelContainer
var box: VBoxContainer


func _ready() -> void:
	font = ThemeDB.fallback_font
	var r := RandomNumberGenerator.new()
	r.seed = 1234
	for i in 70:
		trees.append({"p": Vector2(r.randf_range(60, 640), r.randf_range(60, 900)), "s": r.randf_range(0.8, 1.3)})
	for i in 26:
		trees.append({"p": Vector2(r.randf_range(60, 2340), r.randf_range(1460, 1570)), "s": r.randf_range(0.8, 1.2)})
	for i in 22:
		rocks.append({"p": Vector2(r.randf_range(150, 650), r.randf_range(1100, 1400)), "s": r.randf_range(0.7, 1.4)})
	for i in 3:
		for j in 2:
			fields.append(Rect2(1800 + j * 190, 250 + i * 170, 170, 140))
	for i in 180:
		flowers.append({"p": Vector2(r.randf_range(0, WORLD.x), r.randf_range(0, WORLD.y)), "c": r.randi_range(0, 2)})

	shade = CanvasModulate.new()
	add_child(shade)
	cam = Camera2D.new()
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = int(WORLD.x)
	cam.limit_bottom = int(WORLD.y)
	cam.position_smoothing_enabled = true
	add_child(cam)
	cam.make_current()
	_build_hud()
	_reset_villagers()
	GS.notify.connect(func(_t): _refresh_log())
	_refresh_log()


func _reset_villagers() -> void:
	vpos.clear()
	vtarget.clear()
	for v in GS.data["villagers"]:
		var p := Vector2(v["hx"], v["hy"]) + Vector2(randf_range(-60, 60), randf_range(30, 120))
		vpos.append(p)
		vtarget.append(p)


# ---------------- HUD ----------------

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var top := PanelContainer.new()
	top.add_theme_stylebox_override("panel", Art.bar_style())
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	layer.add_child(top)
	lbl_res = Label.new()
	lbl_res.add_theme_font_size_override("font_size", 18)
	top.add_child(lbl_res)

	var info := PanelContainer.new()
	info.add_theme_stylebox_override("panel", Art.bar_style())
	info.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	info.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	info.offset_top = 50
	info.offset_right = -8
	layer.add_child(info)
	lbl_info = Label.new()
	lbl_info.add_theme_font_size_override("font_size", 15)
	info.add_child(lbl_info)

	var logp := PanelContainer.new()
	logp.add_theme_stylebox_override("panel", Art.bar_style())
	logp.grow_vertical = Control.GROW_DIRECTION_BEGIN
	logp.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	logp.offset_bottom = -8
	logp.offset_left = 8
	layer.add_child(logp)
	lbl_log = Label.new()
	lbl_log.add_theme_font_size_override("font_size", 14)
	lbl_log.custom_minimum_size.x = 560
	lbl_log.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	logp.add_child(lbl_log)

	lbl_prompt = Label.new()
	lbl_prompt.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	lbl_prompt.grow_horizontal = Control.GROW_DIRECTION_BOTH
	lbl_prompt.offset_top = -200
	lbl_prompt.offset_bottom = -170
	lbl_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl_prompt.add_theme_font_size_override("font_size", 22)
	lbl_prompt.add_theme_color_override("font_outline_color", Color.BLACK)
	lbl_prompt.add_theme_constant_override("outline_size", 6)
	layer.add_child(lbl_prompt)

	var help := Label.new()
	help.text = "WASD: mover · E: usar · T: velocidad · Esc: menú"
	help.add_theme_font_size_override("font_size", 13)
	help.add_theme_color_override("font_outline_color", Color.BLACK)
	help.add_theme_constant_override("outline_size", 4)
	help.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	help.grow_vertical = Control.GROW_DIRECTION_BEGIN
	help.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	help.offset_right = -10
	help.offset_bottom = -8
	layer.add_child(help)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(center)
	panel = PanelContainer.new()
	panel.add_theme_stylebox_override("panel", Art.panel_style())
	panel.visible = false
	center.add_child(panel)
	box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)


func _update_hud() -> void:
	var d = GS.data
	lbl_res.text = "   Oro: %d      Madera: %d      Piedra: %d      Comida: %d      Prestigio: %d      Tiempo: x%d" % [int(d["gold"]), int(d["wood"]), int(d["stone"]), int(d["food"]), int(d["prestige"]), int(GS.speed)]
	var p = d["player"]
	var lines := []
	lines.append("%s %s" % [p["name"], d["dynasty"]])
	lines.append("%s · %d años · Salud %d" % [["Campesino", "Jefe del pueblo"][int(d["title"])] if p["male"] else ["Campesina", "Jefa del pueblo"][int(d["title"])], int(p["age"]), int(p["health"])])
	lines.append("Casa: %s" % GS.HOUSE_NAMES[int(d["house_level"])])
	if d["spouse"] != null:
		lines.append("Cónyuge: %s" % d["spouse"]["name"])
	else:
		lines.append("Soltero" if p["male"] else "Soltera")
	lines.append("Hijos: %d · Generación %d" % [d["children"].size(), int(d["generation"])])
	lines.append("%s, día %d · Año %d · %02d:00" % [GS.SEASONS[int(d["season"])], int(d["day"]), int(d["year"]), int(d["time"] * 24.0)])
	if d["summons"] != null:
		var left: int = int(d["summons"]["deadline"]) - int(d["total_days"])
		lines.append("")
		lines.append("¡LLAMADA DEL REY!")
		lines.append("Contra %s" % d["summons"]["enemy"])
		lines.append("Quedan %d días · Campamento al este" % maxi(left, 0))
	lbl_info.text = "\n".join(lines)
	lbl_prompt.text = "" if panel.visible or inter.is_empty() else "[E] " + inter["label"]


func _refresh_log() -> void:
	if lbl_log:
		var l: Array = GS.data["log"]
		lbl_log.text = "\n".join(l.slice(maxi(0, l.size() - 5)))


func _open_panel(title: String, text: String, options: Array) -> void:
	for c in box.get_children():
		c.queue_free()
	var t := Label.new()
	t.text = title
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
	box.add_child(t)
	var b := Label.new()
	b.text = text
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.custom_minimum_size.x = 540
	box.add_child(b)
	var first: Button = null
	for o in options:
		var btn := Button.new()
		btn.text = o[0]
		btn.custom_minimum_size.y = 36
		if o.size() > 2 and not o[2]:
			btn.disabled = true
		btn.pressed.connect(o[1])
		box.add_child(btn)
		if first == null and not btn.disabled:
			first = btn
	panel.visible = true
	if first:
		first.grab_focus.call_deferred()


func _close_panel() -> void:
	panel.visible = false


# ---------------- Bucle ----------------

func _process(delta: float) -> void:
	var d = GS.data
	if not panel.visible and not GS.popups.is_empty():
		_show_popup(GS.popups.pop_front())
	if not panel.visible and not d.get("game_over", false):
		var dir := Vector2(
			float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)),
			float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)))
		if dir != Vector2.ZERO:
			ppos = (ppos + dir.normalized() * SPEED * delta).clamp(Vector2(20, 40), WORLD - Vector2(20, 20))
			walk += delta
		GS.advance(delta)
		inter = _find_interaction()
		if Input.is_key_pressed(KEY_E) and inter.get("type", "") in ["tree", "rock", "field"]:
			_gather(inter["type"])
		_move_villagers(delta)
	cooldown -= delta
	for f in floats:
		f["p"].y -= 35.0 * delta
		f["life"] -= delta
	floats = floats.filter(func(f): return f["life"] > 0)
	cam.position = ppos
	var t: float = d["time"]
	var light := clampf(1.55 - absf(t - 0.5) * 2.2, 0.42, 1.0)
	shade.color = Color(light, light, minf(1.0, light + 0.12))
	_update_hud()
	queue_redraw()


func _move_villagers(delta: float) -> void:
	var t: float = GS.data["time"]
	var night := t < 0.22 or t > 0.85
	var vil: Array = GS.data["villagers"]
	for i in vpos.size():
		var home := Vector2(vil[i]["hx"], vil[i]["hy"]) + Vector2(0, 25)
		if night:
			vtarget[i] = home
		elif vpos[i].distance_to(vtarget[i]) < 4 and randf() < 0.01:
			vtarget[i] = home + Vector2(randf_range(-170, 170), randf_range(10, 170))
		vpos[i] = vpos[i].move_toward(vtarget[i], 55.0 * delta * GS.speed)


func _find_interaction() -> Dictionary:
	var d = GS.data
	for i in vpos.size():
		if ppos.distance_to(vpos[i]) < 40:
			return {"type": "villager", "i": i, "label": "Hablar con %s" % d["villagers"][i]["name"]}
	if ppos.distance_to(PLOT) < 85:
		return {"type": "house", "label": "Tu parcela" if int(d["house_level"]) == 0 else "Tu casa"}
	if ppos.distance_to(MARKET) < 95:
		return {"type": "market", "label": "Mercado"}
	if ppos.distance_to(HALL) < 110:
		return {"type": "hall", "label": "Casa del Concejo"}
	if ppos.distance_to(CAMP) < 120:
		return {"type": "camp", "label": "Campamento del rey"}
	for tr in trees:
		if ppos.distance_to(tr["p"]) < 40:
			return {"type": "tree", "label": "Talar leña (mantén E)"}
	for rk in rocks:
		if ppos.distance_to(rk["p"]) < 38:
			return {"type": "rock", "label": "Picar piedra (mantén E)"}
	for f in fields:
		if f.has_point(ppos):
			return {"type": "field", "label": "Trabajar el campo (mantén E)"}
	return {}


func _unhandled_input(ev: InputEvent) -> void:
	if not (ev is InputEventKey and ev.pressed and not ev.echo):
		return
	match ev.keycode:
		KEY_E:
			if not panel.visible and not GS.data.get("game_over", false):
				_interact()
		KEY_ESCAPE:
			if panel.visible:
				if not GS.data.get("game_over", false):
					_close_panel()
			else:
				_pause_menu()
		KEY_T:
			GS.speed = {1.0: 3.0, 3.0: 6.0}.get(GS.speed, 1.0)
		KEY_F5:
			GS.save_game()
			_float("Partida guardada", Color.WHITE)


func _float(text: String, col: Color) -> void:
	floats.append({"t": text, "p": ppos + Vector2(0, -45), "life": 1.1, "c": col})


# ---------------- Interacciones ----------------

func _interact() -> void:
	match inter.get("type", ""):
		"tree", "rock", "field":
			_gather(inter["type"])
		"villager":
			_villager_panel(inter["i"])
		"house":
			_house_panel()
		"market":
			_market_panel()
		"hall":
			_hall_panel()
		"camp":
			_camp_panel()


func _gather(type: String) -> void:
	if cooldown > 0:
		return
	var d = GS.data
	match type:
		"tree":
			d["wood"] += 1
			cooldown = 0.45
			_float("+1 madera", Color(0.95, 0.75, 0.45))
		"rock":
			d["stone"] += 1
			cooldown = 0.6
			_float("+1 piedra", Color(0.85, 0.85, 0.9))
		"field":
			var amt: int = [1, 2, 2, 0][int(d["season"])]
			if amt == 0:
				cooldown = 1.5
				_float("La tierra está helada", Color(0.7, 0.85, 1.0))
			else:
				d["food"] += amt
				cooldown = 0.7
				_float("+%d comida" % amt, Color(0.6, 1.0, 0.5))


func _house_panel() -> void:
	var d = GS.data
	var lvl := int(d["house_level"])
	var opts := []
	var text := "Tu hogar: %s.\nMadera %d · Piedra %d · Oro %d" % [GS.HOUSE_NAMES[lvl], int(d["wood"]), int(d["stone"]), int(d["gold"])]
	if lvl == 0:
		text += "\n\nNecesitas una casa para casarte y para dormir."
	if lvl < 3:
		var c = GS.HOUSE_COSTS[lvl]
		opts.append(["%s %s (%d madera, %d piedra, %d oro)" % ["Construir" if lvl == 0 else "Mejorar a", GS.HOUSE_NAMES[lvl + 1], c["wood"], c["stone"], c["gold"]], func():
			var err: String = GS.try_build_house()
			if err != "":
				_float(err, Color(1, 0.5, 0.4))
			_house_panel()])
	if lvl >= 1:
		opts.append(["Dormir hasta el amanecer", func():
			GS.sleep()
			_close_panel()])
	opts.append(["Ver familia", _family_panel])
	opts.append(["Guardar partida", func():
		GS.save_game()
		_float("Partida guardada", Color.WHITE)
		_close_panel()])
	opts.append(["Cerrar", _close_panel])
	_open_panel("Tu casa", text, opts)


func _family_panel() -> void:
	var d = GS.data
	var p = d["player"]
	var lines := ["Linaje %s · Generación %d" % [d["dynasty"], int(d["generation"])], "", "%s (%d años) — cabeza de familia" % [p["name"], int(p["age"])]]
	if d["spouse"] != null:
		lines.append("%s (%d años) — cónyuge" % [d["spouse"]["name"], int(d["spouse"]["age"])])
	var heir_age := -1
	for c in d["children"]:
		heir_age = maxi(heir_age, int(c["age"]))
	for c in d["children"]:
		var tag := " — heredero" if int(c["age"]) == heir_age else ""
		lines.append("%s (%d años) — %s%s" % [c["name"], int(c["age"]), "hijo" if c["male"] else "hija", tag])
	if d["children"].is_empty():
		lines.append("")
		lines.append("Sin hijos. Si mueres sin herederos, tu linaje se extingue.")
	lines.append("")
	lines.append("La familia come %d de comida al día." % GS.family_size())
	_open_panel("Familia", "\n".join(lines), [["Volver", _house_panel], ["Cerrar", _close_panel]])


func _villager_panel(i: int) -> void:
	var d = GS.data
	var v = d["villagers"][i]
	var talked: bool = v["name"] in d["talked"]
	var text := "%s, %d años.\nAfecto: %d / 100" % [v["name"], int(v["age"]), int(v["affection"])]
	if int(v["affection"]) >= 100:
		text += "\n\nSe le ve muy feliz de verte..."
	var opts := []
	opts.append(["Charlar (una vez al día)", func():
		v["affection"] = mini(100, int(v["affection"]) + randi_range(6, 12))
		d["talked"].append(v["name"])
		_float(GREETINGS.pick_random(), Color(1, 1, 0.85))
		_villager_panel(i), not talked])
	opts.append(["Regalar 5 de comida (+15 afecto)", func():
		d["food"] -= 5
		v["affection"] = mini(100, int(v["affection"]) + 15)
		_villager_panel(i), d["food"] >= 5])
	opts.append(["Regalar 5 de oro (+20 afecto)", func():
		d["gold"] -= 5
		v["affection"] = mini(100, int(v["affection"]) + 20)
		_villager_panel(i), d["gold"] >= 5])
	if int(v["affection"]) >= 100:
		opts.append(["Proponer matrimonio", func():
			var err: String = GS.marry(i)
			if err != "":
				_open_panel("Matrimonio", err, [["Cerrar", _close_panel]])
			else:
				_reset_villagers()
				_open_panel("¡Boda!", "Te has casado con %s. Pronto podréis tener hijos que continúen el linaje." % d["spouse"]["name"], [["Cerrar", _close_panel]])])
	opts.append(["Adiós", _close_panel])
	_open_panel(v["name"], text, opts)


func _market_panel() -> void:
	var d = GS.data
	var w := int(d["weapon"])
	var a := int(d["armor"])
	var text := "Oro %d · Madera %d · Piedra %d · Comida %d\nEspada nivel %d · Armadura nivel %d" % [int(d["gold"]), int(d["wood"]), int(d["stone"]), int(d["food"]), w, a]
	var opts := [
		["Vender 10 madera (+6 oro)", func(): _trade("wood", -10, 6), d["wood"] >= 10],
		["Vender 10 piedra (+8 oro)", func(): _trade("stone", -10, 8), d["stone"] >= 10],
		["Vender 10 comida (+5 oro)", func(): _trade("food", -10, 5), d["food"] >= 10],
		["Comprar 5 comida (-4 oro)", func(): _trade("food", 5, -4), d["gold"] >= 4],
	]
	if w < 3:
		opts.append(["Comprar espada nivel %d (-%d oro)" % [w + 1, 25 * (w + 1)], func(): _trade("weapon", 1, -25 * (w + 1)), d["gold"] >= 25 * (w + 1)])
	if a < 3:
		opts.append(["Comprar armadura nivel %d (-%d oro)" % [a + 1, 25 * (a + 1)], func(): _trade("armor", 1, -25 * (a + 1)), d["gold"] >= 25 * (a + 1)])
	opts.append(["Cerrar", _close_panel])
	_open_panel("Mercado", text, opts)


func _trade(key: String, amount: int, gold: int) -> void:
	GS.data[key] += amount
	GS.data["gold"] += gold
	_market_panel()


func _hall_panel() -> void:
	var d = GS.data
	var opts := []
	var text: String
	if int(d["title"]) == 0:
		text = "El concejo del pueblo se reúne aquí.\n\nPara ser elegido jefe necesitas %d de prestigio y una Casa de piedra.\nTu prestigio: %d.\n\nGana prestigio construyendo, formando familia y luchando por el rey." % [GS.CHIEF_PRESTIGE, int(d["prestige"])]
		opts.append(["Reclamar la jefatura del pueblo", func():
			var err: String = GS.claim_chief()
			if err != "":
				_float(err, Color(1, 0.5, 0.4))
			_hall_panel(), int(d["prestige"]) >= GS.CHIEF_PRESTIGE and int(d["house_level"]) >= 2])
	else:
		var can_tax: bool = int(d["taxed"]) != GS.season_index()
		text = "Eres el jefe del pueblo.\nCuando el rey llame a las armas, llevarás a la milicia contigo.\n\n(Próxima fase: gobernar la aldea, reclutar y dirigir ejércitos.)"
		opts.append(["Cobrar impuestos (una vez por estación, +%d oro)" % (5 * d["villagers"].size()), func():
			d["gold"] += 5 * d["villagers"].size()
			d["taxed"] = GS.season_index()
			GS.say("Cobras los impuestos del pueblo.")
			_hall_panel(), can_tax])
	opts.append(["Cerrar", _close_panel])
	_open_panel("Casa del Concejo", text, opts)


func _camp_panel() -> void:
	var d = GS.data
	if d["summons"] == null:
		_open_panel("Campamento del rey", "El campamento está vacío.\nCuando el rey llame a las armas, aquí se reunirán las tropas.", [["Cerrar", _close_panel]])
		return
	var text := "El capitán del rey reúne a los hombres para luchar contra %s.\n\nTu salud: %d · Espada nivel %d · Armadura nivel %d" % [d["summons"]["enemy"], int(d["player"]["health"]), int(d["weapon"]), int(d["armor"])]
	if int(d["title"]) == 1:
		text += "\n\nComo jefe, la milicia del pueblo marcha contigo."
	_open_panel("Campamento del rey", text, [["¡Partir a la batalla!", func():
		GS.save_game()
		main.start_battle()], ["Todavía no", _close_panel]])


func _pause_menu() -> void:
	_open_panel("Pausa", "", [
		["Continuar", _close_panel],
		["Guardar partida", func():
			GS.save_game()
			_float("Partida guardada", Color.WHITE)
			_close_panel()],
		["Guardar y volver al menú", func():
			GS.save_game()
			main.show_menu()],
		["Salir del juego", func():
			GS.save_game()
			get_tree().quit()],
	])


func _show_popup(pp: Dictionary) -> void:
	if GS.data.get("game_over", false):
		_open_panel(pp["title"], pp["text"], [["Volver al menú", func(): main.show_menu()]])
	else:
		_open_panel(pp["title"], pp["text"], [["Continuar con el heredero", _close_panel]])


# ---------------- Dibujo ----------------

func _text(pos: Vector2, txt: String, size: int = 16, col: Color = Color.WHITE) -> void:
	draw_string_outline(font, pos + Vector2(-200, 0), txt, HORIZONTAL_ALIGNMENT_CENTER, 400, size, 4, Color(0, 0, 0, 0.8))
	draw_string(font, pos + Vector2(-200, 0), txt, HORIZONTAL_ALIGNMENT_CENTER, 400, size, col)


func _draw() -> void:
	var d = GS.data
	var season := int(d["season"])
	draw_rect(Rect2(Vector2.ZERO, WORLD), [Color(0.36, 0.6, 0.28), Color(0.42, 0.62, 0.25), Color(0.52, 0.55, 0.26), Color(0.84, 0.87, 0.9)][season])
	if season < 2:
		for f in flowers:
			draw_circle(f["p"], 3, [Color(1, 0.9, 0.3), Color(1, 0.55, 0.65), Color.WHITE][f["c"]])
	var dirt := Color(0.56, 0.45, 0.31) if season != 3 else Color(0.72, 0.7, 0.68)
	for target in [HALL, CAMP, Vector2(1950, 470), Vector2(450, 520), Vector2(450, 1250), PLOT, Vector2(1200, 1600), Vector2(760, 1000), Vector2(1640, 1040)]:
		draw_line(PLAZA, target, dirt, 44)
	draw_circle(PLAZA, 190, dirt)
	draw_circle(PLAZA, 26, Color(0.45, 0.45, 0.48))
	draw_circle(PLAZA, 17, Color(0.15, 0.25, 0.4))
	for f in fields:
		_draw_field(f, season)
	for rk in rocks:
		_draw_rock(rk["p"], rk["s"])

	for i in GS.HOMES.size():
		_draw_house(GS.HOMES[i], 0.85, Color(0.55, 0.38, 0.2) if i % 2 == 0 else Color(0.66, 0.64, 0.6), Color(0.78, 0.66, 0.35) if i % 2 == 0 else Color(0.55, 0.25, 0.18))
	_draw_player_house(int(d["house_level"]))
	_draw_house(HALL, 1.6, Color(0.62, 0.6, 0.56), Color(0.3, 0.32, 0.4))
	draw_line(HALL + Vector2(90, -60), HALL + Vector2(90, -150), Color(0.3, 0.2, 0.1), 4)
	draw_rect(Rect2(HALL + Vector2(90, -150), Vector2(40, 26)), Color(0.15, 0.3, 0.7))
	_text(HALL + Vector2(0, 26), "Casa del Concejo")
	for k in 3:
		_draw_stall(MARKET + Vector2((k - 1) * 75, 0), [Color(0.75, 0.2, 0.2), Color(0.2, 0.45, 0.75), Color(0.8, 0.65, 0.2)][k])
	_text(MARKET + Vector2(0, 40), "Mercado")
	_draw_camp(d["summons"] != null)

	var vil: Array = d["villagers"]
	for i in vpos.size():
		Art.person(self, vpos[i], TUNICS[i % TUNICS.size()], vil[i]["male"], vpos[i].x * 0.05)
		if ppos.distance_to(vpos[i]) < 140:
			_text(vpos[i] + Vector2(0, -30), vil[i]["name"], 13)
	var now := Time.get_ticks_msec() / 1000.0
	if d["spouse"] != null:
		Art.person(self, PLOT + Vector2(80 + sin(now * 0.5) * 20, 20), Color(0.7, 0.55, 0.3), d["spouse"]["male"], now * 0.3)
	var k := 0
	for c in d["children"]:
		var s := clampf(0.45 + float(c["age"]) * 0.035, 0.45, 1.0)
		Art.person(self, PLOT + Vector2(-70 + k * 26 + sin(now + k) * 10, 62), Color(0.4, 0.6, 0.75), c["male"], now + k, s)
		k += 1

	draw_arc(ppos + Vector2(0, 18), 14, 0, TAU, 20, Color(1, 0.85, 0.3, 0.8), 2)
	Art.person(self, ppos, Color(0.15, 0.3, 0.75), d["player"]["male"], walk)
	if int(d["title"]) == 1:
		draw_colored_polygon(PackedVector2Array([ppos + Vector2(-7, -21), ppos + Vector2(7, -21), ppos + Vector2(8, -29), ppos + Vector2(3, -25), ppos + Vector2(0, -31), ppos + Vector2(-3, -25), ppos + Vector2(-8, -29)]), Color(1, 0.82, 0.2))

	for tr in trees:
		_draw_tree(tr["p"], tr["s"], season)
	for f in floats:
		_text(f["p"], f["t"], 16, f["c"])


func _draw_field(r: Rect2, season: int) -> void:
	draw_rect(r, Color(0.45, 0.32, 0.18))
	var crop: Color = [Color(0.5, 0.75, 0.3), Color(0.3, 0.6, 0.2), Color(0.88, 0.72, 0.25), Color(0.92, 0.93, 0.96)][season]
	var y := r.position.y + 14
	while y < r.end.y - 6:
		draw_line(Vector2(r.position.x + 8, y), Vector2(r.end.x - 8, y), crop, 7)
		y += 18
	draw_rect(r, Color(0.35, 0.25, 0.12), false, 3)


func _draw_tree(p: Vector2, s: float, season: int) -> void:
	draw_circle(p + Vector2(4, 8), 24 * s, Color(0, 0, 0, 0.18))
	draw_rect(Rect2(p.x - 5 * s, p.y - 4, 10 * s, 22 * s), Color(0.4, 0.26, 0.12))
	var leaf: Color = [Color(0.22, 0.52, 0.22), Color(0.16, 0.44, 0.16), Color(0.78, 0.46, 0.15), Color(0.86, 0.9, 0.93)][season]
	draw_circle(p + Vector2(0, -14) * s, 24 * s, leaf)
	draw_circle(p + Vector2(-12, -4) * s, 16 * s, leaf.darkened(0.12))
	draw_circle(p + Vector2(12, -6) * s, 17 * s, leaf.lightened(0.08))


func _draw_rock(p: Vector2, s: float) -> void:
	draw_colored_polygon(PackedVector2Array([p + Vector2(-20, 8) * s, p + Vector2(-14, -12) * s, p + Vector2(4, -18) * s, p + Vector2(20, -4) * s, p + Vector2(16, 10) * s]), Color(0.48, 0.48, 0.5))
	draw_colored_polygon(PackedVector2Array([p + Vector2(-12, -10) * s, p + Vector2(4, -16) * s, p + Vector2(2, -4) * s]), Color(0.65, 0.65, 0.68))


func _draw_house(p: Vector2, s: float, wall: Color, roof: Color) -> void:
	var w := 90.0 * s
	var h := 60.0 * s
	draw_rect(Rect2(p.x - w / 2 + 6, p.y - h + 6, w, h), Color(0, 0, 0, 0.2))
	draw_rect(Rect2(p.x - w / 2, p.y - h, w, h), wall)
	draw_colored_polygon(PackedVector2Array([Vector2(p.x - w / 2 - 8, p.y - h), Vector2(p.x + w / 2 + 8, p.y - h), Vector2(p.x, p.y - h - 45 * s)]), roof)
	draw_rect(Rect2(p.x - 8 * s, p.y - 24 * s, 16 * s, 24 * s), Color(0.3, 0.18, 0.08))
	draw_rect(Rect2(p.x + w / 4 - 6 * s, p.y - h + 14 * s, 12 * s, 12 * s), Color(0.95, 0.85, 0.45))


func _draw_player_house(lvl: int) -> void:
	var d = GS.data
	match lvl:
		0:
			draw_rect(Rect2(PLOT.x - 60, PLOT.y - 70, 120, 70), Color(0.6, 0.5, 0.3, 0.35))
			for c in [Vector2(-60, -70), Vector2(60, -70), Vector2(-60, 0), Vector2(60, 0)]:
				draw_line(PLOT + c, PLOT + c + Vector2(0, -14), Color(0.4, 0.26, 0.12), 4)
			_text(PLOT + Vector2(0, -30), "Tu parcela", 15, Color(1, 0.9, 0.6))
			return
		1:
			_draw_house(PLOT, 0.8, Color(0.55, 0.38, 0.2), Color(0.82, 0.7, 0.36))
		2:
			_draw_house(PLOT, 1.05, Color(0.7, 0.68, 0.63), Color(0.6, 0.24, 0.17))
		3:
			draw_rect(Rect2(PLOT.x + 50, PLOT.y - 130, 40, 130), Color(0.6, 0.58, 0.54))
			draw_colored_polygon(PackedVector2Array([Vector2(PLOT.x + 44, PLOT.y - 130), Vector2(PLOT.x + 96, PLOT.y - 130), Vector2(PLOT.x + 70, PLOT.y - 170)]), Color(0.3, 0.32, 0.4))
			_draw_house(PLOT, 1.3, Color(0.74, 0.72, 0.66), Color(0.55, 0.2, 0.15))
			draw_rect(Rect2(PLOT.x + 72, PLOT.y - 195, 30, 20), Color(0.6, 0.1, 0.1))
	_text(PLOT + Vector2(0, 30), "Casa %s" % d["dynasty"], 15, Color(1, 0.9, 0.6))


func _draw_stall(p: Vector2, col: Color) -> void:
	draw_rect(Rect2(p.x - 30, p.y - 20, 60, 26), Color(0.45, 0.3, 0.15))
	for i in 4:
		draw_rect(Rect2(p.x - 34 + i * 17, p.y - 44, 17, 16), col if i % 2 == 0 else Color(0.95, 0.92, 0.85))
	draw_circle(p + Vector2(-12, -24), 6, Color(0.9, 0.5, 0.2))
	draw_circle(p + Vector2(8, -24), 6, Color(0.6, 0.8, 0.3))


func _draw_camp(active: bool) -> void:
	for o in [Vector2(-70, -40), Vector2(40, -60), Vector2(-20, 50), Vector2(80, 30)]:
		var p: Vector2 = CAMP + o
		draw_colored_polygon(PackedVector2Array([p + Vector2(-28, 16), p + Vector2(28, 16), p + Vector2(0, -26)]), Color(0.85, 0.8, 0.65))
		draw_line(p + Vector2(0, -26), p + Vector2(0, 16), Color(0.5, 0.4, 0.3), 2)
	draw_line(CAMP + Vector2(0, 10), CAMP + Vector2(0, -90), Color(0.3, 0.2, 0.1), 4)
	draw_rect(Rect2(CAMP + Vector2(0, -90), Vector2(44, 28)), Color(0.75, 0.1, 0.1) if active else Color(0.5, 0.5, 0.5))
	_text(CAMP + Vector2(0, 90), "Campamento del rey" + ("  ¡A LAS ARMAS!" if active else ""), 15, Color(1, 0.6, 0.5) if active else Color.WHITE)
