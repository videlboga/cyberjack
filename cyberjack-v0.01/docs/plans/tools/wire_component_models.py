import json
import struct
from pathlib import Path

BASE = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/machine-modules')
CP = BASE / 'component-catalog.json'
MP = BASE / 'component-models.json'
cc = json.loads(CP.read_text(encoding='utf-8'))
by_id = {c['id']: c for c in cc['components']}

CORE = {
    'structure_base', 'structure_portal', 'support_cradle', 'motion_linear_x',
    'motion_lift_z', 'work_tickle_pair', 'work_probe_linear', 'work_rotary_disc',
    'control_console', 'utility_routing',
}

CORE_MOTION = {
    'motion_linear_x': {
        'type': 'slide', 'axis': 'x', 'amount': 0.20, 'speed': 0.82,
        'parts': ['carriage_bottom', 'carriage_top', 'carriage_cheek_F', 'carriage_cheek_B'],
    },
    'motion_lift_z': {
        'type': 'slide', 'axis': 'y', 'amount': 0.10, 'speed': 0.78,
        'parts': ['carriage_bridge', 'carriage_cheek_L', 'carriage_cheek_R'],
    },
    'work_probe_linear': {
        'type': 'slide', 'axis': 'z', 'amount': 0.10, 'speed': 0.90,
        'parts': ['output_shaft', 'contact_tip'],
    },
    'work_rotary_disc': {
        'type': 'spin', 'axis': 'y', 'speed': 1.25,
        'parts': ['soft_rotor', 'soft_lobes', 'lobe_ribs', 'rotor_ridges', 'hub', 'hub_cap', 'shaft', 'spindle_pulley', 'rotation_mark', 'rotation_dot'],
    },
    'work_tickle_pair': {
        'type': 'spin', 'axis': 'z', 'speed': 2.60,
        'parts': ['brush_ring_0', 'brush_ring_1'],
    },
    'control_console': {'type': 'pulse', 'speed': 2.20, 'part': 'display_face'},
    'utility_routing': {'type': 'pulse', 'speed': 1.50, 'part': 'drive_connector'},
}

NEW_MOTION = {
    'work_tickle_firm': {'type': 'spin', 'axis': 'x', 'speed': 1.8},
    'work_tickle_soft': {'type': 'spin', 'axis': 'x', 'speed': 1.3},
    'work_tickle_radial': {'type': 'spin', 'axis': 'x', 'speed': 1.65},
    'work_feather_fan': {'type': 'swing', 'axis': 'z', 'amount': 0.45, 'speed': 1.2},
    'work_air_jet': {'type': 'scale', 'axis': 'x', 'amount': 0.15, 'speed': 2.0},
    'work_probe_inflatable': {'type': 'scale', 'axis': 'yz', 'amount': 0.10, 'speed': 1.0},
    'work_rotary_drum': {'type': 'spin', 'axis': 'x', 'speed': 1.1},
    'work_probe_rotary': {'type': 'spin', 'axis': 'x', 'speed': 1.6},
    'work_impact_paddle': {'type': 'swing', 'axis': 'z', 'amount': 0.611, 'speed': 9.425},
    'work_impact_roller': {'type': 'spin', 'axis': 'z', 'speed': 1.2},
    'work_foot_cradle': {'type': 'spin', 'axis': 'z', 'speed': 1.1},
    'work_roller': {'type': 'spin', 'axis': 'z', 'speed': 1.2},
    'fluid_mixer': {'type': 'spin', 'axis': 'y', 'speed': 1.4},
    'motion_piston_rod': {'type': 'slide', 'axis': 'x', 'amount': 0.09, 'speed': 0.90},
    'motion_piston_pneumatic': {'type': 'slide', 'axis': 'x', 'amount': 0.10, 'speed': 1.20},
    'motion_piston_hydraulic': {'type': 'slide', 'axis': 'x', 'amount': 0.08, 'speed': 0.70},
    'motion_piston_telescopic': {'type': 'slide', 'axis': 'x', 'amount': 0.12, 'speed': 0.65},
    'motion_piston_cam': {'type': 'slide', 'axis': 'x', 'amount': 0.06, 'speed': 1.60},
    'motion_piston_servo': {'type': 'slide', 'axis': 'x', 'amount': 0.07, 'speed': 1.10},
    'work_attach_smooth': {'type': 'spin', 'axis': 'x', 'speed': 1.00},
    'work_attach_ribbed': {'type': 'spin', 'axis': 'x', 'speed': 1.25},
    'work_attach_spiral': {'type': 'spin', 'axis': 'x', 'speed': 1.40},
    'work_attach_nodular': {'type': 'spin', 'axis': 'x', 'speed': 1.10},
    'work_attach_tapered': {'type': 'spin', 'axis': 'x', 'speed': 0.90},
    'work_attach_bulbous': {'type': 'spin', 'axis': 'x', 'speed': 0.85},
    'work_attach_curved': {'type': 'spin', 'axis': 'x', 'speed': 0.80},
    'work_attach_dual_density': {'type': 'spin', 'axis': 'x', 'speed': 1.00},
    'work_attach_vibrating': {'type': 'vibrate', 'axis': 'x', 'amount': 0.003, 'speed': 28},
    'work_attach_inflatable': {'type': 'scale', 'axis': 'yz', 'amount': 0.07, 'speed': 1.20},
    'work_attach_sleeve': {'type': 'none'},
    'work_attach_adapter': {'type': 'none'},
    'work_attach_sterile_liner': {'type': 'none'},
    'work_attach_carousel': {'type': 'spin', 'axis': 'y', 'speed': 0.90},
}

