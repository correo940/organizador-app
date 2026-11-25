extends Node3D
## Economía del pueblo: parcelas, corral, huerto de manzanos, bayas, setas, estanque, caza, molino y horno.

const M := preload("res://scripts/models.gd")

const CORRAL := Vector3(43.5, 0, 23.5)
const CORRAL_HALF := Vector2(4.5, 3.0)
const POND := Vector3(98, 0, 62)
const POND_R := 7.0
const MILL := Vector3(87, 0, 44)
const OVEN := Vector3(66, 0, 29)
const COMMONS := Rect2(86.5, 48.5, 8, 5)
const CROP_SCALE := {"Wheat": 1.4, "Carrot": 0.5, "Beet": 0.5, "Lettuce": 0.5, "Pumpkin": 0.55}
const ANIMAL_MODEL := {
	"gallina": ["animals/Chicken.fbx", 0.45, "CharacterArmature|"],
	"oveja": ["animals/Sheep.fbx", 1.3, "Armature|"],
	"cerdo": ["animals/Pig.fbx", 1.3, "Armature|"],
	"vaca": ["animals/Cow.glb", 2.3, "AnimalArmature|"],
}

var v  # aldea (paneles, jugador, textos flotantes)
var fields: Array = []
var field_nodes: Array = []
var field_sigs: Array = []
var apples: Array = []
var berries: Array = []
var mushrooms: Array = []
var deer: Array = []
var corral_animals: Array = []
var corral_sig := ""
var fish_nodes: Array = []
var pick_sig := ""
var obstacles: Array = []
var fish_cd := 0.0
var commons_node: Node3D


func _ready() -> void:
	var r := RandomNumberGenerator.new()
	r.seed = 777
	for i in 3:
		for j in 2:
			fields.append(Rect2(90 + j * 9.5, 12.5 + i * 8.5, 8.5, 7))
	for i in fields.size():
		field_nodes.append(null)
		field_sigs.append("")
	for i in 8:
		apples.append({"id": "manzano%d" % i, "p": Vector3(41 + (i % 4) * 3.2, 0, 64 + (i / 4) * 4.0)})
	for i in 10:
		berries.append({"id": "bayas%d" % i, "p": Vector3(r.randf_range(33, 36.5), 0, 8 + i * 3.8)})
	for i in 14:
		mushrooms.append({"id": "setas%d" % i, "p": Vector3(r.randf_range(5, 30), 0, r.randf_range(5, 44)), "k": 1 + i % 3})
	for a in apples:
		obstacles.append([Vector2(a["p"].x, a["p"].z), 0.7])
	obstacles.append([Vector2(POND.x, POND.z), POND_R + 0.3])
	obstacles.append([Vector2(MILL.x, MILL.z), 3.0])
	obstacles.append([Vector2(OVEN.x, OVEN.z), 1.6])
	_build_static()
	for i in 6:
		_spawn_deer({}, r)


