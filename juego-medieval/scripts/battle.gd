extends Node3D
## Batalla en 3D en tercera persona: tu personaje, tus tropas (con órdenes) y las del rey
## contra un ejército enemigo. Las tropas que no caben en el campo entran como refuerzos.

const Art = preload("res://scripts/art.gd")
const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const CAM := preload("res://scripts/cam_rig.gd")
const ARMY := preload("res://scripts/army.gd")
const ENG := preload("res://scripts/engines.gd")
const HALF := 34.0
const MAX_ACTIVE := 32
const ORDERS := ["¡Cargad!", "Mantened la posición", "Seguidme"]
const HOUSES_BG := ["village/House_1.glb", "village/House_2.glb", "village/House_3.glb", "village/House_4.glb"]
const KING := {"name": "Soldados del rey", "hp": 55.0, "dmg": 10.0, "speed": 3.5, "reach": 1.8}

var main
var env: Dictionary
var cam
var units: Array = []
var pl: Dictionary
var over := false
var kills := 0
var enemy_total := 0
var enemy_name := ""
var enemy_faction := "rojo"
var order := 1
var ally_reserve: Array = []
var enemy_reserve: Array = []
var reinforce_cd := 0.0
var arrows: Array = []
var dead_by_type := {}
var siege := {}  # ataque a un pueblo de la región (vacío si es una llamada del rey)
var enemy_dead := 0
var res_box: VBoxContainer
var back_btn: Button
var lbl: Label
var engines: Array = []  # máquinas de guerra: {n, arm, kind, team, cd}
var eff_wall := 0
var siege_notes: Array = []
var morale := [100.0, 100.0]  # moral de cada bando: al bajar, los heridos huyen
var fled := [0, 0]
var rout_cd := 1.0
var formation := 0
const FORMS := ["Línea", "Muro de escudos", "Cuña"]
var lbl_order: Label
var hp_bar: ProgressBar
var flash: ColorRect
var result_panel: PanelContainer
var result_label: Label


func _stats(kind: String) -> Dictionary:
	return KING if kind == "rey" else ARMY.UNITS[kind]


## Crea un soldado del tipo indicado. team 0 = tus tropas, 1 = enemigo.
func _spawn(kind: String, team: int, pos: Vector3) -> Dictionary:
	var a := ACTOR.new()
	add_child(a)
	var st := _stats(kind)
	var faction := "azul" if team == 0 else enemy_faction
	var male := randf() < 0.85
	var parts: Array = ["ubc/Superhero_Male_FullBody", "out/Male_Ranger"] if male else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger"]
	var opts := {"faction": faction, "hair_color": M.SKIN_HAIR.pick_random()}
	match kind:
		"milicia":
			opts["hide_hood"] = true
			parts.append(["hair/Hair_SimpleParted", "hair/Hair_Buzzed", "hair/Hair_Beard"].pick_random() if male else "hair/Hair_Buns")
		"arquero", "arquero_jinete":
			opts["hide_hood"] = false
		"lancero":
			opts["hide_hood"] = true
			opts["helmet"] = "Helmet1"
		_:
			opts["hide_hood"] = true
			opts["sword"] = true
			opts["shield"] = true
			opts["helmet"] = ["Helmet2", "Helmet3"].pick_random()
	a.build(parts, opts)
	match kind:
		"milicia":
			a.attach("hand_r", ["weapons/Axe_Small.glb", "weapons/Hammer_Small.glb"].pick_random(), Vector3(0, 0.05, 0), Vector3(0, 0, 90), 0.7)
		"lancero":
			a.attach("hand_r", "weapons/Spear.glb", Vector3(0, 0.05, 0), Vector3(0, 0, 90), 2.3)
			M.recolor(a.attach("lowerarm_l", "weapons/Shield_Round.glb", Vector3(0, 0.15, -0.1), Vector3(0, 0, 90), 0.6), Color(0.12, 0.2, 0.5) if team == 0 else Color(0.5, 0.06, 0.06))
		"arquero", "arquero_jinete":
			a.attach("hand_l", "weapons/Bow_Wooden.glb", Vector3(0, 0.05, 0), Vector3(0, 90, 0), 1.3)
	if kind in ARMY.MOUNTED:
		a.mount([Color(1, 1, 1), Color(1.7, 1.4, 1.1), Color(2.2, 2.1, 2.0), Color(1.3, 0.9, 0.7)].pick_random())
	a.position = pos
	a.rotation.y = PI if team == 0 else 0.0
	var u := {"a": a, "team": team, "type": kind, "hp": st["hp"], "max": st["hp"], "dmg": st["dmg"], "speed": st["speed"],
		"reach": st["reach"], "ranged": st.get("ranged", false), "cd": randf() * 1.0, "alive": true, "hit_at": -1.0,
		"target": null, "anchor": pos}
	units.append(u)
	return u


