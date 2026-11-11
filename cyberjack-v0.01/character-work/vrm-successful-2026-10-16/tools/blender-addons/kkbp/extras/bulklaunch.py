'''
Bulk import wrapper
'''
import bpy, traceback, os, subprocess, sys
from .. import common as c
from ..interface.dictionary_en import t

class bulk_launch(bpy.types.Operator):
    bl_idname = "kkbp.bulklaunch"
    bl_label = "Launch bulk import"
    bl_description = t('bulk_launch_tt')
    bl_options = {'REGISTER', 'UNDO'}

    filepath : bpy.props.StringProperty(maxlen=1024, default='', options={'HIDDEN'}, subtype="DIR_PATH")
    filter_glob : bpy.props.StringProperty(default='*', options={'HIDDEN'})

    def execute(self, context):
        try:
            auto_import_script = os.path.join(os.path.dirname(__file__), 'auto_import.py')
            blender_exe_path = bpy.app.binary_path
            folder = self.filepath
            print(folder)
            if not folder:
                return {'CANCELLED'}
            subfolders = [os.path.join(folder, f) for f in os.listdir(folder)]
            for subfolder in subfolders:
                subprocess.run([blender_exe_path, 
                            '--python', 
                            auto_import_script,
                            '--',
                            subfolder])
            return {'FINISHED'}
        except:
            c.kklog('Unknown python error occurred', type = 'error')
            c.kklog(traceback.format_exc())
            self.report({'ERROR'}, traceback.format_exc())
            return {"CANCELLED"}

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}
