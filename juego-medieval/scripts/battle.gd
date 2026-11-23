extends Node2D
## Batalla en tiempo real: controlas a tu personaje junto a tus aliados.

const Art = preload("res://scripts/art.gd")
const ARENA := Vector2(1280, 720)

var main
var units: Array = []
var pl: Dictionary
var over := false
var swings: Array = []
var decor: Array = []
var kills := 0
var enemy_total := 0
var enemy_name := ""
var lbl: Label
var result_panel: PanelContainer
var result_label: Label


func _unit(pos: Vector2, team: int, hp: float, dmg: float, spd: float) -> Dictionary:
	return {"pos": pos, "team": team, "hp": hp, "max": hp, "dmg": dmg, "speed": spd, "cd": randf() * 0.8,
		"alive": true, "face": Vector2.RIGHT if team == 0 else Vector2.LEFT, "walk": randf(), "male": randf() < 0.85, "hit": 0.0}


func _ready() -> void:
	var d = GS.data
	enemy_name = d["summons"]["enemy"] if d["summons"] != null else "unos bandidos"
	for i in 80:
		decor.append(Vector2(randf_range(0, ARENA.x), randf_range(0, ARENA.y)))
	pl = _unit(Vector2(230, 360), 0, 100.0, 20.0 + 10.0 * int(d["weapon"]), 210.0)
	pl["hp"] = maxf(float(d["player"]["health"]), 20.0)
	pl["player"] = true
	pl["male"] = d["player"]["male"]
	units.append(pl)
	var allies := 4 + (6 if int(d["title"]) == 1 else 0)
	for i in allies:
		units.append(_unit(Vector2(randf_range(110, 260), randf_range(140, 580)), 0, 45, 9, 120))
	enemy_total = 6 + mini(8, (int(d["year"]) - 1100) / 2) + randi_range(0, 2)
	for i in enemy_total:
		units.append(_unit(Vector2(randf_range(1000, 1180), randf_range(120, 600)), 1, 40, 8, 115))
	var cap := _unit(Vector2(1170, 360), 1, 100, 13, 105)
	cap["captain"] = true
	cap["male"] = true
	units.append(cap)
	enemy_total += 1
	_build_hud()


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var top := PanelContainer.new()
	top.add_theme_stylebox_override("panel", Art.bar_style())
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	layer.add_child(top)
	lbl = Label.new()
	lbl.add_theme_font_size_override("font_size", 18)
	top.add_child(lbl)
	var help := Label.new()
	help.text = "WASD: mover · Clic izquierdo: atacar · Clic derecho (mantener): bloquear con el escudo"
	help.add_theme_color_override("font_outline_color", Color.BLACK)
	help.add_theme_constant_override("outline_size", 4)
	help.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	help.grow_horizontal = Control.GROW_DIRECTION_BOTH
	help.offset_top = -34
	layer.add_child(help)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(center)
	result_panel = PanelContainer.new()
	result_panel.add_theme_stylebox_override("panel", Art.panel_style())
	result_panel.visible = false
	center.add_child(result_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	result_panel.add_child(box)
	result_label = Label.new()
	result_label.add_theme_font_size_override("font_size", 20)
	result_label.custom_minimum_size.x = 460
	result_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(result_label)
	var b := Button.new()
	b.text = "Volver al pueblo"
	b.custom_minimum_size.y = 40
	b.pressed.connect(func(): main.start_village())
	box.add_child(b)


func _enemies_alive() -> int:
	return units.filter(func(u): return u["alive"] and u["team"] == 1).size()


func _allies_alive() -> int:
	return units.filter(func(u): return u["alive"] and u["team"] == 0 and not u.has("player")).size()


func _process(delta: float) -> void:
	for s in swings:
		s["t"] -= delta
	swings = swings.filter(func(s): return s["t"] > 0)
	queue_redraw()
	if over:
		return
	lbl.text = "   Batalla contra %s      Tu salud: %d      Aliados: %d      Enemigos: %d      Abatidos por ti: %d" % [enemy_name, int(pl["hp"]), _allies_alive(), _enemies_alive(), kills]

	var dir := Vector2(
		float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)),
		float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)))
	var blocking := Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
	pl["blocking"] = blocking
	if dir != Vector2.ZERO:
		pl["pos"] += dir.normalized() * pl["speed"] * (0.5 if blocking else 1.0) * delta
		pl["walk"] += delta
	pl["pos"] = pl["pos"].clamp(Vector2(20, 50), ARENA - Vector2(20, 30))
	var to_mouse: Vector2 = get_global_mouse_position() - pl["pos"]
	if to_mouse.length() > 1:
		pl["face"] = to_mouse.normalized()
	pl["cd"] -= delta
	pl["hit"] -= delta
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and pl["cd"] <= 0 and not blocking:
		_player_attack()

	for u in units:
		if over:
			return
		if not u["alive"] or u.has("player"):
			continue
		u["cd"] -= delta
		u["hit"] -= delta
		var tgt = _nearest(u)
		if tgt == null:
			continue
		var to: Vector2 = tgt["pos"] - u["pos"]
		u["face"] = to.normalized()
		if to.length() > 26:
			var sep := Vector2.ZERO
			for o in units:
				if o["alive"] and o["team"] == u["team"] and not is_same(o, u):
					var dd: Vector2 = u["pos"] - o["pos"]
					if dd.length() < 22 and dd.length() > 0.01:
						sep += dd.normalized()
			u["pos"] += (to.normalized() + sep * 0.6).normalized() * u["speed"] * delta
			u["walk"] += delta
		elif u["cd"] <= 0:
			u["cd"] = 1.0 + randf() * 0.5
			swings.append({"pos": u["pos"], "dir": u["face"], "t": 0.15, "r": 30.0})
			_damage(tgt, u["dmg"] * randf_range(0.8, 1.2), u)