func _ready() -> void:
	var d = GS.data
	if d.get("battle") != null:
		siege = d["battle"]
	if not siege.is_empty():
		enemy_name = siege["enemy"]
	else:
		enemy_name = d["summons"]["enemy"] if d["summons"] != null else "unos bandidos"
	enemy_faction = "bandido" if enemy_name.contains("bandidos") or enemy_name.contains("saqueadores") else "rojo"
	env = M.make_env(self, Vector3.ZERO, 400)
	M.set_season_ground(env["grad"], int(d["season"]))
	M.set_daytime(env, 0.42)
	var suffix: String = ["", "", "_Autumn", "_Snow"][int(d["season"])]
	for i in 120:
		var a := randf() * TAU
		var r := randf_range(HALF + 4, HALF + 35)
		M.put(self, "nature/%s%s_%d.glb" % [["CommonTree", "PineTree", "BirchTree"][i % 3], suffix, randi_range(1, 5)], Vector3(cos(a) * r, 0, sin(a) * r), randf() * TAU, randf_range(2.4, 3.4))
	M.castle(self, Vector3(-20, 0, -100), 4.0)
	# Maquinaria de asedio: el ariete derriba la puerta y las catapultas abren brecha.
	var eng: Dictionary = d.get("engines", {})
	eff_wall = int(siege.get("wall", 0))
	var rammed := false
	if siege.get("kind", "") == "asedio":
		if int(eng.get("ariete", 0)) > 0 and eff_wall > 0:
			eff_wall -= 1
			rammed = true
			siege_notes.append("Tu ariete ha derribado la puerta.")
		if int(eng.get("catapulta", 0)) >= 2 and eff_wall > 0:
			eff_wall -= 1
			siege_notes.append("Tus catapultas han abierto brecha en la muralla.")
	# Asedio: la batalla se libra delante de las murallas del pueblo.
	if siege.get("kind", "") == "asedio" and int(siege["wall"]) >= 1:
		if rammed:
			var r := ENG.ram(self)
			r.position = Vector3(0, 0, -HALF - 1.5)
			r.rotation.y = PI
		var stone := int(siege["wall"]) == 2
		var piece := 4.5 if stone else 2.3
		for k in range(-int(60 / piece), int(60 / piece) + 1):
			var x := k * piece
			if stone and not (rammed and k == 0):
				M.recolor(M.put(self, "castle/TallWallEntrance.glb" if k == 0 else "castle/TallWall.glb", Vector3(x, 0, -HALF - 5), 0.0, 3.0), Color(0.52, 0.5, 0.46))
			elif absi(k) > 1:
				M.put(self, "village/Fence.glb", Vector3(x, 0, -HALF - 4), 0.0, 3.0)
		for i in 8:
			M.put(self, HOUSES_BG[i % 4], Vector3(-40 + i * 11, 0, -HALF - 18 - (i % 3) * 5), randf() * TAU, 1.2)
	for i in 4:
		M.tent(self, Vector3(-9 + i * 5, 0, HALF - 2 + (i % 2) * 2), 0.0, Color(0.82, 0.76, 0.6))

	# Tu personaje.
	var armor := int(d["armor"])
	var pa := ACTOR.new()
	add_child(pa)
	var pmale: bool = d["player"]["male"]
	var pparts: Array = ["ubc/Superhero_Male_FullBody", "out/Male_Ranger"] if pmale else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger"]
	if armor < 2:
		pparts.append("hair/Hair_SimpleParted" if pmale else "hair/Hair_Buns")
	pa.build(pparts, {"hair_color": M.SKIN_HAIR[0], "faction": "azul", "hide_hood": true, "sword": true, "shield": true, "helmet": "Helmet2" if armor >= 2 else ""})
	pa.position = Vector3(0, 0, 12)
	pa.rotation.y = PI
	pl = {"a": pa, "team": 0, "type": "jugador", "hp": maxf(float(d["player"]["health"]), 20.0), "max": 100.0,
		"dmg": 20.0 + 10.0 * int(d["weapon"]), "speed": 4.6, "reach": 2.4, "ranged": false, "cd": 0.0, "alive": true,
		"hit_at": -1.0, "target": null, "anchor": pa.position, "player": true}
	if d.get("horse", false):
		pa.mount(Color(1.3, 0.9, 0.7))
		pl["speed"] = 7.5
		pl["hp"] += 30.0
		pl["max"] = 130.0
		pl["dmg"] *= 1.25
		pl["reach"] = 2.8
	units.append(pl)

	# Tus hijos capitanes luchan a tu lado.
	if siege.get("kind", "") != "torneo":
		var ci := 0
		for c in d["children"]:
			if c.get("role", "") == "capitan" and int(c["age"]) >= 16:
				var u := _spawn("infante", 0, Vector3(-2.5 + 5.0 * (ci % 2), 0, 13 + ci / 2 * 1.5))
				var xp := int(c.get("xp", 0))
				u["hp"] = 90.0 + 8.0 * xp
				u["max"] = u["hp"]
				u["dmg"] = 15.0 + 1.5 * xp
				u["child"] = c["name"]
				u["a"].scale = Vector3.ONE * 1.06
				var l := M.label3d(c["name"], 56)
				l.position = Vector3(0, 2.3, 0)
				l.modulate = Color(0.75, 0.85, 1.0)
				u["a"].add_child(l)
				ci += 1

	# Tus tropas: las que no caben en el campo esperan como refuerzo.
	var mine := []
	for k in ARMY.ORDER:
		for n in int(d["army"][k]):
			mine.append(k)
	if siege.get("kind", "") == "torneo":
		mine.clear()
	elif mine.is_empty() and int(d["title"]) == 1:
		for n in 6:
			mine.append("milicia_local")
	if siege.is_empty():
		for n in 4:
			mine.append("rey")
	var row := 0
	for i in mine.size():
		var kind: String = mine[i]
		if i >= MAX_ACTIVE:
			ally_reserve.append(kind)
			continue
		var back := 8.0 if kind == "arquero" else 0.0
		var col := i % 10
		row = i / 10
		_spawn("milicia" if kind == "milicia_local" else kind, 0, Vector3(-11 + col * 2.4 + randf_range(-0.3, 0.3), 0, 15 + row * 2.2 + back))
		units[-1]["real"] = kind in ARMY.UNITS

	# Ejército enemigo, en proporción al tuyo.
	enemy_total = 6 + mini(8, (int(d["year"]) - 1100) / 2) + randi_range(0, 2) + int(ARMY.total() * 0.7)
	if not siege.is_empty():
		enemy_total = maxi(3, int(siege["troops"]) - 1)
		if siege["kind"] == "torneo":
			enemy_total = 0
	var foes := []
	for i in enemy_total:
		var roll := randf()
		if enemy_faction == "bandido":
			foes.append("arquero" if roll < 0.15 else ("milicia" if roll < 0.75 else "lancero"))
		else:
			foes.append("arquero" if roll < 0.2 else ("lancero" if roll < 0.45 else ("infante" if roll < 0.75 else ("jinete" if roll < 0.85 and enemy_total > 15 else "milicia"))))
	for i in foes.size():
		if i >= MAX_ACTIVE:
			enemy_reserve.append(foes[i])
			continue
		var back := -8.0 if foes[i] == "arquero" else 0.0
		_spawn(foes[i], 1, Vector3(-12 + (i % 10) * 2.6 + randf_range(-0.4, 0.4), 0, -14 - (i / 10) * 2.4 + back))
	if not siege.is_empty():
		for u in units:
			if u["team"] == 1:
				u["hp"] *= 1.0 + 0.2 * eff_wall
				u["max"] = u["hp"]
	var cap := _spawn("infante", 1, Vector3(0, 0, -19))
	cap["captain"] = true
	cap["hp"] = 110.0
	cap["max"] = 110.0
	cap["dmg"] = 14.0
	cap["a"].scale = Vector3.ONE * 1.12
	enemy_total += 1

	_setup_engines()

	cam = CAM.new()
	cam.target = pl["a"]
	cam.captured = true
	cam.dist = 4.2
	cam.yaw = 0.0
	add_child(cam)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_build_hud()
	SFX.music("batalla")
	_set_order(1)
	if not siege_notes.is_empty():
		lbl_order.text += "\n" + " ".join(siege_notes)


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
	lbl_order = Label.new()
	lbl_order.add_theme_font_size_override("font_size", 22)
	lbl_order.add_theme_color_override("font_outline_color", Color.BLACK)
	lbl_order.add_theme_constant_override("outline_size", 6)
	lbl_order.position = Vector2(16, 52)
	layer.add_child(lbl_order)
	hp_bar = ProgressBar.new()
	hp_bar.max_value = pl["max"]
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
	help.text = "WASD: mover · Shift: correr · Clic izq.: atacar · Clic der.: bloquear · 1: ¡Cargad! · 2: Mantened · 3: Seguidme · F: formación · Esc: ratón"
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
	res_box = box
	result_label = Label.new()
	result_label.add_theme_font_size_override("font_size", 20)
	result_label.custom_minimum_size.x = 480
	result_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(result_label)
	var b := Button.new()
	b.text = "Volver al pueblo" if siege.is_empty() else "Volver al mapa"
	b.custom_minimum_size.y = 40
	b.pressed.connect(func(): main.start_village() if siege.is_empty() or siege["kind"] == "bandidos" else main.start_region())
	back_btn = b
	box.add_child(b)


