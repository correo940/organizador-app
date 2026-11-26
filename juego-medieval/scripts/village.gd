extends Node3D
## La aldea en 3D: vida del personaje, recursos, casa, familia y llamadas del rey.

const Art = preload("res://scripts/art.gd")
const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const ENG := preload("res://scripts/engines.gd")
const CAM := preload("res://scripts/cam_rig.gd")
const FARM := preload("res://scripts/farm.gd")
const BLD := preload("res://scripts/buildings.gd")
const SIM := preload("res://scripts/village_sim.gd")
const TRADE := preload("res://scripts/trade_ui.gd")
const TOWN := preload("res://scripts/town.gd")
const WILD := preload("res://scripts/wildlife.gd")
const HUD := preload("res://scripts/hud.gd")

const PLAZA := Vector3(60, 0, 40)
const PLOT := Vector3(13, 0, 40)
const MARKET := Vector3(65.6, 0, 47.3)
const HALL := Vector3(60, 0, 19)
const CAMP := Vector3(111, 0, 41)
## Tierras del pueblo: bosque al oeste y al norte, lago al sur con embarcadero, barca e islote.
const LAKE_C := Vector3(90, 0, 140)
const LAKE_R := Vector2(48, 26)
const ISLAND := Vector3(110, 0, 146)
const ISLAND_R := 7.0
const DOCK := Vector3(78, 0, 109)
const DOCK_END := Vector3(78, 0, 121)
const WORLD := Rect2(-55, -65, 270, 235)
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
var vwork: Array = []
var vkids: Array = []
var vsig := ""
var step_t := 0.0
var lands_node: Node3D
var lands_sig := ""
var house_land := -2
var town
var wild
var inc
var built_tier := 0
var bnd: Rect2
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
var lbl_name: Label
var lbl_place: Label
var bar_health
var bar_food
var hud_portrait
var minimap
var hud_slots := {}
var lbl_info: Label
var lbl_log: Label
var lbl_prompt: Label
var panel: PanelContainer
var box: VBoxContainer


func _ready() -> void:
	built_tier = int(GS.data["tier"])
	GS.STALLS.ensure()
	bnd = TOWN.bounds(built_tier)
	env = M.make_env(self, Vector3(80, 0, 40), 500)
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
	# Gran bosque al oeste (caza y leña) y monte bajo al norte.
	var fz := FastNoiseLite.new()
	fz.seed = 5
	fz.frequency = 0.04
	var nf := 0
	while nf < 230:
		var p := Vector3(r.randf_range(-52, -6), 0, r.randf_range(-60, 132))
		if fz.get_noise_2d(p.x, p.z) > -0.25:
			trees.append({"p": p, "k": [0, 1, 1][nf % 3], "i": r.randi_range(1, 5), "s": r.randf_range(2.6, 3.8), "r": r.randf() * TAU})
			nf += 1
	for i in 70:
		var p := Vector3(r.randf_range(0, 150), 0, r.randf_range(-60, -42))
		trees.append({"p": p, "k": i % 3, "i": r.randi_range(1, 5), "s": r.randf_range(2.6, 3.6), "r": r.randf() * TAU})
	for i in 14:
		var a := r.randf() * TAU
		trees.append({"p": ISLAND + Vector3(cos(a), 0, sin(a)) * r.randf_range(1.5, ISLAND_R - 1.5), "k": i % 3, "i": r.randi_range(1, 5), "s": r.randf_range(2.0, 2.8), "r": r.randf() * TAU})
	for i in 22:
		rocks.append({"p": Vector3(r.randf_range(8, 32), 0, r.randf_range(55, 70)), "i": r.randi_range(1, 7), "s": r.randf_range(1.3, 2.4), "r": r.randf() * TAU})
	trees = trees.filter(func(t): return (_on_island(t["p"]) or not _in_lake(t["p"], 4.0)) and t["p"].distance_to(DOCK) > 6.0 and _free_ground(t["p"], 2.5) and t["p"].distance_to(WILD.CAMP) > 6.0 and BLD.SLOTS.all(func(sl): return t["p"].distance_to(sl) > 7.0) and t["p"].distance_to(BLD.MINE) > 6.0 and SIM.LANDS.all(func(l): return Vector2(t["p"].x, t["p"].z).distance_to(l) > 9.0) and TOWN.clear_rects(built_tier).all(func(r): return not r.has_point(Vector2(t["p"].x, t["p"].z))))
	_build_static()
	farm = FARM.new()
	farm.v = self
	add_child(farm)
	obstacles.append_array(farm.obstacles)
	bld = BLD.new()
	bld.v = self
	add_child(bld)
	obstacles.append_array(bld.obstacles)
	town = TOWN.new()
	town.v = self
	add_child(town)
	wild = WILD.new()
	wild.v = self
	add_child(wild)
	inc = GS.INC.new()
	inc.v = self
	add_child(inc)
	obstacles.append_array(town.obstacles)
	var keep := func(q: Vector2) -> bool:
		var p3 := Vector3(q.x, 0, q.y)
		return _free_ground(p3, 0.5) and p3.distance_to(PLAZA) > 12.0 and p3.distance_to(WILD.CAMP) > 6.0 and p3.distance_to(BLD.MINE) > 6.0 \
			and BLD.SLOTS.all(func(sl): return p3.distance_to(sl) > 6.0) and SIM.LANDS.all(func(l): return q.distance_to(l) > 8.0) \
			and TOWN.clear_rects(built_tier).all(func(rc): return not rc.has_point(q)) and obstacles.all(func(o): return q.distance_to(o[0]) > float(o[1]) + 1.0)
	M.grass(self, Vector3(60, 0, 40), 75, 60000, keep)
	_build_hud()
	_reset_villagers()
	cam = CAM.new()
	cam.rts = true
	cam.dist = 34.0
	cam.yaw = -0.785
	cam.limits = WORLD
	add_child(cam)
	_update_player_model()
	cam.target = player
	cam.focus = player.position
	cam.global_position = player.global_position
	GS.notify.connect(func(_t): _refresh_log())
	_refresh_log()
	SFX.music("aldea")


# ---------------- Mundo ----------------

func _build_static() -> void:
	var dirt := Color(0.42, 0.34, 0.24)
	# Plaza empedrada (cuadrada) y calles de tierra.
	var plaza := MeshInstance3D.new()
	var pb := BoxMesh.new()
	pb.size = Vector3(20, 0.06, 20)
	plaza.mesh = pb
	plaza.material_override = M.paving()
	plaza.position = PLAZA + Vector3(0, 0.03, 0)
	add_child(plaza)
	for st in BLD.STREETS:
		M.road(self, Vector3(st[0].x, 0, st[0].y), Vector3(st[1].x, 0, st[1].y), st[2], dirt)
	M.road(self, Vector3(60, 0, 82), Vector3(60, 0, 93), 3.2, dirt)
	M.put(self, "village/Well.glb", PLAZA, 0, 1.6)
	# Bancos y faroles en las esquinas de la plaza.
	for c in [Vector3(-8, 0, -8), Vector3(8, 0, -8), Vector3(-8, 0, 8)]:
		_lamp(PLAZA + c + Vector3(signf(c.x) * 1.2, 0, 0))
	for x in [29.0, 39.0, 74.0]:
		_lamp(Vector3(x, 0, 36.7))
	for z in [60.5, 70.5]:
		_lamp(Vector3(63.3, 0, z))
	lands_node = Node3D.new()
	add_child(lands_node)
	obstacles.append([Vector2(PLAZA.x, PLAZA.z), 1.6])

	for i in GS.HOMES.size():
		var h: Vector3 = Vector3(GS.HOMES[i].x, 0, GS.HOMES[i].y) * 0.05
		var rot := BLD.face_street(h)
		obstacles.append([Vector2(h.x, h.z), 3.0])
		_yard(h, rot, i)
	M.put(self, "village/Bell_Tower.glb", HALL, _face_plaza(HALL), 2.6)
	BLD.signboard(self, HALL + Vector3(3.2, 0, 4.2), "Concejo")
	var banner := M.put(self, "castle/Banner.glb", HALL + Vector3(4, 0, 3), 0, 1.6)
	M.recolor(banner, Color(0.15, 0.3, 0.7))
	obstacles.append([Vector2(HALL.x, HALL.z), 4.0])
	for i in 6:
		var a := float(i) / 6.0 * TAU + 0.4
		M.tent(self, CAMP + Vector3(cos(a) * 6, 0, sin(a) * 6), -a, Color(0.82, 0.76, 0.6))
		obstacles.append([Vector2(CAMP.x + cos(a) * 6, CAMP.z + sin(a) * 6), 1.6])
	camp_fire = M.put(self, "village/Bonfire_Lit.glb", CAMP + Vector3(0, 0, 0), 0, 1.5)
	camp_banner = M.put(self, "castle/Banner.glb", CAMP + Vector3(2.5, 0, -2.5), 0, 1.6)
	M.put(self, "animals/Horse.glb", Vector3(72.5, 0, 44.5), 2.0, 0.42)
	M.castle(self, Vector3(60, 0, -45), 4.0)
	for i in 9:
		var rk := M.put(self, "nature/Rock_%d.glb" % (i % 7 + 1), Vector3(-60 + i * 30, -6, -110 - (i % 3) * 20), randf() * TAU, randf_range(28, 38))
		M.recolor(rk, Color(0.42, 0.44, 0.4))
	nature_node = Node3D.new()
	add_child(nature_node)
	_build_lake()
	# Piedras sueltas por el campo y colinas suaves en el horizonte.
	var rr := RandomNumberGenerator.new()
	rr.seed = 99
	for i in 90:
		var p := Vector3(rr.randf_range(0, 125), 0, rr.randf_range(0, 92))
		if _free_ground(p, 1.0) and p.distance_to(PLAZA) > 11.0 and p.distance_to(FARM.POND) > 9.0:
			M.recolor(M.put(self, "nature/Rock_%d.glb" % (1 + i % 7), p, rr.randf() * TAU, rr.randf_range(0.25, 0.7)), Color(0.55, 0.53, 0.5))
	var hill_mat := M.flat(Color(0.42, 0.44, 0.24))
	for i in 18:
		var a := float(i) / 18.0 * TAU + rr.randf() * 0.2
		var h := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = rr.randf_range(45, 80)
		sm.height = sm.radius * 2.0
		h.mesh = sm
		h.material_override = hill_mat
		h.scale = Vector3(1.0, rr.randf_range(0.18, 0.35), 1.0)
		h.position = Vector3(80 + cos(a) * rr.randf_range(210, 250), -2.0, 40 + sin(a) * rr.randf_range(190, 230))
		add_child(h)


