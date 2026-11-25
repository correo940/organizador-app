extends Node3D
## Solares de construcción, talleres del pueblo y mina de hierro.

const M := preload("res://scripts/models.gd")

const PLAZA := Vector3(60, 0, 40)
## Solares para talleres: a ambos lados de la calle sur y al este de la plaza, mirando a la calle.
const SLOTS := [Vector3(51.5, 0, 55.5), Vector3(68.5, 0, 55.5), Vector3(51.5, 0, 65.5), Vector3(68.5, 0, 65.5), Vector3(51.5, 0, 75.5), Vector3(68.5, 0, 75.5), Vector3(78, 0, 31), Vector3(78, 0, 49)]
const MINE := Vector3(16, 0, 63)
## Calles del pueblo (tramos rectos [a, b, ancho]); los vecinos caminan por ellas.
const STREETS := [
	[Vector2(19, 40), Vector2(60, 40), 5.0],    # calle mayor (oeste)
	[Vector2(60, 40), Vector2(86, 40), 5.0],    # calle mayor (este)
	[Vector2(86, 40), Vector2(106, 40), 3.5],   # camino del campamento
	[Vector2(60, 40), Vector2(60, 22.5), 5.0],  # calle del concejo
	[Vector2(60, 40), Vector2(60, 82), 5.0],    # calle sur
	[Vector2(8, 82), Vector2(60, 82), 3.5],     # camino del barrio nuevo
	[Vector2(60, 82), Vector2(112, 82), 3.5],
	[Vector2(86, 40), Vector2(86, 12), 3.0],    # camino de los campos
]


## Punto más cercano de la red de calles y el tramo al que pertenece.
static func street_proj(p: Vector3) -> Array:
	var q := Vector2(p.x, p.z)
	var best := Vector2.ZERO
	var bi := 0
	var bd := INF
	for i in STREETS.size():
		var c := Geometry2D.get_closest_point_to_segment(q, STREETS[i][0], STREETS[i][1])
		var dd := c.distance_to(q)
		if dd < bd:
			bd = dd
			best = c
			bi = i
	return [bi, Vector3(best.x, 0, best.y), bd]


## Orientación para que un edificio en 'p' mire a la calle más cercana.
static func face_street(p: Vector3) -> float:
	var c: Vector3 = street_proj(p)[1]
	return atan2(c.x - p.x, c.z - p.z)


## Delante de la puerta: a 'dist' metros del centro del edificio, hacia la calle.
static func front(p: Vector3, dist: float) -> Vector3:
	var a := face_street(p)
	return p + Vector3(sin(a), 0, cos(a)) * dist


static func on_street(q: Vector2, margin: float) -> bool:
	for st in STREETS:
		if Geometry2D.get_closest_point_to_segment(q, st[0], st[1]).distance_to(q) < st[2] * 0.5 + margin:
			return true
	return false


## Camino por las calles de 'a' a 'b': puntos a seguir (Dijkstra sobre los extremos de los tramos).
static func route(a: Vector3, b: Vector3) -> Array:
	var pa: Array = street_proj(a)
	var pb: Array = street_proj(b)
	if a.distance_to(b) < 10.0 or (float(pa[2]) > 25.0 and float(pb[2]) > 25.0):
		return [b]
	if pa[0] == pb[0]:
		return [pa[1], pb[1], b]
	var nodes := []
	for st in STREETS:
		for e in [st[0], st[1]]:
			if not nodes.any(func(n): return n.distance_to(e) < 0.5):
				nodes.append(e)
	var idx := func(e: Vector2) -> int:
		for k in nodes.size():
			if nodes[k].distance_to(e) < 0.5:
				return k
		return -1
	var dist := []
	var prev := []
	for k in nodes.size():
		dist.append(INF)
		prev.append(-1)
	var sa: Array = STREETS[pa[0]]
	var qa := Vector2(pa[1].x, pa[1].z)
	dist[idx.call(sa[0])] = qa.distance_to(sa[0])
	dist[idx.call(sa[1])] = qa.distance_to(sa[1])
	var done := {}
	while true:
		var u := -1
		for k in nodes.size():
			if not done.has(k) and dist[k] < INF and (u < 0 or dist[k] < dist[u]):
				u = k
		if u < 0:
			break
		done[u] = true
		for st in STREETS:
			var o := -1
			if st[0].distance_to(nodes[u]) < 0.5:
				o = idx.call(st[1])
			elif st[1].distance_to(nodes[u]) < 0.5:
				o = idx.call(st[0])
			if o >= 0 and dist[u] + nodes[u].distance_to(nodes[o]) < dist[o]:
				dist[o] = dist[u] + nodes[u].distance_to(nodes[o])
				prev[o] = u
	var sb: Array = STREETS[pb[0]]
	var qb := Vector2(pb[1].x, pb[1].z)
	var e0: int = idx.call(sb[0])
	var e1: int = idx.call(sb[1])
	var end := e0 if dist[e0] + qb.distance_to(sb[0]) < dist[e1] + qb.distance_to(sb[1]) else e1
	var chain := []
	var k := end
	while k >= 0:
		chain.push_front(Vector3(nodes[k].x, 0, nodes[k].y))
		k = prev[k]
	return [pa[1]] + chain + [pb[1], b]
