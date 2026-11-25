extends Node3D
## Crecimiento visual del pueblo: barrios con casas según la población, empalizada (villa),
## murallas de piedra y catedral (ciudad) y vecinos anónimos paseando.

const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const SIM := preload("res://scripts/village_sim.gd")
const ARMY := preload("res://scripts/army.gd")

## Barrios por nivel: rectángulo (x, z, ancho, fondo).
const EAST := Rect2(122, 10, 38, 68)
const NORTH := Rect2(80, -36, 44, 36)
const NORTHWEST := Rect2(6, -36, 46, 32)
const BARRACKS := Vector3(141, 0, 47)
const CATHEDRAL := Vector3(102, 0, -30)
const HOUSES := ["village/House_1.glb", "village/House_2.glb", "village/House_3.glb", "village/House_4.glb"]
const PEOPLE_PER_HOUSE := 15

var v
var tier := 0
var slots: Array = []  # [posición, rotación]
var house_nodes: Array = []
var shown := -1
var walkers: Array = []
var obstacles: Array = []
var drill: Array = []
var drill_sig := ""


## Límites por los que puede moverse el jugador en cada nivel.
static func bounds(t: int) -> Rect2:
	match t:
		1:
			return Rect2(1, 1, 162, 97)
		2:
			return Rect2(1, -38, 162, 136)
	return Rect2(1, 1, 118, 96)


## Zonas donde no deben quedar árboles (barrios abiertos).
static func clear_rects(t: int) -> Array:
	var r := []
	if t >= 1:
		r.append(EAST.grow(4))
	if t >= 2:
		r.append(NORTH.grow(4))
		r.append(NORTHWEST.grow(4))
	return r


func _ready() -> void:
	tier = int(GS.data["tier"])
	var dirt := Color(0.42, 0.34, 0.24)
	if tier >= 1:
		M.road(self, Vector3(117, 0, 41), Vector3(160, 0, 41), 4.0, dirt)
		for x in [131.0, 151.0]:
			M.road(self, Vector3(x, 0, 12), Vector3(x, 0, 76), 3.0, dirt)
		_slots([125.0, 137.0, 145.0, 157.0], [15.0, 25.0, 34.0, 48.0, 58.0, 68.0], 41.0)
		M.put(self, "rts/Barracks_FirstAge_Level2.glb", BARRACKS, -PI / 2, 1.0)
		_fit(get_child(get_child_count() - 1), 11.0)
		obstacles.append([Vector2(BARRACKS.x, BARRACKS.z), 5.5])
		_label(BARRACKS + Vector3(0, 9, 0), "Cuartel")
		for k in 3:
			var p := Vector3(70 + k * 4.0, 0, 52)
			M.put(self, "village/MarketStand_%d.glb" % (1 + k % 2), p, PI, 1.7)
			obstacles.append([Vector2(p.x, p.z), 1.0])
		if tier == 1:
			_palisade(bounds(1).grow(-0.5))
	if tier >= 2:
		M.road(self, Vector3(60, 0, 19), Vector3(60, 0, -36), 4.0, dirt)
		M.road(self, Vector3(8, 0, -20), Vector3(124, 0, -20), 4.0, dirt)
		_slots([84.0, 92.0, 112.0, 120.0], [-30.0, -11.0], -20.0)
		_slots([10.0, 19.0, 28.0, 37.0, 46.0], [-30.0, -11.0], -20.0)
		var cat := M.put(self, "rts/Temple_FirstAge_Level3.glb", CATHEDRAL, PI, 1.0)
		_fit(cat, 15.0)
		obstacles.append([Vector2(CATHEDRAL.x, CATHEDRAL.z), 7.0])
		_label(CATHEDRAL + Vector3(0, 16, 0), "Catedral")
		_stone_walls(bounds(2).grow(-0.5))
	slots = slots.filter(func(sl): return sl[0].distance_to(BARRACKS) > 10.0)
	slots.sort_custom(func(a, b): return a[0].distance_to(Vector3(60, 0, 40)) < b[0].distance_to(Vector3(60, 0, 40)))
	for s in slots:
		house_nodes.append(null)
		obstacles.append([Vector2(s[0].x, s[0].z), 3.0])


