extends Node3D
## La aldea en 3D: vida del personaje, recursos, casa, familia y llamadas del rey.

const Art = preload("res://scripts/art.gd")
const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const CAM := preload("res://scripts/cam_rig.gd")
const FARM := preload("res://scripts/farm.gd")
const BLD := preload("res://scripts/buildings.gd")

const SIZE := Vector2(120, 80)
const PLAZA := Vector3(60, 0, 40)
const PLOT := Vector3(52, 0, 31)
const MARKET := Vector3(69, 0, 46)
const HALL := Vector3(60, 0, 19)
const CAMP := Vector3(111, 0, 41)
const RUN_SPEED := 4.2
const SPRINT_SPEED := 7.0
const GREETINGS := ["Buenos días. Dicen que este invierno será duro.", "¿Has visto los lobos cerca del bosque?", "El rey sube los impuestos otra vez...", "Mi abuelo luchó en la frontera, ¿sabes?", "El pan del mercado está más caro cada día.", "Si necesitas ayuda con la cosecha, avísame."]
const MALE_HAIR := ["hair/Hair_SimpleParted", "hair/Hair_Buzzed", "hair/Hair_Beard"]
const FEMALE_HAIR := ["hair/Hair_Long", "hair/Hair_Buns", "hair/Hair_BuzzedFemale"]

var main
var env: Dictionary
var cam
var player
var player_sig := ""
var cooldown := 0.0
var trees: Array = []
var rocks: Array = []
var farm
var bld
var obstacles: Array = []
var villagers: Array = []
var vtarget: Array = []
var vlabels: Array = []
var family: Array = []
var family_sig := ""
var house_node: Node3D
var house_level := -1
var season := -1
var nature_node: Node3D
var camp_banner: Node3D
var camp_fire: Node3D
var inter := {}
var lbl_res: Label
var lbl_info: Label
var lbl_log: Label
var lbl_prompt: Label
var panel: PanelContainer
var box: VBoxContainer


func _ready() -> void:
	env = M.make_env(self, Vector3(SIZE.x / 2, 0, SIZE.y / 2), 400)
	var r := RandomNumberGenerator.new()
	r.seed = 1234
	for i in 70:
		trees.append({"p": Vector3(r.randf_range(3, 32), 0, r.randf_range(3, 45)), "k": i % 3, "i": r.randi_range(1, 5), "s": r.randf_range(2.2, 3.2), "r": r.randf() * TAU})
	for i in 26:
		trees.append({"p": Vector3(r.randf_range(3, 117), 0, r.randf_range(74, 79)), "k": i % 3, "i": r.randi_range(1, 5), "s": r.randf_range(2.2, 3.2), "r": r.randf() * TAU})
	for i in 90:
		var a := r.randf() * TAU
		var p := Vector3(60 + cos(a) * r.randf_range(75, 110), 0, 40 + sin(a) * r.randf_range(55, 90))
		trees.append({"p": p, "k": i % 3, "i": r.randi_range(1, 5), "s": r.randf_range(2.5, 3.5), "r": r.randf() * TAU})
	for i in 22:
		rocks.append({"p": Vector3(r.randf_range(8, 32), 0, r.randf_range(55, 70)), "i": r.randi_range(1, 7), "s": r.randf_range(1.3, 2.4), "r": r.randf() * TAU})
	trees = trees.filter(func(t): return BLD.SLOTS.all(func(sl): return t["p"].distance_to(sl) > 7.0) and t["p"].distance_to(BLD.MINE) > 6.0)
	_build_static()
	farm = FARM.new()
	farm.v = self
	add_child(farm)
	obstacles.append_array(farm.obstacles)
	bld = BLD.new()
	bld.v = self
	add_child(bld)
	obstacles.append_array(bld.obstacles)
	_build_hud()
	_reset_villagers()
	cam = CAM.new()
	add_child(cam)
	_update_player_model()
	cam.target = player
	cam.global_position = player.global_position + Vector3(0, 1.6, 0)
	GS.notify.connect(func(_t): _refresh_log())
	_refresh_log()