func _build_static() -> void:
	# Corral con cerca.
	var probe := M.inst("village/Fence.glb")
	var flen: float = M.aabb_of(probe).size.x * 1.3
	probe.free()
	for side in [-1, 1]:
		var nx := ceili(CORRAL_HALF.x * 2 / flen)
		for k in nx:
			M.put(self, "village/Fence.glb", CORRAL + Vector3(-CORRAL_HALF.x + flen * (k + 0.5), 0, side * CORRAL_HALF.y), 0, 1.3)
		var nz := ceili(CORRAL_HALF.y * 2 / flen)
		for k in nz:
			if side == 1 and k == nz / 2:
				continue  # puerta
			M.put(self, "village/Fence.glb", CORRAL + Vector3(side * CORRAL_HALF.x, 0, -CORRAL_HALF.y + flen * (k + 0.5)), PI / 2, 1.3)
	M.put(self, "village/Hay.glb", CORRAL + Vector3(-3.3, 0, -2.0), 0.4, 1.2)
	var sign_l := M.label3d("Corral", 40)
	sign_l.position = CORRAL + Vector3(0, 2.6, -CORRAL_HALF.y)
	sign_l.modulate = Color(1, 0.9, 0.6)
	add_child(sign_l)
	# Estanque.
	var shore := MeshInstance3D.new()
	var sc := CylinderMesh.new()
	sc.top_radius = POND_R + 1.2
	sc.bottom_radius = POND_R + 1.2
	sc.height = 0.04
	shore.mesh = sc
	shore.material_override = M.flat(Color(0.42, 0.38, 0.27))
	shore.position = POND + Vector3(0, 0.02, 0)
	add_child(shore)
	var water := MeshInstance3D.new()
	var wc := CylinderMesh.new()
	wc.top_radius = POND_R
	wc.bottom_radius = POND_R
	wc.height = 0.05
	water.mesh = wc
	var wm := StandardMaterial3D.new()
	wm.albedo_color = Color(0.05, 0.16, 0.22, 0.85)
	wm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	wm.roughness = 0.05
	wm.metallic_specular = 0.25
	water.material_override = wm
	water.position = POND + Vector3(0, 0.09, 0)
	add_child(water)
	for i in 4:
		var f := _animated("fish/Fish%d.glb" % (1 + i % 3), 0.45, "Armature|Swim")
		fish_nodes.append({"n": f, "a": randf() * TAU, "r": randf_range(2, POND_R - 1.5), "s": randf_range(0.3, 0.6)})
	for i in 5:
		var a := float(i) / 5.0 * TAU
		M.put(self, "nature/Rock_Moss_%d.glb" % (1 + i), POND + Vector3(cos(a), 0, sin(a)) * (POND_R + 1.0), randf() * TAU, 0.9)
	var pl := M.label3d("Estanque", 40)
	pl.position = POND + Vector3(0, 2.5, 0)
	pl.modulate = Color(0.8, 0.9, 1.0)
	add_child(pl)
	# Molino y horno.
	M.put(self, "village/Mill.glb", MILL, -PI / 2, 1.6)
	var ml := M.label3d("Molino", 40)
	ml.position = MILL + Vector3(0, 7.5, 0)
	ml.modulate = Color(1, 0.9, 0.6)
	add_child(ml)
	var dome := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 1.4
	sm.height = 1.4
	sm.is_hemisphere = true
	dome.mesh = sm
	dome.material_override = M.flat(Color(0.6, 0.5, 0.42))
	dome.position = OVEN
	add_child(dome)
	var mouth := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.6, 0.5, 0.3)
	mouth.mesh = bm
	mouth.material_override = M.flat(Color(0.12, 0.08, 0.06))
	mouth.position = OVEN + Vector3(0, 0.25, -1.25)
	add_child(mouth)
	M.put(self, "village/Package_1.glb", OVEN + Vector3(1.8, 0, -0.5), 0.3, 1.3)
	M.put(self, "village/Bench_1.glb", OVEN + Vector3(-2.2, 0, -0.3), PI / 2, 1.3)
	var ol := M.label3d("Horno", 40)
	ol.position = OVEN + Vector3(0, 2.4, 0)
	ol.modulate = Color(1, 0.9, 0.6)
	add_child(ol)
	# Suelo de las parcelas.
	for f in fields:
		var soil := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = Vector3(f.size.x, 0.06, f.size.y)
		soil.mesh = b
		soil.material_override = M.flat(Color(0.33, 0.24, 0.15))
		soil.position = Vector3(f.get_center().x, 0.02, f.get_center().y)
		add_child(soil)


func _animated(path: String, size: float, anim: String) -> Node3D:
	var n := M.inst(path)
	var bb := M.aabb_of(n)
	n.scale = Vector3.ONE * (size / maxf(bb.size.x, maxf(bb.size.y, bb.size.z)))
	add_child(n)
	var ap: AnimationPlayer = n.find_child("AnimationPlayer", true, false)
	if ap and ap.has_animation(anim):
		ap.get_animation(anim).loop_mode = Animation.LOOP_LINEAR
		ap.play(anim)
		ap.seek(randf() * 2.0, true)
	return n


