extends "res://scripts/panel_scene.gd"
## Visita a pie de un pueblo del mapa: calles, casas, mercado, taberna y castillo del señor.

const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const CAM := preload("res://scripts/cam_rig.gd")
const R := preload("res://scripts/region_sim.gd")
const N := preload("res://scripts/nobles.gd")
const COURT := preload("res://scripts/court_ui.gd")
const HOUSES := ["village/House_1.glb", "village/House_2.glb", "village/House_3.glb", "village/House_4.glb"]
const RADIUS := 46.0
const GATE := Vector3(0, 0, 44)

var id := -1
var t: Dictionary
var tier := 0
var col := Color(0.5, 0.1, 0.1)
var player
var cam
var spots: Array = []  # [posición, texto, Callable]
var obstacles: Array = []  # [Vector2, radio]
var walkers: Array = []
var inter = null
var step_t := 0.0


func _ready() -> void:
	var d = GS.data
	id = int(d["visit"])
	d["visited"] = true
	GS.tip("visita", "visitar pueblos", "Pasea por el pueblo: en la plaza está el mercado, en la taberna oirás rumores de la región y en el castillo te recibe su señor. Vuelve a la puerta para salir al mapa.")
	t = R.town(id)
	tier = R.tier_of(int(t["pop"]))
	var r := RandomNumberGenerator.new()
	r.seed = id * 131 + 5
	if t["owner"] == "señor":
		var c: Array = R.region()["lords"][int(t["lord"])]["color"]
		col = Color(c[0], c[1], c[2])
	else:
		col = Color(0.15, 0.3, 0.7)
	var env := M.make_env(self, Vector3.ZERO, 400)
	M.set_season_ground(env["grad"], int(d["season"]))
	M.set_daytime(env, 0.45)
	var suffix: String = ["", "", "_Autumn", "_Snow"][int(d["season"])]

	# Calles: la mayor va de la puerta a la plaza y al castillo.
	var road_col := Color(0.45, 0.38, 0.28)
	M.road(self, GATE, Vector3(0, 0, -26), 4.0, road_col)
	M.road(self, Vector3(-30, 0, 0), Vector3(30, 0, 0), 3.2, road_col)
	if tier >= 1:
		M.road(self, Vector3(-30, 0, -18), Vector3(30, 0, -18), 3.0, road_col)
		M.road(self, Vector3(-30, 0, 20), Vector3(30, 0, 20), 3.0, road_col)

	# Plaza: pozo, puestos del mercado y mercader.
	M.put(self, "village/Well.glb", Vector3(0, 0, 4), 0.0, 1.0)
	obstacles.append([Vector2(0, 4), 1.6])
	for s in [[Vector3(-7, 0, 5), "village/MarketStand_1.glb", PI / 2], [Vector3(7, 0, 5), "village/MarketStand_2.glb", -PI / 2], [Vector3(-7, 0, 11), "village/MarketStand_2.glb", PI / 2]]:
		M.put(self, s[1], s[0], s[2], 1.0)
		obstacles.append([Vector2(s[0].x, s[0].z), 1.8])
	for p in [Vector3(-9, 0, 8), Vector3(9, 0, 2), Vector3(8.5, 0, 8)]:
		M.put(self, ["village/Crate.glb", "village/Barrel.glb", "village/Bags.glb"].pick_random(), p, r.randf() * TAU, 1.0)
	var merchant = _npc(Vector3(-4.6, 0, 5), PI / 2, false, "Idle_Talking")
	spots.append([merchant.position, "Comerciar en el mercado de %s" % t["name"], func(): COURT.market(self, id)])

	# Taberna: rumores de la región.
	M.put(self, "village/Inn.glb", Vector3(16, 0, -8), -PI / 2, 1.0)
	obstacles.append([Vector2(16, -8), 5.0])
	_npc(Vector3(11, 0, -6), -PI / 2, true, "Idle")
	spots.append([Vector3(11, 0, -7), "Escuchar rumores en la taberna", func(): COURT.diplomacy(self)])
	M.put(self, "village/Blacksmith.glb", Vector3(-16, 0, -8), PI / 2, 1.0)
	obstacles.append([Vector2(-16, -8), 4.5])

	# Castillo o casa fuerte del señor, al fondo de la calle mayor.
	if int(t["wall"]) >= 2 or tier >= 1:
		M.castle(self, Vector3(0, 0, -36), 2.2)
		for x in range(-11, 12):
			obstacles.append([Vector2(x, -36), 2.2])
	else:
		M.put(self, "village/House_4.glb", Vector3(0, 0, -34), 0.0, 1.6)
		obstacles.append([Vector2(0, -34), 5.0])
	M.recolor(M.put(self, "castle/Banner.glb", Vector3(-4, 0, -27), 0.0, 1.6), col)
	M.recolor(M.put(self, "castle/Banner.glb", Vector3(4, 0, -27), 0.0, 1.6), col)
	if t["owner"] == "señor":
		var li: int = t["lord"]
		var lord = N.lord(li)
		var noble = _npc(Vector3(0, 0, -26), 0.0, true, "Idle", true)
		noble.attach("hand_r", "weapons/Sword.glb", Vector3(0, 0.05, 0), Vector3(0, 0, 90), 1.0)
		spots.append([noble.position, ("Hablar con %s" if N.at_war(-1, li) else "Entrar en la corte de %s") % N.full(lord), func(): COURT.court(self, li, id)])
	else:
		_npc(Vector3(0, 0, -26), 0.0, true, "Idle")
		spots.append([Vector3(0, 0, -26), "Hablar con tu alcaide", func():
			_say("«Mi señor, %s está en calma. Somos %d vecinos y %d soldados de guarnición.»" % [t["name"], int(t["pop"]), int(t["garrison"])])])

	# Casas a ambos lados de las calles, más cuantas más gentes.
	var n: int = [10, 18, 28][tier]
	var tries := 0
	while n > 0 and tries < 400:
		tries += 1
		var p := Vector3(r.randf_range(-36, 36), 0, r.randf_range(-24, 36))
		if absf(p.x) < 6.5 or p.length() < 15 or absf(p.z) < 4.5 or (tier >= 1 and (absf(p.z + 18) < 4 or absf(p.z - 20) < 4)):
			continue
		if obstacles.any(func(o): return o[0].distance_to(Vector2(p.x, p.z)) < o[1] + 4.0):
			continue
		var rot := 0.0 if absf(p.x) > absf(p.z) else PI / 2
		M.put(self, HOUSES[r.randi() % 4], p, rot + (PI if p.x > 0 else 0.0), 1.0)
		obstacles.append([Vector2(p.x, p.z), 3.4])
		n -= 1

	# Murallas: empalizada o piedra, con puerta hacia el camino.
	var wall := int(t["wall"])
	if wall >= 1:
		var piece := 4.5 if wall == 2 else 2.3
		var count := int(TAU * RADIUS / piece)
		for k in count:
			var a := float(k) / count * TAU
			var p := Vector3(sin(a), 0, cos(a)) * RADIUS
			if k == 0 or (wall == 1 and (k == 1 or k == count - 1)):
				if wall == 2:
					M.recolor(M.put(self, "castle/TallWallEntrance.glb", p, a, 3.0), Color(0.52, 0.5, 0.46))
				continue
			if wall == 2:
				M.recolor(M.put(self, "castle/TallWall.glb", p, a, 3.0), Color(0.52, 0.5, 0.46))
			else:
				M.put(self, "village/Fence.glb", p, a, 3.0)
	for k in 2:
		var g = _npc(GATE + Vector3(-4 + 8 * k, 0, -1), PI, true, "Sword_Idle", true)
		g.attach("hand_r", "weapons/Spear.glb", Vector3(0, 0.05, 0), Vector3(0, 0, 90), 2.3)
	spots.append([GATE, "Salir al mapa", _leave])

	# Bosque alrededor.
	for i in 90:
		var a := r.randf() * TAU
		var dist := r.randf_range(RADIUS + 6, RADIUS + 50)
		M.put(self, "nature/%s%s_%d.glb" % [["CommonTree", "PineTree", "BirchTree"][i % 3], suffix, r.randi_range(1, 5)], Vector3(sin(a), 0, cos(a)) * dist, r.randf() * TAU, r.randf_range(2.4, 3.4))

	# Vecinos paseando.
	for i in clampi(int(t["pop"]) / 25, 5, 16):
		var w = _npc(_street_point(), 0.0, randf() < 0.5, "Walk")
		walkers.append({"a": w, "t": _street_point()})

	# Tú.
	var pl = d["player"]
	var male: bool = pl["male"]
	var parts: Array = ["ubc/Superhero_Male_FullBody", "out/Male_Ranger"] if male else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger"]
	var opts := {"faction": "azul", "hide_hood": true, "hair_color": M.SKIN_HAIR[0], "sword": int(d["weapon"]) >= 1, "shield": int(d["armor"]) >= 1}
	if int(d["armor"]) >= 2:
		opts["helmet"] = "Helmet2"
	else:
		parts.append("hair/Hair_SimpleParted" if male else "hair/Hair_Buns")
	player = ACTOR.new()
	add_child(player)
	player.build(parts, opts)
	if d.get("horse", false) and d.get("riding", false):
		player.mount(Color(1.3, 0.9, 0.7))
	player.position = GATE + Vector3(0, 0, -9)
	player.rotation.y = PI
	cam = CAM.new()
	cam.target = player
	cam.yaw = 0.0
	cam.dist = 6.0
	add_child(cam)

	help_text = "WASD: andar · Shift: correr · Clic derecho: girar cámara · E: hablar · Esc: menú"
	_build_hud()
	SFX.music("aldea")
	SFX.ambient("gente", -12.0)
	GS.notify.connect(func(_t): _refresh_log())
	_refresh_log()