func _count(team: int, include_player := true) -> int:
	return units.filter(func(u): return u["alive"] and u["team"] == team and (include_player or not u.has("player"))).size()


func _set_order(o: int) -> void:
	order = o
	lbl_order.text = "Orden: %s · Formación: %s (F)" % [ORDERS[o], FORMS[formation]]
	if o != 1:
		return
	# Mantened: las tropas forman delante de ti según la formación elegida.
	var mine := units.filter(func(u): return u["alive"] and u["team"] == 0 and not u.has("player") and not u.has("flee"))
	var front := mine.filter(func(u): return not u["ranged"])
	var back := mine.filter(func(u): return u["ranged"])
	var base: Vector3 = pl["a"].position + Vector3(0, 0, -3)
	for i in front.size():
		var p := Vector3.ZERO
		match formation:
			0:
				p = Vector3((i - (front.size() - 1) / 2.0) * 2.0, 0, 0)
			1:
				var cols := maxi(4, int(ceil(front.size() / 2.0)))
				p = Vector3((i % cols - (cols - 1) / 2.0) * 1.15, 0, (i / cols) * 1.2)
			2:
				var k := (i + 1) / 2
				p = Vector3(k * 1.5 * (1 if i % 2 == 1 else -1), 0, k * 1.4 - 2.0)
		front[i]["anchor"] = base + p
	for i in back.size():
		back[i]["anchor"] = base + Vector3((i - (back.size() - 1) / 2.0) * 1.8, 0, 5.0)