## Modelo principal y adornos de cada edificio: [ruta, tamaño o escala, posición local].
const LOOK := {
	"herreria": [["village/Blacksmith.glb", 1.7]],
	"telar": [["village/House_3.glb", 1.5], ["village/Bags.glb", 1.4, Vector3(3.2, 0, 2.6)], ["village/Crate.glb", 1.4, Vector3(-3, 0, 2.6)]],
	"curtiduria": [["village/House_1.glb", 1.6], ["village/Cauldron.glb", 1.6, Vector3(3, 0, 2.6)], ["village/Barrel.glb", 1.4, Vector3(-3, 0, 2.6)]],
	"queseria": [["village/House_2.glb", 1.5], ["village/Barrel.glb", 1.4, Vector3(3, 0, 2.6)], ["village/Barrel.glb", 1.4, Vector3(3.7, 0, 3.3)]],
	"cerveceria": [["village/Inn.glb", 1.4], ["village/Barrel.glb", 1.5, Vector3(4, 0, 3.2)], ["village/Barrel.glb", 1.5, Vector3(4.7, 0, 2.4)]],
	"establo": [["village/Stable.glb", 1.8], ["village/Hay.glb", 1.4, Vector3(-3.5, 0, 2.5)]],
	"granero": [["rts/Storage_FirstAge_Level2.glb", -7.0]],
	"capilla": [["rts/Temple_FirstAge_Level2.glb", -9.0]],
	"molino": [["village/Mill.glb", 1.6]],
	"cantera": [["nature/Rock_3.glb", 4.0], ["nature/Rock_5.glb", 3.0, Vector3(3.5, 0, 1.5)], ["village/Crate.glb", 1.4, Vector3(-3, 0, 2.6)]],
	"escuela": [["village/House_2.glb", 1.5], ["village/Bench_1.glb", 1.4, Vector3(3, 0, 2.8)], ["village/Bench_1.glb", 1.4, Vector3(-3, 0, 2.8)]],
	"hospital": [["village/House_4.glb", 1.6], ["village/Cauldron.glb", 1.4, Vector3(3.2, 0, 2.6)], ["village/Bench_1.glb", 1.4, Vector3(-3, 0, 2.8)]],
	"universidad": [["rts/Temple_FirstAge_Level3.glb", -9.0]],
	"puerto": [["rts/Market_FirstAge_Level2.glb", -8.5], ["village/Barrel.glb", 1.4, Vector3(4, 0, 3)], ["village/Crate.glb", 1.4, Vector3(-4, 0, 3)]],
	"castillo": [["castle/LargeTower.glb", 2.4], ["castle/TallWall.glb", 2.4, Vector3(3.6, 0, 0.4)], ["castle/TallWall.glb", 2.4, Vector3(-3.6, 0, 0.4)]],
}

var v
var nodes: Array = []
var sigs: Array = []
var mine_node: Node3D
var mine_sig := ""
var obstacles: Array = []
var cd := 0.0


func _ready() -> void:
	for p in SLOTS:
		nodes.append(null)
		sigs.append("")
		obstacles.append([Vector2(p.x, p.z), 4.2])
	obstacles.append([Vector2(MINE.x, MINE.z), 3.0])


func _face(p: Vector3) -> float:
	return face_street(p)


