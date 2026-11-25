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


## Murallas y torres con piedra fotográfica (Poly Haven, CC0) teñida con 'col'.
static var _stone := {}
static func stone(n: Node, col: Color) -> void:
	if not _stone.has(col):
		var m := StandardMaterial3D.new()
		m.albedo_texture = load("res://assets/tex/muro_color.jpg")
		m.albedo_color = Color(col.r / 0.535, col.g / 0.5, col.b / 0.417)
		m.normal_enabled = true
		m.normal_texture = load("res://assets/tex/muro_normal.png")
		m.roughness_texture = load("res://assets/tex/muro_rough.jpg")
		m.uv1_triplanar = true
		m.uv1_world_triplanar = true
		m.uv1_scale = Vector3(0.18, 0.18, 0.18)
		_stone[col] = m
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			mi.set_surface_override_material(i, _stone[col])


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
	roads.clear()
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
	# Calidad alta (Forward+ con tarjeta gráfica moderna): luz rebotada, sombras de contacto,
	# resplandor y niebla volumétrica. En modo rendimiento o con OpenGL se queda en lo básico.
	if hq():
		e.sdfgi_enabled = true
		e.sdfgi_use_occlusion = true
		e.sdfgi_energy = 0.9
		e.ssao_enabled = true
		e.ssao_radius = 1.2
		e.ssao_intensity = 1.6
		e.ssil_enabled = true
		e.glow_enabled = true
		e.glow_intensity = 0.55
		e.glow_bloom = 0.04
		e.glow_hdr_threshold = 1.1
		e.volumetric_fog_enabled = true
		e.volumetric_fog_density = 0.0022
		e.volumetric_fog_albedo = Color(0.9, 0.9, 0.95)
		e.volumetric_fog_length = 120.0
		e.fog_density = 0.0015
		e.ssr_enabled = true
		e.ssr_max_steps = 48
		e.adjustment_saturation = 1.08
		e.adjustment_contrast = 1.04
		e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
		e.tonemap_exposure = 1.15
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, -40, 0)
	sun.light_color = Color(1, 0.9, 0.76)
	sun.light_energy = 1.1
	sun.shadow_enabled = SFX.settings["shadows"]
	if hq():
		sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
		sun.directional_shadow_max_distance = 120
		sun.shadow_blur = 1.5
		sun.light_volumetric_fog_energy = 1.2
	else:
		sun.directional_shadow_max_distance = 60
	parent.add_child(sun)
	# Nubes que pasan con el viento (una capa alta, sin niebla).
	var cl := MeshInstance3D.new()
	var cp := PlaneMesh.new()
	cp.size = Vector2(maxf(size * 3.0, 1600.0), maxf(size * 3.0, 1600.0))
	cl.mesh = cp
	cl.position = Vector3(center.x, maxf(110.0, size * 0.5), center.z)
	cl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	cl.material_override = cloud_material()
	parent.add_child(cl)
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
	# Detalle fotográfico (tierra de Poly Haven, CC0): piedrecillas y relieve bajo la hierba.
	mat.detail_enabled = true
	mat.detail_albedo = load("res://assets/tex/tierra_detalle.jpg")
	mat.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MUL
	mat.normal_enabled = true
	mat.normal_texture = load("res://assets/tex/tierra_normal.png")
	mat.normal_scale = 0.8
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
	var gm := grass_material()
	gm.set_shader_parameter("base", cols[0].darkened(0.08))
	gm.set_shader_parameter("tip", cols[1].lightened(0.1))
	gm.set_shader_parameter("hide", 1.0 if season == 3 else 0.0)


## Nubes procedurales: ruido que se desplaza; 'light' se ajusta con la hora del día.
static var _cloud: ShaderMaterial
static func cloud_material() -> ShaderMaterial:
	if _cloud == null:
		var sh := Shader.new()
		sh.code = """shader_type spatial;
render_mode unshaded, cull_disabled, fog_disabled, depth_draw_never, shadows_disabled;
uniform float light = 1.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int k = 0; k < 5; k++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
void fragment() {
	vec2 p = UV * 9.0 + vec2(TIME * 0.012, TIME * 0.005);
	float c = smoothstep(0.38, 0.68, fbm(p));
	float edge = 1.0 - smoothstep(0.3, 0.5, length(UV - 0.5));
	ALBEDO = mix(vec3(0.72, 0.74, 0.8), vec3(1.0), fbm(p * 1.7 + 3.0)) * light;
	ALPHA = c * edge * 0.85;
}"""
		_cloud = ShaderMaterial.new()
		_cloud.shader = sh
	return _cloud


