extends SkeletonModifier3D
## Postura de jinete: piernas abiertas y colgando a los lados del caballo, pase lo que pase arriba.

var splay := 0.45
var lift := 0.55
var bend := 0.7
var seated := true  # true mientras el jinete usa la pose de montar; si ataca, se fija la cadera
var hip = null


func _process_modification() -> void:
	var s := get_skeleton()
	var pv := s.find_bone("pelvis")
	if seated or hip == null:
		hip = s.get_bone_pose_position(pv)
	else:
		s.set_bone_pose_position(pv, hip)
	for side in [["l", 1.0], ["r", -1.0]]:
		var th := s.find_bone("thigh_" + side[0])
		var ca := s.find_bone("calf_" + side[0])
		var g := Basis(Vector3(0, 0, 1), side[1] * splay) * Basis(Vector3(1, 0, 0), -lift) * s.get_bone_global_rest(th).basis.orthonormalized()
		var pg := s.get_bone_global_pose(s.get_bone_parent(th)).basis.orthonormalized()
		s.set_bone_pose_rotation(th, (pg.inverse() * g).get_rotation_quaternion())
		var cg := Basis(Vector3(1, 0, 0), bend) * g * s.get_bone_global_rest(th).basis.orthonormalized().inverse() * s.get_bone_global_rest(ca).basis.orthonormalized()
		s.set_bone_pose_rotation(ca, (g.inverse() * cg).get_rotation_quaternion())
