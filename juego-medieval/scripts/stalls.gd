extends RefCounted
## Puestos de los vecinos en la plaza: quien quiere vender monta su puesto y lo va mejorando
## (1 manta en el suelo, 2 puesto con toldo, 3 tienda de madera).

const M := preload("res://scripts/models.gd")
const E := preload("res://scripts/engines.gd")

const LEVELS := ["", "manta", "puesto", "tienda"]
## Huecos alrededor de la plaza (60, 40), entre las bocacalles: [posición, hacia dónde mira].
const SLOTS := [
	[Vector3(54.8, 0, 31.9), Vector3(0, 0, 1)], [Vector3(65.2, 0, 31.9), Vector3(0, 0, 1)],
	[Vector3(54.8, 0, 48.1), Vector3(0, 0, -1)], [Vector3(65.2, 0, 48.1), Vector3(0, 0, -1)],
	[Vector3(51.9, 0, 35.0), Vector3(1, 0, 0)], [Vector3(51.9, 0, 45.0), Vector3(1, 0, 0)],
	[Vector3(68.1, 0, 35.0), Vector3(-1, 0, 0)], [Vector3(68.1, 0, 45.0), Vector3(-1, 0, 0)],
]
## Qué vende cada oficio: nombre del puesto, modelos y colores de la mercancía.
const GOODS := {
	"agricultor": ["verduras", ["crops/Carrot_4.glb", "crops/Pumpkin_4.glb", "crops/Lettuce_4.glb"], []],
	"pescador": ["pescado", ["fish/Fish1.glb", "fish/Fish2.glb", "fish/Fish3.glb"], []],
	"cazador": ["carne y pieles", [], [Color(0.55, 0.2, 0.15), Color(0.5, 0.35, 0.2), Color(0.45, 0.3, 0.18)]],
	"pastor": ["lana y queso", [], [Color(0.95, 0.95, 0.9), Color(0.95, 0.82, 0.4), Color(0.9, 0.9, 0.85)]],
	"panadero": ["pan", [], [Color(0.75, 0.5, 0.25), Color(0.68, 0.45, 0.22), Color(0.8, 0.58, 0.3)]],
	"tejedor": ["telas", [], [Color(0.6, 0.15, 0.12), Color(0.2, 0.3, 0.6), Color(0.85, 0.8, 0.6)]],
	"molinero": ["harina", [], [Color(0.95, 0.93, 0.85), Color(0.9, 0.88, 0.8), Color(0.92, 0.9, 0.82)]],
	"carpintero": ["muebles", [], [Color(0.5, 0.33, 0.18), Color(0.45, 0.3, 0.16), Color(0.55, 0.37, 0.2)]],
	"curtidor": ["pieles curtidas", [], [Color(0.55, 0.38, 0.22), Color(0.5, 0.33, 0.2), Color(0.6, 0.42, 0.25)]],
	"sastre": ["ropa de abrigo", [], [Color(0.45, 0.2, 0.15), Color(0.25, 0.3, 0.45), Color(0.5, 0.45, 0.3)]],
	"cervecero": ["cerveza", [], [Color(0.55, 0.35, 0.15), Color(0.5, 0.32, 0.14), Color(0.6, 0.4, 0.18)]],
	"quesero": ["quesos", [], [Color(0.95, 0.82, 0.4), Color(0.92, 0.78, 0.35), Color(0.96, 0.85, 0.45)]],
	"apicultor": ["miel", [], [Color(0.9, 0.65, 0.15), Color(0.85, 0.6, 0.12), Color(0.95, 0.7, 0.2)]],
	"alfarero": ["vasijas", [], [Color(0.7, 0.38, 0.22), Color(0.65, 0.35, 0.2), Color(0.75, 0.42, 0.25)]],
	"curandero": ["remedios", [], [Color(0.35, 0.55, 0.3), Color(0.4, 0.6, 0.32), Color(0.3, 0.5, 0.28)]],
	"herrero": ["herramientas", [], [Color(0.35, 0.35, 0.38), Color(0.45, 0.45, 0.48), Color(0.3, 0.3, 0.32)]],
	"leñador": ["leña", [], [Color(0.45, 0.3, 0.17), Color(0.5, 0.35, 0.2), Color(0.42, 0.28, 0.15)]],
	"cantero": ["piedra tallada", [], [Color(0.6, 0.58, 0.55), Color(0.55, 0.53, 0.5), Color(0.65, 0.62, 0.58)]],
	"minero": ["hierro", [], [Color(0.3, 0.28, 0.27), Color(0.38, 0.32, 0.3), Color(0.28, 0.27, 0.27)]],
}