func _play(n: Node, anim: String, loop := true) -> void:
	var ap: AnimationPlayer = n.find_child("AnimationPlayer", true, false)
	if ap and ap.has_animation(anim) and ap.current_animation != anim:
		if loop:
			ap.get_animation(anim).loop_mode = Animation.LOOP_LINEAR
		ap.play(anim, 0.2)


# ---------------- Actualización ----------------

func _process(delta: float) -> void:
	var d = GS.data
	for i in fields.size():
		var f = d["fields"][i]
		var sig := "%s-%s-%d" % [f["owned"], f["crop"], GS.field_stage(f)]
		if sig != field_sigs[i]:
			field_sigs[i] = sig
			_rebuild_field(i)
	var ps := str(GS.season_index()) + str(d["picked"].size()) + str(d["picked"].hash())
	if ps != pick_sig:
		pick_sig = ps
		_rebuild_pickables()
	var cs := str(d["animals"])
	if cs != corral_sig:
		corral_sig = cs
		_rebuild_corral()
	for fn in fish_nodes:
		fn["a"] += fn["s"] * delta
		fn["n"].position = POND + Vector3(cos(fn["a"]), 0, sin(fn["a"])) * fn["r"] + Vector3(0, 0.04, 0)
		fn["n"].rotation.y = -fn["a"]
	fish_cd -= delta
	if v.panel.visible:
		return
	for c in corral_animals:
		var n: Node3D = c["n"]
		var to: Vector3 = c["t"] - n.position
		if to.length() < 0.2:
			_play(n, c["idle"])
			if randf() < 0.004:
				c["t"] = CORRAL + Vector3(randf_range(-CORRAL_HALF.x + 0.8, CORRAL_HALF.x - 0.8), 0, randf_range(-CORRAL_HALF.y + 0.8, CORRAL_HALF.y - 0.8))
		else:
			n.position += to.normalized() * minf(to.length(), 0.6 * delta)
			n.rotation.y = atan2(to.x, to.z)
			_play(n, c["walk"])
	_update_deer(delta)


func _rebuild_field(i: int) -> void:
	if field_nodes[i]:
		field_nodes[i].queue_free()
	var node := Node3D.new()
	add_child(node)
	field_nodes[i] = node
	var r: Rect2 = fields[i]
	var f = GS.data["fields"][i]
	if not f["owned"]:
		var l := M.label3d("Parcela en venta (%d oro)" % GS.FIELD_PRICE, 36)
		l.position = Vector3(r.get_center().x, 1.5, r.get_center().y)
		node.add_child(l)
		return
	if f["crop"] == "":
		return
	make_patch(node, r, GS.CROPS[f["crop"]]["model"], GS.field_stage(f))


## Siembra visual: una cuadrícula de plantas del modelo y fase indicados.
func make_patch(node: Node3D, r: Rect2, model: String, stage: int) -> void:
	var src := M.inst("crops/%s_%d.glb" % [model, stage])
	var pts := []
	var x := r.position.x + 0.6
	while x < r.end.x - 0.4:
		var z := r.position.y + 0.6
		while z < r.end.y - 0.4:
			pts.append(Vector3(x + randf_range(-0.12, 0.12), 0.05, z))
			z += 0.8 if model == "Wheat" else 1.1
		x += 1.0
	var bb := M.aabb_of(src)
	var s: float = CROP_SCALE[model] / maxf(bb.size.y, 0.01)
	for mi in src.find_children("*", "MeshInstance3D", true, false):
		var local: Transform3D = _local_xf(mi, src)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mi.mesh
		mm.instance_count = pts.size()
		for k in pts.size():
			var basis := Basis(Vector3.UP, randf() * TAU).scaled(Vector3.ONE * s * randf_range(0.85, 1.1))
			mm.set_instance_transform(k, Transform3D(basis, pts[k]) * local)
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		node.add_child(mmi)
	src.free()


