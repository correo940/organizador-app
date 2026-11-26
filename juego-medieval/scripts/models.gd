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
	e.ambient_light_sky_contribution = 0.55
	e.ambient_light_color = Color(0.78, 0.7, 0.58)
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
		e.adjustment_saturation = 1.15
		e.adjustment_contrast = 1.08
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
	ALBEDO = mix(base.rgb, tip.rgb, hgt) * COLOR.rgb;
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
	mm.use_colors = true
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
		# Matas de hierba seca entre la verde.
		var dry := clampf(noise.get_noise_2d(xs[i].origin.x * 3.0 + 50.0, xs[i].origin.z * 3.0) * 2.0 + 0.3 + r.randf() * 0.3, 0.0, 1.0)
		mm.set_instance_color(i, Color(1, 1, 1).lerp(Color(1.7, 1.35, 0.55), dry))
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
	# El sol sale a las 0.22 y se pone a las 0.85 (como la noche del juego); la noche es corta.
	var elev: float
	var u := clampf((t - 0.22) / 0.63, 0.0, 1.0)
	if t >= 0.22 and t <= 0.85:
		elev = sin(u * PI)
	else:
		elev = -sin(fposmod(t - 0.85, 1.0) / 0.37 * PI) * 0.6
	var sun: DirectionalLight3D = env["sun"]
	# Sol bajo y dorado todo el día (sombras largas), como una tarde de verano.
	sun.rotation_degrees = Vector3(-6 - clampf(elev, 0.05, 1.0) * 42.0, -60 + u * 120.0, 0)
	var day := clampf(elev * 2.6 + 0.35, 0.0, 1.0)
	var gold := Color(1.0, 0.8, 0.58).lerp(Color(1.0, 0.88, 0.7), clampf(elev, 0, 1))
	sun.light_energy = lerpf(0.12, 1.3, day)
	sun.light_color = Color(0.6, 0.7, 1.0).lerp(gold, day)
	var e: Environment = env["env"]
	e.ambient_light_energy = lerpf(0.15, 0.55, day)
	var sm: ProceduralSkyMaterial = env["sky"]
	sm.sky_top_color = Color(0.03, 0.05, 0.12).lerp(Color(0.48, 0.6, 0.76), day)
	sm.sky_horizon_color = Color(0.08, 0.1, 0.18).lerp(Color(0.98, 0.8, 0.58), day)
	sm.ground_horizon_color = sm.sky_horizon_color.darkened(0.2)
	e.fog_light_color = Color(0.08, 0.1, 0.16).lerp(Color(0.92, 0.76, 0.56), day)
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


