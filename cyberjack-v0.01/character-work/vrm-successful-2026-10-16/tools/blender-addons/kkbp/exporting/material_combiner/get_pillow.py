import os
import subprocess
import sys
from typing import Set
from . import globs
from ... import common as c
from ...interface.dictionary_en import t
import bpy

class InstallPIL(bpy.types.Operator):
    bl_idname = 'kkbp.get_pillow'
    bl_label = 'Install Pillow'
    bl_description = t('pillow_tt')

    def execute(self, context: bpy.types.Context) -> Set[str]:
        try:
            from PIL import Image, ImageChops
        except ImportError:
            self._install_pillow()

        globs.pil_exist = 'restart'

        self.report({'INFO'}, 'Installation complete')
        return {'FINISHED'}

    @staticmethod
    def _install_pillow() -> None:
        def _refresh_kkbp():
            kkbp_addon_name = [addon.module for addon in bpy.context.preferences.addons if 'kkbp' in addon.module][0]
            bpy.ops.preferences.addon_disable(module=kkbp_addon_name)
            bpy.ops.wm.save_userpref()
            bpy.ops.preferences.addon_enable(module=kkbp_addon_name)
            bpy.ops.wm.save_userpref()
        
        #first, download pillow from pypi for this platform
        from pip import _internal
        wheels_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'wheels')
        _internal.main(['download', 'pillow', '--dest', wheels_folder])

        #then edit the blender_manifest.toml file to include the wheel file
        manifest_file = os.path.join(os.path.dirname(wheels_folder), 'blender_manifest.toml')
        with open(manifest_file, 'r') as f:
            contents = f.read()
        wheel_filename = os.listdir(wheels_folder)[0]
        contents = contents.replace('#wheel_placeholder', f'wheels = ["./wheels/{wheel_filename}"]')
        with open(manifest_file, 'w') as f:
            f.write(contents)

        #the wheel is now downloaded to the kkbp extension folder, 
        # and the wheels field in the manifest file has been updated,
        # but blender won't install it until the addon is disabled then renabled
        #wait a second to allow this script to finish, then do that
        bpy.app.timers.register(_refresh_kkbp, first_interval=1)