## Lago con orilla de arena, embarcadero, barca e islote; camino desde el pueblo.
func _build_lake() -> void:
	var shore := MeshInstance3D.new()
	var sm := CylinderMesh.new()
	sm.top_radius = 1.0
	sm.bottom_radius = 1.0
	sm.height = 0.04
	sm.radial_segments = 64
	shore.mesh = sm
	shore.scale = Vector3(LAKE_R.x + 3.0, 1, LAKE_R.y + 3.0)
	shore.position = LAKE_C + Vector3(0, 0.02, 0)
	shore.material_override = M.dirt(Color(0.62, 0.55, 0.38))
	add_child(shore)
	var water := MeshInstance3D.new()
	var wm := CylinderMesh.new()
	wm.top_radius = 1.0
	wm.bottom_radius = 1.0
	wm.height = 0.05
	wm.radial_segments = 64
	water.mesh = wm
	water.scale = Vector3(LAKE_R.x, 1, LAKE_R.y)
	water.position = LAKE_C + Vector3(0, 0.08, 0)
	water.material_override = M.water_material()
	add_child(water)
	var isl := MeshInstance3D.new()
	var im := CylinderMesh.new()
	im.top_radius = ISLAND_R
	im.bottom_radius = ISLAND_R + 1.2
	im.height = 0.4
	isl.mesh = im
	isl.position = ISLAND + Vector3(0, 0.05, 0)
	isl.material_override = M.flat(Color(0.36, 0.44, 0.2))
	add_child(isl)
	for k in 5:
		var a := k * TAU / 5.0 + 0.4
		M.put(self, "nature/Rock_Moss_%d.glb" % (1 + k), ISLAND + Vector3(cos(a), 0, sin(a)) * (ISLAND_R - 0.5), randf() * TAU, 0.9)
	# Embarcadero de tablones sobre postes.
	M.road(self, Vector3(60, 0, 82), DOCK, 3.0, Color(0.42, 0.34, 0.24))
	var dk := Node3D.new()
	add_child(dk)
	M._mats()
	M._bx(dk, Vector3(2.2, 0.15, DOCK_END.z - DOCK.z), (DOCK + DOCK_END) / 2 + Vector3(0, 0.35, 0), M._plank)
	for z in range(int(DOCK.z) + 2, int(DOCK_END.z) + 1, 3):
		for sd in [-1, 1]:
			M._bx(dk, Vector3(0.2, 1.0, 0.2), Vector3(DOCK.x + sd * 1.0, 0.1, z), M._beam)
	boat_node = GS.REALM.boat(self, Color(0.9, 0.85, 0.7))
	boat_node.scale = Vector3.ONE * 0.55
	boat_node.position = DOCK_END + Vector3(1.6, 0, 1.0)
	var lb := M.label3d("Lago · islote al fondo", 40)
	lb.position = LAKE_C + Vector3(0, 4, -LAKE_R.y)
	lb.visibility_range_end = 60.0
	add_child(lb)


## Farol de calle: poste con una luz cálida que se enciende al anochecer.
var lamps: Array = []
func _lamp(p: Vector3) -> void:
	ENG._box(self, Vector3(0.14, 2.8, 0.14), p + Vector3(0, 1.4, 0), Color(0.3, 0.2, 0.11))
	ENG._box(self, Vector3(0.26, 0.3, 0.26), p + Vector3(0, 2.95, 0), Color(0.9, 0.62, 0.3))
	var l := OmniLight3D.new()
	l.position = p + Vector3(0, 2.9, 0)
	l.light_color = Color(1.0, 0.7, 0.35)
	l.omni_range = 9.0
	l.light_energy = 0.0
	add_child(l)
	lamps.append(l)
	obstacles.append([Vector2(p.x, p.z), 0.4])


## Puestos de la plaza: cada vecino que vende tiene el suyo (manta, puesto o tienda).
var stalls_node: Node3D
var stalls_sig := ""
func _rebuild_stalls() -> void:
	if stalls_node:
		stalls_node.queue_free()
	stalls_node = Node3D.new()
	add_child(stalls_node)
	for v in GS.STALLS.sellers():
		GS.STALLS.build(stalls_node, int(v["stall_slot"]), v)
	if season == 3:
		M.set_snow(stalls_node, true)


## Casas de los vecinos según lo que ha prosperado cada familia: cabaña, entramado o piedra.
var homes_node: Node3D
var homes_sig := ""
func _homes_levels() -> Array:
	var out := []
	for hm in GS.HOMES:
		var lv := 0
		for v in GS.data["villagers"]:
			if Vector2(v["hx"], v["hy"]) == hm:
				lv = int(v.get("hlvl", 0))
		out.append(lv)
	return out


func _rebuild_homes(levels: Array) -> void:
	if homes_node:
		homes_node.queue_free()
	homes_node = Node3D.new()
	add_child(homes_node)
	for i in GS.HOMES.size():
		var h: Vector3 = Vector3(GS.HOMES[i].x, 0, GS.HOMES[i].y) * 0.05
		var rot := BLD.face_street(h)
		match int(levels[i]):
			0:
				M.hut(homes_node, h, rot, 1.05 + (i % 3) * 0.04)
			1:
				M.medieval_house(homes_node, h, rot, 1, i, 1.0)
			_:
				M.medieval_house(homes_node, h, rot, 2, i, 1.0)
	if season == 3:
		M.set_snow(homes_node, true)


## Huerto vallado detrás de cada casa (con alguna hortaliza) y leña junto a la pared.
func _yard(h: Vector3, rot: float, i: int) -> void:
	var fwd := Vector3(sin(rot), 0, cos(rot))
	var side := Vector3(fwd.z, 0, -fwd.x)
	var back := h - fwd * 6.5
	M.wattle(self, back - fwd * 2.5 - side * 2.9, back - fwd * 2.5 + side * 2.9)
	for sd in [-1, 1]:
		M.wattle(self, back + side * 2.9 * sd - fwd * 2.5, back + side * 2.9 * sd + fwd * 1.8)
	var crop: String = ["crops/Carrot_3.glb", "crops/Lettuce_3.glb", "crops/Beet_3.glb", "crops/Pumpkin_3.glb"][i % 4]
	for k in 6:
		M.put(self, crop, back + side * (-1.7 + (k % 3) * 1.7) + fwd * (-1.4 + (k / 3) * 1.8), randf() * TAU, 0.5)
	if i % 2 == 0:
		M.put(self, "village/Barrel.glb", h + fwd * 2.6 + side * 2.4, randf(), 1.3)


## ¿Queda libre este suelo (ni calle, ni casa, ni solar, ni la parcela, ni el corral)?
func _free_ground(p: Vector3, margin: float) -> bool:
	if BLD.on_street(Vector2(p.x, p.z), margin):
		return false
	for h in GS.HOMES:
		if Vector2(p.x, p.z).distance_to(h * 0.05) < 7.5 + margin:
			return false
	for sl in BLD.SLOTS:
		if p.distance_to(sl) < 6.0 + margin:
			return false
	for a in FARM.ANNEX:
		if p.distance_to(a) < FARM.ANNEX_HALF + 1.0 + margin:
			return false
	for r in FARM.field_rects():
		if r.grow(margin + 0.5).has_point(Vector2(p.x, p.z)):
			return false
	return p.distance_to(PLOT) > 9.0 + margin and p.distance_to(HALL) > 6.0 + margin and p.distance_to(FARM.CORRAL) > 6.0 + margin and p.distance_to(FARM.OVEN) > 2.5 + margin and p.distance_to(FARM.MILL) > 4.5 + margin


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
		if _free_ground(p, 1.5) and p.distance_to(PLAZA) > 14 and p.distance_to(FARM.POND) > 12 and not Rect2(86, 9, 26, 33).has_point(Vector2(p.x, p.z)) and p.distance_to(FARM.CORRAL) > 7 and BLD.SLOTS.all(func(sl): return p.distance_to(sl) > 6.0) and p.z < 78:
			M.put(nature_node, "nature/%s_%d.glb" % ["Bush_Snow" if s == 3 else "Bush", 1 + i % 2], p, randf() * TAU, randf_range(1.2, 2.0))
	_season_decor(s)
	M.set_season_ground(env["grad"], s)
	season = s


## Posición de la casa del jugador: la parcela original o su terreno del barrio nuevo.
func house_pos() -> Vector3:
	var i := int(GS.data.get("player_land", -1))
	if i >= 0:
		return Vector3(SIM.LANDS[i].x, 0, SIM.LANDS[i].y)
	return PLOT