## Cabaña de madera humilde: tablones, tejado de paja, puerta baja y un ventanuco.
static var _plank: StandardMaterial3D
static var _thatch: StandardMaterial3D
static func _mats() -> void:
	if _plank != null:
		return
	# Tablones verticales con juntas oscuras y veta; paja en hileras con mechones.
	var r := RandomNumberGenerator.new()
	r.seed = 5
	# Tablones fotográficos (Poly Haven, CC0), un poco más oscuros y gastados.
	_plank = StandardMaterial3D.new()
	_plank.albedo_texture = load("res://assets/tex/madera_color.jpg")
	_plank.albedo_color = Color(0.85, 0.82, 0.78)
	_plank.normal_enabled = true
	_plank.normal_texture = load("res://assets/tex/madera_normal.png")
	_plank.uv1_triplanar = true
	_plank.uv1_scale = Vector3(0.45, 0.45, 0.45)
	_plank.roughness = 0.9
	_plank.metallic_specular = 0.2
	var im2 := Image.create(128, 128, false, Image.FORMAT_RGB8)
	for y in 128:
		for x in 128:
			var c := Color(0.62, 0.5, 0.27).darkened(0.25 * float((y + int(r.randf() * 3)) % 16) / 16.0 + r.randf() * 0.12)
			im2.set_pixel(x, y, c)
	_thatch = StandardMaterial3D.new()
	_thatch.albedo_texture = ImageTexture.create_from_image(im2)
	_thatch.uv1_scale = Vector3(3, 3, 1)
	_thatch.roughness = 1.0
	var pn := Image.create(64, 64, false, Image.FORMAT_RGB8)
	for y in 64:
		for x in 64:
			pn.set_pixel(x, y, Color(0.97, 0.86, 0.66).darkened(r.randf() * 0.08 + 0.05 * sin(x * 0.3 + y * 0.17)))
	_plaster = StandardMaterial3D.new()
	_plaster.albedo_texture = ImageTexture.create_from_image(pn)
	_plaster.uv1_triplanar = true
	_plaster.uv1_scale = Vector3(0.5, 0.5, 0.5)
	_plaster.roughness = 1.0
	_plaster.metallic_specular = 0.08
	_beam = _plank.duplicate()
	_beam.albedo_color = Color(1.0, 0.82, 0.66)
	_shingle = _plank.duplicate()
	_shingle.albedo_color = Color(0.55, 0.42, 0.34)
	_shingle.uv1_scale = Vector3(1.4, 1.4, 1.4)
	_stonewall = StandardMaterial3D.new()
	_stonewall.albedo_texture = load("res://assets/tex/muro_color.jpg")
	_stonewall.normal_enabled = true
	_stonewall.normal_texture = load("res://assets/tex/muro_normal.png")
	_stonewall.roughness_texture = load("res://assets/tex/muro_rough.jpg")
	_stonewall.uv1_triplanar = true
	_stonewall.uv1_scale = Vector3(0.26, 0.26, 0.26)
	_stonewall.albedo_color = Color(1.12, 1.1, 1.06)


static var _plaster: StandardMaterial3D
static var _beam: StandardMaterial3D
static var _shingle: StandardMaterial3D
static var _stonewall: StandardMaterial3D
static func _bx(n: Node3D, size: Vector3, pos: Vector3, mat: Material, rz := 0.0) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	m.mesh = b
	m.material_override = mat
	m.position = pos
	m.rotation.z = rz
	n.add_child(m)
	return m


## Fachada de entramado: postes, carreras, tornapuntas en aspa y ventanas con contraventanas.
static func _timber_face(n: Node3D, w: float, y0: float, h: float, z: float, door: bool, variant: int) -> void:
	var t := 0.17
	for x in [-w / 2 + 0.09, w / 2 - 0.09, -w / 6, w / 6]:
		_bx(n, Vector3(t, h, t), Vector3(x, y0 + h / 2, z), _beam)
	_bx(n, Vector3(w + 0.1, t, t + 0.04), Vector3(0, y0 + h - 0.08, z), _beam)
	_bx(n, Vector3(w + 0.1, t, t + 0.04), Vector3(0, y0 + 0.08, z), _beam)
	var bw := w / 3.0 - 0.1
	var bh := h * 0.5 - 0.15
	var diag := sqrt(bw * bw + bh * bh)
	var ang := atan2(bh, bw)
	for sd in [-1, 1]:
		_bx(n, Vector3(w / 3.0, t * 0.8, t), Vector3(sd * w / 3.0, y0 + h * 0.55, z), _beam)
		_bx(n, Vector3(diag, t * 0.8, t), Vector3(sd * w / 3.0, y0 + 0.1 + bh / 2 + 0.05, z), _beam, ang * sd * (1 if variant % 2 == 0 else -1))
	if door:
		_bx(n, Vector3(1.05, 2.0, 0.12), Vector3(0, y0 + 1.0, z + 0.04), _beam)
		_bx(n, Vector3(1.3, 0.16, 0.2), Vector3(0, y0 + 2.08, z + 0.05), _beam)
	var dark := flat(Color(0.08, 0.06, 0.05))
	for sd in [-1, 1]:
		var wy := y0 + h * 0.78
		_bx(n, Vector3(0.7, 0.8, 0.06), Vector3(sd * w / 3.0, wy, z + 0.02), dark)
		_bx(n, Vector3(0.36, 0.86, 0.07), Vector3(sd * w / 3.0 - 0.55, wy, z + 0.05), _beam)
		_bx(n, Vector3(0.36, 0.86, 0.07), Vector3(sd * w / 3.0 + 0.55, wy, z + 0.05), _beam)