func _local_xf(n: Node, root: Node) -> Transform3D:
	var t := Transform3D()
	while n != null and n != root:
		if n is Node3D:
			t = n.transform * t
		n = n.get_parent()
	return t


func _rebuild_pickables() -> void:
	for group in [apples, berries, mushrooms]:
		for p in group:
			if p.has("n") and is_instance_valid(p["n"]):
				p["n"].queue_free()
			p.erase("n")
	var s := int(GS.data["season"])
	for a in apples:
		var ripe := s in [1, 2] and GS.can_pick(a["id"])
		a["n"] = M.put(self, "crops/%s.glb" % ("Apple_4" if ripe else "Apple_Harvested"), a["p"], 0.0, 1.6)
	for b in berries:
		var ripe := s in [0, 1] and GS.can_pick(b["id"])
		b["n"] = M.put(self, "crops/%s.glb" % ("BushBerries_4" if ripe else "BushBerries_Harvested"), b["p"], 0.0, 1.4)
	for m in mushrooms:
		if s in [0, 2] and GS.can_pick(m["id"]):
			m["n"] = M.put(self, "crops/Mushroom_%d.glb" % m["k"], m["p"], randf() * TAU, 0.9)
	# Huerta comunal de los agricultores del pueblo.
	if commons_node:
		commons_node.queue_free()
	commons_node = Node3D.new()
	add_child(commons_node)
	var soil := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(COMMONS.size.x, 0.06, COMMONS.size.y)
	soil.mesh = bm
	soil.material_override = M.flat(Color(0.33, 0.24, 0.15))
	soil.position = Vector3(COMMONS.get_center().x, 0.02, COMMONS.get_center().y)
	commons_node.add_child(soil)
	if s != 3:
		make_patch(commons_node, COMMONS, "Wheat", [2, 3, 4][s])
	var cl := M.label3d("Huerta comunal", 36)
	cl.position = Vector3(COMMONS.get_center().x, 2.0, COMMONS.get_center().y)
	commons_node.add_child(cl)


func _rebuild_corral() -> void:
	for c in corral_animals:
		c["n"].queue_free()
	corral_animals.clear()
	for k in ["vaca", "oveja", "cerdo", "gallina"]:
		var info: Array = ANIMAL_MODEL[k]
		for i in mini(int(GS.data["animals"][k]), 6):
			var n := _animated(info[0], info[1], info[2] + "Idle")
			n.position = CORRAL + Vector3(randf_range(-3.5, 3.5), 0, randf_range(-2.2, 2.2))
			n.rotation.y = randf() * TAU
			var walk: String = info[2] + "Walk"
			var ap: AnimationPlayer = n.find_child("AnimationPlayer", true, false)
			if ap and not ap.has_animation(walk):
				walk = info[2] + "Idle"
			corral_animals.append({"n": n, "t": n.position, "idle": info[2] + "Idle", "walk": walk})


# ---------------- Caza ----------------

func _spawn_deer(dd: Dictionary, r = null) -> void:
	var stag := randf() < 0.35
	var n := _animated("animals/%s.glb" % ("Stag" if stag else "Deer"), 1.9 if stag else 1.7, "AnimalArmature|Idle")
	n.position = Vector3(randf_range(5, 30), 0, randf_range(5, 44))
	if dd.is_empty():
		deer.append({"n": n, "stag": stag, "state": "idle", "t": n.position, "timer": 0.0, "dead": false})
	else:
		dd["n"].queue_free()
		dd["n"] = n
		dd["stag"] = stag
		dd["state"] = "idle"
		dd["t"] = n.position
		dd["dead"] = false