# ---------------- Mundo ----------------

func _build_static() -> void:
	var dirt := Color(0.42, 0.34, 0.24)
	var plaza := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 10
	cm.bottom_radius = 10
	cm.height = 0.05
	plaza.mesh = cm
	plaza.material_override = M.flat(dirt)
	plaza.position = PLAZA + Vector3(0, 0.01, 0)
	add_child(plaza)
	for t in [HALL, CAMP, Vector3(95, 0, 24), Vector3(30, 0, 26), Vector3(28, 0, 60), PLOT, Vector3(60, 0, 80), Vector3(38, 0, 50), Vector3(82, 0, 52), Vector3(83, 0, 28), Vector3(45, 0, 16.5), Vector3(76, 0, 15), Vector3(49, 0, 59), Vector3(69, 0, 59)]:
		M.road(self, PLAZA, t, 3.2, dirt)
	M.put(self, "village/Well.glb", PLAZA, 0, 1.6)
	obstacles.append([Vector2(PLAZA.x, PLAZA.z), 1.6])

	var kinds := ["village/House_1.glb", "village/House_2.glb", "village/House_3.glb", "village/House_4.glb", "village/Blacksmith.glb", "village/House_2.glb", "village/Stable.glb", "village/House_3.glb"]
	for i in GS.HOMES.size():
		var h: Vector3 = Vector3(GS.HOMES[i].x, 0, GS.HOMES[i].y) * 0.05
		M.put(self, kinds[i], h, _face_plaza(h), 1.7)
		obstacles.append([Vector2(h.x, h.z), 3.2])
	M.put(self, "village/Bell_Tower.glb", HALL, _face_plaza(HALL), 2.0)
	var banner := M.put(self, "castle/Banner.glb", HALL + Vector3(4, 0, 3), 0, 1.6)
	M.recolor(banner, Color(0.15, 0.3, 0.7))
	obstacles.append([Vector2(HALL.x, HALL.z), 4.0])
	M.put(self, "village/MarketStand_1.glb", MARKET + Vector3(-2.5, 0, 0), _face_plaza(MARKET), 1.7)
	M.put(self, "village/MarketStand_2.glb", MARKET + Vector3(0.5, 0, 0.5), _face_plaza(MARKET), 1.7)
	M.put(self, "village/MarketStand_1.glb", MARKET + Vector3(3.5, 0, 0), _face_plaza(MARKET), 1.7)
	M.put(self, "village/Cart.glb", MARKET + Vector3(5.5, 0, 3), 0.6, 1.5)
	for o in [Vector3(-4, 0, 2), Vector3(-4.6, 0, 2.8), Vector3(2, 0, 2.6)]:
		M.put(self, "village/Barrel.glb", MARKET + o, randf(), 1.5)
	M.put(self, "village/Crate.glb", MARKET + Vector3(-1.5, 0, 2.6), 0.3, 1.5)
	M.put(self, "village/Bags.glb", MARKET + Vector3(4.5, 0, 1.5), 0.3, 1.5)
	for o in [-2.5, 0.5, 3.5]:
		obstacles.append([Vector2(MARKET.x + o, MARKET.z), 1.0])
	for i in 6:
		var a := float(i) / 6.0 * TAU + 0.4
		M.tent(self, CAMP + Vector3(cos(a) * 6, 0, sin(a) * 6), -a, Color(0.82, 0.76, 0.6))
		obstacles.append([Vector2(CAMP.x + cos(a) * 6, CAMP.z + sin(a) * 6), 1.6])
	camp_fire = M.put(self, "village/Bonfire_Lit.glb", CAMP + Vector3(0, 0, 0), 0, 1.5)
	camp_banner = M.put(self, "castle/Banner.glb", CAMP + Vector3(2.5, 0, -2.5), 0, 1.6)
	M.put(self, "animals/Horse.glb", Vector3(85, 0, 33), 2.0, 0.42)
	M.castle(self, Vector3(60, 0, -45), 4.0)
	for i in 9:
		var rk := M.put(self, "nature/Rock_%d.glb" % (i % 7 + 1), Vector3(-60 + i * 30, -6, -110 - (i % 3) * 20), randf() * TAU, randf_range(28, 38))
		M.recolor(rk, Color(0.42, 0.44, 0.4))
	nature_node = Node3D.new()
	add_child(nature_node)