## Personaje del pueblo. soldier: viste con los colores del señor.
func _npc(pos: Vector3, rot: float, male: bool, anim: String, soldier := false):
	var a := ACTOR.new()
	add_child(a)
	var parts: Array
	var opts := {"hair_color": M.SKIN_HAIR.pick_random()}
	if soldier:
		parts = ["ubc/Superhero_Male_FullBody", "out/Male_Ranger"]
		opts.merge({"faction": "rojo" if t["owner"] == "señor" else "azul", "hide_hood": true, "shield": true, "helmet": "Helmet1"})
	elif male:
		parts = ["ubc/Superhero_Male_FullBody", "out/Male_Peasant", ["hair/Hair_SimpleParted", "hair/Hair_Buzzed", "hair/Hair_Beard"].pick_random()]
	else:
		parts = ["ubc/Superhero_Female_FullBody", "out/Female_Ranger", ["hair/Hair_Long", "hair/Hair_Buns"].pick_random()]
		opts.merge({"hide_hood": true, "faction": "bandido"})
	a.build(parts, opts)
	a.position = pos
	a.rotation.y = rot
	a.play(anim)
	if not soldier and anim != "Walk":
		obstacles.append([Vector2(pos.x, pos.z), 0.6])
	return a


func _street_point() -> Vector3:
	var pts := [Vector3(randf_range(-2, 2), 0, randf_range(-24, 40)), Vector3(randf_range(-28, 28), 0, randf_range(-1.5, 1.5)), Vector3(randf_range(-6, 6), 0, randf_range(0, 14))]
	if tier >= 1:
		pts.append(Vector3(randf_range(-28, 28), 0, -18 + randf_range(-1, 1)))
		pts.append(Vector3(randf_range(-28, 28), 0, 20 + randf_range(-1, 1)))
	return pts.pick_random()