func _update_deer(delta: float) -> void:
	var pp: Vector3 = v.player.position
	for d in deer:
		var n: Node3D = d["n"]
		if d["dead"]:
			d["timer"] -= delta * GS.speed
			if d["timer"] <= 0:
				_spawn_deer(d)
			continue
		var away: Vector3 = n.position - pp
		away.y = 0
		if away.length() < 9.0 and d["state"] != "flee":
			d["state"] = "flee"
			d["timer"] = 3.0
		if d["state"] == "flee":
			d["timer"] -= delta
			var dir := away.normalized()
			n.position += dir * 6.4 * delta
			n.position.x = clampf(n.position.x, 2, 118)
			n.position.z = clampf(n.position.z, 2, 78)
			n.rotation.y = atan2(dir.x, dir.z)
			_play(n, "AnimalArmature|Gallop")
			if d["timer"] <= 0:
				d["state"] = "idle"
				d["t"] = n.position
			continue
		var to: Vector3 = d["t"] - n.position
		if to.length() < 0.3:
			_play(n, "AnimalArmature|Eating")
			if randf() < 0.003:
				d["t"] = Vector3(clampf(n.position.x + randf_range(-8, 8), 3, 31), 0, clampf(n.position.z + randf_range(-8, 8), 3, 46))
		else:
			n.position += to.normalized() * minf(to.length(), 1.2 * delta)
			n.rotation.y = atan2(to.x, to.z)
			_play(n, "AnimalArmature|Walk")


# ---------------- Interacciones ----------------

func find_interaction(pp: Vector3) -> Dictionary:
	var d = GS.data
	var s := int(d["season"])
	for i in deer.size():
		if not deer[i]["dead"] and pp.distance_to(deer[i]["n"].position) < 2.6:
			return {"type": "deer", "i": i, "label": "Cazar %s" % ("ciervo" if deer[i]["stag"] else "cierva")}
	if Vector2(pp.x - CORRAL.x, pp.z - CORRAL.z).length() < 6.0:
		return {"type": "corral", "label": "Corral"}
	if pp.distance_to(MILL) < 5.0:
		return {"type": "mill", "label": "Molino"}
	if pp.distance_to(OVEN) < 3.2:
		return {"type": "oven", "label": "Horno"}
	var dp := pp.distance_to(POND)
	if dp < POND_R + 2.8:
		return {"type": "fish", "label": "Pescar (mantén E)", "p": POND}
	for a in apples:
		if pp.distance_to(a["p"]) < 2.0 and s in [1, 2] and GS.can_pick(a["id"]):
			return {"type": "pick", "id": a["id"], "item": "manzana", "n": [3, 5], "label": "Coger manzanas", "p": a["p"]}
	for b in berries:
		if pp.distance_to(b["p"]) < 1.8 and s in [0, 1] and GS.can_pick(b["id"]):
			return {"type": "pick", "id": b["id"], "item": "bayas", "n": [2, 4], "label": "Coger bayas", "p": b["p"]}
	for m in mushrooms:
		if pp.distance_to(m["p"]) < 1.5 and s in [0, 2] and GS.can_pick(m["id"]):
			return {"type": "pick", "id": m["id"], "item": "setas", "n": [2, 3], "label": "Coger setas", "p": m["p"]}
	for i in fields.size():
		if fields[i].has_point(Vector2(pp.x, pp.z)):
			var f = d["fields"][i]
			var label: String
			if not f["owned"]:
				label = "Comprar parcela (%d oro)" % GS.FIELD_PRICE
			elif f["crop"] == "":
				label = "Sembrar"
			elif GS.field_ready(f):
				label = "Cosechar %s" % String(GS.CROPS[f["crop"]]["name"]).to_lower()
			else:
				label = "%s creciendo (día %d de %d)" % [GS.CROPS[f["crop"]]["name"], int(f["age"]), int(GS.CROPS[f["crop"]]["days"])]
			return {"type": "field", "i": i, "label": label}
	return {}


func interact(it: Dictionary) -> void:
	match it["type"]:
		"deer":
			_hunt(it["i"])
		"corral":
			corral_panel()
		"mill":
			mill_panel()
		"oven":
			oven_panel()
		"fish":
			fish()
		"pick":
			var n := randi_range(it["n"][0], it["n"][1])
			GS.add(it["item"], n)
			GS.mark_picked(it["id"])
			v.player.play_once("Interact")
			SFX.play("cosecha")
			v._float("+%d %s" % [n, String(GS.ITEMS[it["item"]][0]).to_lower()], Color(0.7, 1.0, 0.5))
		"field":
			_field(it["i"])