func _process(delta: float) -> void:
	cd -= delta
	var b = GS.data["buildings"]
	for i in SLOTS.size():
		var id: String = b.get(str(i), "")
		if id != sigs[i] or nodes[i] == null:
			sigs[i] = id
			_rebuild(i, id)
	var ms := str(GS.data["mine"])
	if ms != mine_sig:
		mine_sig = ms
		_rebuild_mine()


func _put_sized(parent: Node, path: String, pos: Vector3, rot: float, size: float) -> Node3D:
	var n := M.inst(path)
	if size < 0:
		var bb := M.aabb_of(n)
		n.scale = Vector3.ONE * (-size / maxf(bb.size.x, maxf(bb.size.y, bb.size.z)))
	else:
		n.scale = Vector3.ONE * size
	n.position = pos
	n.rotation.y = rot
	parent.add_child(n)
	return n


func _rebuild(i: int, id: String) -> void:
	if nodes[i]:
		nodes[i].queue_free()
	var root := Node3D.new()
	root.position = SLOTS[i]
	root.rotation.y = _face(SLOTS[i])
	add_child(root)
	nodes[i] = root
	var label := "Solar libre"
	if id == "":
		for o in [Vector3(-3, 0, -3), Vector3(3, 0, -3), Vector3(-3, 0, 3), Vector3(3, 0, 3)]:
			var post := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.08
			cm.bottom_radius = 0.1
			cm.height = 1.0
			post.mesh = cm
			post.material_override = M.flat(Color(0.45, 0.32, 0.2))
			post.position = o + Vector3(0, 0.5, 0)
			root.add_child(post)
		M.put(root, "village/Package_1.glb", Vector3(1, 0, 1), 0.4, 1.2)
		var patch := MeshInstance3D.new()
		var pm := BoxMesh.new()
		pm.size = Vector3(7.5, 0.04, 7.5)
		patch.mesh = pm
		patch.material_override = M.dirt(Color(0.46, 0.38, 0.27))
		patch.position = Vector3(0, 0.02, 0)
		root.add_child(patch)
		signboard(root, Vector3(3.4, 0, 4.6), "Solar libre")
	elif id == "colmenar":
		label = GS.BUILDINGS[id]["name"]
		for k in 6:
			var hive := MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = Vector3(0.6, 0.7, 0.6)
			hive.mesh = bm
			hive.material_override = M.flat(Color(0.78, 0.6, 0.3))
			hive.position = Vector3(-2.5 + (k % 3) * 2.5, 0.35, -1.2 + (k / 3) * 2.4)
			root.add_child(hive)
			var lid := MeshInstance3D.new()
			var lm := BoxMesh.new()
			lm.size = Vector3(0.75, 0.1, 0.75)
			lid.mesh = lm
			lid.material_override = M.flat(Color(0.4, 0.28, 0.16))
			lid.position = hive.position + Vector3(0, 0.4, 0)
			root.add_child(lid)
		M.put(root, "village/Bench_1.glb", Vector3(0, 0, 3), 0.0, 1.3)
	else:
		label = GS.BUILDINGS[id]["name"]
		if id in M.WORKSHOPS:
			M.workshop(root, id, Vector3.ZERO, 0.0, 1.15)
		for part in ([] if id in M.WORKSHOPS else LOOK[id]):
			var pos: Vector3 = (part[2] if part.size() > 2 else Vector3.ZERO) * 1.2
			var pn = _put_sized(root, part[0], pos, 0.0, part[1] * (1.2 if part[1] > 0 else 1.0))
			if id == "castillo" and pn != null:
				M.stone(pn, Color(0.52, 0.5, 0.46))
	if id != "":
		signboard(root, Vector3(3.4, 0, 5.4), label)
	var l := M.label3d(label, 42)
	l.position = Vector3(0, 2.2 if id == "" or id == "colmenar" else 7.5, 0)
	l.modulate = Color(1, 0.9, 0.6)
	l.visibility_range_end = 28.0
	root.add_child(l)