static func sellers() -> Array:
	return GS.data["villagers"].filter(func(v): return int(v.get("stall", 0)) > 0)


static func _free_slot() -> int:
	var used := sellers().map(func(v): return int(v.get("stall_slot", -1)))
	for i in SLOTS.size():
		if not i in used:
			return i
	return -1


## Partida nueva o antigua: dos vecinos empiezan vendiendo sobre una manta.
static func ensure() -> void:
	var vs: Array = GS.data["villagers"]
	if vs.any(func(v): return v.has("stall")):
		return
	var n := 0
	for v in vs:
		v["stall"] = 0
		if n < 2 and GOODS.has(v["job"]):
			v["stall"] = 1
			v["stall_slot"] = n * 3
			n += 1


## Cada estación: algún vecino monta su puesto y los que venden bien lo mejoran.
static func season() -> void:
	ensure()
	var d = GS.data
	for v in d["villagers"]:
		var lv := int(v.get("stall", 0))
		var mood := int(v.get("mood", 50))
		if lv == 0:
			var slot := _free_slot()
			if slot >= 0 and GOODS.has(v["job"]) and mood >= 45 and randf() < 0.15:
				v["stall"] = 1
				v["stall_slot"] = slot
				GS.say("%s extiende una manta en la plaza para vender %s." % [GS.full_name(v), GOODS[v["job"]][0]])
		elif lv == 1 and mood >= 55 and randf() < 0.1:
			v["stall"] = 2
			GS.say("%s monta un puesto con toldo en la plaza." % GS.full_name(v))
		elif lv == 2 and mood >= 60 and (int(d["tier"]) >= 1 or int(d["prosperity"]) >= 60) and randf() < 0.06:
			v["stall"] = 3
			GS.say("%s levanta una tienda de madera en la plaza: el negocio le va bien." % GS.full_name(v))


static func sig() -> String:
	return str(sellers().map(func(v): return [v["name"], v["job"], int(v["stall"]), int(v["stall_slot"])]))


static func slot_pos(i: int) -> Vector3:
	return SLOTS[i][0]


## Donde se pone el vendedor (detrás) y donde se para el comprador (delante).
static func behind(i: int, lvl: int) -> Vector3:
	return SLOTS[i][0] - SLOTS[i][1] * [1.0, 1.0, 0.9, 0.1][clampi(lvl, 0, 3)]


static func front(i: int) -> Vector3:
	return SLOTS[i][0] + SLOTS[i][1] * 1.8


static func _goods(n: Node3D, job: String, y: float, w: float, rows: int) -> void:
	var g: Array = GOODS.get(job, GOODS["agricultor"])
	var k := 0
	for r in rows:
		for c in 4:
			var p := Vector3(-w / 2 + (c + 0.5) * w / 4, y, -0.25 + r * 0.4)
			if not g[1].is_empty():
				M.put(n, g[1][k % g[1].size()], p + Vector3(0, 0.1 if job == "pescador" else 0.0, 0), randf() * TAU, 0.45 if job != "pescador" else 0.045)
			else:
				var b := E._box(n, Vector3(0.32, 0.18, 0.28), p + Vector3(0, 0.09, 0), g[2][k % 3])
				b.rotation.y = randf() * 0.6
			k += 1