## Vigas de los laterales: carrera arriba y abajo, postes y una riostra.
static func _timber_side(n: Node3D, w: float, dp: float, y0: float, h: float, oz := 0.0) -> void:
	var t := 0.17
	for sd in [-1, 1]:
		var x: float = sd * (w / 2 + 0.03)
		_bx(n, Vector3(t, t, dp + 0.1), Vector3(x, y0 + h - 0.08, oz), _beam)
		_bx(n, Vector3(t, t, dp + 0.1), Vector3(x, y0 + 0.08, oz), _beam)
		_bx(n, Vector3(t, t * 0.8, dp), Vector3(x, y0 + h * 0.55, oz), _beam)
		for z in [-dp / 6, dp / 6]:
			_bx(n, Vector3(t, h, t), Vector3(x, y0 + h / 2, oz + z), _beam)
		var m := _bx(n, Vector3(t, t * 0.8, sqrt(pow(dp / 3.0, 2) + pow(h * 0.4, 2))), Vector3(x, y0 + h * 0.3, oz + dp / 3.0), _beam)
		m.rotation.x = atan2(h * 0.4, dp / 3.0) * sd


## Casa medieval hecha a mano. level 1: entramado de una planta con desván; level 2: planta baja de
## piedra y piso de entramado volado. variant cambia tejado (paja / tablilla) y detalles.
static func medieval_house(parent: Node, pos: Vector3, rot: float, level: int, variant: int, s := 1.0, props := true) -> Node3D:
	_mats()
	var n := Node3D.new()
	n.position = pos
	n.rotation.y = rot
	n.scale = Vector3.ONE * s
	parent.add_child(n)
	var w := 5.0
	var dp := 5.4
	var top := 0.0
	if level <= 1:
		_bx(n, Vector3(w + 0.2, 0.55, dp + 0.2), Vector3(0, 0.27, 0), _stonewall)
		_bx(n, Vector3(w, 2.7, dp), Vector3(0, 0.55 + 1.35, 0), _plaster)
		_timber_face(n, w, 0.55, 2.7, dp / 2 + 0.03, true, variant)
		_timber_face(n, w, 0.55, 2.7, -dp / 2 - 0.03, false, variant + 1)
		_timber_side(n, w, dp, 0.55, 2.7)
		top = 3.25
	else:
		_bx(n, Vector3(w, 3.0, dp), Vector3(0, 1.5, 0), _stonewall)
		_bx(n, Vector3(1.1, 2.1, 0.14), Vector3(0, 1.05, dp / 2 + 0.03), _beam)
		_bx(n, Vector3(1.5, 0.3, 0.3), Vector3(0, 2.25, dp / 2 + 0.05), _stonewall)
		var dark := flat(Color(0.08, 0.06, 0.05))
		for sd in [-1, 1]:
			_bx(n, Vector3(0.45, 0.8, 0.06), Vector3(sd * 1.6, 1.7, dp / 2 + 0.02), dark)
		# Piso volado de entramado (sobresale hacia la calle).
		_bx(n, Vector3(w + 0.7, 0.25, dp + 0.7), Vector3(0, 3.12, 0), _beam)
		for k in 5:
			_bx(n, Vector3(0.18, 0.18, 0.5), Vector3(-w / 2 + 0.5 + k * (w - 1.0) / 4.0, 2.92, dp / 2 + 0.1), _beam)
		_bx(n, Vector3(w + 0.5, 2.5, dp + 0.5), Vector3(0, 3.25 + 1.25, 0), _plaster)
		_timber_face(n, w + 0.5, 3.25, 2.5, dp / 2 + 0.28, false, variant)
		_timber_face(n, w + 0.5, 3.25, 2.5, -dp / 2 - 0.28, false, variant + 1)
		_timber_side(n, w + 0.5, dp + 0.5, 3.25, 2.5)
		top = 5.75
	# Tejado de paja grueso con alero; el frontón queda a la vista (encalado y con vigas).
	var ww := w if level <= 1 else w + 0.5
	var wd := dp if level <= 1 else dp + 0.5
	var rh := 2.7 if level <= 1 else 2.4
	var thatch := (variant % 3 != 2 and level <= 1) or (level >= 2 and variant % 2 == 0)
	_roof_slabs(n, ww, wd, top, rh, _thatch if thatch else _shingle)
	for z in [wd / 2, -wd / 2]:
		var g := MeshInstance3D.new()
		var gp := PrismMesh.new()
		gp.size = Vector3(ww - 0.1, rh - 0.1, 0.16)
		g.mesh = gp
		g.material_override = _plaster
		g.position = Vector3(0, top + (rh - 0.1) / 2, z)
		n.add_child(g)
		var zz: float = z + signf(z) * 0.07
		_bx(n, Vector3(0.17, rh * 0.85, 0.12), Vector3(0, top + rh * 0.42, zz), _beam)
		for sd in [-1, 1]:
			var dx := ww * 0.3
			var dy := rh * 0.62
			_bx(n, Vector3(sqrt(dx * dx + dy * dy), 0.15, 0.12), Vector3(sd * dx / 2, top + dy / 2, zz), _beam, -sd * atan2(dy, dx))
	# Chimenea de piedra con humo.
	var cx := 0.0
	_bx(n, Vector3(0.75, rh + 1.0, 0.75), Vector3(cx, top + (rh + 1.0) / 2, -dp / 4), _stonewall)
	_bx(n, Vector3(0.9, 0.18, 0.9), Vector3(cx, top + rh + 1.0, -dp / 4), _stonewall)
	var smoke := CPUParticles3D.new()
	smoke.amount = 10
	smoke.lifetime = 4.0
	smoke.position = Vector3(cx, top + rh + 1.2, -dp / 4)
	smoke.direction = Vector3(0.3, 1, 0)
	smoke.spread = 25.0
	smoke.gravity = Vector3(0.25, 0.35, 0)
	smoke.initial_velocity_min = 0.4
	smoke.initial_velocity_max = 0.7
	smoke.scale_amount_min = 0.6
	smoke.scale_amount_max = 1.6
	var sq := QuadMesh.new()
	sq.size = Vector2(0.9, 0.9)
	var smat := StandardMaterial3D.new()
	var gt := GradientTexture2D.new()
	var gr := Gradient.new()
	gr.set_color(0, Color(1, 1, 1, 1))
	gr.set_color(1, Color(1, 1, 1, 0))
	gt.gradient = gr
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	smat.albedo_texture = gt
	smat.albedo_color = Color(0.72, 0.72, 0.74, 0.3)
	smat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	smat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	smat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	sq.material = smat
	smoke.mesh = sq
	n.add_child(smoke)
	if props:
		_props(n, w, dp, variant)
	return n


