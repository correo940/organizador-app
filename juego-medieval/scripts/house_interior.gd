extends "res://scripts/panel_scene.gd"
## Tu casa por dentro: el mobiliario mejora con el nivel de la casa y tu riqueza; tu familia está dentro.
## Puedes dormir, comer en familia, mirar el arcón y salir.

const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const CAM := preload("res://scripts/cam_rig.gd")
const ENG := preload("res://scripts/engines.gd")
const W := 12.0
const D := 9.0

var player
var cam
var spots: Array = []
var inter = null


func _ready() -> void:
	var d = GS.data
	var lvl := int(d["house_level"])
	var rich := int(d["gold"]) >= 300
	var env := M.make_env(self, Vector3(0, -0.02, 0), 60)
	var day: bool = float(d["time"]) > 0.25 and float(d["time"]) < 0.8
	M.set_daytime(env, float(d["time"]) if day else 0.15)
	env["env"].fog_enabled = false
	env["sun"].light_energy = 0.45 if day else 0.15
	M.set_season_ground(env["grad"], int(d["season"]))
	env["env"].ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env["env"].ambient_light_color = Color(1.0, 0.85, 0.65)
	env["env"].ambient_light_energy = 0.5 if day else 0.6
	var floor_col := Color(0.42, 0.3, 0.18) if lvl < 2 else Color(0.5, 0.48, 0.45)
	var wall_col := Color(0.55, 0.42, 0.28) if lvl < 2 else (Color(0.72, 0.7, 0.66) if lvl < 4 else Color(0.8, 0.76, 0.68))
	ENG._box(self, Vector3(W, 0.1, D), Vector3(0, -0.05, 0), floor_col)
	ENG._box(self, Vector3(W, 3.5, 0.3), Vector3(0, 1.75, -D / 2), wall_col)
	ENG._box(self, Vector3(0.3, 3.5, D), Vector3(-W / 2, 1.75, 0), wall_col)
	ENG._box(self, Vector3(0.3, 1.2, D), Vector3(W / 2, 0.6, 0), wall_col)
	# Pared delantera solo a media altura, para ver dentro como en una casa de muñecas.
	ENG._box(self, Vector3(W * 0.35, 0.6, 0.3), Vector3(-W * 0.33, 0.3, D / 2), wall_col)
	ENG._box(self, Vector3(W * 0.35, 0.6, 0.3), Vector3(W * 0.33, 0.3, D / 2), wall_col)
	for x in [-4.0, 0.0, 4.0]:
		ENG._box(self, Vector3(0.25, 0.25, D), Vector3(x, 3.4, 0), Color(0.3, 0.2, 0.12))
	# Hogar con fuego.
	ENG._box(self, Vector3(2.2, 1.8, 0.8), Vector3(0, 0.9, -D / 2 + 0.5), Color(0.4, 0.38, 0.36))
	M.put(self, "village/Bonfire_Lit.glb", Vector3(0, 0, -D / 2 + 1.1), 0.0, 0.9)
	var fire := OmniLight3D.new()
	fire.light_color = Color(1.0, 0.6, 0.3)
	fire.light_energy = 2.5
	fire.omni_range = 12.0
	fire.position = Vector3(0, 1.5, -D / 2 + 1.5)
	add_child(fire)
	var lamp := OmniLight3D.new()
	lamp.light_color = Color(1.0, 0.8, 0.55)
	lamp.light_energy = 1.2
	lamp.omni_range = 14.0
	lamp.position = Vector3(0, 3.0, 1.0)
	add_child(lamp)
	# Mesa con bancos.
	ENG._box(self, Vector3(3.0, 0.15, 1.3), Vector3(0, 0.85, 0.5), Color(0.4, 0.27, 0.15))
	for s in [-1, 1]:
		ENG._box(self, Vector3(3.0, 0.1, 0.4), Vector3(0, 0.45, 0.5 + 1.0 * s), Color(0.35, 0.24, 0.13))
		for x in [-1.3, 1.3]:
			ENG._box(self, Vector3(0.12, 0.85, 0.12), Vector3(x, 0.42, 0.5 + 0.5 * s), Color(0.35, 0.24, 0.13))
	spots.append([Vector3(0, 0, 0.5), "Comer en familia (una vez al día)", _meal])
	# Camas: más y mejores cuanto mayor es la casa.
	var beds := mini(1 + d["children"].size() / 2, 1 + lvl)
	for b in beds:
		var bp := Vector3(-W / 2 + 1.3, 0, -D / 2 + 1.5 + b * 1.6)
		ENG._box(self, Vector3(2.0, 0.5, 1.1), bp + Vector3(0, 0.25, 0), Color(0.4, 0.28, 0.16))
		ENG._box(self, Vector3(1.6, 0.12, 1.0), bp + Vector3(0.15, 0.55, 0), Color(0.75, 0.15, 0.15) if b == 0 else Color(0.25, 0.35, 0.6))
	spots.append([Vector3(-W / 2 + 2.5, 0, -D / 2 + 1.5), "Dormir hasta el amanecer", func():
		GS.sleep()
		_say("Duermes hasta el amanecer junto a tu familia. (+10 salud)")])
	# Arcón y despensa.
	ENG._box(self, Vector3(1.2, 0.7, 0.7), Vector3(W / 2 - 1.0, 0.35, -D / 2 + 1.0), Color(0.45, 0.3, 0.15))
	ENG._box(self, Vector3(1.25, 0.08, 0.75), Vector3(W / 2 - 1.0, 0.74, -D / 2 + 1.0), Color(0.35, 0.33, 0.3))
	spots.append([Vector3(W / 2 - 1.0, 0, -D / 2 + 2.0), "Abrir el arcón", _chest])
	for k in 1 + lvl:
		M.put(self, ["village/Barrel.glb", "village/Crate.glb", "village/Bags.glb"][k % 3], Vector3(W / 2 - 1.0, 0, -0.5 + k * 1.1), randf() * TAU, 1.0)
	# Lujos según la casa y la riqueza.
	if lvl >= 2:
		ENG._box(self, Vector3(3.6, 0.03, 2.4), Vector3(0, 0.02, 2.9), Color(0.55, 0.12, 0.12))
	if lvl >= 3 or rich:
		M.recolor(M.put(self, "castle/Banner.glb", Vector3(-3.5, 0, -D / 2 + 0.3), 0.0, 2.2), Color(0.6, 0.1, 0.1))
		M.recolor(M.put(self, "castle/Banner.glb", Vector3(3.5, 0, -D / 2 + 0.3), 0.0, 2.2), Color(0.6, 0.1, 0.1))
	if lvl >= 4:
		ENG._box(self, Vector3(1.0, 1.6, 0.6), Vector3(W / 2 - 0.5, 0.8, 2.5), Color(0.35, 0.24, 0.13))
		for k in 4:
			ENG._box(self, Vector3(0.12, 0.25, 0.4), Vector3(W / 2 - 0.5, 0.4 + k * 0.35, 2.5), [Color(0.6, 0.2, 0.2), Color(0.2, 0.3, 0.6), Color(0.3, 0.5, 0.25), Color(0.6, 0.5, 0.2)][k])
	if d.get("weapon", 0) >= 2:
		var sw := M.put(self, "weapons/Sword.glb", Vector3(-1.8, 2.2, -D / 2 + 0.3), 0.0, 0.5)
		sw.rotation_degrees = Vector3(0, 0, 90)
	spots.append([Vector3(0, 0, D / 2 - 0.6), "Salir de casa", func():
		GS.save_game()
		main.start_village()])
	# La familia.
	var k := 0
	var members := []
	if d["spouse"] != null:
		members.append(d["spouse"])
	members.append_array(d["children"])
	for m in members:
		var a := ACTOR.new()
		add_child(a)
		var male: bool = m["male"]
		var parts: Array = ["ubc/Superhero_Male_FullBody", "out/Male_Peasant", "hair/Hair_SimpleParted"] if male else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger", "hair/Hair_Long"]
		a.build(parts, {"hair_color": GS.CHAR.hair(int(m["age"]), M.SKIN_HAIR[(k + 1) % 4])} if male else {"hide_hood": true, "faction": "bandido", "hair_color": GS.CHAR.hair(int(m["age"]), M.SKIN_HAIR[(k + 1) % 4])})
		if int(m["age"]) < 16:
			a.scale = Vector3.ONE * clampf(0.45 + int(m["age"]) * 0.035, 0.45, 0.95)
		if k < 4:
			a.position = Vector3(-1.0 + (k / 2) * 2.0, 0, 0.5 + (1.0 if k % 2 == 0 else 0.0))
			a.rotation.y = PI if k % 2 == 0 else 0.0
			a.play("Sitting_Idle")
			a.position.y = 0.0
		else:
			a.position = Vector3(randf_range(-4, 3), 0, randf_range(1.5, 3.5))
			a.play("Idle")
		var l := M.label3d(m["name"], 28)
		l.position = Vector3(0, 2.2, 0)
		a.add_child(l)
		k += 1
	# Tú.
	var pl = d["player"]
	player = ACTOR.new()
	add_child(player)
	player.build(["ubc/Superhero_Male_FullBody", "out/Male_Peasant", "hair/Hair_SimpleParted"] if pl["male"] else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger", "hair/Hair_Long"], {"hair_color": GS.CHAR.hair(int(pl["age"]), M.SKIN_HAIR[0])} if pl["male"] else {"hide_hood": true, "faction": "bandido", "hair_color": GS.CHAR.hair(int(pl["age"]), M.SKIN_HAIR[0])})
	player.position = Vector3(0, 0, D / 2 - 1.2)
	player.rotation.y = PI
	cam = CAM.new()
	cam.target = player
	cam.yaw = 0.0
	cam.pitch = -0.7
	cam.dist = 7.5
	add_child(cam)
	help_text = "WASD: andar · E: usar · Clic derecho: girar cámara · Esc: salir"
	_build_hud()
	SFX.ambient("", -30.0)
	GS.notify.connect(func(_t): _refresh_log())
	_refresh_log()


func _meal() -> void:
	var d = GS.data
	if d.get("meal_day", -1) == int(d["total_days"]):
		_say("Ya habéis comido juntos hoy.")
		return
	if not GS.eat(GS.family_size()):
		_say("No hay comida suficiente para toda la familia.")
		return
	d["meal_day"] = int(d["total_days"])
	d["player"]["health"] = minf(100.0, float(d["player"]["health"]) + 5.0)
	var talk := ["Los niños cuentan lo que han hecho en el día.", "Hablas de los planes para la cosecha.", "Se ríe toda la mesa con una historia del abuelo.", "Rezáis antes de comer y luego charláis hasta tarde."]
	_say("Coméis todos juntos alrededor de la mesa. %s (+5 salud)" % talk.pick_random())


func _chest() -> void:
	var d = GS.data
	var items := []
	for k in d["inv"]:
		if int(d["inv"][k]) > 0:
			items.append("%s: %d" % [GS.ITEMS[k][0] if GS.ITEMS.has(k) else k, int(d["inv"][k])])
	_say("En el arcón guardas %d de oro, %d de madera y %d de piedra.\n%s" % [int(d["gold"]), int(d["wood"]), int(d["stone"]), ", ".join(items) if not items.is_empty() else "Nada más."])


func _process(delta: float) -> void:
	if not panel.visible:
		var dir: Vector3 = cam.move_dir()
		if dir != Vector3.ZERO:
			var p: Vector3 = player.position + dir * 3.0 * delta
			p.x = clampf(p.x, -W / 2 + 0.6, W / 2 - 0.6)
			p.z = clampf(p.z, -D / 2 + 0.8, D / 2 - 0.4)
			if Rect2(-1.7, -0.3, 3.4, 1.6).has_point(Vector2(p.x, p.z)):
				p = player.position
			player.position = p
			player.rotation.y = lerp_angle(player.rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 12.0))
			player.play("Walk")
		else:
			player.play("Idle")
	inter = null
	var best := 1.8
	for s in spots:
		var dd: float = Vector2(s[0].x, s[0].z).distance_to(Vector2(player.position.x, player.position.z))
		if dd < best:
			best = dd
			inter = s
	var d = GS.data
	lbl_top.text = "   Tu casa: %s · %s, día %d, año %d · Oro: %d" % [GS.HOUSE_NAMES[int(d["house_level"])], GS.SEASONS[int(d["season"])], int(d["day"]), int(d["year"]), int(d["gold"])]
	lbl_prompt.text = "" if panel.visible or inter == null else "[E] " + inter[1]


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
					GS.save_game()
					main.start_village()
