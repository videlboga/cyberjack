bl_info = {
    'name': 'Cyberjack · Full Body Tickle',
    'author': 'Cyberjack',
    'version': (1, 0),
    'blender': (5, 2, 0),
    'location': 'F3 → Tickle: Full Body Session',
    'description': 'Райкаст по коже → зона → независимые каналы реакции',
    'category': 'Animation',
}

import bpy
import blf
import json
import math
import sys
import time
from pathlib import Path
from mathutils import Vector
from bpy_extras import view3d_utils

HERE = Path(__file__).resolve().parent if '__file__' in globals() else Path(bpy.data.filepath).parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
from fullbody_model import FullBodyReaction
from rig_performance import FullBodyRig


def clamp(x):
    return max(0.0, min(1.0, x))


class TICKLE_OT_fullbody(bpy.types.Operator):
    active = None
    bl_idname = 'tickle.fullbody'
    bl_label = 'Tickle: Full Body Session'
    bl_options = {'REGISTER'}

    def setup(self, context):
        TICKLE_OT_fullbody.active = self
        self.perf = FullBodyRig()
        self.model = FullBodyReaction(seed=7)
        self.force = 0.66
        self.tool_id = 'fingers'
        self.button = False
        self.hit = None
        self.hover = 0.0
        self.last_hit_point = None
        self.pointer_speed = 0.0
        self.last_move = time.monotonic()
        self.last_tick = time.monotonic()
        self.absolute_t = 1.0
        self.tick_count = 0
        self.state = self.model.step(1 / 30, None)
        self.region = None
        self.draw = None
        self.timer = None
        self.finished = False

    def finish(self, context):
        if self.finished:
            return
        self.finished = True
        TICKLE_OT_fullbody.active = None
        if self.timer and bpy.app.timers.is_registered(self.timer):
            bpy.app.timers.unregister(self.timer)
        if self.draw:
            bpy.types.SpaceView3D.draw_handler_remove(self.draw, 'WINDOW')
        if self.perf:
            neutral = self.model.step(1 / 30, None)
            self.perf.apply(neutral, self.absolute_t)
            self.perf.tool.hide_render = True
        for area in context.screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.update()
                area.tag_redraw()

    def set_camera(self, context, name):
        context.scene.camera = bpy.data.objects[name]
        for area in context.screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.region_3d.view_perspective = 'CAMERA'
                space.region_3d.view_camera_zoom = 0
                area.tag_redraw()

    def raycast(self, context, event):
        region = context.region
        rv3d = context.region_data
        coord = (event.mouse_region_x, event.mouse_region_y)
        origin = view3d_utils.region_2d_to_origin_3d(region, rv3d, coord)
        direction = view3d_utils.region_2d_to_vector_3d(region, rv3d, coord)
        dg = context.evaluated_depsgraph_get()
        hit, point, normal, face, obj, _ = context.scene.ray_cast(dg, origin, direction)
        if not hit or obj != self.perf.body:
            self.hit = None
            self.hover = 0.0
            self.last_hit_point = None
            self.pointer_speed = 0.0
            return
        now = time.monotonic()
        dt = max(1e-3, now - self.last_move)
        if self.last_hit_point is not None:
            self.pointer_speed = clamp((point - self.last_hit_point).length / dt / 0.15)
        self.last_hit_point = point.copy()
        self.last_move = now
        attrs = self.perf.body.data.attributes
        zone_id = attrs['zone_id'].data[face].value if 0 <= face < len(attrs['zone_id'].data) else -1
        intertoe = attrs['intertoe_side'].data[face].value if 0 <= face < len(attrs['intertoe_side'].data) else 0
        if zone_id < 0 and not intertoe:
            self.hit = None
            return
        zone = 'intertoe' if intertoe else self.perf.zone_names[zone_id]
        sensitivity = attrs['sensitivity'].data[face].value if zone_id >= 0 else 0.78
        self.hit = {'point': point, 'normal': normal.normalized(), 'zone': zone,
                    'sensitivity': sensitivity, 'face': face}
        self.hover = clamp(self.hover + dt * 1.5)

    def tick(self):
        if self.finished:
            return None
        now = time.monotonic()
        dt = min(0.075, max(1 / 240, now - self.last_tick))
        self.last_tick = now
        self.absolute_t += dt
        self.tick_count += 1
        contact = None
        override = None
        if self.button and self.hit:
            override = (self.hit['point'], self.hit['normal'])
            contact = {'zone': self.hit['zone'], 'tool': self.tool_id, 'force': self.force,
                       'speed': max(0.05, self.pointer_speed), 'area': 0.70,
                       'source': 'external', 'hover': self.hover, 'expectedness': None}
        self.state = self.model.step(dt, contact)
        self.perf.apply(self.state, self.absolute_t, override)
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                area.tag_redraw()
        return 1 / 30

    def draw_hud(self, context):
        if not self.region:
            return
        st = self.state
        x, y = 18, self.region.height - 24
        lines = [
            f"Зона: {st.get('family') and self.perf.last_zone or '—'}   {st.get('character', 'rest')}",
            f"Стимул {st.get('stimulus', 0):.2f}  Привыкание {st.get('adaptation', 0):.2f}  Усталость {st.get('load', 0):.2f}",
            f"Тело {st.get('body', 0):.2f}  Мимика {st.get('face', 0):.2f}  Дыхание {st.get('breath', 0):.2f}  Рот {st.get('mouth', 0):.2f}",
            f"Задержки, мс: {json.dumps(st.get('onsets_ms', {}), ensure_ascii=False)}",
            f"Инструмент: {self.tool_id}  Сила: {self.force:.2f}",
            'ЛКМ: контакт · 1/2/3: сила · Q/W/E: перо/пальцы/ногти',
            'F: тело · G: лицо · H: подошва · R: сброс · ESC: выход',
        ]
        for i, line in enumerate(lines):
            blf.position(0, x, y - i * 19, 0)
            blf.size(0, 14)
            blf.draw(0, line)

    def invoke(self, context, event):
        self.setup(context)
        if context.area.type != 'VIEW_3D':
            self.report({'ERROR'}, 'Запустить из 3D-вида')
            return {'CANCELLED'}
        self.region = context.region
        self.draw = bpy.types.SpaceView3D.draw_handler_add(self.draw_hud, (context,), 'WINDOW', 'POST_PIXEL')
        bpy.app.timers.register(self.tick, first_interval=1 / 30)
        self.timer = self.tick
        self.set_camera(context, 'Camera_Full')
        context.window_manager.modal_handler_add(self)
        return {'RUNNING_MODAL'}

    def modal(self, context, event):
        if event.type == 'ESC':
            self.finish(context)
            return {'CANCELLED'}
        if event.type == 'LEFTMOUSE':
            self.button = event.value == 'PRESS'
            self.raycast(context, event)
            return {'RUNNING_MODAL'}
        if event.type == 'MOUSEMOVE':
            self.raycast(context, event)
            return {'RUNNING_MODAL'}
        if event.value == 'PRESS':
            if event.type in {'ONE', 'NUMPAD_1'}:
                self.force = 0.33
            elif event.type in {'TWO', 'NUMPAD_2'}:
                self.force = 0.66
            elif event.type in {'THREE', 'NUMPAD_3'}:
                self.force = 1.0
            elif event.type == 'Q':
                self.tool_id = 'feather'
            elif event.type == 'W':
                self.tool_id = 'fingers'
            elif event.type == 'E':
                self.tool_id = 'nails'
            elif event.type == 'R':
                self.model = FullBodyReaction(seed=7)
                self.absolute_t = 1.0
            elif event.type == 'F':
                self.set_camera(context, 'Camera_Full')
            elif event.type == 'G':
                self.set_camera(context, 'Camera_Face')
            elif event.type == 'H':
                self.set_camera(context, 'Camera_Sole')
            return {'RUNNING_MODAL'}
        return {'RUNNING_MODAL'}


def register():
    bpy.utils.register_class(TICKLE_OT_fullbody)


register()