## Dos faldones gruesos (ridge a lo largo de la casa) y una cumbrera redondeada.
static func _roof_slabs(n: Node3D, ww: float, wd: float, top: float, rh: float, mat: Material) -> void:
	var half := ww / 2 + 0.55
	var ang := atan2(rh, ww / 2)
	var L := half / cos(ang)
	for sd in [-1, 1]:
		var m := _bx(n, Vector3(L, 0.38, wd + 1.1), Vector3(-sd * (half / 2 - 0.12), top + rh - half * tan(ang) / 2 + 0.12, 0), mat, sd * ang)
		m.rotation.z = sd * ang
	if mat == _thatch:
		# Paja en capas: escalones a lo largo del faldón y un borde grueso en el alero.
		for sd in [-1, 1]:
			for k in [0.36, 0.7]:
				var px: float = -sd * half * k
				var py: float = top + rh - half * k * tan(ang) + 0.3
				var t := _bx(n, Vector3(L * 0.08, 0.16, wd + 1.12), Vector3(px, py, 0), mat, sd * ang)
				t.rotation.z = sd * ang
	var rid := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 0.3
	c.bottom_radius = 0.3
	c.height = wd + 1.1
	rid.mesh = c
	rid.material_override = mat
	rid.rotation.x = PI / 2
	rid.position = Vector3(0, top + rh + 0.12, 0)
	n.add_child(rid)