func _nearest(u: Dictionary):
	var best = null
	var bd := INF
	for o in units:
		if o["alive"] and o["team"] != u["team"]:
			var dist: float = u["pos"].distance_to(o["pos"])
			if dist < bd:
				bd = dist
				best = o
	return best


func _player_attack() -> void:
	pl["cd"] = 0.45
	swings.append({"pos": pl["pos"], "dir": pl["face"], "t": 0.18, "r": 46.0})
	for u in units:
		if u["alive"] and u["team"] == 1:
			var to: Vector2 = u["pos"] - pl["pos"]
			if to.length() < 60 and to.normalized().dot(pl["face"]) > 0.35:
				_damage(u, pl["dmg"] * randf_range(0.9, 1.2), pl)


func _damage(t: Dictionary, amount: float, src: Dictionary) -> void:
	if over or not t["alive"]:
		return
	if t.has("player"):
		amount *= 1.0 - 0.15 * int(GS.data["armor"])
		if t.get("blocking", false):
			amount *= 0.25
	t["hp"] -= amount
	t["hit"] = 0.12
	if t["hp"] > 0:
		return
	t["hp"] = 0
	t["alive"] = false
	if src.has("player"):
		kills += 1
	if t.has("player"):
		_end(false)
	elif _enemies_alive() == 0:
		_end(true)


func _end(victory: bool) -> void:
	over = true
	var d = GS.data
	var chief := int(d["title"]) == 1
	var text: String
	if victory:
		var gold := 10 + 4 * enemy_total + 3 * kills
		var pres := 25 + 2 * kills + (15 if chief else 0)
		d["gold"] += gold
		d["prestige"] += pres
		d["player"]["health"] = maxf(pl["hp"], 10.0)
		text = "¡VICTORIA!\n\nHabéis derrotado a %s.\nEnemigos abatidos por ti: %d\n\nBotín: +%d oro\nPrestigio: +%d" % [enemy_name, kills, gold, pres]
		GS.say("Victoria contra %s. +%d oro, +%d prestigio." % [enemy_name, gold, pres])
	else:
		d["prestige"] = maxi(0, int(d["prestige"]) - 5)
		if randf() < 0.25:
			text = "DERROTA\n\nCaíste en el campo de batalla..."
			GS.player_death("murió luchando contra %s" % enemy_name)
		else:
			d["player"]["health"] = 15.0
			text = "DERROTA\n\nFuiste herido de gravedad y tus compañeros te sacaron del campo de batalla.\nPrestigio: -5"
			GS.say("Derrota contra %s. Vuelves herido." % enemy_name)
	d["summons"] = null
	GS.next_day()
	GS.save_game()
	result_label.text = text
	result_panel.visible = true


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, ARENA), Color(0.4, 0.56, 0.28))
	for p in decor:
		draw_circle(p, 3, Color(0.32, 0.47, 0.22))
	for u in units:
		if not u["alive"]:
			var c: Color = Color(0.25, 0.32, 0.55) if u["team"] == 0 else Color(0.5, 0.2, 0.18)
			draw_rect(Rect2(u["pos"] + Vector2(-12, -4), Vector2(24, 9)), c)
			draw_circle(u["pos"] + Vector2(15, 0), 6, Color(0.75, 0.62, 0.52))
	var alive := units.filter(func(u): return u["alive"])
	alive.sort_custom(func(a, b): return a["pos"].y < b["pos"].y)
	for u in alive:
		var col := Color(0.2, 0.35, 0.75) if u["team"] == 0 else Color(0.72, 0.2, 0.17)
		if u.has("captain"):
			col = Color(0.4, 0.08, 0.08)
		if u.has("player"):
			col = Color(0.1, 0.25, 0.9)
			draw_arc(u["pos"] + Vector2(0, 18), 15, 0, TAU, 20, Color(1, 0.85, 0.3), 2)
		if u["hit"] > 0:
			col = Color.WHITE
		var s := 1.25 if u.has("captain") else 1.0
		Art.person(self, u["pos"], col, u["male"], u["walk"], s)
		var f: Vector2 = u["face"]
		draw_line(u["pos"] + f * 8, u["pos"] + f * 28 * s, Color(0.85, 0.85, 0.9), 3)
		if u.get("blocking", false):
			draw_circle(u["pos"] + f * 14, 10, Color(0.55, 0.35, 0.15))
			draw_arc(u["pos"] + f * 14, 10, 0, TAU, 16, Color(0.85, 0.7, 0.3), 2)
		var w := 30.0 * s
		draw_rect(Rect2(u["pos"] + Vector2(-w / 2, -32 * s), Vector2(w, 4)), Color(0, 0, 0, 0.6))
		draw_rect(Rect2(u["pos"] + Vector2(-w / 2, -32 * s), Vector2(w * u["hp"] / u["max"], 4)), Color(0.25, 0.9, 0.25) if u["team"] == 0 else Color(0.95, 0.25, 0.2))
	for sw in swings:
		var a: float = sw["dir"].angle()
		draw_arc(sw["pos"], sw["r"], a - 0.8, a + 0.8, 10, Color(1, 1, 1, 0.7), 4)