func _leave() -> void:
	GS.data.erase("visit")
	GS.save_game()
	main.start_region()


func _process(delta: float) -> void:
	for w in walkers:
		var to: Vector3 = w["t"] - w["a"].position
		to.y = 0
		if to.length() < 0.5:
			w["t"] = _street_point()
		else:
			w["a"].position += to.normalized() * minf(to.length(), 1.4 * delta)
			w["a"].rotation.y = lerp_angle(w["a"].rotation.y, atan2(to.x, to.z), minf(1.0, delta * 6.0))
	if not panel.visible and not GS.popups.is_empty():
		var pp: Dictionary = GS.popups.pop_front()
		if pp.has("options"):
			_open_panel(pp["title"], pp["text"], pp["options"].map(func(o): return [o[0], func():
				_close_panel()
				o[1].call()]))
		else:
			_open_panel(pp["title"], pp["text"], [[pp.get("button", "Continuar"), _close_panel]])
	if not panel.visible:
		_move_player(delta)
	inter = null
	var best := 3.2
	for s in spots:
		var dd: float = Vector2(s[0].x, s[0].z).distance_to(Vector2(player.position.x, player.position.z))
		if dd < best:
			best = dd
			inter = s
	var d = GS.data
	lbl_top.text = "   %s · %s de %s · %d hab. · %s      Oro: %d" % [t["name"], R.tier_name(tier), R.owner_text(t), int(t["pop"]), GS.SEASONS[int(d["season"])], int(d["gold"])]
	lbl_prompt.text = "" if panel.visible or inter == null else "[E] " + inter[1]


func _move_player(delta: float) -> void:
	var dir: Vector3 = cam.move_dir()
	if dir == Vector3.ZERO:
		player.play("Idle")
		return
	var sprint := Input.is_key_pressed(KEY_SHIFT)
	var p: Vector3 = player.position + dir * (7.0 if sprint else 4.2) * (1.8 if player.horse != null else 1.0) * delta
	if Vector2(p.x, p.z).length() > RADIUS - 2.0:
		p = Vector3(p.x, 0, p.z).normalized() * (RADIUS - 2.0)
	for o in obstacles:
		var v: Vector2 = Vector2(p.x, p.z) - o[0]
		if v.length() < o[1]:
			var fix: Vector2 = o[0] + v.normalized() * o[1]
			p.x = fix.x
			p.z = fix.y
	player.position = p
	step_t -= delta
	if step_t <= 0:
		step_t = 0.27 if sprint else 0.36
		SFX.play("paso_nieve" if int(GS.data["season"]) == 3 else "paso", -10.0)
	player.rotation.y = lerp_angle(player.rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 12.0))
	player.play("Sprint" if sprint else "Jog_Fwd")


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed and not ev.echo:
		match ev.keycode:
			KEY_E:
				if not panel.visible and inter != null:
					inter[2].call()
			KEY_ESCAPE:
				if panel.visible:
					_close_panel()
				else:
					_open_panel("Pausa", "", [["Continuar", _close_panel], ["Salir al mapa", _leave], ["Opciones", func():
						_close_panel()
						preload("res://scripts/options.gd").open(self)], ["Guardar partida", func():
						GS.save_game()
						_close_panel()]])
