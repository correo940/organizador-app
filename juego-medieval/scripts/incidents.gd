extends Node3D
## Sucesos que se ven y se juegan en el pueblo: incendios que hay que apagar con cubos de agua,
## ladrones nocturnos (y el alguacil), y animales sueltos o zorros en el gallinero.

const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const CORRAL := Vector3(36, 0, 16)
const EDGE := Vector3(118, 0, 40)

var v
var bucket := false
var fire_node: Node3D
var fire_sig := ""
var flames: Array = []
var thief = null  # {a, t, stolen}
var thief_cd := 30.0
var guard
var pig_node: Node3D
var pig_t := Vector3.ZERO
var fox_node: Node3D


# ---------------- Lógica diaria (estática) ----------------

static func day() -> void:
	var d = GS.data
	var loose = d.get("loose", null)
	if loose != null and int(d["total_days"]) - int(loose["since"]) >= 1:
		d["animals"]["cerdo"] = maxi(0, int(d["animals"]["cerdo"]) - 1)
		d["loose"] = null
		GS.say("El cerdo que se escapó no ha vuelto: lo das por perdido.")
	elif loose == null and int(d["animals"].get("cerdo", 0)) > 0 and randf() < 0.04:
		d["loose"] = {"since": int(d["total_days"])}
		GS.say("¡Se ha escapado un cerdo del corral! Anda suelto por el pueblo.")
	if d.get("fox", false):
		d["fox"] = false
		if int(d["animals"].get("gallina", 0)) > 0:
			d["animals"]["gallina"] = int(d["animals"]["gallina"]) - 1
			GS.say("Un zorro se ha llevado una gallina esta noche.")
	if int(d["animals"].get("gallina", 0)) > 0 and randf() < 0.05:
		d["fox"] = true
	if d.get("bailiff", false):
		if int(d["gold"]) >= 3:
			d["gold"] = int(d["gold"]) - 3
		else:
			d["bailiff"] = false
			GS.say("Sin paga, el alguacil deja su puesto.")


static func start_fire() -> void:
	var d = GS.data
	if d["villagers"].is_empty() or d.get("fire", null) != null:
		return
	var who = d["villagers"].pick_random()
	d["fire"] = {"v": who["name"], "hp": 35.0}
	GS.popups.append({"title": "¡Fuego!", "text": "¡Arde la casa de %s! Coge agua del pozo de la plaza (E) y échala sobre las llamas antes de que se extienda. Los vecinos ayudarán." % who["name"], "button": "¡Corre!"})


# ---------------- En la escena del pueblo ----------------

func _process(delta: float) -> void:
	var d = GS.data
	_update_fire(delta, d)
	_update_thief(delta, d)
	_update_animals(delta, d)


func _fire_pos(d: Dictionary) -> Vector3:
	for vv in d["villagers"]:
		if vv["name"] == d["fire"]["v"]:
			return v._door(vv) + Vector3(0, 0, 0)
	return v.PLAZA + Vector3(14, 0, -14)