func _unhandled_input(ev: InputEvent) -> void:
	if over:
		return
	if ev is InputEventKey and ev.pressed and not ev.echo:
		match ev.keycode:
			KEY_ESCAPE:
				cam.captured = not cam.captured
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if cam.captured else Input.MOUSE_MODE_VISIBLE
			KEY_1:
				_set_order(0)
			KEY_2:
				_set_order(1)
			KEY_3:
				_set_order(2)
			KEY_F:
				formation = (formation + 1) % FORMS.size()
				_set_order(1)
	elif ev is InputEventMouseButton and ev.pressed and not cam.captured:
		cam.captured = true
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _process(delta: float) -> void:
	flash.color.a = maxf(0.0, flash.color.a - delta * 1.5)
	_update_arrows(delta)
	if over:
		return
	lbl.text = "   Batalla contra %s      Tus tropas: %d (+%d de refuerzo)      Enemigos: %d (+%d)      Abatidos por ti: %d" % [enemy_name, _count(0, false), ally_reserve.size(), _count(1), enemy_reserve.size(), kills]
	lbl.text += "      Moral: %d contra %d" % [int(morale[0]), int(morale[1])]
	hp_bar.value = pl["hp"]
	_reinforce(delta)
	_check_rout(delta)
	_update_engines(delta)
	_player_step(delta)
	for u in units:
		if over:
			return
		_resolve_hit(u)
		if not u["alive"] or u.has("player"):
			continue
		_ai_step(u, delta)


## Entran refuerzos por la retaguardia mientras queden tropas esperando.
func _reinforce(delta: float) -> void:
	reinforce_cd -= delta
	if reinforce_cd > 0:
		return
	reinforce_cd = 1.2
	if not ally_reserve.is_empty() and _count(0, false) < MAX_ACTIVE:
		var kind: String = ally_reserve.pop_front()
		_spawn("milicia" if kind == "milicia_local" else kind, 0, Vector3(randf_range(-10, 10), 0, HALF - 3))
		units[-1]["real"] = kind in ARMY.UNITS
		units[-1]["anchor"] = pl["a"].position + Vector3(randf_range(-6, 6), 0, 4)
	if not enemy_reserve.is_empty() and _count(1) < MAX_ACTIVE:
		_spawn(enemy_reserve.pop_front(), 1, Vector3(randf_range(-10, 10), 0, -HALF + 3))


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
	var face: float = cam.yaw + PI
	if dir != Vector3.ZERO and not blocking and not attacking:
		face = atan2(dir.x, dir.z)
	a.rotation.y = lerp_angle(a.rotation.y, face, minf(1.0, delta * 12.0))
	if cam.captured and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and pl["cd"] <= 0 and not blocking:
		pl["cd"] = 0.75
		a.rotation.y = cam.yaw + PI
		a.play_once("Sword_Attack")
		SFX.play("espada", -2.0, 0.1)
		pl["hit_at"] = 0.3


## Hacia dónde debe ir un soldado propio según la orden actual (sin enemigo cerca).
func _rest_point(u: Dictionary) -> Vector3:
	if order == 2:
		var i := units.find(u)
		var ang := float(i) * 2.399
		return pl["a"].position + Vector3(cos(ang), 0, sin(ang)) * (2.5 + (i % 5) * 1.2)
	return u["anchor"]