## Letrero de madera junto a la calle, con el nombre del oficio a la vista.
static func signboard(parent: Node3D, pos: Vector3, text: String) -> void:
	var E := preload("res://scripts/engines.gd")
	var n := Node3D.new()
	n.position = pos
	parent.add_child(n)
	var wood := Color(0.36, 0.24, 0.13)
	E._box(n, Vector3(0.14, 2.6, 0.14), Vector3(0, 1.3, 0), wood)
	E._box(n, Vector3(1.0, 0.1, 0.1), Vector3(-0.45, 2.5, 0), wood)
	E._box(n, Vector3(1.5, 0.62, 0.07), Vector3(-0.7, 2.05, 0), Color(0.55, 0.4, 0.22))
	var t := Label3D.new()
	t.text = text
	t.font_size = 46
	t.pixel_size = 0.0055
	t.outline_size = 0
	t.modulate = Color(0.16, 0.1, 0.04)
	t.double_sided = false
	t.width = 250.0
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.position = Vector3(-0.7, 2.05, 0.045)
	n.add_child(t)
	var t2 := t.duplicate()
	t2.position.z = -0.045
	t2.rotation.y = PI
	n.add_child(t2)


func _rebuild_mine() -> void:
	if mine_node:
		mine_node.queue_free()
	mine_node = Node3D.new()
	mine_node.position = MINE
	mine_node.rotation.y = _face(MINE)
	add_child(mine_node)
	if GS.data["mine"]:
		_tint_light(_put_sized(mine_node, "rts/Mine.glb", Vector3.ZERO, 0.0, -7.0))
	else:
		_tint_light(_put_sized(mine_node, "rts/Resource_Gold_1.glb", Vector3.ZERO, 0.0, -2.5))
	var l := M.label3d("Mina de hierro" if GS.data["mine"] else "Veta de hierro", 42)
	l.position = Vector3(0, 5.5 if GS.data["mine"] else 2.5, 0)
	l.modulate = Color(1, 0.9, 0.6)
	mine_node.add_child(l)


## Las rocas de estos modelos vienen casi blancas: se oscurecen a gris piedra.
func _tint_light(n: Node) -> void:
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var m = mi.get_active_material(i)
			if m is StandardMaterial3D and m.albedo_color.get_luminance() > 0.7:
				var mm: StandardMaterial3D = m.duplicate()
				mm.albedo_color = Color(0.45, 0.43, 0.4)
				mi.set_surface_override_material(i, mm)


# ---------------- Interacciones ----------------

func find_interaction(pp: Vector3) -> Dictionary:
	if pp.distance_to(MINE) < 5.0:
		return {"type": "mine", "label": "Extraer hierro (mantén E)" if GS.data["mine"] else "Abrir una mina (%s)" % GS.cost_text(GS.MINE_COST)}
	for i in SLOTS.size():
		if pp.distance_to(SLOTS[i]) < 5.5:
			var id: String = GS.data["buildings"].get(str(i), "")
			return {"type": "solar", "i": i, "label": "Solar libre: construir" if id == "" else GS.BUILDINGS[id]["name"]}
	return {}


func interact(it: Dictionary) -> void:
	match it["type"]:
		"mine":
			if GS.data["mine"]:
				mine_tick()
			else:
				v._open_panel("Veta de hierro", "Aquí asoma una veta de hierro. Abrir una mina cuesta %s.\nCon un pico (herrería) sacarás más hierro." % GS.cost_text(GS.MINE_COST), [
					["Abrir la mina", func():
						var err: String = GS.build_mine()
						if err != "":
							v._float(err, Color(1, 0.5, 0.4))
						v._close_panel(), GS.can_pay(GS.MINE_COST)],
					["Cerrar", v._close_panel]])
		"solar":
			var id: String = GS.data["buildings"].get(str(it["i"]), "")
			if id == "":
				build_panel(it["i"])
			else:
				workshop_panel(id)


func mine_tick() -> void:
	if cd > 0:
		return
	cd = 1.0
	v.player.play_once("Interact")
	SFX.play("picar")
	var pick: bool = "pico" in GS.data["tools"]
	GS.data["stone"] += 1
	if randf() < (0.6 if pick else 0.3):
		GS.add("hierro", 1)
		v._float("+1 hierro, +1 piedra", Color(0.8, 0.8, 0.9))
	else:
		v._float("+1 piedra", Color(0.85, 0.85, 0.9))