func _update_fire(delta: float, d: Dictionary) -> void:
	var f = d.get("fire", null)
	var sig := "" if f == null else str(int(f["hp"]) / 20)
	if sig != fire_sig:
		fire_sig = sig
		if fire_node:
			fire_node.queue_free()
			fire_node = null
		if f != null:
			fire_node = Node3D.new()
			add_child(fire_node)
			var p := _fire_pos(d)
			var n := 1 + int(f["hp"]) / 20
			# Llamas (conos que parpadean) en la puerta y sobre el tejado de la casa.
			flames.clear()
			for k in 3 + n * 3:
				var up := 0.0 if k < 3 else randf_range(2.5, 4.5)
				var fm := MeshInstance3D.new()
				var cm := CylinderMesh.new()
				cm.top_radius = 0.0
				cm.bottom_radius = randf_range(0.4, 0.8)
				cm.height = randf_range(1.2, 2.6) * (0.8 + float(f["hp"]) / 100.0)
				fm.mesh = cm
				var mat := StandardMaterial3D.new()
				mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
				mat.albedo_color = [Color(1.0, 0.45, 0.1), Color(1.0, 0.7, 0.15), Color(0.95, 0.25, 0.05)][k % 3] * 2.2
				fm.material_override = mat
				fm.position = p + Vector3(randf_range(-2.2, 2.2), up + cm.height / 2, randf_range(-2.2, 2.2))
				fire_node.add_child(fm)
				flames.append(fm)
			# Partículas de fuego y humo.
			for pk in 2:
				var ps := CPUParticles3D.new()
				var smoke := pk == 1
				ps.amount = 60 if not smoke else 40
				ps.lifetime = 1.0 if not smoke else 3.5
				ps.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
				ps.emission_box_extents = Vector3(2.0, 0.3, 2.0)
				ps.direction = Vector3(0, 1, 0)
				ps.spread = 12.0
				ps.gravity = Vector3(0, 2.5 if not smoke else 0.8, 0)
				ps.initial_velocity_min = 1.0
				ps.initial_velocity_max = 2.5
				ps.scale_amount_min = 0.6
				ps.scale_amount_max = 1.4
				var qm := QuadMesh.new()
				qm.size = Vector2(0.7, 0.9) if not smoke else Vector2(1.4, 1.4)
				var pm := StandardMaterial3D.new()
				pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
				pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				pm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
				pm.vertex_color_use_as_albedo = true
				qm.material = pm
				ps.mesh = qm
				var g := Gradient.new()
				if smoke:
					g.set_color(0, Color(0.35, 0.33, 0.32, 0.5))
					g.set_color(1, Color(0.5, 0.5, 0.5, 0.0))
				else:
					g.set_color(0, Color(1.0, 0.85, 0.3, 0.95))
					g.set_color(1, Color(0.9, 0.2, 0.05, 0.0))
				ps.color_ramp = g
				ps.position = p + Vector3(0, 0.3 if not smoke else 3.5, 0)
				fire_node.add_child(ps)
			var l := OmniLight3D.new()
			l.light_color = Color(1.0, 0.5, 0.2)
			l.light_energy = 2.0 + float(f["hp"]) / 25.0
			l.omni_range = 14.0
			l.position = p + Vector3(0, 3, 0)
			fire_node.add_child(l)
			var lb := M.label3d("¡FUEGO! %d%%" % int(f["hp"]), 48)
			lb.position = p + Vector3(0, 5, 0)
			lb.modulate = Color(1, 0.4, 0.2)
			fire_node.add_child(lb)
	if f == null:
		return
	for fm in flames:
		if is_instance_valid(fm):
			fm.scale = Vector3(1, randf_range(0.75, 1.25), 1)
	f["hp"] = float(f["hp"]) + delta * (1.2 if not "fuente" in GS.TL.works_done() else 0.8) - delta * 0.15 * mini(4, d["villagers"].size())
	if float(f["hp"]) >= 100.0:
		d["fire"] = null
		GS.EVENTS._burn()
		GS.popups.append({"title": "El fuego se extiende", "text": "No habéis podido frenar las llamas: arden varias casas.", "button": "Continuar"})
	elif float(f["hp"]) <= 0.0:
		d["fire"] = null
		d["prestige"] += 8
		for vv in d["villagers"]:
			vv["mood"] = mini(100, int(vv["mood"]) + 5)
			vv["affection"] = mini(100, int(vv["affection"]) + 3)
		GS.popups.append({"title": "¡Fuego apagado!", "text": "Entre todos habéis apagado el incendio. El pueblo te lo agradece. (+8 prestigio)", "button": "Continuar"})


# ---------------- Ladrones y alguacil ----------------

func _update_thief(delta: float, d: Dictionary) -> void:
	var t: float = d["time"]
	var night := t < 0.2 or t > 0.86
	# El alguacil hace la ronda por la noche.
	if d.get("bailiff", false) and guard == null:
		guard = ACTOR.new()
		add_child(guard)
		guard.build(["ubc/Superhero_Male_FullBody", "out/Male_Ranger"], {"faction": "azul", "hide_hood": true, "shield": true, "helmet": "Helmet1"})
		guard.attach("hand_r", "weapons/Spear.glb", Vector3(0, 0.05, 0), Vector3(0, 0, 90), 2.3)
		guard.position = v.PLAZA
		var gl := M.label3d("Alguacil", 32)
		gl.position = Vector3(0, 2.3, 0)
		guard.add_child(gl)
	elif not d.get("bailiff", false) and guard != null:
		guard.queue_free()
		guard = null
	if guard != null:
		var gt: Vector3 = v.PLAZA + Vector3(sin(Time.get_ticks_msec() / 9000.0) * 14.0, 0, cos(Time.get_ticks_msec() / 9000.0) * 14.0)
		v._walk_to(guard, gt, 1.6, delta)
	if thief == null:
		if not night:
			return
		thief_cd -= delta * GS.speed
		if thief_cd > 0:
			return
		thief_cd = randf_range(60.0, 140.0)
		if randf() > 0.35 or d["villagers"].is_empty():
			return
		if d.get("bailiff", false) and randf() < 0.7:
			GS.say("El alguacil sorprende a un ladrón entrando en el pueblo y lo echa a palos.")
			return
		var a := ACTOR.new()
		add_child(a)
		a.build(["ubc/Superhero_Male_FullBody", "out/Male_Ranger"], {"faction": "bandido", "hide_hood": false})
		a.position = EDGE
		var victim = d["villagers"].pick_random()
		thief = {"a": a, "t": v._door(victim), "stolen": false, "who": victim["name"]}
		GS.say("Algo se mueve entre las casas... ¿un ladrón?")
		return
	var a = thief["a"]
	var to: Vector3 = thief["t"] - a.position
	to.y = 0
	if to.length() < 0.6:
		if not thief["stolen"]:
			thief["stolen"] = true
			var g := mini(int(d["gold"]), randi_range(5, 15))
			d["gold"] = int(d["gold"]) - g
			thief["gold"] = g
			GS.say("¡Un ladrón ha robado en casa de %s y se lleva %d de tu oro del arca del concejo!" % [thief["who"], g])
			thief["t"] = EDGE
		else:
			a.queue_free()
			thief = null
		return
	a.position += to.normalized() * minf(to.length(), (2.0 if not thief["stolen"] else 3.6) * delta)
	a.rotation.y = atan2(to.x, to.z)
	a.play("Walk" if not thief["stolen"] else "Sprint")