## Leña apilada, cajas y un barril junto a la puerta.
static func _props(n: Node3D, w: float, dp: float, variant: int) -> void:
	var sd := 1 if variant % 2 == 0 else -1
	var fx: float = sd * (w / 2 - 0.4)
	var logm := _plank
	for row in 3:
		for k in 4 - row:
			var m := MeshInstance3D.new()
			var c := CylinderMesh.new()
			c.top_radius = 0.14
			c.bottom_radius = 0.14
			c.height = 1.1
			m.mesh = c
			m.material_override = logm
			m.rotation.z = PI / 2
			m.position = Vector3(fx, 0.14 + row * 0.25, dp / 2 + 0.35 + (k - (3 - row) / 2.0) * 0.28)
			m.rotation.y = PI / 2
			n.add_child(m)
	if variant % 3 != 1:
		_bx(n, Vector3(0.7, 0.6, 0.7), Vector3(-fx, 0.3, dp / 2 + 0.6), _plank)
		_bx(n, Vector3(0.55, 0.5, 0.55), Vector3(-fx * 0.82, 0.25, dp / 2 + 1.25), _plank)
	put(n, "village/Barrel.glb", Vector3(-fx * 0.45, 0, dp / 2 + 0.55), 0.3, 1.25)


## Valla de mimbre trenzado entre dos puntos, con estacas.
static var _wattle_mat: StandardMaterial3D
static func wattle(parent: Node, a: Vector3, b: Vector3, h := 0.95) -> void:
	_mats()
	if _wattle_mat == null:
		var img := Image.create(64, 64, false, Image.FORMAT_RGB8)
		for y in 64:
			for x in 64:
				var strand := (y / 8) % 2
				var wave := sin((x + strand * 16) * PI / 16.0)
				var c := Color(0.42, 0.3, 0.17).lightened(0.12 * wave) if (y % 8) > 0 else Color(0.18, 0.12, 0.07)
				img.set_pixel(x, y, c)
		_wattle_mat = StandardMaterial3D.new()
		_wattle_mat.albedo_texture = ImageTexture.create_from_image(img)
		_wattle_mat.uv1_triplanar = true
		_wattle_mat.uv1_scale = Vector3(0.9, 0.9, 0.9)
		_wattle_mat.roughness = 1.0
	var len := a.distance_to(b)
	var mid := (a + b) / 2
	var panel := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(len, h, 0.09)
	panel.mesh = bm
	panel.material_override = _wattle_mat
	parent.add_child(panel)
	panel.position = mid + Vector3(0, h / 2, 0)
	panel.rotation.y = atan2(-(b.z - a.z), b.x - a.x)
	var n := int(ceil(len / 1.2)) + 1
	for k in n:
		var p := a.lerp(b, float(k) / float(n - 1))
		var m := MeshInstance3D.new()
		var c := CylinderMesh.new()
		c.top_radius = 0.05
		c.bottom_radius = 0.06
		c.height = h + 0.25
		m.mesh = c
		m.material_override = _beam
		m.position = p + Vector3(0, (h + 0.25) / 2, 0)
		parent.add_child(m)


static func _node(parent: Node, pos: Vector3, rot: float, s: float) -> Node3D:
	_mats()
	var n := Node3D.new()
	n.position = pos
	n.rotation.y = rot
	n.scale = Vector3.ONE * s
	parent.add_child(n)
	return n