func _fit(n: Node3D, size: float) -> void:
	var bb := M.aabb_of(n)
	n.scale = Vector3.ONE * (size / maxf(bb.size.x, bb.size.z))


func _label(p: Vector3, text: String) -> void:
	var l := M.label3d(text, 44)
	l.position = p
	l.modulate = Color(1, 0.9, 0.6)
	add_child(l)


## Solares para casas en una cuadrícula; miran hacia la calle principal del barrio.
func _slots(xs: Array, zs: Array, street_z: float) -> void:
	for x in xs:
		for z in zs:
			slots.append([Vector3(x, 0, z), 0.0 if z < street_z else PI])


func _palisade(b: Rect2) -> void:
	var probe := M.inst("village/Fence.glb")
	var flen: float = M.aabb_of(probe).size.x * 1.6
	probe.free()
	var gates := [Vector2(160.5, 41), Vector2(60, 97.5), Vector2(117, 1.5)]
	for side in 4:
		var a: Vector2
		var c: Vector2
		match side:
			0:
				a = b.position
				c = Vector2(b.end.x, b.position.y)
			1:
				a = Vector2(b.end.x, b.position.y)
				c = b.end
			2:
				a = b.end
				c = Vector2(b.position.x, b.end.y)
			3:
				a = Vector2(b.position.x, b.end.y)
				c = b.position
		var n := int(a.distance_to(c) / flen)
		for k in n:
			var p := a.lerp(c, (k + 0.5) / n)
			if gates.any(func(g): return g.distance_to(p) < 5.0):
				continue
			M.put(self, "village/Fence.glb", Vector3(p.x, 0, p.y), 0.0 if side % 2 == 0 else PI / 2, 1.6)


func _stone_walls(b: Rect2) -> void:
	var probe := M.inst("castle/TallWall.glb")
	var wbb := M.aabb_of(probe)
	var wlen: float = maxf(wbb.size.x, wbb.size.z) * 2.0
	probe.free()
	var stone := Color(0.55, 0.53, 0.49)
	var gates := [Vector2(162.5, 41), Vector2(60, 97.5), Vector2(60, -37.5)]
	for corner in [b.position, Vector2(b.end.x, b.position.y), b.end, Vector2(b.position.x, b.end.y)]:
		M.stone(M.put(self, "castle/LargeTower.glb", Vector3(corner.x, 0, corner.y), 0.0, 2.0), stone)
	for side in 4:
		var a: Vector2 = [b.position, Vector2(b.end.x, b.position.y), b.end, Vector2(b.position.x, b.end.y)][side]
		var c: Vector2 = [Vector2(b.end.x, b.position.y), b.end, Vector2(b.position.x, b.end.y), b.position][side]
		var n := int(ceil(a.distance_to(c) / (wlen * 0.9)))
		for k in n:
			var p := a.lerp(c, (k + 0.5) / n)
			var gate: bool = gates.any(func(g): return g.distance_to(p) < wlen * 0.6)
			var piece := "castle/TallWallEntrance.glb" if gate else "castle/TallWall.glb"
			M.stone(M.put(self, piece, Vector3(p.x, 0, p.y), 0.0 if side % 2 == 0 else PI / 2, 2.0), stone)


