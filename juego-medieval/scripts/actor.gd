extends Node3D
## Personaje animado: cuerpo base + ropa/pelo sobre un único esqueleto.

const M := preload("res://scripts/models.gd")

var skel: Skeleton3D
var anim: AnimationPlayer
var current := ""
var horse: Node3D
var horse_anim: AnimationPlayer
var body: Node3D
const SADDLE := 1.05
const RIDE := {"Jog_Fwd": "Gallop", "Sprint": "Gallop", "Walk": "Walk", "Death01": "Death", "Hit_Chest": "Idle_HitReact_Left"}


## parts: rutas bajo assets/ sin extensión (ej. "ubc/Superhero_Male_FullBody").
## opts: faction (azul/rojo/bandido), hair_color, hide_hood, sword, shield, helmet.
func build(parts: Array, opts := {}) -> void:
	body = M.inst(parts[0] + ".gltf")
	add_child(body)
	skel = body.find_child("Skeleton3D", true, false)
	M.fix_body(body)
	for i in range(1, parts.size()):
		var extra := M.inst(parts[i] + ".gltf")
		for mi in extra.find_children("*", "MeshInstance3D", true, false):
			if opts.get("hide_hood", false) and mi.name.contains("Hood"):
				continue
			mi.get_parent().remove_child(mi)
			mi.owner = null
			skel.add_child(mi)
			mi.skeleton = NodePath("..")
			if parts[i].begins_with("hair/") and opts.has("hair_color"):
				M.recolor_mesh(mi, opts["hair_color"])
		extra.free()
	if opts.has("faction"):
		_retex(opts["faction"])
	anim = AnimationPlayer.new()
	body.add_child(anim)
	anim.add_animation_library("", M.anim_lib())
	if opts.get("sword", false):
		attach("hand_r", "weapons/Sword.glb", Vector3(0, 0.05, 0), Vector3(0, 0, 90), 1.0)
	if opts.get("shield", false):
		var sh := attach("lowerarm_l", "weapons/Shield_Heater.glb", Vector3(0, 0.15, -0.1), Vector3(0, 0, 90), 0.75)
		M.recolor(sh, {"azul": Color(0.12, 0.2, 0.5), "rojo": Color(0.5, 0.06, 0.06)}.get(opts.get("faction", ""), Color(0.35, 0.25, 0.15)))
	if opts.get("helmet", "") != "":
		M.recolor(attach("Head", "knight/%s.glb" % opts["helmet"], Vector3(0, 0.13, 0.015), Vector3(0, 180, 0), 0.27), Color(0.55, 0.56, 0.6))
	play("Idle")


func _retex(faction: String) -> void:
	var tex: Texture2D = load("res://assets/tex/Ranger_%s.png" % faction)
	for mi in skel.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var m = mi.mesh.surface_get_material(i)
			if m is StandardMaterial3D and m.albedo_texture and m.albedo_texture.resource_path.contains("Ranger"):
				var mm: StandardMaterial3D = m.duplicate()
				mm.albedo_texture = tex
				mi.set_surface_override_material(i, mm)


## Adjunta un objeto rígido a un hueso, centrado y escalado a 'size' metros.
func attach(bone: String, path: String, off: Vector3, rot: Vector3, size: float) -> Node3D:
	var ba := BoneAttachment3D.new()
	ba.bone_name = bone
	skel.add_child(ba)
	var pivot := Node3D.new()
	ba.add_child(pivot)
	var k := skel.global_transform.basis.get_scale().x if is_inside_tree() else _skel_scale()
	pivot.position = off / k
	pivot.rotation_degrees = rot
	var w := M.inst(path)
	var bb := M.aabb_of(w)
	pivot.scale = Vector3.ONE * (size / maxf(bb.size.x, maxf(bb.size.y, bb.size.z)) / k)
	w.position = -bb.get_center()
	pivot.add_child(w)
	return pivot


func _skel_scale() -> float:
	var t := Transform3D()
	var n: Node = skel
	while n != null and n != self:
		if n is Node3D:
			t = n.transform * t
		n = n.get_parent()
	return t.basis.get_scale().x


## Sube al personaje a un caballo (caballería). Las animaciones se reparten entre jinete y montura.
func mount(coat: Color) -> void:
	horse = M.inst("animals/Horse.glb")
	var bb := M.aabb_of(horse)
	horse.scale = Vector3.ONE * (2.3 / maxf(bb.size.x, maxf(bb.size.y, bb.size.z)))
	add_child(horse)
	M.recolor_coat(horse, coat)
	horse_anim = horse.find_child("AnimationPlayer", true, false)
	for n in ["Idle", "Gallop", "Walk"]:
		horse_anim.get_animation("AnimalArmature|" + n).loop_mode = Animation.LOOP_LINEAR
	body.position = Vector3(0, SADDLE, -0.1)
	current = ""
	play("Idle")


func _rider(anim_name: String) -> String:
	if horse == null:
		return anim_name
	horse_anim.play("AnimalArmature|" + RIDE.get(anim_name, "Idle"), 0.2)
	if anim_name == "Death01":
		body.position = Vector3(0.9, 0, 0)
		return anim_name
	return anim_name if anim_name in ["Sword_Attack", "Hit_Chest", "Spell_Simple_Shoot"] else "Driving"


func play(anim_name: String, blend := 0.2) -> void:
	if current == anim_name:
		return
	current = anim_name
	anim.play(_rider(anim_name), blend)


## Reproduce desde el principio aunque ya esté sonando (ataques, golpes).
func play_once(anim_name: String, blend := 0.1) -> void:
	current = anim_name
	anim.play(_rider(anim_name), blend)
	anim.seek(0.0, true)


func is_playing_once() -> bool:
	return anim.is_playing() and current in ["Sword_Attack", "Interact", "Hit_Chest", "PickUp_Table"]