func fish() -> void:
	if fish_cd > 0:
		return
	if not "caña" in GS.data["tools"]:
		fish_cd = 1.5
		v._float("Necesitas una caña de pescar (mercado)", Color(1, 0.6, 0.5))
		return
	fish_cd = 1.4
	v.player.play_once("Interact")
	if randf() < 0.35:
		GS.add("pescado", 1)
		v._float("+1 pescado", Color(0.6, 0.85, 1.0))
	else:
		v._float("...", Color(0.8, 0.8, 0.8))


func _hunt(i: int) -> void:
	var d = deer[i]
	d["dead"] = true
	d["timer"] = 2.0 * GS.SECONDS_PER_DAY
	_play(d["n"], "AnimalArmature|Death", false)
	var meat := 6 if d["stag"] else 4
	GS.add("carne", meat)
	GS.add("cuero", 1)
	v.player.play_once("Sword_Attack" if int(GS.data["weapon"]) >= 1 else "Interact")
	v._float("+%d carne, +1 cuero" % meat, Color(1, 0.75, 0.6))


func _field(i: int) -> void:
	var f = GS.data["fields"][i]
	if not f["owned"]:
		v._open_panel("Parcela en venta", "Una parcela de cultivo propia cuesta %d de oro.\nTu oro: %d" % [GS.FIELD_PRICE, int(GS.data["gold"])], [
			["Comprar parcela", func():
				var err: String = GS.buy_field(i)
				if err != "":
					v._float(err, Color(1, 0.5, 0.4))
				v._close_panel(), GS.data["gold"] >= GS.FIELD_PRICE],
			["Cerrar", v._close_panel]])
	elif f["crop"] == "":
		var opts := []
		for k in GS.CROPS:
			var c = GS.CROPS[k]
			opts.append(["Sembrar %s — semillas %d oro, %d días" % [String(c["name"]).to_lower(), int(c["seed"]), int(c["days"])], func():
				var err: String = GS.plant(i, k)
				if err != "":
					v._float(err, Color(1, 0.5, 0.4))
				else:
					v.player.play_once("Interact")
				v._close_panel(), int(GS.data["season"]) != 3 and GS.data["gold"] >= c["seed"]])
		opts.append(["Cerrar", v._close_panel])
		var text := "¿Qué quieres sembrar? Los cultivos crecen un día cada día (no en invierno).\nLo que no coseches antes del invierno se lo lleva la helada."
		if int(GS.data["season"]) == 3:
			text = "En invierno la tierra está helada. Espera a la primavera."
		v._open_panel("Sembrar", text, opts)
	elif GS.field_ready(f):
		var res: String = GS.harvest(i)
		SFX.play("cosecha")
		v.player.play_once("Interact")
		v._float(res, Color(0.7, 1.0, 0.5))
	else:
		v._float("Todavía está creciendo", Color.WHITE)


func corral_panel() -> void:
	var d = GS.data
	var an = d["animals"]
	var lines := []
	for k in GS.ANIMALS:
		lines.append("%s: %d / %d" % [GS.ANIMALS[k]["name"], int(an[k]), GS.animal_max(k)])
	var waiting := []
	for k in d["barn"]:
		if int(floor(float(d["barn"][k]))) > 0:
			waiting.append("%d %s" % [int(floor(float(d["barn"][k]))), String(GS.ITEMS[k][0]).to_lower()])
	lines.append("")
	lines.append("Para recoger: " + (", ".join(waiting) if not waiting.is_empty() else "nada"))
	lines.append("")
	lines.append("En invierno los animales comen trigo o remolacha (%.1f al día)." % GS._feed_need())
	lines.append("Gallinas, ovejas y cerdos crían si tienes al menos dos.")
	var opts := [["Recoger productos", func():
		var res: String = GS.collect_barn()
		v._float(res if res != "" else "No hay nada que recoger", Color(0.7, 1.0, 0.5))
		corral_panel(), not waiting.is_empty()]]
	opts.append(["Sacrificar un cerdo (+6 carne, +1 cuero)", func():
		v._float(GS.slaughter_pig(), Color(1, 0.75, 0.6))
		corral_panel(), int(an["cerdo"]) > 0])
	for k in GS.ANIMALS:
		var a = GS.ANIMALS[k]
		opts.append(["Comprar %s (%d oro)" % [String(a["name"]).to_lower().trim_suffix("s"), int(a["price"])], func():
			var err: String = GS.buy_animal(k)
			if err != "":
				v._float(err, Color(1, 0.5, 0.4))
			corral_panel(), d["gold"] >= a["price"] and int(an[k]) < GS.animal_max(k)])
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Corral", "\n".join(lines), opts)