func _ai_step(u: Dictionary, delta: float) -> void:
	var a = u["a"]
	if u.has("flee"):
		var edge := Vector3(a.position.x, 0, HALF if u["team"] == 0 else -HALF)
		_walk(u, edge, 0.0, delta)
		a.play("Sprint")
		if absf(a.position.z) >= HALF - 0.6:
			u["alive"] = false
			a.visible = false
			fled[u["team"]] += 1
			_check_end()
		return
	u["cd"] -= delta
	if u["target"] == null or not u["target"]["alive"] or randf() < 0.01:
		u["target"] = _nearest(u)
	var tgt = u["target"]
	var attacking: bool = a.current in ["Sword_Attack", "Spell_Simple_Shoot"] and a.anim.is_playing()
	# Tus tropas solo se lanzan con «¡Cargad!» o si el enemigo está cerca.
	if u["team"] == 0 and order != 0 and tgt != null:
		var center: Vector3 = _rest_point(u) if order == 1 else pl["a"].position
		var range_ok: float = (u["reach"] if u["ranged"] else 7.0) + 1.0
		if tgt["a"].position.distance_to(center) > range_ok and tgt["a"].position.distance_to(a.position) > range_ok:
			tgt = null
	if tgt == null:
		if u["team"] == 0:
			_walk(u, _rest_point(u), 0.6, delta)
		else:
			a.play("Idle")
		return
	var to: Vector3 = tgt["a"].position - a.position
	to.y = 0
	var dist := to.length()
	a.rotation.y = lerp_angle(a.rotation.y, atan2(to.x, to.z), minf(1.0, delta * 8.0))
	var reach: float = u["reach"]
	if u["ranged"] and dist < 3.0:
		reach = 1.7
	if dist > reach:
		if attacking:
			return
		_walk(u, tgt["a"].position, reach * 0.9, delta)
	elif u["cd"] <= 0:
		if u["ranged"] and dist > 3.0:
			u["cd"] = 2.2 + randf() * 0.8
			a.play_once("Spell_Simple_Shoot")
			_shoot(u, tgt)
		else:
			u["cd"] = 1.3 + randf() * 0.7
			a.play_once("Sword_Attack")
			u["hit_at"] = 0.35
			u["charge"] = float(u.get("run", 0.0)) > 1.2
			u["run"] = 0.0
	elif not attacking:
		a.play("Sword_Idle" if not u["ranged"] else "Idle")


func _walk(u: Dictionary, target: Vector3, stop: float, delta: float) -> void:
	var a = u["a"]
	var to: Vector3 = target - a.position
	to.y = 0
	if to.length() <= stop:
		a.play("Idle")
		# En su puesto, de cara al enemigo (si no, les pueden atacar por la espalda).
		a.rotation.y = lerp_angle(a.rotation.y, PI if u["team"] == 0 else 0.0, minf(1.0, delta * 4.0))
		return
	var sep := Vector3.ZERO
	for o in units:
		if o["alive"] and not is_same(o, u):
			var dd: Vector3 = a.position - o["a"].position
			dd.y = 0
			if dd.length() < 1.1 and dd.length() > 0.01:
				sep += dd.normalized()
	a.position += (to.normalized() + sep * 0.7).normalized() * u["speed"] * delta
	a.position.x = clampf(a.position.x, -HALF, HALF)
	a.position.z = clampf(a.position.z, -HALF, HALF)
	a.rotation.y = lerp_angle(a.rotation.y, atan2(to.x, to.z), minf(1.0, delta * 8.0))
	u["run"] = float(u.get("run", 0.0)) + delta
	a.play("Jog_Fwd")


## Flecha con trayectoria en arco; al caer hiere al primer enemigo cercano.
func _shoot(u: Dictionary, tgt: Dictionary) -> void:
	var from: Vector3 = u["a"].position + Vector3(0, 1.5, 0)
	var dist: float = from.distance_to(tgt["a"].position)
	var miss := dist / 18.0 * 1.2
	var to: Vector3 = tgt["a"].position + Vector3(randf_range(-miss, miss), 1.0, randf_range(-miss, miss))
	var m := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.02
	cm.bottom_radius = 0.02
	cm.height = 0.8
	m.mesh = cm
	m.material_override = M.flat(Color(0.35, 0.25, 0.12))
	add_child(m)
	m.position = from
	arrows.append({"m": m, "from": from, "to": to, "t": 0.0, "dur": maxf(0.35, dist / 24.0), "src": u})


func _update_arrows(delta: float) -> void:
	for ar in arrows.duplicate():
		ar["t"] += delta / ar["dur"]
		var k: float = minf(ar["t"], 1.0)
		var arc: float = ar.get("arc", 0.15)
		var p: Vector3 = ar["from"].lerp(ar["to"], k) + Vector3(0, sin(k * PI) * ar["from"].distance_to(ar["to"]) * arc, 0)
		var m: MeshInstance3D = ar["m"]
		var next: Vector3 = ar["from"].lerp(ar["to"], minf(k + 0.05, 1.0)) + Vector3(0, sin(minf(k + 0.05, 1.0) * PI) * ar["from"].distance_to(ar["to"]) * arc, 0)
		if next.distance_to(p) > 0.001:
			m.look_at_from_position(p, next, Vector3.UP)
			m.rotate_object_local(Vector3.RIGHT, PI / 2)
		else:
			m.position = p
		if ar["t"] >= 1.0:
			arrows.erase(ar)
			m.queue_free()
			if over:
				continue
			var src: Dictionary = ar["src"]
			var land: Vector3 = ar["to"] - Vector3(0, 1, 0)
			if ar.has("aoe"):
				SFX.play("golpe", -land.distance_to(pl["a"].position) * 0.4, 0.1)
				for o in units.duplicate():
					if o["alive"] and o["team"] != src["team"] and o["a"].position.distance_to(land) < ar["aoe"]:
						_damage(o, src["dmg"] * randf_range(0.7, 1.1), src)
				continue
			for o in units:
				if o["alive"] and o["team"] != src["team"] and o["a"].position.distance_to(land) < 1.3:
					_damage(o, src["dmg"] * randf_range(0.8, 1.2), src)
					break


# ---------------- Maquinaria de guerra ----------------

