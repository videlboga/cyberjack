import bpy, sys, os

def sanitizeMaterialName(text: str) -> str:
    for ch in ['\\','`','*','<','>','.',':','?','|','/','\"']:
        if ch in text:
            text = text.replace(ch,'')
    return text

#folder that contains one model
pmx_folder = os.path.join(sys.argv[-1],'')
print(pmx_folder)

save_path = os.path.join(os.path.dirname(os.path.dirname(pmx_folder)), os.path.basename(os.path.dirname(pmx_folder)) + '.blend')
error_path = os.path.join(os.path.dirname(os.path.dirname(pmx_folder)), 'Error - ' + os.path.basename(os.path.dirname(pmx_folder)) + '.blend')

try:
    bpy.context.scene.kkbp.import_dir = pmx_folder
    bpy.ops.kkbp.kkbpimport('EXEC_DEFAULT')
    bpy.ops.wm.save_as_mainfile(filepath=save_path)
    bpy.ops.wm.quit_blender()
except:
    #There was an error during import. Oh well
    bpy.ops.wm.save_as_mainfile(filepath=error_path)
    bpy.ops.wm.quit_blender()
