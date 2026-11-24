extends Node3D
## Batalla en 3D en tercera persona: controlas a tu personaje junto a tus aliados.

const Art = preload("res://scripts/art.gd")
const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const CAM := preload("res://scripts/cam_rig.gd")
const HALF := 30.0
const REACH := 1.7

var main
var env: Dictionary
var cam
var units: Array = []
var pl: Dictionary
var over := false
var kills := 0
var enemy_total := 0
var enemy_name := ""
var lbl: Label
var hp_bar: ProgressBar
var flash: ColorRect
var result_panel: PanelContainer
var result_label: Label


func _unit(pos: Vector3, team: int, hp: float, dmg: float, spd: float, opts: Dictionary) -> Dictionary:
	var a := ACTOR.new()
	add_child(a)
	var male: bool = opts.get("male", true)
	var parts: Array = ["ubc/Superhero_Male_FullBody", "out/Male_Ranger"] if male else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger"]
	if opts.get("helmet", "") == "":
		parts.append(["hair/Hair_SimpleParted", "hair/Hair_Buzzed", "hair/Hair_Beard"].pick_random() if male else "hair/Hair_Buns")
	opts["sword"] = true
	if not opts.has("hide_hood"):
		opts["hide_hood"] = opts.get("helmet", "") != ""
	opts["hair_color"] = M.SKIN_HAIR.pick_random()
	a.build(parts, opts)
	a.position = pos
	a.rotation.y = PI if team == 0 else 0.0
	return {"a": a, "team": team, "hp": hp, "max": hp, "dmg": dmg, "speed": spd, "cd": randf() * 1.0, "alive": true, "hit_at": -1.0, "target": null}


func _ready() -> void:
	var d = GS.data
	enemy_name = d["summons"]["enemy"] if d["summons"] != null else "unos bandidos"
	env = M.make_env(self, Vector3.ZERO, 400)
	M.set_season_ground(env["grad"], int(d["season"]))
	M.set_daytime(env, 0.42)
	var suffix: String = ["", "", "_Autumn", "_Snow"][int(d["season"])]
	for i in 120:
		var a := randf() * TAU
		var r := randf_range(HALF + 4, HALF + 35)
		M.put(self, "nature/%s%s_%d.glb" % [["CommonTree", "PineTree", "BirchTree"][i % 3], suffix, randi_range(1, 5)], Vector3(cos(a) * r, 0, sin(a) * r), randf() * TAU, randf_range(2.4, 3.4))
	M.castle(self, Vector3(-20, 0, -95), 4.0)
	for i in 4:
		M.tent(self, Vector3(-9 + i * 5, 0, HALF - 2 + (i % 2) * 2), 0.0, Color(0.82, 0.76, 0.6))

	var enemy_faction := "bandido" if enemy_name.contains("bandidos") or enemy_name.contains("saqueadores") else "rojo"
	var armor := int(d["armor"])
	pl = _unit(Vector3(0, 0, 12), 0, 100.0, 20.0 + 10.0 * int(d["weapon"]), 4.6, {"male": d["player"]["male"], "faction": "azul", "shield": true, "helmet": "Helmet2" if armor >= 2 else ""})
	pl["hp"] = maxf(float(d["player"]["health"]), 20.0)
	pl["player"] = true
	units.append(pl)
	var allies := 4 + (6 if int(d["title"]) == 1 else 0)
	for i in allies:
		units.append(_unit(Vector3(randf_range(-10, 10), 0, randf_range(11, 16)), 0, 45, 9, 3.6, {"faction": "azul", "shield": i % 3 != 2, "helmet": ["Helmet2", "Helmet1", ""][i % 3]}))
	enemy_total = 6 + mini(8, (int(d["year"]) - 1100) / 2) + randi_range(0, 2)
	for i in enemy_total:
		units.append(_unit(Vector3(randf_range(-11, 11), 0, randf_range(-16, -11)), 1, 40, 8, 3.5, {"faction": enemy_faction, "shield": i % 2 == 0, "helmet": "" if enemy_faction == "bandido" else ["Helmet2", "Helmet3", ""][i % 3], "hide_hood": false}))
	var cap := _unit(Vector3(0, 0, -17), 1, 100, 13, 3.3, {"faction": enemy_faction, "shield": true, "helmet": "Helmet3"})
	cap["captain"] = true
	cap["a"].scale = Vector3.ONE * 1.12
	units.append(cap)
	enemy_total += 1

	cam = CAM.new()
	cam.target = pl["a"]
	cam.captured = true
	cam.dist = 4.2
	cam.yaw = 0.0
	add_child(cam)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_build_hud()


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	flash = ColorRect.new()
	flash.color = Color(0.8, 0, 0, 0)
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(flash)
	var top := PanelContainer.new()
	top.add_theme_stylebox_override("panel", Art.bar_style())
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	layer.add_child(top)
	lbl = Label.new()
	lbl.add_theme_font_size_override("font_size", 18)
	top.add_child(lbl)
	hp_bar = ProgressBar.new()
	hp_bar.max_value = 100
	hp_bar.show_percentage = false
	hp_bar.custom_minimum_size = Vector2(320, 18)
	hp_bar.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	hp_bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	hp_bar.offset_top = -70
	hp_bar.offset_bottom = -52
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color(0.75, 0.12, 0.1)
	hp_bar.add_theme_stylebox_override("fill", fill)
	layer.add_child(hp_bar)
	var help := Label.new()
	help.text = "WASD: mover · Shift: correr · Ratón: cámara · Clic izquierdo: atacar · Clic derecho (mantener): bloquear · Esc: soltar ratón"
	help.add_theme_color_override("font_outline_color", Color.BLACK)
	help.add_theme_constant_override("outline_size", 4)
	help.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	help.grow_horizontal = Control.GROW_DIRECTION_BOTH
	help.offset_top = -34
	layer.add_child(help)
	var cross := Label.new()
	cross.text = "+"
	cross.add_theme_font_size_override("font_size", 22)
	cross.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	layer.add_child(cross)
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