func mill_panel() -> void:
	var n := GS.inv("trigo")
	v._open_panel("Molino", "El molinero muele tu trigo a cambio de una parte.\n5 trigo → 4 harina.\n\nTienes %d trigo y %d harina." % [n, GS.inv("harina")], [
		["Moler 5 trigo", func():
			GS.take("trigo", 5)
			GS.add("harina", 4)
			mill_panel(), n >= 5],
		["Moler todo el trigo", func():
			var k := GS.inv("trigo") / 5
			GS.take("trigo", k * 5)
			GS.add("harina", k * 4)
			mill_panel(), n >= 5],
		["Cerrar", v._close_panel]])


func oven_panel() -> void:
	var h := GS.inv("harina")
	var w := int(GS.data["wood"])
	v._open_panel("Horno", "2 harina + 1 madera → 3 panes (cada pan da 3 raciones).\n\nTienes %d harina, %d madera y %d panes." % [h, w, GS.inv("pan")], [
		["Hornear pan", func():
			GS.take("harina", 2)
			GS.data["wood"] -= 1
			GS.add("pan", 3)
			oven_panel(), h >= 2 and w >= 1],
		["Cerrar", v._close_panel]])


## Mercado: compra y venta de todo lo que produce el pueblo.
func market_panel() -> void:
	SFX.play("monedas", -6.0)
	var d = GS.data
	var grid := GridContainer.new()
	grid.columns = 5
	grid.add_theme_constant_override("h_separation", 10)
	for h in ["Producto", "Tienes", "", "", ""]:
		var l := Label.new()
		l.text = h
		l.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
		grid.add_child(l)
	for k in GS.ITEMS:
		var it: Array = GS.ITEMS[k]
		var sell: int = int(round(it[1] * GS.CHAR.sell_mult() * GS.TL.sell_mult()))
		var buy := int(ceil(it[1] * 1.6 * GS.TL.buy_mult()))
		var name_l := Label.new()
		name_l.text = "%s%s" % [it[0], " (%d rac.)" % it[2] if it[2] > 0 else ""]
		grid.add_child(name_l)
		var have := Label.new()
		have.text = str(GS.inv(k))
		grid.add_child(have)
		grid.add_child(_btn("Vender 1 (+%d)" % sell, func():
			GS.take(k, 1)
			d["gold"] += sell
			market_panel(), GS.inv(k) >= 1))
		grid.add_child(_btn("Vender 5 (+%d)" % (sell * 5), func():
			GS.take(k, 5)
			d["gold"] += sell * 5
			market_panel(), GS.inv(k) >= 5))
		grid.add_child(_btn("Comprar 1 (-%d)" % buy, func():
			d["gold"] -= buy
			GS.add(k, 1)
			market_panel(), d["gold"] >= buy))
	for res in [["wood", "Madera", 1], ["stone", "Piedra", 1]]:
		var l := Label.new()
		l.text = res[1]
		grid.add_child(l)
		var have := Label.new()
		have.text = str(int(d[res[0]]))
		grid.add_child(have)
		grid.add_child(_btn("Vender 10 (+%d)" % (res[2] * 7), func():
			d[res[0]] -= 10
			d["gold"] += res[2] * 7
			market_panel(), d[res[0]] >= 10))
		grid.add_child(Control.new())
		grid.add_child(_btn("Comprar 10 (-%d)" % (res[2] * 14), func():
			d[res[0]] += 10
			d["gold"] -= res[2] * 14
			market_panel(), d["gold"] >= res[2] * 14))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(760, 380)
	scroll.add_child(grid)
	var extra := VBoxContainer.new()
	extra.add_child(scroll)
	var w := int(d["weapon"])
	var a := int(d["armor"])
	var row := HBoxContainer.new()
	if not "caña" in d["tools"]:
		row.add_child(_btn("Caña de pescar (-6)", func():
			d["gold"] -= 6
			d["tools"].append("caña")
			market_panel(), d["gold"] >= 6))
	if not d.get("horse", false):
		row.add_child(_btn("Caballo (-150)", func():
			d["gold"] -= 150
			d["horse"] = true
			d["riding"] = true
			v._float("¡Tienes caballo! Pulsa H para montar o desmontar.", Color(1, 0.9, 0.6))
			market_panel(), d["gold"] >= 150))
	row.add_child(_btn("Armero…", func(): GS.CHAR.armory(v, market_panel)))
	if not d.get("falcon", false):
		row.add_child(_btn("Halcón de caza (-100)", func():
			d["gold"] -= 100
			d["falcon"] = true
			v._float("Tienes un halcón: suéltalo en el bosque y sal de cetrería con los nobles.", Color(1, 0.9, 0.6))
			market_panel(), d["gold"] >= 100))
	if w < 3:
		row.add_child(_btn("Espada nivel %d (-%d)" % [w + 1, 25 * (w + 1)], func():
			d["gold"] -= 25 * (w + 1)
			d["weapon"] += 1
			market_panel(), d["gold"] >= 25 * (w + 1)))
	if a < 3:
		row.add_child(_btn("Armadura nivel %d (-%d)" % [a + 1, 25 * (a + 1)], func():
			d["gold"] -= 25 * (a + 1)
			d["armor"] += 1
			market_panel(), d["gold"] >= 25 * (a + 1)))
	extra.add_child(row)
	v._open_custom(("¡Día de mercado! Mejores precios · " if GS.TL.market_day() else "") + "Mercado — Oro: %d" % int(d["gold"]), extra)