func _process(delta: float) -> void:
	var want := mini(slots.size(), int(ceil(int(GS.data["commons"]) / float(PEOPLE_PER_HOUSE))))
	if want != shown:
		for i in slots.size():
			if i < want and house_nodes[i] == null:
				house_nodes[i] = M.put(self, HOUSES[i % HOUSES.size()], slots[i][0], slots[i][1], 1.6)
			elif i >= want and house_nodes[i] != null:
				house_nodes[i].queue_free()
				house_nodes[i] = null
		shown = want
		_update_walkers()
	var ds := "%d-%s" % [ARMY.total(), str(GS.data["army"])]
	if tier >= 1 and ds != drill_sig:
		drill_sig = ds
		_update_drill()
	if v.panel.visible:
		return
	var t: float = GS.data["time"]
	for i in drill.size():
		var dd = drill[i]
		dd["cd"] -= delta
		if dd["cd"] <= 0:
			dd["cd"] = randf_range(1.2, 2.0)
			dd["a"].play_once("Sword_Attack" if not dd["kind"] in ["arquero", "arquero_jinete"] else "Spell_Simple_Shoot")
	var night := t < 0.22 or t > 0.85
	for w in walkers:
		w["a"].visible = not night
		if night:
			continue
		var to: Vector3 = w["t"] - w["a"].position
		to.y = 0
		if to.length() < 0.5:
			w["t"] = _street_point()
		else:
			w["a"].position += to.normalized() * minf(to.length(), 1.4 * delta * GS.speed)
			w["a"].rotation.y = atan2(to.x, to.z)
			w["a"].play("Walk")


## Vecinos anónimos por las calles: más cuanta más población.
func _update_walkers() -> void:
	var want := clampi(int(GS.data["commons"]) / 25, 0, 12)
	while walkers.size() < want:
		var male := randf() < 0.5
		var a := ACTOR.new()
		add_child(a)
		var parts: Array = ["ubc/Superhero_Male_FullBody", "out/Male_Peasant", ["hair/Hair_SimpleParted", "hair/Hair_Buzzed", "hair/Hair_Beard"].pick_random()] if male else ["ubc/Superhero_Female_FullBody", "out/Female_Ranger", ["hair/Hair_Long", "hair/Hair_Buns"].pick_random()]
		a.build(parts, {"hair_color": M.SKIN_HAIR.pick_random()} if male else {"hide_hood": true, "faction": "bandido", "hair_color": M.SKIN_HAIR.pick_random()})
		a.position = _street_point()
		walkers.append({"a": a, "t": _street_point()})
	while walkers.size() > want:
		walkers.pop_back()["a"].queue_free()


func _street_point() -> Vector3:
	var pts := [Vector3(60, 0, 40) + Vector3(randf_range(-8, 8), 0, randf_range(-8, 8))]
	if tier >= 1:
		pts.append(Vector3(randf_range(120, 158), 0, 41 + randf_range(-1.5, 1.5)))
		pts.append(Vector3([131.0, 151.0].pick_random() + randf_range(-1, 1), 0, randf_range(14, 74)))
	if tier >= 2:
		pts.append(Vector3(randf_range(10, 122), 0, -20 + randf_range(-1.5, 1.5)))
	return pts.pick_random()


## Soldados entrenando delante del cuartel (hasta 10, en proporción a tu ejército).
func _update_drill() -> void:
	for dd in drill:
		dd["a"].queue_free()
	drill.clear()
	var kinds := []
	for k in ARMY.ORDER:
		for n in int(GS.data["army"][k]):
			kinds.append(k)
	kinds.shuffle()
	for i in mini(10, kinds.size()):
		var a := ACTOR.new()
		add_child(a)
		var k: String = kinds[i]
		var opts := {"faction": "azul", "hide_hood": not k in ["arquero", "arquero_jinete"], "sword": k in ["infante", "milicia", "jinete"], "shield": k in ["infante", "jinete"], "helmet": "Helmet2" if k in ["infante", "lancero", "jinete"] else ""}
		a.build(["ubc/Superhero_Male_FullBody", "out/Male_Ranger"], opts)
		if k == "lancero":
			a.attach("hand_r", "weapons/Spear.glb", Vector3(0, 0.05, 0), Vector3(0, 0, 90), 2.3)
		elif k in ["arquero", "arquero_jinete"]:
			a.attach("hand_l", "weapons/Bow_Wooden.glb", Vector3(0, 0.05, 0), Vector3(0, 90, 0), 1.3)
		a.position = BARRACKS + Vector3(-9 - (i / 5) * 2.2, 0, -4 + (i % 5) * 2.0)
		a.rotation.y = PI / 2
		if k in ARMY.MOUNTED:
			a.mount(Color(1.7, 1.4, 1.1))
		drill.append({"a": a, "kind": k, "cd": randf() * 2.0})


