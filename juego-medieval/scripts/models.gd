extends RefCounted
## Utilidades 3D compartidas: animaciones, entorno, carga de modelos.

const LOOPS := ["Idle", "Walk", "Jog_Fwd", "Sprint", "Sword_Idle", "Idle_Talking", "Sitting_Idle", "Crouch_Idle", "Walk_Formal", "Dance", "Driving"]
const SKIN_HAIR := [Color(0.25, 0.16, 0.09), Color(0.12, 0.09, 0.07), Color(0.45, 0.3, 0.15), Color(0.6, 0.45, 0.25)]

static var _lib: AnimationLibrary
static var _body_shader: Shader
static var _scenes := {}


static func anim_lib() -> AnimationLibrary:
	if _lib == null:
		var u: Node = load("res://assets/ual/UAL1_Standard.glb").instantiate()
		_lib = u.find_child("AnimationPlayer", true, false).get_animation_library("")
		u.free()
		for n in LOOPS:
			if _lib.has_animation(n):
				_lib.get_animation(n).loop_mode = Animation.LOOP_LINEAR
	return _lib


static func inst(path: String) -> Node3D:
	if not _scenes.has(path):
		_scenes[path] = load("res://assets/%s" % path)
	return _scenes[path].instantiate()


static func put(parent: Node, path: String, pos: Vector3, rot := 0.0, s := 1.0) -> Node3D:
	var n := inst(path)
	n.position = pos
	n.rotation.y = rot
	n.scale = Vector3.ONE * s
	parent.add_child(n)
	return n


## Tiñe un animal multiplicando su color (pelaje de caballos).
static func recolor_coat(n: Node, col: Color) -> void:
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var m = mi.get_active_material(i)
			if m is StandardMaterial3D and m.albedo_color.v > 0.3:
				var mm: StandardMaterial3D = m.duplicate()
				mm.albedo_color = m.albedo_color * col
				mi.set_surface_override_material(i, mm)


static func recolor(n: Node, col: Color) -> void:
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var m = mi.get_active_material(i)
			if m is StandardMaterial3D:
				var mm: StandardMaterial3D = m.duplicate()
				mm.albedo_color = col
				mi.set_surface_override_material(i, mm)
	if n is MeshInstance3D:
		recolor_mesh(n, col)


static func recolor_mesh(mi: MeshInstance3D, col: Color) -> void:
	for i in mi.mesh.get_surface_count():
		var m = mi.get_active_material(i)
		if m is StandardMaterial3D:
			var mm: StandardMaterial3D = m.duplicate()
			mm.albedo_color = col
			mi.set_surface_override_material(i, mm)


static func flat(col: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = 0.9
	return m


## Encoge ligeramente el cuerpo base por debajo del cuello para que no atraviese la ropa.
static func fix_body(n: Node) -> void:
	if _body_shader == null:
		_body_shader = Shader.new()
		_body_shader.code = """
shader_type spatial;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform vec4 albedo_col : source_color = vec4(1.0);
uniform vec4 under_col : source_color = vec4(0.24, 0.21, 0.18, 1.0);
uniform float cut;
uniform float shirt;
uniform float shrink;
varying float h;
void vertex() {
	h = VERTEX.y;
	if (VERTEX.y < cut) { VERTEX -= NORMAL * shrink; }
}
void fragment() {
	vec3 skin = texture(albedo_tex, UV).rgb * albedo_col.rgb;
	// Por debajo del cuello el cuerpo base se pinta como ropa interior (camisa, calzas, guantes).
	float k = smoothstep(shirt + 0.01, shirt - 0.01, h);
	ALBEDO = mix(skin, under_col.rgb * (0.85 + 0.15 * skin.r), k);
	ROUGHNESS = 0.8;
}
"""
	for mi in n.find_children("SuperHero*", "MeshInstance3D", true, false):
		var bb: AABB = mi.get_aabb()
		for i in mi.mesh.get_surface_count():
			var m = mi.mesh.surface_get_material(i)
			if m is StandardMaterial3D:
				var sm := ShaderMaterial.new()
				sm.shader = _body_shader
				sm.set_shader_parameter("albedo_tex", m.albedo_texture)
				sm.set_shader_parameter("albedo_col", m.albedo_color)
				sm.set_shader_parameter("cut", bb.position.y + bb.size.y * 0.84)
				sm.set_shader_parameter("shirt", bb.position.y + bb.size.y * 0.815)
				sm.set_shader_parameter("shrink", bb.size.y * 0.012)
				mi.set_surface_override_material(i, sm)


static func aabb_of(n: Node) -> AABB:
	var acc = [null]
	_aabb(n, Transform3D(), acc)
	return acc[0] if acc[0] != null else AABB()


static func _aabb(n: Node, xf: Transform3D, acc: Array) -> void:
	var t := xf
	if n is Node3D:
		t = xf * n.transform
	if n is MeshInstance3D:
		var a: AABB = t * n.get_aabb()
		acc[0] = a if acc[0] == null else acc[0].merge(a)
	for c in n.get_children():
		_aabb(c, t, acc)


## Crea cielo, sol y suelo. Devuelve referencias para animar el día y las estaciones.
static func make_env(parent: Node, center: Vector3, size: float) -> Dictionary:
	var we := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.32, 0.45, 0.68)
	sm.sky_horizon_color = Color(0.75, 0.72, 0.66)
	sm.ground_horizon_color = Color(0.5, 0.5, 0.45)
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.5
	e.tonemap_mode = Environment.TONE_MAPPER_ACES
	e.tonemap_exposure = 1.05
	e.fog_enabled = true
	e.fog_light_color = Color(0.62, 0.66, 0.7)
	e.fog_density = 0.004
	e.adjustment_enabled = true
	e.adjustment_saturation = 0.88
	e.adjustment_contrast = 1.06
	we.environment = e
	parent.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, -40, 0)
	sun.light_color = Color(1, 0.9, 0.76)
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 60
	parent.add_child(sun)
	var g := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(size, size)
	g.mesh = pm
	g.position = center
	var mat := StandardMaterial3D.new()
	var nt := NoiseTexture2D.new()
	var noise := FastNoiseLite.new()
	noise.frequency = 0.03
	nt.noise = noise
	nt.seamless = true
	var grad := Gradient.new()
	grad.set_color(0, Color(0.24, 0.33, 0.14))
	grad.set_color(1, Color(0.4, 0.46, 0.22))
	nt.color_ramp = grad
	mat.albedo_texture = nt
	mat.uv1_scale = Vector3(size / 6.0, size / 6.0, 1)
	mat.roughness = 1.0
	g.material_override = mat
	parent.add_child(g)
	return {"env": e, "sun": sun, "sky": sm, "grad": grad}