func _setup_engines() -> void:
	var d = GS.data
	var kind: String = siege.get("kind", "")
	if kind == "torneo":
		return
	var eng: Dictionary = d.get("engines", {})
	var mine := []
	for i in int(eng.get("balista", 0)):
		mine.append("balista")
	for i in int(eng.get("catapulta", 0)):
		mine.append("catapulta")
	for i in mini(mine.size(), 6):
		_add_engine(mine[i], 0, Vector3(-10 + (i % 6) * 4.0, 0, 25 + (i / 6) * 4.0))
	# Defensas del enemigo: balistas en la muralla; los ejércitos grandes traen catapulta.
	if kind == "asedio":
		for i in eff_wall:
			_add_engine("balista", 1, Vector3(-14 + i * 28, 6.6 if int(siege["wall"]) == 2 else 0.0, -HALF - (5.0 if int(siege["wall"]) == 2 else 2.0)))
	elif kind == "campo" and int(siege.get("troops", 0)) >= 30:
		_add_engine("catapulta", 1, Vector3(randf_range(-8, 8), 0, -29))


func _add_engine(kind: String, team: int, pos: Vector3) -> void:
	var n: Node3D = ENG.ballista(self) if kind == "balista" else ENG.catapult(self)
	n.position = pos
	n.rotation.y = PI if team == 0 else 0.0
	engines.append({"n": n, "arm": n.get_node("arm"), "kind": kind, "team": team, "cd": randf_range(1.0, 3.0)})


func _update_engines(delta: float) -> void:
	for e in engines:
		e["cd"] -= delta
		if e["cd"] > 0:
			continue
		var n: Node3D = e["n"]
		var foes := units.filter(func(u): return u["alive"] and u["team"] != e["team"] and not u.has("flee"))
		if foes.is_empty():
			continue
		var src := {"team": e["team"], "a": n, "dmg": 34.0 if e["kind"] == "balista" else 30.0}
		if e["kind"] == "balista":
			var best = null
			var bd := 48.0
			for o in foes:
				var dd: float = o["a"].position.distance_to(n.position)
				if dd < bd:
					bd = dd
					best = o
			if best == null:
				e["cd"] = 1.0
				continue
			e["cd"] = 3.5
			var to: Vector3 = best["a"].position + Vector3(0, 1.0, 0)
			n.rotation.y = atan2(to.x - n.position.x, to.z - n.position.z)
			_projectile(n.position + Vector3(0, 1.4, 0), to, src, Vector3(0.07, 0.07, 1.4), Color(0.3, 0.22, 0.12), 0.03, maxf(0.25, bd / 45.0), 0.0)
			SFX.play("espada", -n.position.distance_to(pl["a"].position) * 0.3, 0.2)
		else:
			# La catapulta apunta adonde más enemigos se apiñan.
			var best = foes[0]
			var most := -1
			for i in mini(8, foes.size()):
				var c = foes.pick_random()
				var near := foes.filter(func(o): return o["a"].position.distance_to(c["a"].position) < 3.0).size()
				if near > most:
					most = near
					best = c
			var dist: float = best["a"].position.distance_to(n.position)
			if dist > 70.0:
				e["cd"] = 1.5
				continue
			e["cd"] = 6.5
			var miss := dist / 30.0
			var to: Vector3 = best["a"].position + Vector3(randf_range(-miss, miss), 1.0, randf_range(-miss, miss))
			var arm: Node3D = e["arm"]
			var tw := create_tween()
			tw.tween_property(arm, "rotation:x", 1.7, 0.22)
			tw.tween_property(arm, "rotation:x", 0.0, 1.6)
			_projectile(n.position + Vector3(0, 3.0, 0), to, src, Vector3(0.7, 0.7, 0.7), Color(0.4, 0.4, 0.38), 0.4, maxf(1.2, dist / 18.0), 2.8)
			SFX.play("talar", -n.position.distance_to(pl["a"].position) * 0.3, 0.2)