func _face_plaza(p: Vector3) -> float:
	return atan2(PLAZA.x - p.x, PLAZA.z - p.z)


## Árboles y rocas cambian con la estación (otoño / nieve).
func _build_nature(s: int) -> void:
	for c in nature_node.get_children():
		c.queue_free()
	var suffix: String = ["", "", "_Autumn", "_Snow"][s]
	for t in trees:
		var kind: String = ["CommonTree", "PineTree", "BirchTree"][t["k"]]
		M.put(nature_node, "nature/%s%s_%d.glb" % [kind, suffix, t["i"]], t["p"], t["r"], t["s"])
		if season == -1:
			obstacles.append([Vector2(t["p"].x, t["p"].z), 0.6])
	for rk in rocks:
		var kind := "Rock_Snow" if s == 3 else "Rock_Moss"
		M.put(nature_node, "nature/%s_%d.glb" % [kind, rk["i"]], rk["p"], rk["r"], rk["s"])
		if season == -1:
			obstacles.append([Vector2(rk["p"].x, rk["p"].z), 0.9 * rk["s"] / 1.5])
	for i in 40:
		var p := Vector3(randf_range(2, 118), 0, randf_range(2, 78))
		if p.distance_to(PLAZA) > 14 and p.distance_to(FARM.POND) > 12 and not Rect2(86, 9, 26, 33).has_point(Vector2(p.x, p.z)) and p.distance_to(FARM.CORRAL) > 7 and BLD.SLOTS.all(func(sl): return p.distance_to(sl) > 6.0):
			M.put(nature_node, "nature/%s_%d.glb" % ["Bush_Snow" if s == 3 else "Bush", 1 + i % 2], p, randf() * TAU, randf_range(1.2, 2.0))
	M.set_season_ground(env["grad"], s)
	season = s


func _rebuild_house() -> void:
	if house_node:
		house_node.queue_free()
	house_node = Node3D.new()
	add_child(house_node)
	house_level = int(GS.data["house_level"])
	var rot := _face_plaza(PLOT)
	match house_level:
		0:
			for o in [Vector3(-3, 0, -3), Vector3(3, 0, -3), Vector3(-3, 0, 3), Vector3(3, 0, 3)]:
				M.put(house_node, "village/Fence.glb", PLOT + o, 0.0 if o.z != 0 else PI / 2, 1.2)
			M.put(house_node, "village/Hay.glb", PLOT + Vector3(-1, 0, -1), 0.3, 1.3)
		1:
			M.put(house_node, "village/House_1.glb", PLOT, rot, 1.3)
		2:
			M.put(house_node, "village/House_4.glb", PLOT, rot, 1.8)
		3:
			M.put(house_node, "village/Inn.glb", PLOT, rot, 1.8)
			M.recolor(M.put(house_node, "castle/Banner.glb", PLOT + Vector3(4.5, 0, 3), 0, 1.4), Color(0.6, 0.1, 0.1))
	var lbl := M.label3d("Tu parcela" if house_level == 0 else "Casa %s" % GS.data["dynasty"], 40)
	lbl.position = PLOT + Vector3(0, 7.0 if house_level > 0 else 2.5, 0)
	lbl.modulate = Color(1, 0.9, 0.6)
	house_node.add_child(lbl)


func _actor(parts: Array, opts := {}) -> Node3D:
	var a := ACTOR.new()
	add_child(a)
	a.build(parts, opts)
	return a