func _count(team: int, include_player := true) -> int:
	return units.filter(func(u): return u["alive"] and u["team"] == team and (include_player or not u.has("player"))).size()


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed and ev.keycode == KEY_ESCAPE and not over:
		cam.captured = not cam.captured
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if cam.captured else Input.MOUSE_MODE_VISIBLE
	elif ev is InputEventMouseButton and ev.pressed and not over and not cam.captured:
		cam.captured = true
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _process(delta: float) -> void:
	flash.color.a = maxf(0.0, flash.color.a - delta * 1.5)
	if over:
		return
	lbl.text = "   Batalla contra %s      Aliados: %d      Enemigos: %d      Abatidos por ti: %d" % [enemy_name, _count(0, false), _count(1), kills]
	hp_bar.value = pl["hp"]
	_player_step(delta)
	for u in units:
		if over:
			return
		_resolve_hit(u)
		if not u["alive"] or u.has("player"):
			continue
		_ai_step(u, delta)


func _player_step(delta: float) -> void:
	var a = pl["a"]
	pl["cd"] -= delta
	var blocking: bool = cam.captured and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
	pl["blocking"] = blocking
	var dir: Vector3 = cam.move_dir()
	var attacking: bool = a.current == "Sword_Attack" and a.anim.is_playing()
	if dir != Vector3.ZERO:
		var sprint := Input.is_key_pressed(KEY_SHIFT) and not blocking
		var spd: float = pl["speed"] * (1.5 if sprint else 1.0) * (0.45 if blocking or attacking else 1.0)
		a.position += dir * spd * delta
		a.position.x = clampf(a.position.x, -HALF, HALF)
		a.position.z = clampf(a.position.z, -HALF, HALF)
		if not attacking:
			a.play("Sword_Idle" if blocking else ("Sprint" if sprint else "Jog_Fwd"))
	elif not attacking:
		a.play("Sword_Idle" if blocking else "Idle")
	# El personaje mira hacia donde mira la cámara al combatir.
	var face: float = cam.yaw + PI
	if dir != Vector3.ZERO and not blocking and not attacking:
		face = atan2(dir.x, dir.z)
	a.rotation.y = lerp_angle(a.rotation.y, face, minf(1.0, delta * 12.0))
	if cam.captured and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and pl["cd"] <= 0 and not blocking:
		pl["cd"] = 0.75
		a.rotation.y = cam.yaw + PI
		a.play_once("Sword_Attack")
		pl["hit_at"] = 0.3


