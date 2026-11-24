extends Node3D
## Crecimiento visual del pueblo: barrios con casas según la población, empalizada (villa),
## murallas de piedra y catedral (ciudad) y vecinos anónimos paseando.

const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const SIM := preload("res://scripts/village_sim.gd")

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
		_label(BARRACKS + Vector3(0, 9, 0), "Cuartel (próximamente)")
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
		M.recolor(M.put(self, "castle/LargeTower.glb", Vector3(corner.x, 0, corner.y), 0.0, 2.0), stone)
	for side in 4:
		var a: Vector2 = [b.position, Vector2(b.end.x, b.position.y), b.end, Vector2(b.position.x, b.end.y)][side]
		var c: Vector2 = [Vector2(b.end.x, b.position.y), b.end, Vector2(b.position.x, b.end.y), b.position][side]
		var n := int(ceil(a.distance_to(c) / (wlen * 0.9)))
		for k in n:
			var p := a.lerp(c, (k + 0.5) / n)
			var gate: bool = gates.any(func(g): return g.distance_to(p) < wlen * 0.6)
			var piece := "castle/TallWallEntrance.glb" if gate else "castle/TallWall.glb"
			M.recolor(M.put(self, piece, Vector3(p.x, 0, p.y), 0.0 if side % 2 == 0 else PI / 2, 2.0), stone)


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
	if v.panel.visible:
		return
	var t: float = GS.data["time"]
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