## Construye el puesto según su nivel, mirando hacia +z local (el centro de la plaza).
static func build(parent: Node, i: int, v: Dictionary) -> Node3D:
	M._mats()
	var n := Node3D.new()
	n.position = SLOTS[i][0]
	var f: Vector3 = SLOTS[i][1]
	n.rotation.y = atan2(f.x, f.z)
	parent.add_child(n)
	var job: String = v["job"]
	match int(v["stall"]):
		1:
			# Manta en el suelo, un cesto y la mercancía encima.
			E._box(n, Vector3(2.0, 0.03, 1.4), Vector3(0, 0.02, 0), [Color(0.55, 0.42, 0.25), Color(0.45, 0.25, 0.2), Color(0.35, 0.4, 0.3)][i % 3])
			_goods(n, job, 0.04, 1.6, 2)
			M.put(n, "village/Bags.glb", Vector3(1.2, 0, -0.6), 0.4, 1.0)
		2:
			# Mesa con caballetes y toldo de tela a rayas sobre cuatro postes.
			M._bx(n, Vector3(2.4, 0.08, 1.0), Vector3(0, 0.85, 0), M._plank)
			for x in [-1.0, 1.0]:
				M._bx(n, Vector3(0.08, 0.85, 0.8), Vector3(x, 0.42, 0), M._beam)
				for z in [-0.7, 0.6]:
					M._bx(n, Vector3(0.09, 2.2, 0.09), Vector3(x * 1.25, 1.1, z), M._beam)
			var awn := E._box(n, Vector3(2.8, 0.05, 1.8), Vector3(0, 2.15, -0.05), [Color(0.7, 0.2, 0.15), Color(0.2, 0.35, 0.6), Color(0.75, 0.6, 0.2)][i % 3])
			awn.rotation.x = -0.2
			_goods(n, job, 0.89, 2.2, 2)
			M.put(n, "village/Crate.glb", Vector3(-1.0, 0, -1.2), 0.3, 1.1)
			M.put(n, "village/Barrel.glb", Vector3(1.1, 0, -1.2), 0.0, 1.1)
		_:
			# Tienda de madera: pared trasera y laterales, mostrador, tejadillo de tablilla y letrero.
			M._bx(n, Vector3(3.2, 2.6, 0.12), Vector3(0, 1.3, -1.2), M._plank)
			for x in [-1.6, 1.6]:
				M._bx(n, Vector3(0.12, 2.6, 2.4), Vector3(x, 1.3, 0), M._plank)
			M._bx(n, Vector3(3.2, 0.95, 0.5), Vector3(0, 0.47, 0.95), M._beam)
			M._bx(n, Vector3(3.3, 0.06, 0.6), Vector3(0, 0.97, 0.95), M._plank)
			var roof := M._bx(n, Vector3(3.6, 0.12, 3.0), Vector3(0, 2.85, 0.1), M._shingle)
			roof.rotation.x = -0.18
			_goods(n, job, 1.0, 3.0, 1)
			for k in 3:
				M._bx(n, Vector3(0.9, 0.05, 0.35), Vector3(-1.0 + k, 1.6, -1.0), M._beam)
				_goods_shelf(n, job, Vector3(-1.0 + k, 1.63, -1.0))
			preload("res://scripts/buildings.gd").signboard(n, Vector3(1.9, 0, 1.2), String(GOODS.get(job, ["mercado"])[0]).capitalize())
			if job == "panadero":
				M.hang_sign(n, "res://assets/ui/cartel_pan.png", Vector3(-1.6, 3.4, 1.15))
	var l := M.label3d("%s · %s" % [v["name"], GOODS.get(job, ["mercado"])[0]], 30)
	l.position = Vector3(0, 3.3, 0)
	l.visibility_range_end = 14.0
	n.add_child(l)
	return n


static func _goods_shelf(n: Node3D, job: String, p: Vector3) -> void:
	var g: Array = GOODS.get(job, GOODS["agricultor"])
	if not g[1].is_empty():
		M.put(n, g[1][0], p + Vector3(0, 0.1 if job == "pescador" else 0.0, 0), 0.0, 0.4 if job != "pescador" else 0.045)
	else:
		E._box(n, Vector3(0.6, 0.16, 0.25), p + Vector3(0, 0.08, 0), g[2][0])