GENERIC_MOTION = {
    'motion_linear_y': {'type': 'slide', 'axis': 'y', 'amount': 0.08, 'speed': 0.80},
    'motion_rotary': {'type': 'spin', 'axis': 'x', 'speed': 1.10},
    'motion_oscillating': {'type': 'slide', 'axis': 'x', 'amount': 0.04, 'speed': 1.50},
    'motion_spreader': {'type': 'none'},
    'motion_winch': {'type': 'spin', 'axis': 'x', 'speed': 0.90},
    'motion_turntable': {'type': 'spin', 'axis': 'y', 'speed': 0.80},
    'work_tickle_soft': {'type': 'spin', 'axis': 'x', 'speed': 1.30},
    'work_tickle_firm': {'type': 'spin', 'axis': 'x', 'speed': 1.55},
    'work_tickle_radial': {'type': 'spin', 'axis': 'x', 'speed': 1.65},
    'work_feather_fan': {'type': 'spin', 'axis': 'x', 'speed': 0.70},
    'work_foot_cradle': {'type': 'none'},
    'work_probe_inflatable': {'type': 'scale', 'axis': 'yz', 'amount': 0.06, 'speed': 1.10},
    'work_probe_thermal': {'type': 'none'},
    'work_probe_textured': {'type': 'spin', 'axis': 'x', 'speed': 1.10},
    'work_probe_rotary': {'type': 'spin', 'axis': 'x', 'speed': 1.30},
    'work_rotary_drum': {'type': 'spin', 'axis': 'x', 'speed': 1.10},
    'work_impact_paddle': {'type': 'spin', 'axis': 'x', 'speed': 1.60},
    'work_impact_roller': {'type': 'none'},
    'work_electro_pad': {'type': 'none'},
    'work_electro_collar': {'type': 'none'},
    'work_thermal_pad': {'type': 'none'},
    'work_air_jet': {'type': 'none'},
    'work_spray': {'type': 'none'},
    'work_roller': {'type': 'spin', 'axis': 'y', 'speed': 1.10},
    'work_irrigation': {'type': 'none'},
    'work_suction': {'type': 'none'},
    'fluid_mixer': {'type': 'spin', 'axis': 'y', 'speed': 1.40},
    'sensory_light': {'type': 'none'},
}


def glb_node_count(path):
    b = path.read_bytes()
    magic, ver, total = struct.unpack('<III', b[:12])
    off = 12
    clen, ctype = struct.unpack('<II', b[off:off + 8])
    j = json.loads(b[off + 8:off + 8 + clen])
    return len(j.get('nodes', []))