## Detalles de cada estación: flores en primavera, heno en verano, calabazas y hojas en otoño,
## y nieve amontonada y copos cayendo en invierno.
var snowfall: CPUParticles3D
func _season_decor(s: int) -> void:
	var r := RandomNumberGenerator.new()
	r.seed = 4242 + s
	var ok := func(p: Vector3) -> bool:
		return _free_ground(p, 1.0) and p.distance_to(PLAZA) > 9 and p.distance_to(FARM.POND) > 11 and not Rect2(86, 9, 26, 33).has_point(Vector2(p.x, p.z)) and BLD.SLOTS.all(func(sl): return p.distance_to(sl) > 6.0) and p.z < 78
	match s:
		0:
			var cols := [Color(0.95, 0.85, 0.2), Color(0.9, 0.3, 0.5), Color(0.95, 0.95, 0.95), Color(0.6, 0.4, 0.9)]
			for i in 160:
				var p := Vector3(r.randf_range(3, 117), 0, r.randf_range(3, 77))
				if not ok.call(p):
					continue
				var c: Color = cols[i % 4]
				for j in 3:
					var f := ENG._box(nature_node, Vector3(0.18, 0.12, 0.18), p + Vector3(r.randf_range(-0.6, 0.6), 0.35, r.randf_range(-0.6, 0.6)), c)
					f.rotation.y = r.randf() * TAU
		1:
			for i in 10:
				var p := Vector3(r.randf_range(88, 110), 0, r.randf_range(44, 50))
				M.put(nature_node, "village/Hay.glb", p, r.randf() * TAU, 1.3)
		2:
			for i in 50:
				var p := Vector3(r.randf_range(3, 117), 0, r.randf_range(3, 77))
				if not ok.call(p):
					continue
				if i % 3 == 0:
					M.put(nature_node, "crops/Pumpkin_4.glb", p, r.randf() * TAU, 1.0)
				else:
					ENG._box(nature_node, Vector3(1.6, 0.06, 1.2), p + Vector3(0, 0.03, 0), [Color(0.75, 0.4, 0.12), Color(0.6, 0.25, 0.1), Color(0.8, 0.6, 0.2)][i % 3], Vector3(0, r.randf() * 180, 0))
		3:
			for i in 70:
				var p := Vector3(r.randf_range(3, 117), 0, r.randf_range(3, 77))
				if not ok.call(p):
					continue
				var m := MeshInstance3D.new()
				var sm := SphereMesh.new()
				sm.radius = r.randf_range(0.5, 1.2)
				sm.height = sm.radius * 0.7
				m.mesh = sm
				m.material_override = M.flat(Color(0.95, 0.96, 1.0))
				m.position = p
				nature_node.add_child(m)
	M.set_snow(self, s == 3)
	if snowfall:
		snowfall.queue_free()
		snowfall = null
	if s == 3:
		snowfall = CPUParticles3D.new()
		snowfall.amount = 700
		snowfall.lifetime = 5.0
		snowfall.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
		snowfall.emission_box_extents = Vector3(25, 0.5, 25)
		snowfall.direction = Vector3(0, -1, 0)
		snowfall.spread = 25.0
		snowfall.initial_velocity_min = 1.2
		snowfall.initial_velocity_max = 2.2
		snowfall.gravity = Vector3(0, -0.5, 0)
		var qm := QuadMesh.new()
		qm.size = Vector2(0.1, 0.1)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(1, 1, 1, 0.9)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		qm.material = mat
		snowfall.mesh = qm
		add_child(snowfall)


func _rebuild_house() -> void:
	if house_node:
		house_node.queue_free()
	house_node = Node3D.new()
	add_child(house_node)
	house_level = int(GS.data["house_level"])
	house_land = int(GS.data.get("player_land", -1))
	var hp := house_pos()
	var rot := BLD.face_street(hp) if house_land < 0 else PI
	match house_level:
		0:
			for o in [Vector3(-3, 0, -3), Vector3(3, 0, -3), Vector3(-3, 0, 3), Vector3(3, 0, 3)]:
				M.put(house_node, "village/Fence.glb", hp + o, 0.0 if o.z != 0 else PI / 2, 1.2)
			M.put(house_node, "village/Hay.glb", hp + Vector3(-1, 0, -1), 0.3, 1.3)
		1:
			M.hut(house_node, hp, rot, 1.15)
		2:
			M.medieval_house(house_node, hp, rot, 1, 0, 1.25)
		3:
			M.medieval_house(house_node, hp, rot, 2, 1, 1.35)
			M.recolor(M.put(house_node, "castle/Banner.glb", hp + Vector3(4.5, 0, 3), 0, 1.4), Color(0.6, 0.1, 0.1))
		4:
			M.put(house_node, "village/Inn.glb", hp, rot, 2.2)
			M.put(house_node, "village/Bell_Tower.glb", hp + Vector3(6, 0, 1), rot, 1.5)
			M.recolor(M.put(house_node, "castle/Banner.glb", hp + Vector3(-5.5, 0, -3), 0, 1.6), Color(0.6, 0.1, 0.1))
		5:
			M.castle(house_node, hp + Vector3(0, 0, 3.5), 1.6)
			M.put(house_node, "village/Inn.glb", hp + Vector3(0, 0, -2), rot, 1.7)
			M.recolor(M.put(house_node, "castle/Banner.glb", hp + Vector3(-7, 0, -4), 0, 1.8), Color(0.6, 0.1, 0.1))
	var lbl := M.label3d("Tu parcela" if house_level == 0 else "Casa %s" % GS.data["dynasty"], 40)
	lbl.position = hp + Vector3(0, 7.0 if house_level > 0 else 2.5, 0)
	lbl.modulate = Color(1, 0.9, 0.6)
	house_node.add_child(lbl)


## Terrenos del barrio nuevo: en venta, en obras o con la casa de los forasteros.
func _rebuild_lands() -> void:
	for c in lands_node.get_children():
		c.queue_free()
	var d = GS.data
	for i in d["lands"].size():
		var l = d["lands"][i]
		if not l["open"] or i == int(d["player_land"]):
			continue
		var p := Vector3(SIM.LANDS[i].x, 0, SIM.LANDS[i].y)
		var text := ""
		if l["owner"] == "":
			text = "Terreno en venta (%d oro)" % SIM.land_price(i)
		elif l["owner"] == "jugador":
			text = "Tu terreno"
		elif int(d["total_days"]) < int(l["built"]):
			text = "En obras (%s)" % l["owner"]
			M.put(lands_node, "village/Package_1.glb", p + Vector3(-1.5, 0, 0), 0.3, 1.4)
			M.put(lands_node, "village/Crate.glb", p + Vector3(1.5, 0, 1), 0.8, 1.4)
		else:
			text = ("Casa de la %s" if String(l["owner"]).begins_with("familia") else "Casa de %s") % l["owner"]
			M.medieval_house(lands_node, p, PI, 1 + i % 2, i, 1.0)
		if l["owner"] == "" or l["owner"] == "jugador":
			for o in [Vector3(-4, 0, -4), Vector3(4, 0, -4), Vector3(-4, 0, 4), Vector3(4, 0, 4)]:
				M.put(lands_node, "village/Fence.glb", p + o, 0.0, 1.0)
		var lb := M.label3d(text, 40)
		lb.position = p + Vector3(0, 2.5 if l["owner"] in ["", "jugador"] else 7.5, 0)
		lb.modulate = Color(1, 0.9, 0.6)
		lands_node.add_child(lb)


func _actor(parts: Array, opts := {}) -> Node3D:
	var a := ACTOR.new()
	add_child(a)
	a.build(parts, opts)
	return a


func _villager_sig() -> String:
	var n := 0
	var couples := 0
	for v in GS.data["villagers"]:
		n += v.get("kids", []).size()
		couples += 1 if v.has("partner") else 0
	return "%d-%d-%d-%d" % [GS.data["villagers"].size(), n, couples, int(GS.data["year"])]


func _reset_villagers() -> void:
	vsig = _villager_sig()
	for v in villagers:
		v.queue_free()
	villagers.clear()
	for k in vkids:
		k["a"].queue_free()
	vkids.clear()
	vtarget.clear()
	vlabels.clear()
	vwork.clear()
	routes.clear()
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
		a.position = home + Vector3(randf_range(-1.5, 1.5), 0, randf_range(-1.5, 1.5))
		var l := M.label3d("%s\n%s%s" % [GS.full_name(v), SIM.job_name(v), " · anciano" if GS.FOLK.is_elder(v) else ""], 32)
		l.position = Vector3(0, 2.25, 0)
		l.visibility_range_end = 9.0
		a.add_child(l)
		villagers.append(a)
		vtarget.append(a.position)
		vlabels.append(l)
		vwork.append(randf() * 2.0)
		# Hijos de las familias del pueblo: juegan cerca de casa.
		var kk := 0
		for k in v.get("kids", []):
			var km: bool = k["male"]
			var kparts: Array = ["ubc/Superhero_Male_FullBody", "out/Male_Peasant", MALE_HAIR[kk % 2]] if km else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger", FEMALE_HAIR[kk % 2]]
			var ka := _actor(kparts, {"hide_hood": true, "faction": "bandido", "hair_color": M.SKIN_HAIR[(i + kk) % 4]} if not km else {"hair_color": M.SKIN_HAIR[(i + kk) % 4]})
			ka.scale = Vector3.ONE * clampf(0.5 + int(k["age"]) * 0.032, 0.5, 0.95)
			ka.position = home + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3))
			var kl := M.label3d(k["name"], 30)
			kl.position = Vector3(0, 2.3, 0)
			ka.add_child(kl)
			vkids.append({"a": ka, "home": home, "t": ka.position})
			kk += 1
		i += 1


func _door(v: Dictionary) -> Vector3:
	var h := Vector3(v["hx"], 0, v["hy"]) * 0.05
	return BLD.front(h, 4.6)


func _update_player_model() -> void:
	var d = GS.data
	var p = d["player"]
	var armor := int(d["armor"])
	var sig := "%s-%d-%d-%s-%s-%d" % [p["male"], mini(armor, 2), mini(int(d["weapon"]), 1), p["name"], _riding(), int(p["age"]) / 5]
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
	var opts := {"hide_hood": true, "hair_color": GS.CHAR.hair(int(p["age"]), M.SKIN_HAIR[0]), "sword": int(d["weapon"]) >= 1}
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
	if _riding():
		player.mount(Color(1.3, 0.9, 0.7))
	player.position = pos
	player.rotation.y = rot
	if cam:
		cam.target = player


func _riding() -> bool:
	return GS.data.get("horse", false) and GS.data.get("riding", false)


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
	var hp := house_pos()
	if int(GS.data.get("player_land", -1)) >= 0:
		return hp + Vector3(0, 0, -6)
	return BLD.front(hp, 7.0)


## Lugar de trabajo de cada aldeano según su oficio.
func _work_spot(v: Dictionary, i: int) -> Vector3:
	match v["job"]:
		"leñador":
			return Vector3(24 + (i * 5) % 12, 0, 8 + (i * 7) % 14)
		"cantero":
			return Vector3(14 + (i * 5) % 16, 0, 54)
		"agricultor":
			return Vector3(FARM.COMMONS.get_center().x + (i % 3) * 2.5 - 2.5, 0, FARM.COMMONS.get_center().y + (i % 2) * 2 - 1)
		"pescador":
			var a := float(i) * 1.3
			return FARM.POND + Vector3(cos(a), 0, sin(a)) * (FARM.POND_R + 1.4)
		"cazador":
			return Vector3(6 + (i * 9) % 14, 0, 6 + (i * 13) % 20)
		"pastor":
			return FARM.CORRAL + Vector3(-2 + (i % 3) * 2, 0, FARM.CORRAL_HALF.y + 1.3)
		"minero":
			return BLD.MINE + Vector3(2.5, 0, 3.5)
		"panadero":
			return FARM.OVEN + Vector3(0, 0, -2.3)
		"tejedor":
			return MARKET + Vector3(-3, 0, 2.6)
		"herrero":
			return MARKET + Vector3(6, 0, -1.5)
	return PLAZA