func _btn(text: String, cb: Callable, enabled := true) -> Button:
	var b := Button.new()
	b.text = text
	b.disabled = not enabled
	b.pressed.connect(cb)
	return b


func inventory_panel() -> void:
	var d = GS.data
	var lines := ["Oro %d · Madera %d · Piedra %d" % [int(d["gold"]), int(d["wood"]), int(d["stone"])], "", "Comida total: %d raciones (tu familia come %d al día)" % [GS.food_total(), GS.family_size()], ""]
	for k in GS.ITEMS:
		if GS.inv(k) > 0:
			lines.append("%s: %d" % [GS.ITEMS[k][0], GS.inv(k)])
	lines.append("")
	var an := []
	for k in GS.ANIMALS:
		if int(d["animals"][k]) > 0:
			an.append("%d %s" % [int(d["animals"][k]), String(GS.ANIMALS[k]["name"]).to_lower()])
	lines.append("Animales: " + (", ".join(an) if not an.is_empty() else "ninguno"))
	var owned := 0
	for f in d["fields"]:
		if f["owned"]:
			owned += 1
	lines.append("Parcelas: %d de %d" % [owned, d["fields"].size()])
	var tl := []
	for t in d["tools"]:
		tl.append(GS.TOOLS[t])
	lines.append("Herramientas: " + (", ".join(tl) if not tl.is_empty() else "ninguna"))
	var bl := []
	for id in d["buildings"].values():
		bl.append(GS.BUILDINGS[id]["name"])
	if d["mine"]:
		bl.append("Mina")
	lines.append("Edificios: " + (", ".join(bl) if not bl.is_empty() else "ninguno"))
	v._open_panel("Inventario", "\n".join(lines), [["Cerrar", v._close_panel]])