func _reset_villagers() -> void:
	for v in villagers:
		v.queue_free()
	villagers.clear()
	vtarget.clear()
	vlabels.clear()
	var i := 0
	for v in GS.data["villagers"]:
		var parts: Array
		var opts := {"hair_color": M.SKIN_HAIR[i % 4]}
		if v["male"]:
			parts = ["ubc/Superhero_Male_FullBody", "out/Male_Peasant", MALE_HAIR[i % 3]]
		else:
			parts = ["ubc/Superhero_Female_FullBody", "out/Female_Ranger", FEMALE_HAIR[i % 2]]
			opts["hide_hood"] = true
			if i % 2 == 0:
				opts["faction"] = "bandido"
		var a := _actor(parts, opts)
		var home := _door(v)
		a.position = home + Vector3(randf_range(-4, 4), 0, randf_range(-4, 4))
		var l := M.label3d(v["name"], 36)
		l.position = Vector3(0, 2.15, 0)
		a.add_child(l)
		villagers.append(a)
		vtarget.append(a.position)
		vlabels.append(l)
		i += 1


func _door(v: Dictionary) -> Vector3:
	var h := Vector3(v["hx"], 0, v["hy"]) * 0.05
	return h + (PLAZA - h).normalized() * 4.0


func _update_player_model() -> void:
	var d = GS.data
	var p = d["player"]
	var armor := int(d["armor"])
	var sig := "%s-%d-%d-%s" % [p["male"], mini(armor, 2), mini(int(d["weapon"]), 1), p["name"]]
	if sig == player_sig:
		return
	player_sig = sig
	var pos := PLAZA + Vector3(-4, 0, -12)
	var rot := 0.0
	if player:
		pos = player.position
		rot = player.rotation.y
		player.queue_free()
	var male: bool = p["male"]
	var opts := {"hide_hood": true, "hair_color": M.SKIN_HAIR[0], "sword": int(d["weapon"]) >= 1}
	var parts: Array
	if armor >= 1:
		parts = ["ubc/Superhero_Male_FullBody", "out/Male_Ranger"] if male else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger"]
		opts["faction"] = "azul"
		opts["shield"] = true
		if armor >= 2:
			opts["helmet"] = "Helmet2"
		else:
			parts.append("hair/Hair_SimpleParted" if male else "hair/Hair_Buns")
	else:
		parts = ["ubc/Superhero_Male_FullBody", "out/Male_Peasant", "hair/Hair_SimpleParted"] if male else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger", "hair/Hair_Long"]
		if not male:
			opts["faction"] = "bandido"
	player = _actor(parts, opts)
	player.position = pos
	player.rotation.y = rot
	if cam:
		cam.target = player


func _update_family() -> void:
	var d = GS.data
	var sig := str(d["spouse"]) + str(d["children"]) + str(d["generation"])
	if sig == family_sig:
		return
	family_sig = sig
	for f in family:
		f["a"].queue_free()
	family.clear()
	var members := []
	if d["spouse"] != null:
		members.append(d["spouse"])
	members.append_array(d["children"])
	var k := 0
	for m in members:
		var male: bool = m["male"]
		var parts: Array = ["ubc/Superhero_Male_FullBody", "out/Male_Peasant", MALE_HAIR[k % 2]] if male else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger", FEMALE_HAIR[k % 2]]
		var a := _actor(parts, {"hide_hood": true, "hair_color": M.SKIN_HAIR[(k + 1) % 4], "faction": "bandido"} if not male else {"hair_color": M.SKIN_HAIR[(k + 1) % 4]})
		var age := int(m["age"])
		if m != d["spouse"]:
			a.scale = Vector3.ONE * clampf(0.5 + age * 0.032, 0.5, 1.0)
		a.position = _front_of_house() + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3))
		family.append({"a": a, "t": a.position})
		k += 1


func _front_of_house() -> Vector3:
	return PLOT + (PLAZA - PLOT).normalized() * 6.0


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
	help.text = "WASD: mover · Shift: correr · Clic derecho: girar cámara · Rueda: zoom · E: usar · I: inventario · T: velocidad · Esc: menú"
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
	lbl_res.text = "   Oro: %d      Madera: %d      Piedra: %d      Comida: %d raciones      Prestigio: %d      Tiempo: x%d" % [int(d["gold"]), int(d["wood"]), int(d["stone"]), GS.food_total(), int(d["prestige"]), int(GS.speed)]
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