static func _roof(n: Node3D, size: Vector3, pos: Vector3, mat: Material) -> void:
	var m := MeshInstance3D.new()
	var pm := PrismMesh.new()
	pm.size = size
	m.mesh = pm
	m.material_override = mat
	m.position = pos
	n.add_child(m)


static func _cyl(n: Node3D, r: float, h: float, pos: Vector3, mat: Material) -> void:
	var m := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r
	c.height = h
	m.mesh = c
	m.material_override = mat
	m.position = pos
	n.add_child(m)


## Capilla de piedra: nave con tejado de tablilla, espadaña con campana y cruz.
static func chapel(parent: Node, pos: Vector3, rot: float, s := 1.0) -> Node3D:
	var n := _node(parent, pos, rot, s)
	_bx(n, Vector3(6.0, 4.2, 9.0), Vector3(0, 2.1, -0.5), _stonewall)
	_roof(n, Vector3(6.8, 3.0, 9.6), Vector3(0, 5.7, -0.5), _shingle)
	_bx(n, Vector3(3.0, 8.0, 0.9), Vector3(0, 4.0, 4.2), _stonewall)
	_roof(n, Vector3(3.2, 1.2, 1.1), Vector3(0, 8.6, 4.2), _shingle)
	var dark := flat(Color(0.07, 0.05, 0.04))
	_bx(n, Vector3(0.9, 1.1, 0.95), Vector3(0, 6.6, 4.2), dark)
	_bx(n, Vector3(0.55, 0.6, 0.6), Vector3(0, 6.5, 4.2), flat(Color(0.55, 0.42, 0.18)))
	_bx(n, Vector3(1.5, 2.6, 0.14), Vector3(0, 1.3, 4.7), _beam)
	_bx(n, Vector3(0.16, 1.4, 0.16), Vector3(0, 9.9, 4.2), _beam)
	_bx(n, Vector3(0.8, 0.16, 0.16), Vector3(0, 10.2, 4.2), _beam)
	for z in [-3.0, 0.0]:
		for sd in [-1, 1]:
			_bx(n, Vector3(0.06, 1.4, 0.5), Vector3(sd * 3.0, 2.8, z), dark)
	return n


## Granero o establo: tablones, tejado de paja grande y portón doble.
static func barn(parent: Node, pos: Vector3, rot: float, s := 1.0) -> Node3D:
	var n := _node(parent, pos, rot, s)
	_bx(n, Vector3(7.0, 3.6, 6.0), Vector3(0, 1.8, 0), _plank)
	_roof(n, Vector3(7.8, 3.0, 6.8), Vector3(0, 5.1, 0), _thatch)
	_bx(n, Vector3(2.8, 3.0, 0.12), Vector3(0, 1.5, 3.02), _beam)
	_bx(n, Vector3(0.12, 3.0, 0.16), Vector3(0, 1.5, 3.08), flat(Color(0.12, 0.08, 0.05)))
	for sd in [-1, 1]:
		_bx(n, Vector3(0.2, 3.6, 0.2), Vector3(sd * 3.5, 1.8, 3.0), _beam)
		_bx(n, Vector3(3.2, 0.14, 0.14), Vector3(sd * 0.75, 1.5, 3.1), _beam, sd * 0.75)
	return n


## Torre de piedra con chapitel (universidad, iglesia mayor).
static func tower(parent: Node, pos: Vector3, h: float, s := 1.0) -> Node3D:
	var n := _node(parent, pos, 0.0, s)
	_bx(n, Vector3(3.2, h, 3.2), Vector3(0, h / 2, 0), _stonewall)
	var m := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 0.0
	c.bottom_radius = 2.6
	c.height = 3.5
	c.radial_segments = 4
	m.mesh = c
	m.material_override = _shingle
	m.position = Vector3(0, h + 1.75, 0)
	m.rotation.y = PI / 4
	n.add_child(m)
	return n