# ---------------- HUD ----------------

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	# Arriba a la izquierda: retrato, nombre, barras de salud y despensa, y datos de la casa.
	var tl := HBoxContainer.new()
	tl.position = Vector2(12, 10)
	tl.add_theme_constant_override("separation", 10)
	layer.add_child(tl)
	hud_portrait = HUD.Portrait.new()
	hud_portrait.custom_minimum_size = Vector2(118, 118)
	tl.add_child(hud_portrait)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	tl.add_child(col)
	lbl_name = Label.new()
	lbl_name.add_theme_font_size_override("font_size", 18)
	lbl_name.add_theme_color_override("font_outline_color", Color.BLACK)
	lbl_name.add_theme_constant_override("outline_size", 5)
	col.add_child(lbl_name)
	bar_health = HUD.Bar.new()
	bar_health.icon = load("res://assets/ui/icono_salud.png")
	bar_health.custom_minimum_size = Vector2(250, 22)
	col.add_child(bar_health)
	bar_food = HUD.Bar.new()
	bar_food.col = Color(0.8, 0.62, 0.12)
	bar_food.icon = load("res://assets/ui/icono_comida.png")
	bar_food.custom_minimum_size = Vector2(250, 22)
	col.add_child(bar_food)
	lbl_res = Label.new()
	lbl_res.add_theme_font_size_override("font_size", 13)
	lbl_res.add_theme_color_override("font_outline_color", Color.BLACK)
	lbl_res.add_theme_constant_override("outline_size", 4)
	col.add_child(lbl_res)
	# Arriba a la derecha: lugar y fecha, minimapa con reloj y misiones.
	var tr := VBoxContainer.new()
	tr.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	tr.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	tr.offset_right = -10
	tr.offset_top = 8
	tr.add_theme_constant_override("separation", 6)
	layer.add_child(tr)
	var place := PanelContainer.new()
	place.add_theme_stylebox_override("panel", HUD.frame_style(10))
	tr.add_child(place)
	var ph := HBoxContainer.new()
	place.add_child(ph)
	var pic := TextureRect.new()
	pic.texture = load("res://assets/ui/icono_habitantes.png")
	pic.custom_minimum_size = Vector2(40, 40)
	pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ph.add_child(pic)
	lbl_place = Label.new()
	lbl_place.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl_place.add_theme_font_size_override("font_size", 15)
	lbl_place.add_theme_color_override("font_color", HUD.GOLD)
	ph.add_child(lbl_place)
	minimap = HUD.Minimap.new()
	minimap.v = self
	minimap.custom_minimum_size = Vector2(260, 260)
	tr.add_child(minimap)
	var info := PanelContainer.new()
	info.add_theme_stylebox_override("panel", HUD.frame_style(6))
	tr.add_child(info)
	lbl_info = Label.new()
	lbl_info.add_theme_font_size_override("font_size", 14)
	lbl_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_info.custom_minimum_size.x = 300
	info.add_child(lbl_info)
	var keys := Label.new()
	keys.text = "Clic izq.: ir / usar · Clic der.: ir · WASD o borde: mover vista · Q/R: girar · Rueda: zoom · Espacio: centrar en ti"
	keys.add_theme_font_size_override("font_size", 13)
	keys.add_theme_color_override("font_outline_color", Color.BLACK)
	keys.add_theme_constant_override("outline_size", 4)
	keys.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	keys.grow_horizontal = Control.GROW_DIRECTION_BOTH
	keys.offset_top = 128
	keys.offset_left = -330
	layer.add_child(keys)
	# Abajo en el centro: ranuras con recursos y teclas.
	var bar := HBoxContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bar.offset_bottom = -10
	bar.add_theme_constant_override("separation", 6)
	layer.add_child(bar)
	for sdef in [["oro", "Oro"], ["madera", "Madera"], ["piedra", "Piedra"], ["hierro", "Hierro"], ["comida", "Comida"], ["soldados", "Soldados"], ["prestigio", "Prestigio"]]:
		var sl := HUD.slot("", sdef[1], "res://assets/ui/icono_%s.png" % sdef[0])
		bar.add_child(sl)
		hud_slots[sdef[0]] = sl.find_child("L", true, false)
	for kdef in [["E", "Usar"], ["I", "Inventario"], ["M", "Mapa"], ["H", "Caballo"], ["T", "Tiempo"]]:
		var sl := HUD.slot(kdef[0], kdef[1])
		(sl.find_child("L", true, false) as Label).add_theme_font_size_override("font_size", 20)
		bar.add_child(sl)
		if kdef[0] == "T":
			hud_slots["t"] = sl.find_child("K", true, false)

	var logp := PanelContainer.new()
	logp.add_theme_stylebox_override("panel", Art.bar_style())
	logp.grow_vertical = Control.GROW_DIRECTION_BEGIN
	logp.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	logp.offset_bottom = -100
	logp.offset_left = 8
	layer.add_child(logp)
	lbl_log = Label.new()
	lbl_log.add_theme_font_size_override("font_size", 14)
	lbl_log.custom_minimum_size.x = 440
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
	lbl_prompt.add_theme_stylebox_override("normal", HUD.frame_style(8))
	layer.add_child(lbl_prompt)


	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(center)
	panel = PanelContainer.new()
	panel.theme = Art.parchment_theme()
	panel.visible = false
	center.add_child(panel)
	box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)


## Retrato según quién eres: campesino o campesina, señor o dama, rey o reina, o anciano.
var _faces := {}
func _portrait_path(p: Dictionary, d: Dictionary) -> String:
	return Art.face_of(p, int(d["title"]) >= 1 or int(d["tier"]) >= 1, d.get("king", false))


func _portrait(p: Dictionary, d: Dictionary) -> Texture2D:
	var k := _portrait_path(p, d)
	if not _faces.has(k):
		_faces[k] = load(k)
	return _faces[k]


func _update_hud() -> void:
	var d = GS.data
	var p = d["player"]
	var rank: String = ["Campesino", "Jefe del pueblo"][int(d["title"])] if p["male"] else ["Campesina", "Jefa del pueblo"][int(d["title"])]
	if d.get("king", false):
		rank = "Rey de la región" if p["male"] else "Reina de la región"
	lbl_name.text = "%s %s · %s, %d años" % [p["name"], d["dynasty"], rank, int(p["age"])]
	hud_portrait.initial = String(d["dynasty"]).replace("de ", "").replace("del ", "").substr(0, 1).to_upper()
	hud_portrait.face = _portrait(p, d)
	hud_portrait.queue_redraw()
	bar_health.label = "Salud %d" % int(p["health"])
	bar_health.value = float(p["health"]) / 100.0
	bar_health.queue_redraw()
	var mouths: int = 1 + d["children"].size() + (1 if d["spouse"] != null else 0)
	bar_food.label = "Despensa: %d raciones" % GS.food_total()
	bar_food.value = float(GS.food_total()) / float(mouths * 15)
	bar_food.queue_redraw()
	lbl_res.text = "Casa: %s · %s · Hijos: %d · Generación %d" % [GS.HOUSE_NAMES[int(d["house_level"])], ("Casado con " if p["male"] else "Casada con ") + String(d["spouse"]["name"]) if d["spouse"] != null else ("Soltero" if p["male"] else "Soltera"), d["children"].size(), int(d["generation"])]
	lbl_place.text = "%s · %d habitantes\n%s, día %d · Año %d · %02d:00" % [SIM.town_title(), SIM.total_pop(), GS.SEASONS[int(d["season"])], int(d["day"]), int(d["year"]), int(d["time"] * 24.0)]
	hud_slots["oro"].text = str(int(d["gold"]))
	hud_slots["madera"].text = str(int(d["wood"]))
	hud_slots["piedra"].text = str(int(d["stone"]))
	hud_slots["comida"].text = str(GS.food_total())
	hud_slots["prestigio"].text = str(int(d["prestige"]))
	hud_slots["hierro"].text = str(GS.inv("hierro"))
	hud_slots["soldados"].text = str(GS.ARMY.total())
	hud_slots["t"].text = "Tiempo x%d" % int(GS.speed)
	var lines := ["MISIONES"]
	if d["summons"] != null:
		var left: int = int(d["summons"]["deadline"]) - int(d["total_days"])
		lines.append("¡LLAMADA DEL REY!")
		lines.append("Contra %s" % d["summons"]["enemy"])
		lines.append("Quedan %d días · Campamento al este" % maxi(left, 0))
	var ft: String = GS.SOCIAL.favor_text()
	if ft != "":
		lines.append(ft)
	GS.QUESTS.check()
	var q: Dictionary = GS.QUESTS.current()
	if not q.is_empty():
		lines.append("• %s" % q["goal"])
		lines.append(q["tip"])
	if lines.size() == 1:
		lines.append("Sin tareas pendientes. Prosperidad %d" % int(d["prosperity"]))
	lbl_info.text = "\n".join(lines)
	lbl_prompt.text = "" if panel.visible or inter.is_empty() else "[E] " + inter["label"]
	if not panel.visible and not hover.is_empty() and hover.get("label", "") != inter.get("label", ""):
		lbl_prompt.text = "Clic: " + hover["label"]
	lbl_prompt.visible = lbl_prompt.text != ""


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
	t.add_theme_color_override("font_color", Art.TITLE)
	box.add_child(t)
	var pic := Art.event_picture(title)
	if pic != "":
		box.add_child(Art.picture(pic))
	elif title == "El obispo":
		box.add_child(Art.portrait_row([["res://assets/ui/retrato_obispo.png", "El obispo"]]))
	elif title == "Familia":
		var d = GS.data
		var noble: bool = int(d["title"]) >= 1 or int(d["tier"]) >= 1
		var people := [[_portrait_path(d["player"], d), d["player"]["name"]]]
		if d["spouse"] != null:
			people.append([Art.face_of(d["spouse"], noble, d.get("king", false)), d["spouse"]["name"]])
		for c in d["children"].slice(0, 5):
			people.append([Art.face_of(c, noble), "%s (%d)" % [c["name"], int(c["age"])]])
		box.add_child(Art.portrait_row(people))
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
	t.add_theme_color_override("font_color", Art.TITLE)
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
	if int(d["tier"]) != built_tier:
		GS.save_game()
		main.start_village.call_deferred()
		set_process(false)
		return
	if house_level != int(d["house_level"]) or house_land != int(d["player_land"]):
		_rebuild_house()
	if _villager_sig() != vsig:
		_reset_villagers()
	var ss := GS.STALLS.sig()
	if ss != stalls_sig:
		stalls_sig = ss
		_rebuild_stalls()
	var hl := _homes_levels()
	if str(hl) != homes_sig:
		homes_sig = str(hl)
		_rebuild_homes(hl)
	var ls := str(d["lands"]) + str(d["total_days"]) + str(d["player_land"])
	if ls != lands_sig:
		lands_sig = ls
		_rebuild_lands()
	_update_family()
	_update_player_model()
	if not panel.visible and not GS.popups.is_empty():
		_show_popup(GS.next_popup())
	if not panel.visible and not d.get("game_over", false):
		_move_player(delta)
		GS.advance(delta)
		inter = _find_interaction()
		if not order.is_empty() and order["type"] != "" and inter.get("type", "") == order["type"] and not order.get("gather", false):
			if order["type"] in ["tree", "rock", "fish", "mine"]:
				order["gather"] = true
			else:
				order = {}
				_interact()
		var auto: bool = order.get("gather", false)
		var gm = cam.ground_at(get_viewport().get_mouse_position())
		hover = _find_interaction(gm) if gm != null else {}
		if (Input.is_key_pressed(KEY_E) or auto) and inter.get("type", "") in ["tree", "rock"]:
			_gather(inter["type"])
		elif (Input.is_key_pressed(KEY_E) or auto) and inter.get("type", "") == "fish":
			farm.fish()
		elif (Input.is_key_pressed(KEY_E) or auto) and inter.get("type", "") == "mine" and GS.data["mine"]:
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
	var dark := 1.6 if float(d["time"]) < 0.24 or float(d["time"]) > 0.8 else 0.0
	if lamps.size() > 0 and lamps[0].light_energy != dark:
		for lp in lamps:
			lp.light_energy = dark
	if snowfall:
		snowfall.position = player.position + Vector3(0, 14, 0)
	_ambience(d, night)
	_update_civic()
	_update_hud()


