extends Node3D
## Solares de construcción, talleres del pueblo y mina de hierro.

const M := preload("res://scripts/models.gd")

const PLAZA := Vector3(60, 0, 40)
const SLOTS := [Vector3(42, 0, 40), Vector3(40, 0, 60), Vector3(40, 0, 7), Vector3(54, 0, 7), Vector3(66, 0, 7), Vector3(84, 0, 7), Vector3(66, 0, 72), Vector3(78, 0, 72)]
const MINE := Vector3(22, 0, 50)
## Modelo principal y adornos de cada edificio: [ruta, tamaño o escala, posición local].
const LOOK := {
	"herreria": [["village/Blacksmith.glb", 1.7]],
	"telar": [["village/House_3.glb", 1.5], ["village/Bags.glb", 1.4, Vector3(3.2, 0, 2.6)], ["village/Crate.glb", 1.4, Vector3(-3, 0, 2.6)]],
	"curtiduria": [["village/House_1.glb", 1.6], ["village/Cauldron.glb", 1.6, Vector3(3, 0, 2.6)], ["village/Barrel.glb", 1.4, Vector3(-3, 0, 2.6)]],
	"queseria": [["village/House_2.glb", 1.5], ["village/Barrel.glb", 1.4, Vector3(3, 0, 2.6)], ["village/Barrel.glb", 1.4, Vector3(3.7, 0, 3.3)]],
	"cerveceria": [["village/Inn.glb", 1.4], ["village/Barrel.glb", 1.5, Vector3(4, 0, 3.2)], ["village/Barrel.glb", 1.5, Vector3(4.7, 0, 2.4)]],
	"establo": [["village/Stable.glb", 1.8], ["village/Hay.glb", 1.4, Vector3(-3.5, 0, 2.5)]],
	"granero": [["rts/Storage_FirstAge_Level2.glb", -8.0]],
	"capilla": [["rts/Temple_FirstAge_Level2.glb", -10.0]],
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
		obstacles.append([Vector2(p.x, p.z), 3.0])
	obstacles.append([Vector2(MINE.x, MINE.z), 3.0])


func _face(p: Vector3) -> float:
	return atan2(PLAZA.x - p.x, PLAZA.z - p.z)


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
		for part in LOOK[id]:
			var pos: Vector3 = part[2] if part.size() > 2 else Vector3.ZERO
			_put_sized(root, part[0], pos, 0.0, part[1])
	var l := M.label3d(label, 42)
	l.position = Vector3(0, 2.2 if id == "" or id == "colmenar" else 7.5, 0)
	l.modulate = Color(1, 0.9, 0.6)
	root.add_child(l)


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
			v._close_panel(), GS.can_pay(b["cost"])])
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
			text += "\n\nEl párroco bendice a tu familia. El pueblo te respeta más cada estación."
	opts.append(["Cerrar", v._close_panel])
	v._open_panel(b["name"], text, opts)
