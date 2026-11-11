# MIT License

# Copyright (c) 2017 GiveMeAllYourCats

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the 'Software'), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

# Code author: Hotox
# Repo: https://github.com/michaeldegroot/cats-blender-plugin
# Edits by: GiveMeAllYourCats

import bpy, io

from contextlib import redirect_stdout
from . import common as Common
from ...common import kklog
#from .register import register_wrap
#from .translations import t

#@register_wrap
class MergeWeights(bpy.types.Operator):
    bl_idname = 'kkbp.cats_merge_weights'
    bl_label = 'cats merge weights'
    #bl_description = t('MergeWeights.desc')
    bl_options = {'REGISTER', 'UNDO'}
    '''
    @classmethod
    def poll(cls, context):
        active_obj = bpy.context.active_object
        if not active_obj or not bpy.context.active_object.type == 'ARMATURE':
            return False
        if active_obj.mode == 'EDIT' and bpy.context.selected_editable_bones:
            return True
        if active_obj.mode == 'POSE' and bpy.context.selected_pose_bones:
            return True

        return False
    '''
    def execute(self, context):
        saved_data = Common.SavedData()

        armature = bpy.context.object

        Common.switch('EDIT')

        # Find which bones to work on and put their name and their parent in a list
        parenting_list = {}
        for bone in bpy.context.selected_editable_bones:
            parent = bone.parent
            while parent and parent.parent and parent in bpy.context.selected_editable_bones:
                parent = parent.parent
            if not parent:
                continue
            parenting_list[bone.name] = parent.name

        # Merge all the bones in the parenting list
        merge_weights(armature, parenting_list)

        saved_data.load()

        self.report({'INFO'}, 'cats merge weights success')
        return {'FINISHED'}
    
def merge_weights(armature, parenting_list):
    Common.switch('OBJECT')
    # Merge the weights on the meshes
    # The original implementation created and applied a VERTEX_WEIGHT_MIX modifier
    # once per (mesh, bone) pair. Each bpy.ops.object.modifier_apply call forces a
    # full dependency-graph re-evaluation and pushes to the undo stack, so with
    # dozens of meshes and hundreds/thousands of bones it ran for hours/days.
    #
    # This version does the exact same math (target_weight += source_weight, then
    # delete the source group) directly on the mesh's vertex-group data in a single
    # pass per mesh.
    meshes = Common.get_meshes_objects(armature_name=armature.name, visible_only=bpy.context.scene.merge_visible_meshes_only if bpy.context.scene.get('merge_visible_meshes_only') != None else True)

    for mindex, mesh in enumerate(meshes):
        vgs = mesh.vertex_groups
        merge_map = {}
        for bone, parent in parenting_list.items():
            vg_from = vgs.get(bone)
            if not vg_from:
                continue
            vg_to = vgs.get(parent)
            if not vg_to:
                vg_to = vgs.new(name=parent)
            merge_map[vg_from.index] = vg_to

        kklog(f'Merging weights: object {mindex + 1} / {len(meshes)} ({mesh.name}), {len(merge_map)} groups')

        if not merge_map:
            continue

        for v in mesh.data.vertices:
            adds = None
            for g in v.groups:
                vg_to = merge_map.get(g.group)
                if vg_to is not None and g.weight > 0.0:
                    if adds is None:
                        adds = []
                    adds.append((vg_to, g.weight))
            if adds:
                vidx = (v.index,)
                for vg_to, w in adds:
                    vg_to.add(vidx, w, 'ADD')

        # Remove the merged source groups.
        for bone in parenting_list.keys():
            src = vgs.get(bone)
            if src:
                vgs.remove(src)

    # Select armature
    Common.unselect_all()
    Common.set_active(armature)
    Common.switch('EDIT')

    # Delete merged bones
    for bone in parenting_list.keys():
        edit_bone = armature.data.edit_bones.get(bone)
        if edit_bone:
            armature.data.edit_bones.remove(edit_bone)