## Día de mercado (puestos y mercaderes en la plaza), andamios de las obras y la fuente terminada.
var civic_node: Node3D
var civic_sig := ""
func _update_civic() -> void:
	var feast: Dictionary = GS.FEST.feast_today()
	var cer = GS.data.get("ceremony", null)
	var sig := str(GS.TL.market_day()) + str(GS.TL.current_work()) + str(GS.TL.works_done()) + str(feast) + str(cer)
	if sig == civic_sig:
		return
	civic_sig = sig
	if civic_node:
		civic_node.queue_free()
	civic_node = Node3D.new()
	add_child(civic_node)
	if GS.TL.market_day():
		for k in 4:
			var ang := PI / 4 + k * PI / 2
			var p := PLAZA + Vector3(cos(ang), 0, sin(ang)) * 10.0
			M.put(civic_node, ["village/MarketStand_1.glb", "village/MarketStand_2.glb"][k % 2], p, -ang + PI / 2, 1.2)
			M.put(civic_node, "village/Crate.glb", p + Vector3(cos(ang), 0, sin(ang)) * 1.6, ang, 1.0)
			var mer := ACTOR.new()
			civic_node.add_child(mer)
			mer.build(["ubc/Superhero_Male_FullBody", "out/Male_Peasant", MALE_HAIR[k % 3]], {"hair_color": M.SKIN_HAIR[k % 4]})
			mer.position = p + Vector3(cos(ang), 0, sin(ang)) * -1.6
			mer.rotation.y = -ang - PI / 2
			mer.play("Idle_Talking")
		var lb := M.label3d("¡Día de mercado!", 64)
		lb.position = PLAZA + Vector3(0, 6, 0)
		lb.modulate = Color(1, 0.85, 0.4)
		civic_node.add_child(lb)
	if not feast.is_empty():
		var cols := [Color(0.8, 0.15, 0.15), Color(0.95, 0.8, 0.2), Color(0.2, 0.4, 0.8), Color(0.2, 0.6, 0.25)]
		for k in 8:
			var ang := k * TAU / 8.0
			var p := PLAZA + Vector3(cos(ang), 0, sin(ang)) * 7.5
			ENG._box(civic_node, Vector3(0.15, 4.0, 0.15), p + Vector3(0, 2.0, 0), Color(0.45, 0.3, 0.17))
			for j in 3:
				ENG._box(civic_node, Vector3(0.5, 0.6, 0.05), p + Vector3(0, 3.6 - j * 0.15, 0) + Vector3(-sin(ang), 0, cos(ang)) * (0.6 + j * 0.7), cols[(k + j) % 4], Vector3(0, -rad_to_deg(ang), 0))
		match int(GS.data["season"]):
			1, 3:
				M.put(civic_node, "village/Bonfire_Lit.glb", PLAZA + Vector3(0, 0, -12), 0.0, 2.0)
				var fl := OmniLight3D.new()
				fl.light_color = Color(1.0, 0.6, 0.3)
				fl.light_energy = 3.0
				fl.omni_range = 16.0
				fl.position = PLAZA + Vector3(0, 2, -12)
				civic_node.add_child(fl)
			2:
				for k in 6:
					M.put(civic_node, "crops/Pumpkin_4.glb", PLAZA + Vector3(-5 + k * 2.0, 0, -9.5), randf() * TAU, 1.0)
			0:
				for k in 6:
					M.put(civic_node, "crops/BushBerries_4.glb", PLAZA + Vector3(-5 + k * 2.0, 0, -9.5), randf() * TAU, 1.0)
		var lf := M.label3d("¡%s!" % feast["name"], 64)
		lf.position = PLAZA + Vector3(0, 7.5, 0)
		lf.modulate = Color(1, 0.8, 0.4)
		civic_node.add_child(lf)
	if cer != null and int(cer["day"]) == int(GS.data["total_days"]):
		var lc := M.label3d(cer["title"], 44)
		lc.position = _ceremony_spot() + Vector3(0, 4.5, 0)
		lc.modulate = Color(1, 0.95, 0.8) if cer["kind"] == "boda" else Color(0.75, 0.75, 0.85)
		civic_node.add_child(lc)
	var spot := PLAZA + Vector3(13, 0, 13)
	if GS.TL.current_work() != null:
		for k in 4:
			ENG._box(civic_node, Vector3(0.2, 4.0, 0.2), spot + Vector3((k % 2) * 3.0 - 1.5, 2.0, (k / 2) * 3.0 - 1.5), Color(0.45, 0.3, 0.17))
		ENG._box(civic_node, Vector3(3.4, 0.15, 3.4), spot + Vector3(0, 2.5, 0), Color(0.35, 0.24, 0.13))
		M.put(civic_node, "village/Package_1.glb", spot + Vector3(2.5, 0, 2.5), 0.3, 1.4)
		var lw := M.label3d("Obras: %s" % GS.TL.WORKS[GS.TL.current_work()["id"]]["name"].to_lower(), 40)
		lw.position = spot + Vector3(0, 5, 0)
		civic_node.add_child(lw)
	elif "fuente" in GS.TL.works_done():
		M.put(civic_node, "village/Well.glb", spot, 0.0, 2.4)
		var lf := M.label3d("Fuente pública", 36)
		lf.position = spot + Vector3(0, 4, 0)
		civic_node.add_child(lf)


## Sonido ambiente según la hora, la estación y el sitio; campana de misa los domingos.
var bell_day := -1
func _ambience(d: Dictionary, night: bool) -> void:
	if int(d["season"]) == 3:
		SFX.ambient("viento", -14.0)
	elif night:
		SFX.ambient("viento", -24.0)
	elif player.position.distance_to(PLAZA) < 18.0:
		SFX.ambient("gente", -12.0)
	else:
		SFX.ambient("pajaros", -15.0)
	if int(d["day"]) % 7 == 0 and float(d["time"]) > 0.3 and bell_day != int(d["total_days"]):
		bell_day = int(d["total_days"])
		SFX.play("campana", -6.0)


## Orden actual del jugador: ir a un punto y, al llegar, hacer lo que había allí.
var order := {}
var hover := {}
var sailing := false
var boat_node: Node3D
var marker: Node3D


func _mark(p: Vector3) -> void:
	if marker == null:
		marker = Node3D.new()
		add_child(marker)
		var m := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.45
		tm.outer_radius = 0.6
		m.mesh = tm
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(1.0, 0.85, 0.3)
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.material_override = mat
		marker.add_child(m)
	marker.position = p + Vector3(0, 0.08, 0)
	marker.scale = Vector3.ONE * 1.6
	marker.visible = true
	var tw := create_tween()
	tw.tween_property(marker, "scale", Vector3.ONE * 0.6, 0.35)
	tw.tween_callback(func(): marker.visible = false)


static func _in_lake(p: Vector3, margin := 0.0) -> bool:
	var q := Vector2((p.x - LAKE_C.x) / (LAKE_R.x + margin), (p.z - LAKE_C.z) / (LAKE_R.y + margin))
	return q.length() < 1.0


static func _on_island(p: Vector3) -> bool:
	return Vector2(p.x - ISLAND.x, p.z - ISLAND.z).length() < ISLAND_R