## Talleres con su aspecto propio: casa medieval y lo que delata el oficio.
const WORKSHOPS := ["herreria", "telar", "curtiduria", "queseria", "cerveceria", "escuela", "hospital", "establo", "granero", "capilla", "universidad"]
static func workshop(parent: Node, id: String, pos: Vector3, rot: float, s := 1.0) -> Node3D:
	var n := _node(parent, pos, rot, s)
	var dark := flat(Color(0.2, 0.2, 0.22))
	match id:
		"herreria":
			medieval_house(n, Vector3(0, 0, -0.5), 0.0, 1, 2)
			# Cobertizo abierto de la fragua, con yunque y brasas.
			for x in [3.2, 5.6]:
				for z in [-1.8, 1.8]:
					_bx(n, Vector3(0.18, 2.6, 0.18), Vector3(x, 1.3, z), _beam)
			_bx(n, Vector3(3.0, 0.15, 4.2), Vector3(4.4, 2.7, 0), _shingle, -0.18)
			_bx(n, Vector3(1.2, 0.9, 1.2), Vector3(4.6, 0.45, -1.0), _stonewall)
			_bx(n, Vector3(0.8, 0.12, 0.8), Vector3(4.6, 0.95, -1.0), flat(Color(1.0, 0.35, 0.05)))
			var l := OmniLight3D.new()
			l.light_color = Color(1.0, 0.5, 0.2)
			l.omni_range = 4.0
			l.light_energy = 1.2
			l.position = Vector3(4.6, 1.4, -1.0)
			n.add_child(l)
			var sg := Sprite3D.new()
			sg.texture = load("res://assets/ui/cartel_herreria.png")
			sg.pixel_size = 0.0045
			sg.position = Vector3(-1.6, 3.0, 3.05)
			sg.shaded = true
			sg.double_sided = true
			n.add_child(sg)
			_bx(n, Vector3(0.7, 0.45, 0.35), Vector3(4.3, 0.75, 1.0), dark)
			_bx(n, Vector3(0.35, 0.5, 0.3), Vector3(4.3, 0.25, 1.0), _beam)
		"telar", "curtiduria", "queseria":
			medieval_house(n, Vector3(0, 0, -0.5), 0.0, 1, id.length())
			var cols: Array = {"telar": [Color(0.6, 0.15, 0.12), Color(0.2, 0.3, 0.6), Color(0.85, 0.8, 0.6)], "curtiduria": [Color(0.45, 0.3, 0.18), Color(0.5, 0.36, 0.22), Color(0.4, 0.27, 0.16)], "queseria": []}[id]
			if not cols.is_empty():
				# Tendedero con telas o pieles.
				for x in [-3.4, 3.4]:
					_bx(n, Vector3(0.14, 2.2, 0.14), Vector3(x, 1.1, 4.2), _beam)
				_bx(n, Vector3(6.8, 0.08, 0.08), Vector3(0, 2.15, 4.2), _beam)
				for k in 3:
					_bx(n, Vector3(1.4, 1.3, 0.04), Vector3(-2.2 + k * 2.2, 1.45, 4.2), flat(cols[k]))
			if id == "curtiduria":
				for x in [-3.6, 3.6]:
					_cyl(n, 0.6, 0.8, Vector3(x, 0.4, 2.0), _plank)
			if id == "queseria":
				_bx(n, Vector3(2.0, 0.08, 0.7), Vector3(-3.2, 0.9, 2.2), _beam)
				for k in 4:
					_cyl(n, 0.28, 0.16, Vector3(-3.9 + k * 0.45, 1.02, 2.2), flat(Color(0.95, 0.8, 0.35)))
		"cerveceria", "escuela", "hospital":
			medieval_house(n, Vector3(0, 0, -0.5), 0.0, 2, id.length())
		"establo":
			barn(n, Vector3.ZERO, 0.0, 1.0)
		"granero":
			barn(n, Vector3.ZERO, 0.0, 1.15)
		"capilla":
			chapel(n, Vector3(0, 0, -0.5), 0.0, 1.0)
		"universidad":
			medieval_house(n, Vector3(-1.2, 0, -0.5), 0.0, 2, 1, 1.15)
			tower(n, Vector3(3.6, 0, -1.5), 9.0)
	return n