## Hierba con viento: briznas instanciadas (MultiMesh) que se mecen. 'keep' decide dónde crece.
static var _grass: ShaderMaterial
static func grass_material() -> ShaderMaterial:
	if _grass == null:
		var sh := Shader.new()
		sh.code = """shader_type spatial;
render_mode cull_disabled, shadows_disabled;
uniform vec4 base : source_color = vec4(0.16, 0.25, 0.09, 1.0);
uniform vec4 tip : source_color = vec4(0.45, 0.52, 0.25, 1.0);
uniform float hide = 0.0;
varying float hgt;
void vertex() {
	hgt = 1.0 - UV.y;
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float w = sin(wp.x * 0.35 + TIME * 1.7) * 0.6 + sin(wp.z * 0.5 + TIME * 2.3) * 0.4;
	VERTEX.x += w * 0.14 * hgt * hgt;
	VERTEX.z += w * 0.07 * hgt * hgt;
	VERTEX *= 1.0 - hide;
}
void fragment() {
	ALBEDO = mix(base.rgb, tip.rgb, hgt);
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	ROUGHNESS = 0.9;
	BACKLIGHT = vec3(0.25, 0.3, 0.1) * hgt;
}"""
		_grass = ShaderMaterial.new()
		_grass.shader = sh
	return _grass


static func _on_road(q: Vector2) -> bool:
	for rd in roads:
		if Geometry2D.get_closest_point_to_segment(q, rd[0], rd[1]).distance_to(q) < rd[2]:
			return true
	return false