func _move_player(delta: float) -> void:
	var dir := Vector3.ZERO
	if not order.is_empty():
		if order.has("i") and order["type"] == "villager" and int(order["i"]) < villagers.size():
			order["p"] = villagers[int(order["i"])].position
		var to: Vector3 = order["p"] - player.position
		to.y = 0
		order["t"] = float(order["t"]) + delta
		if to.length() < 0.4 or float(order["t"]) > 40.0 or order.get("gather", false):
			if order["type"] == "" or float(order["t"]) > 40.0:
				order = {}
		else:
			dir = to.normalized()
	if dir == Vector3.ZERO:
		if not player.is_playing_once():
			player.play("Idle")
		return
	if sailing:
		var np: Vector3 = player.position + dir * 5.0 * delta
		var q := Vector2((np.x - LAKE_C.x) / (LAKE_R.x - 1.5), (np.z - LAKE_C.z) / (LAKE_R.y - 1.5))
		if q.length() >= 1.0 or Vector2(np.x - ISLAND.x, np.z - ISLAND.z).length() < ISLAND_R + 0.8:
			order = {}
			return
		player.position = np
		boat_node.position = Vector3(np.x, 0, np.z)
		boat_node.rotation.y = lerp_angle(boat_node.rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 4.0))
		player.rotation.y = boat_node.rotation.y
		player.play("Idle")
		return
	var sprint := Input.is_key_pressed(KEY_SHIFT)
	var p: Vector3 = player.position + dir * (SPRINT_SPEED if sprint else RUN_SPEED) * (1.8 if _riding() else GS.CHAR.speed_mult()) * delta
	p.x = clampf(p.x, WORLD.position.x, WORLD.end.x)
	p.z = clampf(p.z, WORLD.position.y, WORLD.end.y)
	# En el islote no se sale al agua; en tierra firme, la orilla del lago frena.
	if _on_island(player.position):
		var off := Vector2(p.x - ISLAND.x, p.z - ISLAND.z)
		if off.length() > ISLAND_R - 0.8:
			off = off.normalized() * (ISLAND_R - 0.8)
			p.x = ISLAND.x + off.x
			p.z = ISLAND.z + off.y
	elif _in_lake(p, 0.5) and absf(p.x - DOCK.x) > 1.0:
		var q := Vector2((p.x - LAKE_C.x) / (LAKE_R.x + 0.5), (p.z - LAKE_C.z) / (LAKE_R.y + 0.5)).normalized()
		p.x = LAKE_C.x + q.x * (LAKE_R.x + 0.5)
		p.z = LAKE_C.z + q.y * (LAKE_R.y + 0.5)
	var hp := house_pos()
	var obs := obstacles + ([[Vector2(hp.x, hp.z), 3.6 if house_level < 4 else 6.0]] if house_level > 0 else [])
	for li in GS.data["lands"].size():
		var l = GS.data["lands"][li]
		if l["owner"] != "" and l["owner"] != "jugador" and int(GS.data["total_days"]) >= int(l["built"]):
			obs.append([SIM.LANDS[li], 3.4])
	for o in obs:
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


func _move_npcs(delta: float) -> void:
	var t: float = GS.data["time"]
	var night := t < 0.22 or t > 0.85
	var vil: Array = GS.data["villagers"]
	var winter := int(GS.data["season"]) == 3
	for i in villagers.size():
		var a = villagers[i]
		var v = vil[i]
		var job_off: bool = winter and SIM.JOBS[v["job"]].get("no_winter", false)
		var rt = _routine_spot(i, t)
		vtarget[i] = rt if rt != null else (_door(v) if night or job_off else _work_spot(v, i))
		var far: bool = a.position.distance_to(vtarget[i]) > 0.4
		var spd := 3.2 if far and a.position.distance_to(vtarget[i]) > 25 else 1.4
		if far:
			_walk_to(a, vtarget[i], spd, delta)
			if spd > 2:
				a.play("Jog_Fwd")
		elif rt != null:
			a.play("Dance" if not GS.FEST.feast_today().is_empty() and t > 0.4 and t < 0.86 else "Idle_Talking")
		elif not night and not job_off:
			vwork[i] -= delta
			if vwork[i] <= 0:
				vwork[i] = randf_range(2.0, 3.5)
				a.play_once("Interact")
		else:
			a.play("Idle")
	for k in vkids:
		if k["a"].position.distance_to(k["t"]) < 0.3 and randf() < 0.005:
			# Por la mañana a la escuela (si la hay); de día juegan en la plaza; de noche, a casa.
			var school := _building_pos("escuela")
			var tt: float = GS.data["time"]
			if night:
				k["t"] = k["home"]
			elif school != Vector3.INF and tt > 0.3 and tt < 0.5:
				k["t"] = school + Vector3(randf_range(-3, 3), 0, randf_range(4, 7))
			elif randf() < 0.5:
				k["t"] = PLAZA + Vector3(randf_range(-7, 7), 0, randf_range(-7, 7))
			else:
				k["t"] = k["home"] + Vector3(randf_range(-4, 4), 0, randf_range(-4, 4))
		_walk_to(k["a"], k["t"], 1.2, delta)
	for f in family:
		if f["a"].position.distance_to(f["t"]) < 0.3 and randf() < 0.004:
			f["t"] = _front_of_house() + Vector3(randf_range(-3.5, 3.5), 0, randf_range(-3.5, 3.5))
		_walk_to(f["a"], f["t"], 1.1, delta)


func _ceremony_spot() -> Vector3:
	var cp := _building_pos("capilla")
	return BLD.front(cp, 7.0) if cp != Vector3.INF else PLAZA + Vector3(-6, 0, -6)


func _building_pos(id: String) -> Vector3:
	for k in GS.data["buildings"]:
		if GS.data["buildings"][k] == id:
			return BLD.SLOTS[int(k)]
	return Vector3.INF


## Rutinas: misa los domingos por la mañana (si hay capilla) y tertulia en la plaza al atardecer.
func _routine_spot(i: int, t: float) -> Variant:
	var d = GS.data
	var ang := float(i) * 2.399
	# Fiesta: todo el pueblo en la plaza; boda o funeral: junto a la capilla (o la plaza).
	if not GS.FEST.feast_today().is_empty() and t > 0.4 and t < 0.86:
		return PLAZA + Vector3(cos(ang), 0, sin(ang)) * (4.0 + (i % 4) * 1.2)
	var cer = d.get("ceremony", null)
	if cer != null and int(cer["day"]) == int(d["total_days"]) and t > 0.3 and t < 0.6:
		return _ceremony_spot() + Vector3(cos(ang), 0, sin(ang)) * (2.5 + (i % 3))
	if int(d["day"]) % 7 == 0 and t > 0.32 and t < 0.45:
		for k in d["buildings"]:
			if d["buildings"][k] == "capilla":
				return BLD.front(BLD.SLOTS[int(k)], 7.0) + Vector3(cos(ang), 0, sin(ang)) * (1.5 + i % 3)
	var vv: Dictionary = d["villagers"][i] if i < d["villagers"].size() else {}
	if int(vv.get("stall", 0)) > 0 and t > 0.3 and t < 0.62:
		return GS.STALLS.behind(int(vv["stall_slot"]), int(vv["stall"]))
	if t > 0.74 and t < 0.84 and i % 2 == 0:
		return PLAZA + Vector3(cos(ang), 0, sin(ang)) * (3.0 + (i % 4) * 0.8)
	return null


## Camina siguiendo las calles: se calcula la ruta al cambiar de destino.
var routes := {}
func _walk_to(a, target: Vector3, spd: float, delta: float) -> void:
	var r = routes.get(a)
	if r == null or r["t"].distance_to(target) > 0.5:
		r = {"t": target, "pts": BLD.route(a.position, target)}
		routes[a] = r
	var pts: Array = r["pts"]
	while pts.size() > 1 and Vector2(a.position.x - pts[0].x, a.position.z - pts[0].z).length() < 0.6:
		pts.pop_front()
	_step_to(a, pts[0] if not pts.is_empty() else target, spd, delta)


func _step_to(a, target: Vector3, spd: float, delta: float) -> void:
	var to: Vector3 = target - a.position
	to.y = 0
	if to.length() < 0.3:
		a.play("Idle")
		return
	a.position += to.normalized() * minf(to.length(), spd * delta * GS.speed)
	a.rotation.y = lerp_angle(a.rotation.y, atan2(to.x, to.z), minf(1.0, delta * 8.0))
	a.play("Walk")


func _find_interaction(pp: Vector3 = Vector3.INF) -> Dictionary:
	var d = GS.data
	if pp == Vector3.INF:
		pp = player.position
	# La barca y el lago.
	if sailing:
		if pp.distance_to(DOCK_END) < 4.0:
			return {"type": "boat_off", "label": "Bajar al embarcadero"}
		if pp.distance_to(ISLAND) < ISLAND_R + 3.0:
			return {"type": "boat_off", "label": "Desembarcar en el islote"}
		return {"type": "fish", "label": "Pescar desde la barca (mantén E)"}
	if boat_node and pp.distance_to(boat_node.position) < 3.5:
		return {"type": "boat_on", "label": "Subir a la barca y navegar"}
	var ii: Dictionary = inc.find_interaction(pp)
	if not ii.is_empty():
		return ii
	var wi: Dictionary = wild.find_interaction(pp)
	if not wi.is_empty():
		return wi
	if not GS.FEST.feast_today().is_empty() and pp.distance_to(PLAZA) < 9.0:
		return {"type": "feast", "label": "Unirse a la fiesta: %s" % GS.FEST.feast_today()["name"]}
	var cer = GS.data.get("ceremony", null)
	if cer != null and not cer["attended"] and int(cer["day"]) == int(GS.data["total_days"]) and pp.distance_to(_ceremony_spot()) < 8.0:
		return {"type": "ceremony", "label": "Asistir a " + String(cer["title"]).to_lower()}
	for i in villagers.size():
		if pp.distance_to(villagers[i].position) < 1.8:
			return {"type": "villager", "i": i, "label": "Hablar con %s" % d["villagers"][i]["name"]}
	for li in d["lands"].size():
		var l = d["lands"][li]
		if l["open"] and li != int(d["player_land"]) and l["owner"] in ["", "jugador"] and Vector2(pp.x, pp.z).distance_to(SIM.LANDS[li]) < 6.0:
			return {"type": "land", "i": li, "label": "Comprar terreno (%d oro)" % SIM.land_price(li) if l["owner"] == "" else "Tu terreno"}
	if pp.distance_to(house_pos()) < (6.5 if house_level < 4 else 9.0):
		return {"type": "house", "label": "Tu parcela" if int(d["house_level"]) == 0 else "Tu casa"}
	for v in GS.STALLS.sellers():
		var si := int(v["stall_slot"])
		if pp.distance_to(GS.STALLS.front(si)) < 2.0 or pp.distance_to(GS.STALLS.slot_pos(si)) < 2.2:
			return {"type": "market", "label": "Comprar en el puesto de %s (%s)" % [v["name"], GS.STALLS.GOODS.get(v["job"], ["mercado"])[0]]}
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
	var ti: Dictionary = town.find_interaction(pp)
	if not ti.is_empty():
		return ti
	var bi: Dictionary = bld.find_interaction(pp)
	if not bi.is_empty():
		return bi
	var fi: Dictionary = farm.find_interaction(pp)
	if not fi.is_empty():
		return fi
	return {}