func _projectile(from: Vector3, to: Vector3, src: Dictionary, size: Vector3, col: Color, arc: float, dur: float, aoe: float) -> void:
	var m := MeshInstance3D.new()
	if aoe > 0:
		var sm := SphereMesh.new()
		sm.radius = size.x / 2
		sm.height = size.x
		m.mesh = sm
	else:
		var bm := BoxMesh.new()
		bm.size = Vector3(size.x, size.z, size.y)
		m.mesh = bm
	m.material_override = M.flat(col)
	add_child(m)
	m.position = from
	var ar := {"m": m, "from": from, "to": to, "t": 0.0, "dur": dur, "src": src, "arc": arc}
	if aoe > 0:
		ar["aoe"] = aoe
	arrows.append(ar)


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
		if t != null and t["alive"] and t["a"].position.distance_to(a.position) < u["reach"] + 0.6:
			var mult := 1.6 if u.get("charge", false) and u["type"] == "jinete" else 1.0
			u["charge"] = false
			_damage(t, u["dmg"] * randf_range(0.8, 1.2) * mult, u)


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
	elif t["type"] == "infante":
		amount *= 0.8
	# Las lanzas paran a los caballos.
	if src.get("type", "") == "lancero" and t["type"] in ARMY.MOUNTED:
		amount *= 2.0
	# Golpe por la espalda: mucho más dañino.
	var tf := Vector3(sin(t["a"].rotation.y), 0, cos(t["a"].rotation.y))
	var from: Vector3 = src["a"].position - t["a"].position
	from.y = 0
	if from.length() > 0.01 and tf.dot(from.normalized()) < -0.3:
		amount *= 1.5
	# Muro de escudos: quien aguanta en su puesto recibe menos daño.
	if t["team"] == 0 and order == 1 and formation == 1 and t["type"] in ["infante", "lancero", "milicia"] and t["a"].position.distance_to(t["anchor"]) < 1.5:
		amount *= 0.65
	t["hp"] -= amount
	var near: float = t["a"].position.distance_to(pl["a"].position)
	if near < 14.0:
		SFX.play("choque" if t.get("blocking", false) or t["type"] == "infante" else "golpe", -near * 0.6, 0.08)
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
	if t["team"] == 1:
		enemy_dead += 1
	if t.has("child"):
		_child_fell(t["child"])
	# Cada baja hunde la moral de su bando y anima al contrario.
	var side: int = t["team"]
	var alive_side := _count(side) + (ally_reserve.size() if side == 0 else enemy_reserve.size()) / 2
	morale[side] = maxf(0.0, morale[side] - 160.0 / (alive_side + 8.0) - (25.0 if t.get("captain", false) else 0.0))
	morale[1 - side] = minf(100.0, morale[1 - side] + 1.5)
	if t["team"] == 0 and t.get("real", false):
		dead_by_type[t["type"]] = int(dead_by_type.get(t["type"], 0)) + 1
	if t.has("player"):
		_end(false)
	else:
		_check_end()


func _check_end() -> void:
	if not over and _count(1) == 0 and enemy_reserve.is_empty():
		_end(true)


## Con la moral baja, los heridos huyen; si se hunde del todo, huye el bando entero.
func _check_rout(delta: float) -> void:
	rout_cd -= delta
	if rout_cd > 0:
		return
	rout_cd = 1.0
	for side in 2:
		if morale[side] >= 35.0:
			continue
		var all_run: bool = morale[side] < 12.0
		if all_run and side == 1 and not enemy_reserve.is_empty():
			fled[1] += enemy_reserve.size()
			enemy_reserve.clear()
		for u in units:
			if u["alive"] and u["team"] == side and not u.has("player") and not u.has("flee") and not u.has("child") and not u.get("captain", false):
				if all_run or (float(u["hp"]) / float(u["max"]) < 0.45 and randf() < 0.35):
					u["flee"] = true
					u["target"] = null
		if all_run and side == 1:
			lbl_order.text = "¡El enemigo huye en desbandada!"


func _child_fell(n: String) -> void:
	var d = GS.data
	for c in d["children"]:
		if c["name"] == n:
			d["children"].erase(c)
			GS.popups.append({"title": "Ha caído %s" % n, "text": "Tu %s %s ha muerto luchando a tu lado. Toda la familia guarda luto." % ["hijo" if c["male"] else "hija", n], "button": "Continuar"})
			GS.say("%s ha caído en la batalla." % n)
			return


func _end(victory: bool) -> void:
	for u in units:
		if u.has("child") and u["alive"]:
			for c in GS.data["children"]:
				if c["name"] == u["child"]:
					c["xp"] = int(c.get("xp", 0)) + 1
	over = true
	cam.captured = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var d = GS.data
	var chief := int(d["title"]) == 1
	ARMY.casualties(dead_by_type)
	var losses := 0
	for k in dead_by_type:
		losses += int(dead_by_type[k])
	var text: String
	if not siege.is_empty():
		_end_siege(victory, losses)
		return
	if victory:
		var gold := 10 + 3 * enemy_total + 3 * kills
		var pres := 25 + 2 * kills + enemy_total / 4 + (15 if chief else 0)
		d["gold"] += gold
		d["prestige"] += pres
		d["player"]["health"] = clampf(pl["hp"], 10.0, 100.0)
		text = "¡VICTORIA!\n\nVictoria contra %s (%d enemigos).\nAbatidos por ti: %d\nBajas de tus tropas: %d\n\nBotín: +%d oro\nPrestigio: +%d" % [enemy_name, enemy_total, kills, losses, gold, pres]
		GS.say("Victoria contra %s. +%d oro, +%d prestigio. Bajas: %d." % [enemy_name, gold, pres, losses])
		for u in units:
			if u["alive"] and u["team"] == 0:
				u["a"].play("Dance" if randf() < 0.3 else "Idle")
	else:
		d["prestige"] = maxi(0, int(d["prestige"]) - 5)
		if randf() < 0.25:
			text = "DERROTA\n\nCaíste en el campo de batalla...\nBajas de tus tropas: %d" % losses
			GS.player_death("murió luchando contra %s" % enemy_name)
		else:
			d["player"]["health"] = 15.0
			text = "DERROTA\n\nFuiste herido de gravedad y tus compañeros te sacaron del campo de batalla.\nBajas de tus tropas: %d\nPrestigio: -5" % losses
			GS.say("Derrota contra %s. Vuelves herido. Bajas: %d." % [enemy_name, losses])
	d["summons"] = null
	GS.next_day()
	GS.save_game()
	result_label.text = text
	result_panel.visible = true