static func hut(parent: Node, pos: Vector3, rot: float, s := 1.0) -> Node3D:
	_mats()
	var n := Node3D.new()
	n.position = pos
	n.rotation.y = rot
	n.scale = Vector3.ONE * s
	parent.add_child(n)
	var walls := MeshInstance3D.new()
	var wb := BoxMesh.new()
	wb.size = Vector3(4.6, 2.3, 4.2)
	walls.mesh = wb
	walls.material_override = _plank
	walls.position = Vector3(0, 1.15, 0)
	n.add_child(walls)
	var roof := MeshInstance3D.new()
	var pm := PrismMesh.new()
	pm.size = Vector3(5.4, 1.9, 4.9)
	roof.mesh = pm
	roof.material_override = _thatch
	roof.position = Vector3(0, 2.3 + 0.95, 0)
	n.add_child(roof)
	var dark := flat(Color(0.18, 0.12, 0.07))
	for b in [[Vector3(1.0, 1.7, 0.08), Vector3(0.7, 0.85, 2.12)], [Vector3(0.6, 0.5, 0.08), Vector3(-1.2, 1.5, 2.12)], [Vector3(0.18, 2.4, 0.18), Vector3(-2.3, 1.2, 2.1)], [Vector3(0.18, 2.4, 0.18), Vector3(2.3, 1.2, 2.1)], [Vector3(0.18, 2.4, 0.18), Vector3(-2.3, 1.2, -2.1)], [Vector3(0.18, 2.4, 0.18), Vector3(2.3, 1.2, -2.1)]]:
		var m := MeshInstance3D.new()
		var bx := BoxMesh.new()
		bx.size = b[0]
		m.mesh = bx
		m.material_override = dark
		m.position = b[1]
		n.add_child(m)
	return n


static func road(parent: Node, a: Vector3, b: Vector3, w: float, col: Color) -> MeshInstance3D:
	roads.append([Vector2(a.x, a.z), Vector2(b.x, b.z), w * 0.5 + 0.4])
	# Camino de tierra con bordes irregulares que se funden con la hierba.
	var m := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(w * 1.45, a.distance_to(b) + w)
	m.mesh = pm
	m.material_override = soft_road(col)
	parent.add_child(m)
	m.look_at_from_position((a + b) / 2 + Vector3(0, 0.03, 0), b + Vector3(0, 0.03, 0), Vector3.UP)
	return m


static var _soft := {}
static func soft_road(col: Color) -> ShaderMaterial:
	if not _soft.has(col):
		var sh := Shader.new()
		sh.code = """shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled;
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D nmap : hint_normal, filter_linear_mipmap, repeat_enable;
uniform vec4 tint : source_color;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 uv = wp.xz * 0.25;
	ALBEDO = texture(tex, uv).rgb * tint.rgb;
	NORMAL_MAP = texture(nmap, uv).rgb;
	ROUGHNESS = 1.0;
	float n = texture(tex, wp.xz * 0.045).r;
	float edge = 0.26 + (n - 0.4) * 0.35;
	ALPHA = smoothstep(0.0, edge, UV.x) * smoothstep(1.0, 1.0 - edge, UV.x);
}"""
		var m := ShaderMaterial.new()
		m.shader = sh
		m.set_shader_parameter("tex", load("res://assets/tex/tierra_color.jpg"))
		m.set_shader_parameter("nmap", load("res://assets/tex/tierra_normal.png"))
		m.set_shader_parameter("tint", Color(col.r / 0.416, col.g / 0.351, col.b / 0.265))
		_soft[col] = m
	return _soft[col]


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