func build_panel(i: int) -> void:
	var opts := []
	for id in GS.BUILDINGS:
		if GS.has_building(id):
			continue
		var b = GS.BUILDINGS[id]
		opts.append(["%s — %s" % [b["name"], GS.cost_text(b["cost"])], func():
			var err: String = GS.construct(i, id)
			if err != "":
				v._float(err, Color(1, 0.5, 0.4))
			v._close_panel(), GS.can_pay(b["cost"]) and int(GS.data["tier"]) >= int(b.get("tier", 0))])
	var lines := ["Elige qué construir en este solar. Cada edificio solo se puede tener una vez.", ""]
	for id in GS.BUILDINGS:
		if not GS.has_building(id):
			lines.append("%s: %s" % [GS.BUILDINGS[id]["name"], GS.BUILDINGS[id]["desc"]])
	lines.append("")
	lines.append("Tienes %d madera, %d piedra y %d oro." % [int(GS.data["wood"]), int(GS.data["stone"]), int(GS.data["gold"])])
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Solar libre", "\n".join(lines), opts)


func workshop_panel(id: String) -> void:
	var b = GS.BUILDINGS[id]
	var opts := []
	var text: String = b["desc"]
	match id:
		"herreria":
			text += "\n\nTienes %d hierro, %d madera y %d piel curtida." % [GS.inv("hierro"), int(GS.data["wood"]), GS.inv("piel")]
			for r in GS.RECIPES["herreria"]:
				var owned: bool = r["tool"] in GS.data["tools"]
				opts.append(["%s — %s" % [GS.TOOLS[r["tool"]], "ya la tienes" if owned else GS.cost_text(r["in"])], func():
					v._float(GS.craft(r), Color(0.9, 0.9, 1.0))
					workshop_panel(id), not owned and GS.can_pay(r["in"])])
			for kind in ["weapon", "armor"]:
				var lvl := int(GS.data[kind])
				if lvl >= 3:
					continue
				var cost: Dictionary = GS.forge_cost(kind)
				opts.append(["Forjar %s nivel %d — %s" % ["espada" if kind == "weapon" else "armadura", lvl + 1, GS.cost_text(cost)], func():
					GS.pay(cost)
					GS.data[kind] += 1
					v._float("Equipo mejorado", Color(0.9, 0.9, 1.0))
					workshop_panel(id), GS.can_pay(cost)])
		"telar", "queseria", "cerveceria", "curtiduria":
			var r: Dictionary = GS.RECIPES[id][0]
			var ink: String = r["in"].keys()[0]
			var outk: String = r["out"].keys()[0]
			var times: int = GS.res(ink) / int(r["in"][ink])
			text += "\n\n%s → %s\nTienes %d %s y %d %s." % [GS.cost_text(r["in"]), GS.cost_text(r["out"]), GS.res(ink), String(GS.ITEMS[ink][0]).to_lower(), GS.res(outk), String(GS.ITEMS[outk][0]).to_lower()]
			opts.append(["Hacer una vez", func():
				v._float(GS.craft(r), Color(0.7, 1.0, 0.5))
				workshop_panel(id), times >= 1])
			opts.append(["Hacer todo (%d veces)" % times, func():
				v._float(GS.craft(r, times), Color(0.7, 1.0, 0.5))
				workshop_panel(id), times >= 1])
		"colmenar":
			var n := int(floor(float(GS.data["honey"])))
			text += "\n\nMiel lista para recoger: %d" % n
			opts.append(["Recoger miel", func():
				GS.add("miel", n)
				GS.data["honey"] = float(GS.data["honey"]) - n
				v._float("+%d miel" % n, Color(1, 0.85, 0.4))
				workshop_panel(id), n >= 1])
		"establo":
			text += "\n\nCapacidad del corral: %d gallinas, %d ovejas, %d cerdos, %d vacas." % [GS.animal_max("gallina"), GS.animal_max("oveja"), GS.animal_max("cerdo"), GS.animal_max("vaca")]
		"granero":
			text += "\n\nTus cosechas ya rinden más gracias al granero."
		"capilla":
			text += "\n\nEl párroco bendice a tu familia. El pueblo te respeta más cada estación.\nLos domingos por la mañana los vecinos vienen a misa."
			opts.append_array(GS.SOCIAL.priest_options(v))
	opts.append(["Cerrar", v._close_panel])
	v._open_panel(b["name"], text, opts)
