extends Node
## Sonido del juego (autoload "SFX"): efectos y música en bucle con fundido.

const SOUNDS := {
	"talar": ["impact_wood_heavy_000", "impact_wood_heavy_001", "impact_wood_heavy_002", "chop"],
	"picar": ["impact_mining_000", "impact_mining_001", "impact_mining_002"],
	"paso": ["footstep_grass_000", "footstep_grass_001", "footstep_grass_002"],
	"paso_nieve": ["footstep_snow_000", "footstep_snow_001", "footstep_snow_002"],
	"espada": ["knife_slice", "knife_slice_2", "draw_knife_1"],
	"golpe": ["impact_punch_medium_000", "impact_punch_medium_001", "impact_punch_medium_002"],
	"choque": ["impact_metal_heavy_000", "impact_metal_heavy_001", "impact_metal_heavy_002"],
	"monedas": ["handle_coins", "handle_coins_2"],
	"campana": ["impact_bell_heavy_000", "impact_bell_heavy_001"],
	"cosecha": ["cloth_1"],
	"puerta": ["door_open_1"],
}

var music_on := true
var _pool: Array = []
var _next := 0
var _last := {}
var _cache := {}
var _music: AudioStreamPlayer
var _music_old: AudioStreamPlayer
var _track := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in 16:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)
	_music = AudioStreamPlayer.new()
	add_child(_music)
	_music_old = AudioStreamPlayer.new()
	add_child(_music_old)


func _stream(name: String) -> AudioStream:
	if not _cache.has(name):
		_cache[name] = load("res://assets/audio/%s.ogg" % name)
	return _cache[name]


## Reproduce un efecto. 'gap' evita que el mismo sonido se amontone (p. ej. en batallas grandes).
func play(kind: String, vol_db := 0.0, gap := 0.05) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	if now - float(_last.get(kind, -1.0)) < gap:
		return
	_last[kind] = now
	var p: AudioStreamPlayer = _pool[_next]
	_next = (_next + 1) % _pool.size()
	p.stream = _stream(SOUNDS[kind].pick_random())
	p.volume_db = vol_db - 4.0
	p.pitch_scale = randf_range(0.9, 1.1)
	p.play()


## Cambia la música con un fundido suave. Pistas: aldea, mapa, batalla.
func music(track: String) -> void:
	if track == _track:
		return
	_track = track
	var tmp := _music_old
	_music_old = _music
	_music = tmp
	var s: AudioStreamOggVorbis = _stream("musica_" + track)
	s.loop = true
	_music.stream = s
	_music.volume_db = -40.0
	if music_on:
		_music.play()
	var tw := create_tween()
	tw.tween_property(_music, "volume_db", -11.0, 2.0)
	tw.parallel().tween_property(_music_old, "volume_db", -40.0, 2.0)
	tw.tween_callback(_music_old.stop)


func toggle_music() -> void:
	music_on = not music_on
	if music_on:
		_music.volume_db = -11.0
		_music.play()
	else:
		_music.stop()
