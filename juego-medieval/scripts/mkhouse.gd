extends RefCounted
## Casas montadas con las piezas del Medieval Village MegaKit (Quaternius, CC0).
## Cada muro mide 2 m de ancho y 3,12 m de alto; la cara exterior mira a +z.

const DIR := "res://assets/mk/"
const H := 3.12
static var _cache := {}


static func _p(name: String) -> PackedScene:
	if not _cache.has(name):
		_cache[name] = load(DIR + name + ".gltf")
	return _cache[name]


static func put(parent: Node3D, name: String, pos: Vector3, rot := 0.0) -> Node3D:
	var n: Node3D = _p(name).instantiate()
	n.position = pos
	n.rotation.y = rot
	parent.add_child(n)
	return n


## Casa de w x d módulos (2 m cada uno) y 'floors' plantas. variant cambia materiales y detalles.
## Planta baja de piedra (o yeso), pisos de entramado, tejado de teja con hastiales de ladrillo.
static func house(parent: Node, pos: Vector3, rot: float, w: int, d: int, floors: int, variant: int) -> Node3D:
	var n := Node3D.new()
	n.position = pos
	n.rotation.y = rot
	parent.add_child(n)
	var W := w * 2.0
	var D := d * 2.0
	var brick_base := variant % 3 != 1
	for f in floors:
		var y := f * H
		var ground := f == 0
		# Lados: [inicio, dirección del tramo, número de tramos, rotación]
		var sides := [
			[Vector3(-W / 2 + 1, y, D / 2), Vector3(2, 0, 0), w, 0.0, true],
			[Vector3(W / 2 - 1, y, -D / 2), Vector3(-2, 0, 0), w, PI, false],
			[Vector3(W / 2, y, D / 2 - 1), Vector3(0, 0, -2), d, PI / 2, false],
			[Vector3(-W / 2, y, -D / 2 + 1), Vector3(0, 0, 2), d, -PI / 2, false],
		]
		for sd in sides:
			for k in int(sd[2]):
				var p: Vector3 = sd[0] + sd[1] * k
				var front: bool = sd[4]
				var mid: bool = k == int(sd[2]) / 2
				var piece: String
				if ground and front and mid:
					piece = "Wall_UnevenBrick_Door_Round" if brick_base else "Wall_Plaster_Door_Round"
				elif ground:
					var win: bool = (k + variant) % 2 == 0
					if brick_base:
						piece = "Wall_UnevenBrick_Window_Wide_Round" if win else "Wall_UnevenBrick_Straight"
					else:
						piece = "Wall_Plaster_Window_Wide_Flat" if win else "Wall_Plaster_Straight_Base"
				else:
					var win2: bool = (k + f + variant) % 2 == 1 or (front and mid)
					piece = "Wall_Plaster_Window_Wide_Flat" if win2 else "Wall_Plaster_WoodGrid"
				put(n, piece, p, sd[3])
				if piece.contains("Window_Wide_Flat"):
					put(n, "Window_Wide_Flat1", p, sd[3])
					if (k + variant) % 3 != 0:
						put(n, "WindowShutters_Wide_Flat_Open", p, sd[3])
				elif piece.contains("Window_Wide_Round"):
					put(n, "Window_Wide_Round1", p, sd[3])
				elif piece.contains("Door_Round"):
					put(n, "DoorFrame_Round_WoodDark" if not brick_base else "DoorFrame_Round_Brick", p, sd[3])
					put(n, "Door_1_Round", p + Vector3(-0.55, 0, 0).rotated(Vector3.UP, sd[3]), sd[3])
		for c in [Vector3(-W / 2, y, -D / 2), Vector3(W / 2, y, -D / 2), Vector3(W / 2, y, D / 2), Vector3(-W / 2, y, D / 2)]:
			put(n, "Corner_Exterior_Brick" if ground and brick_base else "Corner_Exterior_Wood", c, 0.0)
		if f > 0:
			for i in w:
				for j in d:
					put(n, "Floor_WoodDark", Vector3(-W / 2 + 1 + i * 2, y, -D / 2 + 1 + j * 2))
	# Tejado de teja y hastiales.
	var top := floors * H
	var rname := "Roof_RoundTiles_%dx%d" % [W, D]
	if ResourceLoader.exists(DIR + rname + ".gltf"):
		put(n, rname, Vector3(0, top, 0))
	var gname := "Roof_Front_Brick%d" % int(W)
	if ResourceLoader.exists(DIR + gname + ".gltf"):
		put(n, gname, Vector3(0, top, D / 2 - 0.1))
		put(n, gname, Vector3(0, top, -D / 2 + 0.1), PI)
	put(n, "Prop_Chimney" if variant % 2 == 0 else "Prop_Chimney2", Vector3(W / 2 - 1.2, top + 0.4, -D / 4))
	return n