## Panel con contenido libre (mercado).
func _open_custom(title: String, content: Control) -> void:
	for c in box.get_children():
		c.queue_free()
	var t := Label.new()
	t.text = title
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
	box.add_child(t)
	box.add_child(content)
	var close := Button.new()
	close.text = "Cerrar"
	close.custom_minimum_size.y = 36
	close.pressed.connect(_close_panel)
	box.add_child(close)
	panel.visible = true
	close.grab_focus.call_deferred()


func _close_panel() -> void:
	panel.visible = false


# ---------------- Bucle ----------------

func _process(delta: float) -> void:
	var d = GS.data
	if season != int(d["season"]):
		_build_nature(int(d["season"]))
	if house_level != int(d["house_level"]):
		_rebuild_house()
	_update_family()
	_update_player_model()
	if not panel.visible and not GS.popups.is_empty():
		_show_popup(GS.popups.pop_front())
	if not panel.visible and not d.get("game_over", false):
		_move_player(delta)
		GS.advance(delta)
		inter = _find_interaction()
		if Input.is_key_pressed(KEY_E) and inter.get("type", "") in ["tree", "rock"]:
			_gather(inter["type"])
		elif Input.is_key_pressed(KEY_E) and inter.get("type", "") == "fish":
			farm.fish()
		elif Input.is_key_pressed(KEY_E) and inter.get("type", "") == "mine" and GS.data["mine"]:
			bld.mine_tick()
		_move_npcs(delta)
	else:
		player.play("Idle")
	cooldown -= delta
	var night: bool = d["time"] < 0.22 or d["time"] > 0.85
	camp_banner.visible = d["summons"] != null
	camp_fire.visible = d["summons"] != null or night
	for i in villagers.size():
		vlabels[i].visible = villagers[i].position.distance_to(player.position) < 9
	M.set_daytime(env, d["time"])
	_update_hud()


func _move_player(delta: float) -> void:
	var dir: Vector3 = cam.move_dir()
	if dir == Vector3.ZERO:
		if not player.is_playing_once():
			player.play("Idle")
		return
	var sprint := Input.is_key_pressed(KEY_SHIFT)
	var p: Vector3 = player.position + dir * (SPRINT_SPEED if sprint else RUN_SPEED) * delta
	p.x = clampf(p.x, 1, SIZE.x - 1)
	p.z = clampf(p.z, 1, SIZE.y - 1)
	var obs := obstacles + ([[Vector2(PLOT.x, PLOT.z), 3.6]] if house_level > 0 else [])
	for o in obs:
		var v: Vector2 = Vector2(p.x, p.z) - o[0]
		if v.length() < o[1]:
			var fix: Vector2 = o[0] + v.normalized() * o[1]
			p.x = fix.x
			p.z = fix.y
	player.position = p
	player.rotation.y = lerp_angle(player.rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 12.0))
	player.play("Sprint" if sprint else "Jog_Fwd")


func _move_npcs(delta: float) -> void:
	var t: float = GS.data["time"]
	var night := t < 0.22 or t > 0.85
	var vil: Array = GS.data["villagers"]
	for i in villagers.size():
		var a = villagers[i]
		var home := _door(vil[i])
		if night:
			vtarget[i] = home
		elif a.position.distance_to(vtarget[i]) < 0.3 and randf() < 0.004 * GS.speed:
			vtarget[i] = home + Vector3(randf_range(-9, 9), 0, randf_range(-9, 9))
		_walk_to(a, vtarget[i], 1.3, delta)
	for f in family:
		if f["a"].position.distance_to(f["t"]) < 0.3 and randf() < 0.004:
			f["t"] = _front_of_house() + Vector3(randf_range(-3.5, 3.5), 0, randf_range(-3.5, 3.5))
		_walk_to(f["a"], f["t"], 1.1, delta)