## Final de un ataque a un pueblo: si ganas, eliges qué hacer con él.
func _end_siege(victory: bool, losses: int) -> void:
	var d = GS.data
	var id: int = siege.get("town", -1)
	d.erase("battle")
	if siege["kind"] == "torneo":
		var lord: int = siege["lord"]
		if victory:
			d["gold"] = int(d["gold"]) + 100
			d["prestige"] += 25
			GS.REGION.NOBLES.add_rel(-1, lord, 10)
			result_label.text = "¡CAMPEÓN DEL TORNEO!\n\nHas derrotado al campeón de %s.\nPremio: 100 de oro · +25 de prestigio · mejora tu relación con su señor." % enemy_name
			GS.say("Ganas el torneo de %s. (+100 oro, +25 prestigio)" % enemy_name)
		else:
			d["player"]["health"] = clampf(pl["hp"], 30.0, 100.0)
			result_label.text = "DERROTA EN EL TORNEO\n\nEl campeón te ha descabalgado. Sin heridas graves, solo el orgullo."
		GS.next_day()
		GS.save_game()
		result_panel.visible = true
		return
	if siege["kind"] == "bandidos":
		if victory:
			var loot := 12 * int(siege["troops"])
			d["gold"] = int(d["gold"]) + loot
			d["prestige"] += 10 + kills
			d["player"]["health"] = clampf(pl["hp"], 10.0, 100.0)
			d.erase("bandits")
			result_label.text = "¡VICTORIA!\n\nHas echado a los bandidos del bosque.\nBotín: +%d oro · Prestigio: +%d" % [loot, 10 + kills]
			GS.say("Echas a los bandidos del bosque. +%d oro." % loot)
		else:
			d["player"]["health"] = 15.0
			result_label.text = "DERROTA\n\nLos bandidos te dejan malherido junto al camino."
			GS.say("Los bandidos te vencen. Vuelves herido al pueblo.")
		GS.next_day()
		GS.save_game()
		result_panel.visible = true
		return
	if siege["kind"] == "campo":
		if victory:
			var loot := GS.REGION.army_defeated(int(siege["army"]))
			d["prestige"] += 15 + 2 * kills
			d["player"]["health"] = clampf(pl["hp"], 10.0, 100.0)
			result_label.text = "¡VICTORIA!\n\nHas derrotado al ejército de %s.\nBotín: +%d oro · Bajas de tus tropas: %d" % [enemy_name, loot, losses]
			GS.say("Derrotas al ejército de %s. +%d oro." % [enemy_name, loot])
		else:
			var a := GS.REGION.army_by_id(int(siege["army"]))
			if not a.is_empty():
				a["troops"] = maxi(1, int(a["troops"]) - enemy_dead)
			d["player"]["health"] = 15.0
			result_label.text = "DERROTA\n\nTus tropas huyen del campo de batalla.\nBajas: %d · Enemigos caídos: %d" % [losses, enemy_dead]
			GS.say("Derrota contra el ejército de %s." % enemy_name)
		GS.next_day()
		GS.save_game()
		result_panel.visible = true
		return
	if victory:
		d["prestige"] += 10 + 2 * kills
		d["player"]["health"] = clampf(pl["hp"], 10.0, 100.0)
		result_label.text = "¡VICTORIA!\n\nHabéis tomado %s.\nAbatidos por ti: %d · Bajas de tus tropas: %d\n\n¿Qué haces con el pueblo?" % [enemy_name, kills, losses]
		back_btn.visible = false
		for choice in [["Saquearlo (botín de oro)", "saquear"], ["Conquistarlo (pasa a ser tuyo)", "conquistar"], ["Exigir vasallaje (tributo cada estación)", "vasallo"]]:
			var b := Button.new()
			b.text = choice[0]
			b.custom_minimum_size.y = 38
			b.pressed.connect(func():
				var msg := GS.REGION.after_victory(id, choice[1])
				GS.say(msg)
				GS.next_day()
				GS.save_game()
				main.start_region())
			res_box.add_child(b)
	else:
		var t := GS.REGION.town(id)
		t["troops"] = maxi(0, int(t["troops"]) - enemy_dead)
		d["prestige"] = maxi(0, int(d["prestige"]) - 5)
		if randf() < 0.25:
			result_label.text = "DERROTA\n\nCaíste ante los muros de %s...\nBajas de tus tropas: %d" % [enemy_name, losses]
			GS.player_death("murió asaltando %s" % enemy_name)
		else:
			d["player"]["health"] = 15.0
			result_label.text = "DERROTA\n\nTus tropas se retiran de %s.\nBajas: %d · Enemigos caídos: %d" % [enemy_name, losses, enemy_dead]
		GS.next_day()
		GS.save_game()
	result_panel.visible = true


func _exit_tree() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