func _ai_step(u: Dictionary, delta: float) -> void:
	var a = u["a"]
	u["cd"] -= delta
	if u["target"] == null or not u["target"]["alive"] or randf() < 0.01:
		u["target"] = _nearest(u)
	var tgt = u["target"]
	if tgt == null:
		a.play("Idle")
		return
	var to: Vector3 = tgt["a"].position - a.position
	to.y = 0
	var dist := to.length()
	a.rotation.y = lerp_angle(a.rotation.y, atan2(to.x, to.z), minf(1.0, delta * 8.0))
	var attacking: bool = a.current == "Sword_Attack" and a.anim.is_playing()
	if dist > REACH:
		if attacking:
			return
		var sep := Vector3.ZERO
		for o in units:
			if o["alive"] and not is_same(o, u):
				var dd: Vector3 = a.position - o["a"].position
				dd.y = 0
				if dd.length() < 1.1 and dd.length() > 0.01:
					sep += dd.normalized()
		a.position += (to.normalized() + sep * 0.7).normalized() * u["speed"] * delta
		a.play("Jog_Fwd")
	elif u["cd"] <= 0:
		u["cd"] = 1.3 + randf() * 0.7
		a.play_once("Sword_Attack")
		u["hit_at"] = 0.35
	elif not attacking:
		a.play("Sword_Idle")


## Aplica el golpe cuando la animación de ataque llega al impacto.
func _resolve_hit(u: Dictionary) -> void:
	if u["hit_at"] < 0:
		return
	u["hit_at"] -= get_process_delta_time()
	if u["hit_at"] > 0:
		return
	u["hit_at"] = -1.0
	if not u["alive"]:
		return
	var a = u["a"]
	var fwd := Vector3(sin(a.rotation.y), 0, cos(a.rotation.y))
	if u.has("player"):
		for o in units:
			if o["alive"] and o["team"] == 1:
				var to: Vector3 = o["a"].position - a.position
				to.y = 0
				if to.length() < 2.4 and to.normalized().dot(fwd) > 0.35:
					_damage(o, u["dmg"] * randf_range(0.9, 1.2), u)
	else:
		var t = u["target"]
		if t != null and t["alive"] and t["a"].position.distance_to(a.position) < 2.2:
			_damage(t, u["dmg"] * randf_range(0.8, 1.2), u)


func _nearest(u: Dictionary):
	var best = null
	var bd := INF
	for o in units:
		if o["alive"] and o["team"] != u["team"]:
			var dist: float = u["a"].position.distance_to(o["a"].position)
			if dist < bd:
				bd = dist
				best = o
	return best


func _damage(t: Dictionary, amount: float, src: Dictionary) -> void:
	if over or not t["alive"]:
		return
	if t.has("player"):
		amount *= 1.0 - 0.15 * int(GS.data["armor"])
		if t.get("blocking", false):
			amount *= 0.25
		flash.color.a = 0.35
	t["hp"] -= amount
	if t["hp"] > 0:
		if not t.has("player") and not (t["a"].current == "Sword_Attack" and t["a"].anim.is_playing()):
			t["a"].play_once("Hit_Chest")
		return
	t["hp"] = 0
	t["alive"] = false
	t["hit_at"] = -1.0
	t["a"].play_once("Death01")
	if src.has("player"):
		kills += 1
	if t.has("player"):
		_end(false)
	elif _count(1) == 0:
		_end(true)


func _end(victory: bool) -> void:
	over = true
	cam.captured = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
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
		for u in units:
			if u["alive"] and u["team"] == 0:
				u["a"].play("Dance" if randf() < 0.3 else "Idle")
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


func _exit_tree() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