# ---------------- Animales sueltos ----------------

func _update_animals(delta: float, d: Dictionary) -> void:
	var loose = d.get("loose", null)
	if loose != null and pig_node == null:
		pig_node = M.inst("animals/Pig.fbx")
		var bb := M.aabb_of(pig_node)
		pig_node.scale = Vector3.ONE * (1.1 / maxf(bb.size.x, maxf(bb.size.y, bb.size.z)))
		add_child(pig_node)
		pig_node.position = CORRAL + Vector3(8, 0, 6)
		pig_t = pig_node.position
	elif loose == null and pig_node != null:
		pig_node.queue_free()
		pig_node = null
	if pig_node != null:
		var to: Vector3 = pig_t - pig_node.position
		to.y = 0
		if to.length() < 0.5:
			pig_t = v.PLAZA + Vector3(randf_range(-20, 20), 0, randf_range(-20, 20))
		else:
			pig_node.position += to.normalized() * 1.5 * delta
			pig_node.rotation.y = atan2(to.x, to.z)
	var t: float = d["time"]
	var fox: bool = d.get("fox", false) and (t < 0.2 or t > 0.82)
	if fox and fox_node == null:
		fox_node = M.inst("animals/Wolf.glb")
		var bb := M.aabb_of(fox_node)
		fox_node.scale = Vector3.ONE * (0.8 / maxf(bb.size.x, maxf(bb.size.y, bb.size.z)))
		M.recolor_coat(fox_node, Color(2.2, 1.1, 0.5))
		add_child(fox_node)
		fox_node.position = CORRAL + Vector3(-6, 0, 3)
	elif not fox and fox_node != null:
		fox_node.queue_free()
		fox_node = null


# ---------------- Interacción ----------------

func find_interaction(pp: Vector3) -> Dictionary:
	var d = GS.data
	if d.get("fire", null) != null:
		if bucket and pp.distance_to(_fire_pos(d)) < 5.0:
			return {"type": "inc_douse", "label": "Echar el agua al fuego"}
		var well: Vector3 = v.PLAZA
		if not bucket and (pp.distance_to(well) < 3.5 or pp.distance_to(v.PLAZA + Vector3(13, 0, 13)) < 3.5):
			return {"type": "inc_bucket", "label": "Llenar un cubo de agua"}
	if thief != null and pp.distance_to(thief["a"].position) < 2.5:
		return {"type": "inc_thief", "label": "¡Atrapar al ladrón!"}
	if pig_node != null and pp.distance_to(pig_node.position) < 2.0:
		return {"type": "inc_pig", "label": "Atrapar al cerdo y devolverlo al corral"}
	if fox_node != null and pp.distance_to(fox_node.position) < 3.0:
		return {"type": "inc_fox", "label": "Espantar al zorro"}
	return {}


func interact(it: Dictionary) -> void:
	var d = GS.data
	v.player.play_once("Interact")
	match it["type"]:
		"inc_bucket":
			bucket = true
			v._float("Llevas un cubo de agua: ¡corre al fuego!", Color(0.6, 0.8, 1.0))
		"inc_douse":
			bucket = false
			d["fire"]["hp"] = float(d["fire"]["hp"]) - (40.0 if "fuente" in GS.TL.works_done() else 28.0)
			v._float("¡Splash!", Color(0.6, 0.8, 1.0))
		"inc_thief":
			var g := int(thief.get("gold", 0))
			d["gold"] = int(d["gold"]) + g
			d["prestige"] += 4
			thief["a"].queue_free()
			thief = null
			v._float("¡Ladrón atrapado! Recuperas %d de oro. (+4 prestigio)" % g, Color(1, 0.9, 0.6))
		"inc_pig":
			d["loose"] = null
			v._float("El cerdo vuelve al corral.", Color(1, 0.9, 0.8))
		"inc_fox":
			d["fox"] = false
			v._float("El zorro huye al bosque.", Color(1, 0.8, 0.6))
