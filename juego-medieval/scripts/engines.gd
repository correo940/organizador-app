extends RefCounted
## Maquinaria de guerra hecha con piezas sencillas (estilo low-poly): catapulta, balista y ariete.

const M := preload("res://scripts/models.gd")
const WOOD := Color(0.45, 0.3, 0.17)
const DARK := Color(0.28, 0.19, 0.11)
const IRON := Color(0.35, 0.36, 0.38)


static func _box(p: Node3D, size: Vector3, pos: Vector3, col: Color, rot := Vector3.ZERO) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	m.mesh = bm
	m.material_override = M.flat(col)
	m.position = pos
	m.rotation_degrees = rot
	p.add_child(m)
	return m


static func _wheel(p: Node3D, pos: Vector3, r: float) -> void:
	var m := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = 0.18
	cm.radial_segments = 10
	m.mesh = cm
	m.material_override = M.flat(DARK)
	m.position = pos
	m.rotation_degrees = Vector3(0, 0, 90)
	p.add_child(m)


## Catapulta: el brazo (hijo "arm") gira al disparar. Mira hacia +Z.
static func catapult(parent: Node) -> Node3D:
	var n := Node3D.new()
	parent.add_child(n)
	_box(n, Vector3(0.25, 0.25, 3.2), Vector3(-0.8, 0.6, 0), WOOD)
	_box(n, Vector3(0.25, 0.25, 3.2), Vector3(0.8, 0.6, 0), WOOD)
	_box(n, Vector3(1.85, 0.2, 0.25), Vector3(0, 0.6, 1.3), WOOD)
	_box(n, Vector3(1.85, 0.2, 0.25), Vector3(0, 0.6, -1.3), WOOD)
	for s in [-1, 1]:
		_box(n, Vector3(0.2, 1.6, 0.2), Vector3(0.8 * s, 1.4, 0.2), WOOD, Vector3(-12, 0, 0))
		for z in [-1.1, 1.1]:
			_wheel(n, Vector3(1.0 * s, 0.45, z), 0.45)
	_box(n, Vector3(1.8, 0.2, 0.2), Vector3(0, 2.15, 0.35), DARK)
	var arm := Node3D.new()
	arm.name = "arm"
	arm.position = Vector3(0, 0.95, -0.2)
	n.add_child(arm)
	_box(arm, Vector3(0.18, 0.18, 2.8), Vector3(0, 0, -1.2), WOOD)
	_box(arm, Vector3(0.6, 0.15, 0.6), Vector3(0, 0.12, -2.5), DARK)
	_box(arm, Vector3(0.9, 0.7, 0.7), Vector3(0, -0.2, 0.3), IRON)
	return n


## Balista: un gran arco sobre un trípode.
static func ballista(parent: Node) -> Node3D:
	var n := Node3D.new()
	parent.add_child(n)
	for a in [0, 120, 240]:
		var leg := _box(n, Vector3(0.12, 1.3, 0.12), Vector3(sin(deg_to_rad(a)) * 0.4, 0.55, cos(deg_to_rad(a)) * 0.4), WOOD)
		leg.rotation_degrees = Vector3(cos(deg_to_rad(a)) * 18, 0, -sin(deg_to_rad(a)) * 18)
	var top := Node3D.new()
	top.name = "arm"
	top.position = Vector3(0, 1.25, 0)
	n.add_child(top)
	_box(top, Vector3(0.22, 0.2, 1.9), Vector3(0, 0, 0.2), WOOD)
	_box(top, Vector3(1.9, 0.12, 0.14), Vector3(0, 0.05, 0.9), DARK, Vector3(0, 0, 0))
	for s in [-1, 1]:
		_box(top, Vector3(0.7, 0.1, 0.1), Vector3(0.95 * s, 0.05, 0.7), DARK, Vector3(0, -30 * s, 0))
	_box(top, Vector3(0.06, 0.06, 1.6), Vector3(0, 0.16, 0.4), IRON)
	return n


## Ariete: tejadillo sobre ruedas con un tronco colgado.
static func ram(parent: Node) -> Node3D:
	var n := Node3D.new()
	parent.add_child(n)
	for s in [-1, 1]:
		_box(n, Vector3(0.2, 0.2, 3.6), Vector3(0.75 * s, 0.55, 0), WOOD)
		for z in [-1.3, 0, 1.3]:
			_box(n, Vector3(0.16, 1.7, 0.16), Vector3(0.75 * s, 1.3, z), WOOD)
		for z in [-1.3, 1.3]:
			_wheel(n, Vector3(0.95 * s, 0.4, z), 0.4)
		_box(n, Vector3(1.0, 0.1, 3.8), Vector3(0.42 * s, 2.35, 0), Color(0.5, 0.42, 0.3), Vector3(0, 0, -35 * s))
	var log := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.22
	cm.bottom_radius = 0.22
	cm.height = 3.8
	log.mesh = cm
	log.material_override = M.flat(DARK)
	log.rotation_degrees = Vector3(90, 0, 0)
	log.position = Vector3(0, 1.3, 0.4)
	log.name = "arm"
	n.add_child(log)
	_box(n, Vector3(0.5, 0.5, 0.3), Vector3(0, 1.3, 2.35), IRON)
	return n


## Torre de asedio: torre de madera sobre ruedas con rampa.
static func tower(parent: Node) -> Node3D:
	var n := Node3D.new()
	parent.add_child(n)
	for s in [-1, 1]:
		for z in [-1, 1]:
			_box(n, Vector3(0.3, 7.5, 0.3), Vector3(1.2 * s, 3.9, 1.2 * z), WOOD)
			_wheel(n, Vector3(1.45 * s, 0.45, 1.0 * z), 0.45)
	for y in [0.8, 2.8, 4.8, 7.6]:
		_box(n, Vector3(2.7, 0.2, 2.7), Vector3(0, y, 0), DARK)
	for s in [-1, 1]:
		_box(n, Vector3(0.1, 6.6, 2.5), Vector3(1.3 * s, 4.3, 0), Color(0.5, 0.4, 0.28))
	_box(n, Vector3(0.1, 6.6, 2.5), Vector3(0, 4.3, 1.3), Color(0.5, 0.4, 0.28), Vector3(0, 90, 0))
	_box(n, Vector3(2.3, 0.15, 2.6), Vector3(0, 7.6, -2.3), WOOD, Vector3(-20, 0, 0))
	return n


## Escala apoyada en la muralla.
static func ladder(parent: Node, h: float) -> Node3D:
	var n := Node3D.new()
	parent.add_child(n)
	for s in [-1, 1]:
		_box(n, Vector3(0.1, h, 0.1), Vector3(0.3 * s, h / 2, 0), WOOD)
	var y := 0.4
	while y < h:
		_box(n, Vector3(0.6, 0.07, 0.07), Vector3(0, y, 0), WOOD)
		y += 0.45
	n.rotation_degrees.x = -15
	return n