func find_interaction(pp: Vector3) -> Dictionary:
	if tier >= 1 and pp.distance_to(BARRACKS) < 9.0:
		return {"type": "barracks", "label": "Cuartel"}
	return {}


func barracks_panel() -> void:
	GS.tip("cuartel", "el cuartel", "Recluta tropas del pueblo llano: cada soldado cobra paga diaria y, sin oro, desertan. Los lanceros paran a la caballería y los arqueros disparan desde atrás. En el taller de asedio construyes arietes, balistas, torres y catapultas.")
	var d = GS.data
	var err := ARMY.can_recruit()
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	var info := Label.new()
	info.text = "Tropas: %d de %d plazas (la mitad del pueblo llano como máximo) · Paga diaria: %.1f de oro · Tu oro: %d\nTus tropas te acompañan cuando el rey te llama a la guerra. Las bajas se pierden.%s" % [ARMY.total(), ARMY.capacity(), ARMY.daily_pay(), int(d["gold"]), ("\n" + err) if err != "" else ""]
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.custom_minimum_size.x = 760
	box.add_child(info)
	var grid := GridContainer.new()
	grid.columns = 6
	grid.add_theme_constant_override("h_separation", 10)
	for h in ["Tropa", "Tienes", "Coste por soldado", "", "", ""]:
		var l := Label.new()
		l.text = h
		l.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
		grid.add_child(l)
	for k in ARMY.UNITS:
		var u = ARMY.UNITS[k]
		for t in [u["name"], str(int(d["army"][k])), "%s · paga %.2f/día" % [GS.cost_text(u["cost"]), float(u["pay"])]]:
			var l := Label.new()
			l.text = t
			grid.add_child(l)
		for n in [1, 5]:
			var b := Button.new()
			b.text = "Reclutar %d" % n
			b.disabled = not (err == "" and int(d["tier"]) >= int(u.get("tier", 1)) and GS.can_pay(u["cost"], n) and ARMY.total() + n <= ARMY.capacity())
			b.pressed.connect(func():
				v._float(ARMY.recruit(k, n), Color(0.8, 0.9, 1.0))
				barracks_panel())
			grid.add_child(b)
		var dm := Button.new()
		dm.text = "Licenciar 5"
		dm.disabled = int(d["army"][k]) <= 0
		dm.pressed.connect(func():
			ARMY.dismiss(k, 5)
			barracks_panel())
		grid.add_child(dm)
	box.add_child(grid)
	var eh := Label.new()
	eh.text = "Taller de asedio — tienes: " + ", ".join(ARMY.ENGINES.keys().map(func(k): return "%d %s" % [int(d["engines"][k]), String(ARMY.ENGINES[k]["name"]).to_lower()]))
	eh.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
	box.add_child(eh)
	var eg := GridContainer.new()
	eg.columns = 3
	eg.add_theme_constant_override("h_separation", 10)
	for k in ARMY.ENGINES:
		var e: Dictionary = ARMY.ENGINES[k]
		var l := Label.new()
		l.text = "%s · %s" % [e["name"], GS.cost_text(e["cost"])]
		eg.add_child(l)
		var dl := Label.new()
		dl.text = e["desc"]
		dl.add_theme_font_size_override("font_size", 13)
		eg.add_child(dl)
		var bb := Button.new()
		bb.text = "Construir"
		bb.disabled = not (err == "" and int(d["tier"]) >= int(e["tier"]) and GS.can_pay(e["cost"]))
		bb.pressed.connect(func():
			v._float(ARMY.build_engine(k), Color(0.8, 0.9, 1.0))
			barracks_panel())
		eg.add_child(bb)
	box.add_child(eg)
	v._open_custom("Cuartel de %s" % d["town"], box)