manifest = {}
for c in cc['components']:
    cid = c['id']
    path = BASE / 'components' / f'{cid}.glb'
    if not path.is_file():
        print('MISSING', cid)
        continue
    prefix = c.get('legacyId') if cid in CORE else cid
    if cid in {'motion_linear_x','motion_lift_z','work_tickle_pair','work_probe_linear','work_rotary_disc','control_console'}:
        prefix = cid
    if cid in CORE_MOTION:
        motion = CORE_MOTION[cid]
    elif cid in NEW_MOTION:
        motion = NEW_MOTION[cid]
    elif cid in GENERIC_MOTION:
        motion = GENERIC_MOTION[cid]
    else:
        motion = {'type': 'none'}
    model = {
        'file': f'components/{cid}.glb',
        'prefix': prefix,
        'motion': motion,
        'nodes': glb_node_count(path),
    }
    if cid in ('work_tickle_firm', 'work_tickle_soft', 'work_tickle_radial', 'work_feather_fan', 'work_probe_textured', 'work_air_jet', 'work_probe_inflatable', 'work_rotary_drum', 'work_probe_rotary', 'work_impact_paddle', 'work_probe_thermal', 'work_impact_roller', 'work_electro_pad', 'work_electro_collar', 'work_thermal_pad', 'work_spray', 'work_foot_cradle', 'work_roller', 'work_irrigation', 'work_suction', 'fluid_mixer', 'restraint_wrist_cuff', 'restraint_ankle_cuff', 'restraint_thigh_clamp', 'restraint_waist_belt', 'restraint_neck_yoke', 'restraint_head_frame', 'restraint_stirrup', 'restraint_spreader', 'restraint_suspension_cuff', 'restraint_quick_release', 'restraint_matrix', 'surface_soft', 'surface_anti_slip', 'surface_heated', 'surface_cooled', 'surface_fluid_channel', 'surface_liner', 'surface_sensor', 'surface_contour', 'sensory_hood', 'sensory_visor', 'sensory_audio', 'sensory_light', 'control_telemetry', 'control_estop', 'control_interlock', 'utility_power', 'utility_data', 'utility_air', 'utility_water', 'utility_drain', 'utility_routing', 'service_dock', 'service_cleaner', 'structure_gantry', 'structure_bed_frame', 'structure_cage', 'structure_suspension_frame', 'structure_stall_row', 'structure_dock', 'motion_linear_y', 'motion_oscillating', 'motion_spreader', 'motion_winch', 'motion_turntable', 'work_attach_smooth', 'work_attach_ribbed', 'work_attach_spiral', 'work_attach_nodular', 'work_attach_tapered', 'work_attach_bulbous', 'work_attach_curved', 'work_attach_dual_density', 'work_attach_vibrating', 'work_attach_inflatable', 'work_attach_sleeve', 'work_attach_adapter', 'work_attach_sterile_liner', 'work_attach_carousel', 'motion_piston_rod', 'motion_piston_pneumatic', 'motion_piston_hydraulic', 'motion_piston_telescopic', 'motion_piston_cam', 'motion_piston_servo', 'structure_base', 'structure_portal', 'support_cradle', 'motion_linear_x', 'motion_lift_z', 'motion_rotary', 'work_tickle_pair', 'work_probe_linear', 'work_rotary_disc', 'control_console'):
        model['quality'] = 'refined'
    c['model'] = model
    manifest[cid] = {
        'file': model['file'],
        'prefix': prefix,
        'class': c['class'],
        'status': c['status'],
        'bytes': path.stat().st_size,
        'nodes': model['nodes'],
        'motion': motion['type'],
    }

CP.write_text(json.dumps(cc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
MP.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wired', len(manifest), 'models; files', len(list((BASE / 'components').glob('*.glb'))))
print('missing', sorted({c['id'] for c in cc['components']} - set(manifest)))
print('motion counts', {k: sum(1 for v in manifest.values() if v['motion'] == k) for k in sorted({v['motion'] for v in manifest.values()})})