func _unhandled_input(ev: InputEvent) -> void:
	# Clic izquierdo: ir a un sitio o a hacer algo (talar, hablar, comprar...). Clic derecho: solo ir.
	if ev is InputEventMouseButton and ev.pressed and ev.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT]:
		if panel.visible or GS.data.get("game_over", false):
			return
		var g = cam.ground_at(ev.position)
		if g == null:
			return
		var it: Dictionary = _find_interaction(g) if ev.button_index == MOUSE_BUTTON_LEFT else {}
		order = {"p": g, "type": it.get("type", ""), "t": 0.0}
		if it.has("i"):
			order["i"] = it["i"]
		_mark(g)
		return
	if not (ev is InputEventKey and ev.pressed and not ev.echo):
		return
	if ev.keycode == KEY_SPACE:
		cam.follow = true
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
		KEY_F1:
			if not panel.visible:
				preload("res://scripts/help.gd").open(self)
		KEY_H:
			if GS.data.get("horse", false) and not panel.visible:
				GS.data["riding"] = not GS.data.get("riding", false)
				_update_player_model()
		KEY_I:
			if not panel.visible:
				farm.inventory_panel()
		KEY_M:
			if not panel.visible and not GS.data.get("game_over", false):
				GS.save_game()
				main.start_region()
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
		"boat_on":
			sailing = true
			order = {}
			player.position = boat_node.position + Vector3(0, 0.45, 0)
			_float("Navegando: haz clic en el agua para remar", Color(0.7, 0.9, 1.0))
		"boat_off":
			sailing = false
			order = {}
			if player.position.distance_to(DOCK_END) < 5.0:
				boat_node.position = DOCK_END + Vector3(1.6, 0, 1.0)
				player.position = DOCK_END - Vector3(0, 0, 2.0)
			else:
				var dir: Vector3 = player.position - ISLAND
				dir.y = 0
				boat_node.position = ISLAND + dir.normalized() * (ISLAND_R + 1.2)
				player.position = ISLAND + dir.normalized() * (ISLAND_R - 1.6)
			player.position.y = 0.0
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
		"land":
			_land_panel(inter["i"])
		"barracks":
			town.barracks_panel()
		"inc_bucket", "inc_douse", "inc_thief", "inc_pig", "inc_fox":
			inc.interact(inter)
		"feast":
			GS.FEST.join(self)
		"ceremony":
			GS.FEST.attend(self)
		"wolf", "bandits", "boar", "falcon":
			wild.interact(inter)
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
			SFX.play("talar")
		"rock":
			var st := 2 if "pico" in d["tools"] else 1
			d["stone"] += st
			cooldown = 0.6
			_float("+%d piedra" % st, Color(0.85, 0.85, 0.9))
			SFX.play("picar")


func _house_panel() -> void:
	var d = GS.data
	var lvl := int(d["house_level"])
	var opts := []
	var text := "Tu hogar: %s.\nMadera %d · Piedra %d · Oro %d" % [GS.HOUSE_NAMES[lvl], int(d["wood"]), int(d["stone"]), int(d["gold"])]
	if lvl == 0:
		text += "\n\nNecesitas una casa para casarte y para dormir."
	if lvl >= 3 and int(d["player_land"]) < 0:
		text += "\n\nPara ampliar más tu casa necesitas un terreno grande. Se abren al sur del pueblo cuando prospera."
	if lvl < 5:
		var c = GS.HOUSE_COSTS[lvl]
		opts.append(["%s %s (%d madera, %d piedra, %d oro)" % ["Construir" if lvl == 0 else "Mejorar a", GS.HOUSE_NAMES[lvl + 1], c["wood"], c["stone"], c["gold"]], func():
			var err: String = GS.try_build_house()
			if err != "":
				_float(err, Color(1, 0.5, 0.4))
			_house_panel(), lvl < 3 or int(d["player_land"]) >= 0])
	if lvl >= 1:
		opts.append(["Entrar en tu casa", func():
			GS.save_game()
			main.start_house()])
		opts.append(["Dormir hasta el amanecer", func():
			GS.sleep()
			_close_panel()])
	opts.append(["Ver familia", _family_panel])
	opts.append(["Crónica y árbol del linaje", _chronicle_panel])
	if d.get("steward", false):
		opts.append(["Despedir al mayordomo", func():
			d["steward"] = false
			_house_panel()])
	else:
		opts.append(["Contratar un mayordomo (4 oro/día): cosecha, resiembra y vende lo que sobra", func():
			d["steward"] = true
			GS.say("Contratas un mayordomo. Él se ocupará de los campos y de vender lo que sobre.")
			_house_panel(), lvl >= 1])
	opts.append(["Llamar al físico (30 oro): +30 salud, puede curar heridas", func(): GS.CHAR.physician(self)])
	opts.append(["Guardar partida", func():
		GS.save_game()
		_float("Partida guardada", Color.WHITE)
		_close_panel()])
	opts.append(["Cerrar", _close_panel])
	_open_panel("Tu casa", text, opts)


func _family_panel() -> void:
	GS.tip("familia", "la familia", "Tus hijos heredan cuando mueres: sin hijos, el linaje se acaba. Edúcalos desde los 6 años y, de mayores, nómbralos capitanes o gobernadores. Cada uno tiene un rasgo que le hace mejor en algo.")
	var d = GS.data
	var p = d["player"]
	var lines := ["Linaje %s · Generación %d" % [d["dynasty"], int(d["generation"])], "", "%s (%d años) — cabeza de familia · %s" % [p["name"], int(p["age"]), GS.TRAITS[GS.trait_of(p)]]]
	if d["spouse"] != null:
		lines.append("%s (%d años) — cónyuge" % [d["spouse"]["name"], int(d["spouse"]["age"])])
	var heir_age := -1
	for c in d["children"]:
		heir_age = maxi(heir_age, int(c["age"]))
	var opts := []
	for c in d["children"]:
		var tag := " — heredero" if int(c["age"]) == heir_age else ""
		var role := ""
		match c.get("role", ""):
			"capitan":
				role = " · capitán de tus tropas (%d batallas)" % int(c.get("xp", 0))
			"gobernador":
				role = " · gobierna %s" % GS.REGION.town(int(c["town"])).get("name", "?")
		var edu: String = c.get("edu", "")
		lines.append("%s (%d años) — %s%s%s · %s%s" % [c["name"], int(c["age"]), "hijo" if c["male"] else "hija", tag, role, String(GS.TRAITS[GS.trait_of(c)]).split(":")[0], (" · educado en " + edu) if edu != "" else ""])
		if int(c["age"]) >= 16:
			opts.append(["Cargos de %s" % c["name"], func(): _child_roles(c)])
		elif int(c["age"]) >= 6 and edu == "":
			opts.append(["Educar a %s (%d oro)" % [c["name"], GS.edu_cost()], func(): _educate(c)])
	if d["children"].is_empty():
		lines.append("")
		lines.append("Sin hijos. Si mueres sin herederos, tu linaje se extingue.")
	lines.append("")
	lines.append("La familia come %d de comida al día." % GS.family_size())
	lines.append("")
	lines.append(GS.CHAR.summary())
	opts.append_array([["Volver", _house_panel], ["Cerrar", _close_panel]])
	_open_panel("Familia", "\n".join(lines), opts)


func _chronicle_panel() -> void:
	var d = GS.data
	var lines := ["ÁRBOL DEL LINAJE %s" % String(d["dynasty"]).to_upper(), ""]
	var gen := 1
	for a in d.get("ancestors", []):
		lines.append("%d. %s %s (%s a los %d años, año %d)" % [gen, a["name"], a.get("epithet", ""), a["reason"], int(a["age"]), int(a["year"])])
		gen += 1
	lines.append("%d. %s — cabeza de familia, %d años%s" % [gen, d["player"]["name"], int(d["player"]["age"]), (", con " + d["spouse"]["name"]) if d["spouse"] != null else ""])
	for c in d["children"]:
		lines.append("      └ %s (%d años)" % [c["name"], int(c["age"])])
	lines.append("")
	lines.append("CRÓNICA")
	var ch: Array = d.get("chronicle", [])
	for e in ch.slice(maxi(0, ch.size() - 40)):
		lines.append("Año %d: %s" % [int(e["y"]), e["t"]])
	var l := Label.new()
	l.text = "\n".join(lines)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x = 520
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(540, 440)
	sc.add_child(l)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	var tree := TextureRect.new()
	tree.texture = load("res://assets/ui/arbol.jpg")
	tree.custom_minimum_size = Vector2(245, 440)
	tree.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tree.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	row.add_child(tree)
	row.add_child(sc)
	_open_custom("Crónica del linaje", row)


func _educate(c: Dictionary) -> void:
	var d = GS.data
	var opts := []
	for k in GS.EDU:
		opts.append([GS.EDU[k], func():
			d["gold"] = int(d["gold"]) - GS.edu_cost()
			c["edu"] = k
			GS.say("%s empieza su educación: %s." % [c["name"], k])
			_family_panel(), int(d["gold"]) >= GS.edu_cost()])
	opts.append(["Volver", _family_panel])
	_open_panel("Educar a %s" % c["name"], "Elige cómo se educará %s (%s). Lo que aprenda le servirá de mayor como capitán, gobernador o para traer dinero a casa.\nCuesta %d de oro." % [c["name"], GS.TRAITS[GS.trait_of(c)], GS.EDU_COST], opts)