static func grass(parent: Node, center: Vector3, half: float, count: int, keep: Callable) -> void:
	if SFX.settings.get("low", false):
		return
	if not hq():
		count /= 3
	# Brizna: dos planos cruzados, más estrechos arriba.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for a in [0.0, PI / 2.0]:
		var dx := Vector3(cos(a), 0, sin(a)) * 0.05
		var top := Vector3(0, 0.34, 0)
		var v := [-dx, dx, dx * 0.3 + top, -dx * 0.3 + top]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for i in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP)
			st.set_uv(uv[i])
			st.add_vertex(v[i])
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = st.commit()
	var xs: Array[Transform3D] = []
	var r := RandomNumberGenerator.new()
	r.seed = 77
	var noise := FastNoiseLite.new()
	noise.frequency = 0.05
	for k in count * 2:
		if xs.size() >= count:
			break
		var p := Vector3(center.x + r.randf_range(-half, half), 0, center.z + r.randf_range(-half, half))
		if noise.get_noise_2d(p.x, p.z) < -0.15 or not keep.call(Vector2(p.x, p.z)) or _on_road(Vector2(p.x, p.z)):
			continue
		var s := r.randf_range(0.6, 1.4)
		xs.append(Transform3D(Basis(Vector3.UP, r.randf() * TAU).scaled(Vector3(s, s * r.randf_range(0.7, 1.3), s)), p))
	mm.instance_count = xs.size()
	for i in xs.size():
		mm.set_instance_transform(i, xs[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = grass_material()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)


## ¿Se pueden usar los efectos avanzados? (Forward+ y sin modo rendimiento)
static func hq() -> bool:
	return RenderingServer.get_rendering_device() != null and not SFX.settings.get("low", false)


## Agua con olas y reflejos (estanques, río del mapa y de las batallas).
static var _water: ShaderMaterial
static func water_material() -> Material:
	if _water == null:
		var sh := Shader.new()
		sh.code = """shader_type spatial;
render_mode blend_mix, cull_back, specular_schlick_ggx;
uniform vec4 deep : source_color = vec4(0.02, 0.09, 0.14, 1.0);
uniform vec4 shallow : source_color = vec4(0.08, 0.25, 0.32, 1.0);
float wave(vec2 p, float t) {
	return sin(p.x * 0.9 + t * 1.3) * 0.5 + sin(p.y * 1.3 - t * 1.1) * 0.5 + sin((p.x + p.y) * 2.1 + t * 2.0) * 0.25;
}
void fragment() {
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float t = TIME;
	float e = 0.08;
	float h = wave(wp.xz, t);
	vec3 n = normalize(vec3(wave(wp.xz + vec2(e, 0.0), t) - h, 1.6, wave(wp.xz + vec2(0.0, e), t) - h));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	ALBEDO = mix(deep.rgb, shallow.rgb, 0.35 + 0.3 * h * 0.5);
	ROUGHNESS = 0.06;
	METALLIC = 0.0;
	SPECULAR = 0.7;
	ALPHA = 0.94 + fres * 0.06;
}"""
		_water = ShaderMaterial.new()
		_water.shader = sh
	return _water


## Capa de nieve: se pinta de blanco lo que mira hacia arriba (tejados, copas, rocas).
static var _snow: ShaderMaterial
static func snow_overlay() -> ShaderMaterial:
	if _snow == null:
		var sh := Shader.new()
		sh.code = """shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back;
varying float up;
void vertex() { up = (MODEL_MATRIX * vec4(NORMAL, 0.0)).y; }
void fragment() {
	ALBEDO = vec3(0.94, 0.95, 0.98);
	ROUGHNESS = 0.9;
	ALPHA = smoothstep(0.35, 0.7, up) * 0.92;
}"""
		_snow = ShaderMaterial.new()
		_snow.shader = sh
	return _snow


## Pone o quita la nieve a todas las mallas bajo 'root' (menos personas y suelo).
static func set_snow(root: Node, on: bool) -> void:
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		if mi.get_parent() is Skeleton3D or mi.mesh is PlaneMesh:
			continue
		mi.material_overlay = snow_overlay() if on else null


## Luz de luna: de noche se sigue viendo el terreno (mapa y batallas).
static func moonlight(env: Dictionary, k: float) -> void:
	var sun: DirectionalLight3D = env["sun"]
	sun.light_energy = maxf(sun.light_energy, k)
	var e: Environment = env["env"]
	e.ambient_light_energy = maxf(e.ambient_light_energy, k)
	var sm: ProceduralSkyMaterial = env["sky"]
	var moon_top := Color(0.16, 0.22, 0.4)
	var moon_hor := Color(0.24, 0.3, 0.45)
	if sm.sky_top_color.get_luminance() < moon_top.get_luminance():
		sm.sky_top_color = moon_top
		sm.sky_horizon_color = moon_hor
		sm.ground_horizon_color = moon_hor
		sm.ground_bottom_color = Color(0.1, 0.12, 0.18)
		e.fog_light_color = moon_hor
		sun.light_color = Color(0.65, 0.75, 1.0)
		cloud_material().set_shader_parameter("light", 0.25)


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
	cloud_material().set_shader_parameter("light", lerpf(0.12, 1.0, day))


## Tierra fotográfica teñida con el color pedido (caminos, plazas, eras).
static var _dirt := {}
static func dirt(col: Color) -> StandardMaterial3D:
	if not _dirt.has(col):
		var m := StandardMaterial3D.new()
		m.albedo_texture = load("res://assets/tex/tierra_color.jpg")
		m.albedo_color = Color(col.r / 0.416, col.g / 0.351, col.b / 0.265)
		m.normal_enabled = true
		m.normal_texture = load("res://assets/tex/tierra_normal.png")
		m.roughness = 1.0
		m.uv1_triplanar = true
		m.uv1_world_triplanar = true
		m.uv1_scale = Vector3(0.25, 0.25, 0.25)
		_dirt[col] = m
	return _dirt[col]


static var roads: Array = []  # tramos de camino de la escena: [a, b, radio] (la hierba no crece encima)
## Empedrado de la plaza: la piedra del muro, clara y en losas grandes.
static var _paving: StandardMaterial3D
static func paving() -> StandardMaterial3D:
	if _paving == null:
		_paving = StandardMaterial3D.new()
		_paving.albedo_texture = load("res://assets/tex/muro_color.jpg")
		_paving.albedo_color = Color(1.15, 1.1, 1.05)
		_paving.normal_enabled = true
		_paving.normal_texture = load("res://assets/tex/muro_normal.png")
		_paving.roughness_texture = load("res://assets/tex/muro_rough.jpg")
		_paving.uv1_triplanar = true
		_paving.uv1_world_triplanar = true
		_paving.uv1_scale = Vector3(0.22, 0.22, 0.22)
	return _paving


static func road(parent: Node, a: Vector3, b: Vector3, w: float, col: Color) -> MeshInstance3D:
	roads.append([Vector2(a.x, a.z), Vector2(b.x, b.z), w * 0.5 + 0.4])
	var m := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(w, 0.04, a.distance_to(b) + w)
	m.mesh = bm
	m.material_override = dirt(col)
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
		stone(put(parent, p[0], c + p[1] * s, 0, s), stone)


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