static func set_season_ground(grad: Gradient, season: int) -> void:
	var cols: Array = [
		[Color(0.26, 0.36, 0.15), Color(0.42, 0.5, 0.24)],
		[Color(0.24, 0.33, 0.14), Color(0.4, 0.46, 0.22)],
		[Color(0.36, 0.33, 0.16), Color(0.52, 0.45, 0.24)],
		[Color(0.78, 0.8, 0.84), Color(0.92, 0.93, 0.96)],
	][season]
	grad.set_color(0, cols[0])
	grad.set_color(1, cols[1])


## Ciclo de día: t en 0..1 (0.5 = mediodía).
static func set_daytime(env: Dictionary, t: float) -> void:
	var elev := sin((t - 0.25) * TAU)
	var sun: DirectionalLight3D = env["sun"]
	sun.rotation_degrees = Vector3(-5 - clampf(elev, 0.05, 1.0) * 60.0, -40 + t * 80.0, 0)
	var day := clampf(elev * 2.2 + 0.75, 0.0, 1.0)
	sun.light_energy = lerpf(0.12, 1.1, day)
	sun.light_color = Color(0.6, 0.7, 1.0).lerp(Color(1, 0.9, 0.76), day)
	var e: Environment = env["env"]
	e.ambient_light_energy = lerpf(0.15, 0.5, day)
	var sm: ProceduralSkyMaterial = env["sky"]
	sm.sky_top_color = Color(0.03, 0.05, 0.12).lerp(Color(0.32, 0.45, 0.68), day)
	sm.sky_horizon_color = Color(0.08, 0.1, 0.18).lerp(Color(0.75, 0.72, 0.66), day)
	e.fog_light_color = Color(0.08, 0.1, 0.16).lerp(Color(0.62, 0.66, 0.7), day)


static func road(parent: Node, a: Vector3, b: Vector3, w: float, col: Color) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(w, 0.04, a.distance_to(b) + w)
	m.mesh = bm
	m.material_override = flat(col)
	parent.add_child(m)
	m.look_at_from_position((a + b) / 2 + Vector3(0, 0.02, 0), b + Vector3(0, 0.02, 0), Vector3.UP)
	return m


static func tent(parent: Node, pos: Vector3, rot: float, col: Color) -> void:
	var m := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0
	cm.bottom_radius = 2.0
	cm.height = 2.6
	cm.radial_segments = 4
	cm.rings = 1
	m.mesh = cm
	m.material_override = flat(col)
	m.position = pos + Vector3(0, 1.3, 0)
	m.rotation.y = rot + PI / 4
	parent.add_child(m)


static func castle(parent: Node, c: Vector3, s: float) -> void:
	var stone := Color(0.52, 0.5, 0.46)
	for p in [["castle/LargeTower.glb", Vector3.ZERO], ["castle/TallWallEntrance.glb", Vector3(-2.25, 0, 0.5)], ["castle/TallWall.glb", Vector3(2.25, 0, 0.5)], ["castle/LargeSquareTower.glb", Vector3(-4.5, 0, 0.5)], ["castle/PointyTower.glb", Vector3(4.5, 0, 0.5)]]:
		recolor(put(parent, p[0], c + p[1] * s, 0, s), stone)


## Etiqueta flotante que mira a cámara.
static func label3d(text: String, size := 48) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = size
	l.outline_size = 12
	l.pixel_size = 0.004
	l.no_depth_test = true
	return l