func _walk_to(a, target: Vector3, spd: float, delta: float) -> void:
	var to: Vector3 = target - a.position
	to.y = 0
	if to.length() < 0.3:
		a.play("Idle")
		return
	a.position += to.normalized() * minf(to.length(), spd * delta * GS.speed)
	a.rotation.y = lerp_angle(a.rotation.y, atan2(to.x, to.z), minf(1.0, delta * 8.0))
	a.play("Walk")


func _find_interaction() -> Dictionary:
	var d = GS.data
	var pp: Vector3 = player.position
	for i in villagers.size():
		if pp.distance_to(villagers[i].position) < 1.8:
			return {"type": "villager", "i": i, "label": "Hablar con %s" % d["villagers"][i]["name"]}
	if pp.distance_to(PLOT) < 6.5:
		return {"type": "house", "label": "Tu parcela" if int(d["house_level"]) == 0 else "Tu casa"}
	if pp.distance_to(MARKET) < 5.5:
		return {"type": "market", "label": "Mercado"}
	if pp.distance_to(HALL) < 7.0:
		return {"type": "hall", "label": "Casa del Concejo"}
	if pp.distance_to(CAMP) < 8.0:
		return {"type": "camp", "label": "Campamento del rey"}
	for tr in trees:
		if pp.distance_to(tr["p"]) < 2.0:
			return {"type": "tree", "label": "Talar leña (mantén E)", "p": tr["p"]}
	for rk in rocks:
		if pp.distance_to(rk["p"]) < 1.2 + rk["s"] * 0.6:
			return {"type": "rock", "label": "Picar piedra (mantén E)", "p": rk["p"]}
	var bi: Dictionary = bld.find_interaction(pp)
	if not bi.is_empty():
		return bi
	var fi: Dictionary = farm.find_interaction(pp)
	if not fi.is_empty():
		return fi
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
		KEY_I:
			if not panel.visible:
				farm.inventory_panel()
		KEY_F5:
			GS.save_game()
			_float("Partida guardada", Color.WHITE)


func _float(text: String, col: Color) -> void:
	var l := M.label3d(text, 44)
	l.modulate = col
	l.position = player.position + Vector3(0, 2.3, 0)
	add_child(l)
	var tw := create_tween()
	tw.tween_property(l, "position:y", l.position.y + 1.2, 1.1)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 1.1)
	tw.tween_callback(l.queue_free)


# ---------------- Interacciones ----------------

func _interact() -> void:
	match inter.get("type", ""):
		"tree", "rock":
			_gather(inter["type"])
		"villager":
			var v = villagers[inter["i"]]
			v.rotation.y = atan2(player.position.x - v.position.x, player.position.z - v.position.z)
			v.play("Idle_Talking")
			_villager_panel(inter["i"])
		"house":
			_house_panel()
		"market":
			farm.market_panel()
		"hall":
			_hall_panel()
		"camp":
			_camp_panel()
		"":
			pass
		"solar", "mine":
			bld.interact(inter)
		_:
			farm.interact(inter)


func _gather(type: String) -> void:
	if cooldown > 0:
		return
	if inter.has("p"):
		var to: Vector3 = inter["p"] - player.position
		player.rotation.y = atan2(to.x, to.z)
	player.play_once("Interact")
	var d = GS.data
	match type:
		"tree":
			var w := 2 if "hacha" in d["tools"] else 1
			d["wood"] += w
			cooldown = 0.45
			_float("+%d madera" % w, Color(0.95, 0.75, 0.45))
		"rock":
			var st := 2 if "pico" in d["tools"] else 1
			d["stone"] += st
			cooldown = 0.6
			_float("+%d piedra" % st, Color(0.85, 0.85, 0.9))


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
	opts.append(["Regalar comida, 5 raciones (+15 afecto)", func():
		GS.eat(5)
		v["affection"] = mini(100, int(v["affection"]) + 15)
		_villager_panel(i), GS.food_total() >= 5])
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