## Un hijo adulto puede ser capitán (lucha a tu lado en las batallas) o gobernar uno de tus pueblos.
func _child_roles(c: Dictionary) -> void:
	var d = GS.data
	var text := "%s puede servir a la familia:\n\n· Capitán: lucha a tu lado en cada batalla. Gana experiencia, pero puede morir.\n· Gobernador: administra un pueblo tuyo del mapa y sus rentas suben un 50%%." % c["name"]
	var opts := []
	if c.get("role", "") != "capitan":
		opts.append(["Nombrar capitán", func():
			c["role"] = "capitan"
			c.erase("town")
			GS.say("%s será capitán de tus tropas." % c["name"])
			_family_panel()])
	for t in GS.REGION.region()["towns"]:
		if t["owner"] == "jugador" and not t.get("home", false) and GS.REGION.governor_of(int(t["id"])) == "":
			opts.append(["Nombrar gobernador de %s" % t["name"], func():
				c["role"] = "gobernador"
				c["town"] = int(t["id"])
				GS.say("%s parte a gobernar %s." % [c["name"], t["name"]])
				_family_panel()])
	if c.get("role", "") != "":
		opts.append(["Quitarle el cargo (vuelve a casa)", func():
			c["role"] = ""
			c.erase("town")
			_family_panel()])
	opts.append(["Volver", _family_panel])
	_open_panel("Cargos de %s" % c["name"], text, opts)


func _villager_panel(i: int) -> void:
	var d = GS.data
	var v = d["villagers"][i]
	var talked: bool = v["name"] in d["talked"]
	var text := "%s, %d años%s. %s.\nAfecto: %d / 100 · Carácter: %s · Le gusta: %s\n%s" % [GS.full_name(v), int(v["age"]), " (anciano)" if GS.FOLK.is_elder(v) else "", SIM.job_name(v), int(v["affection"]), GS.FOLK.PERS[GS.FOLK.pers(v)], String(GS.ITEMS[v["likes"]][0]).to_lower(), GS.FOLK.friends_text(v)]
	if v.has("partner"):
		text += "\n%s con %s." % ["Casado" if v["male"] else "Casada", v["partner"]]
	elif v.has("suitor"):
		text += "\nEs %s de %s." % ["novio" if v["male"] else "novia", v["suitor"]]
	var kid_names := []
	for k in v.get("kids", []):
		kid_names.append("%s (%d)" % [k["name"], int(k["age"])])
	if not kid_names.is_empty():
		text += "\nHijos: " + ", ".join(kid_names)
	if int(v["affection"]) >= 100:
		text += "\n\nSe le ve muy feliz de verte..."
	var opts := []
	var fo: Array = GS.SOCIAL.favor_option(v, func(): _villager_panel(i))
	if not fo.is_empty():
		opts.append(fo)
	opts.append(["Comerciar", func(): TRADE.open(self, i)])
	var lk: String = v["likes"]
	opts.append(["Regalarle %s, lo que más le gusta (+30 afecto)" % String(GS.ITEMS[lk][0]).to_lower(), func():
		GS.take(lk, 1)
		v["affection"] = mini(100, int(v["affection"]) + 30)
		_float("¡Le encanta!", Color(1, 0.9, 0.6))
		_villager_panel(i), GS.inv(lk) >= 1])
	opts.append_array(GS.FOLK.elder_options(v, func(t): _open_panel(GS.full_name(v), t, [["Volver", func(): _villager_panel(i)]])))
	opts.append(["Charlar (una vez al día)", func():
		v["affection"] = mini(100, int(int(v["affection"]) + randi_range(6, 12) * GS.FOLK.chat_mult(v)))
		d["talked"].append(v["name"])
		_float(GS.FOLK.greeting(v), Color(1, 1, 0.85))
		_villager_panel(i), not talked])
	opts.append(["Regalar comida, 5 raciones (+15 afecto)", func():
		GS.eat(5)
		v["affection"] = mini(100, int(v["affection"]) + 15)
		_villager_panel(i), GS.food_total() >= 5])
	opts.append(["Regalar 5 de oro (+20 afecto)", func():
		d["gold"] -= 5
		v["affection"] = mini(100, int(v["affection"]) + 20)
		_villager_panel(i), d["gold"] >= 5])
	if int(v["affection"]) >= 100 and not v.has("partner"):
		opts.append(["Proponer matrimonio", func():
			var err: String = GS.marry(i)
			if err != "":
				_open_panel("Matrimonio", err, [["Cerrar", _close_panel]])
			else:
				_reset_villagers()
				_open_panel("¡Boda!", "Te has casado con %s. Pronto podréis tener hijos que continúen el linaje." % d["spouse"]["name"], [["Cerrar", _close_panel]])])
	opts.append(["Adiós", _close_panel])
	_open_panel(GS.full_name(v), text, opts)


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
		text = "Eres el jefe del pueblo.\nCuando el rey llame a las armas, llevarás a tus tropas (o a la milicia del pueblo si no tienes ejército).\nCuando el pueblo sea villa podrás reclutar soldados en el cuartel."
		var tax := int(d["commons"]) / 4
		for vv in d["villagers"]:
			tax += mini(5, int(vv["gold"]))
		opts.append(["Cobrar impuestos (una vez por estación, +%d oro)" % tax, func():
			for vv in d["villagers"]:
				var t := mini(5, int(vv["gold"]))
				vv["gold"] -= t
				vv["mood"] = maxi(0, int(vv["mood"]) - 5)
				d["gold"] += t
			d["gold"] += int(int(d["commons"]) / 4 * (0.7 if int(d.get("low_tax", 0)) == int(d["year"]) else 1.0))
			d["taxed"] = GS.season_index()
			GS.say("Cobras los impuestos del pueblo.")
			_hall_panel(), can_tax])
	text += "\n\n" + _town_report()
	opts.append_array(GS.SOCIAL.hall_options(self))
	if int(d["title"]) >= 1:
		opts.append(["Consejo de la corte", func(): GS.POL.council_panel(self)])
		opts.append(["Obras públicas", func(): GS.TL.works_panel(self)])
		if d.get("bailiff", false):
			opts.append(["Despedir al alguacil", func():
				d["bailiff"] = false
				_hall_panel()])
		else:
			opts.append(["Contratar un alguacil (3 oro/día): ronda de noche y caza ladrones", func():
				d["bailiff"] = true
				_hall_panel()])
		opts.append(["Gremios", func():
			var go: Array = GS.TL.guild_options(self)
			go.append(["Cerrar", _close_panel])
			_open_panel("Gremios del pueblo", GS.TL.guilds_text() + "\n\nCon privilegios, los oficios de un gremio producen un 25% más. Si les niegas sus peticiones dos veces, hacen huelga.", go)])
		opts.append(["Reinos vecinos", func(): GS.WORLD.kingdoms_panel(self)])
		if not GS.HOSTS.prisoners().is_empty():
			opts.append(["Mazmorras (%d presos)" % GS.HOSTS.prisoners().size(), func(): GS.HOSTS.dungeon_panel(self)])
		opts.append(["Resumen de tus pueblos", func(): _open_panel("Tus pueblos", GS.ECON.towns_summary() + "\n\nPara administrarlos, abre el mapa (M) y pulsa G.", [["Cerrar", _close_panel]])])
		if not GS.POL.is_king():
			text += "\n\n" + GS.POL.crown_text()
			opts.append(["Coronarte rey de la región (%d oro)" % GS.POL.CROWN_GOLD, func():
				GS.POL.crown()
				_close_panel(), GS.POL.can_crown()])
	opts.append(["Cerrar", _close_panel])
	_open_panel("Casa del Concejo", text, opts)


func _town_report() -> String:
	var d = GS.data
	var jobs := {}
	for vv in d["villagers"]:
		var jn := SIM.job_name(vv)
		jobs[jn] = int(jobs.get(jn, 0)) + 1
	var parts := []
	for k in jobs:
		parts.append("%s %d" % [k.to_lower(), jobs[k]])
	var next := ""
	for i in d["lands"].size():
		if not d["lands"][i]["open"]:
			next = "Próximo terreno al llegar a %d de prosperidad." % SIM.LAND_THRESH[i]
			break
	return "%s · Prosperidad: %d\nHabitantes: %d (%d vecinos con nombre y %d del pueblo llano) de %d que caben\nOficios de los vecinos: %s\n%s\n%s" % [SIM.town_title(), int(d["prosperity"]), SIM.total_pop(), SIM._population(), int(d["commons"]), int(SIM.TIERS[int(d["tier"])]["cap"]), ", ".join(parts), SIM.next_tier_text(), next]


func _land_panel(i: int) -> void:
	var d = GS.data
	var l = d["lands"][i]
	if l["owner"] == "":
		_open_panel("Terreno en venta", "Un terreno amplio en el barrio nuevo. Cuesta %d de oro.\nSi no lo compras, pronto lo comprarán forasteros para vivir aquí.\n\nTu oro: %d" % [SIM.land_price(i), int(d["gold"])], [
			["Comprar terreno", func():
				var err: String = SIM.buy_land(i)
				if err != "":
					_float(err, Color(1, 0.5, 0.4))
				_land_panel(i), int(d["gold"]) >= SIM.land_price(i)],
			["Cerrar", _close_panel]])
	else:
		_open_panel("Tu terreno", "Aquí puedes levantar una casa más grande (Casona y Casa fuerte).\nSi te mudas, tu casa actual se traslada aquí con su nivel y tu familia te acompaña.", [
			["Mudarte a este terreno", func():
				d["player_land"] = i
				GS.say("Tu familia se muda al barrio nuevo.")
				_close_panel(), true],
			["Cerrar", _close_panel]])


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
		["Ayuda (F1)", func(): preload("res://scripts/help.gd").open(self)],
		["Opciones", func():
			_close_panel()
			preload("res://scripts/options.gd").open(self)],
		["Guardar y volver al menú", func():
			GS.save_game()
			main.show_menu()],
		["Salir del juego", func():
			GS.save_game()
			get_tree().quit()],
	])


func _show_popup(pp: Dictionary) -> void:
	SFX.play("campana")
	if GS.data.get("game_over", false):
		_open_panel(pp["title"], pp["text"], [["Volver al menú", func(): main.show_menu()]])
	elif pp.has("options"):
		_open_panel(pp["title"], pp["text"], pp["options"].map(func(o): return [o[0], func():
			_close_panel()
			o[1].call()]))
	else:
		_open_panel(pp["title"], pp["text"], [[pp.get("button", "Continuar con el heredero"), _close_panel]])
