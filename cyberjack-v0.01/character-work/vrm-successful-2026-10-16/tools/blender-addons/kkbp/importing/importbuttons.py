'''
This file performs the following operations
·	Delete default scene
·	Set view transform to Standard
·	Create KK log in the scripting tab
·	Save the import folder path and character name for later
·	Import all pmx files from folder path, then tag them for later
.   Invokes the other import operations based on what options were chosen on the panel
'''

import bpy, os, datetime

from ..interface.dictionary_en import t
from .. import common as c

class kkbp_import(bpy.types.Operator):
    bl_idname = "kkbp.kkbpimport"
    bl_label = "Import .pmx file"
    bl_description = t('kkbp_import_tt')
    bl_options = {'REGISTER', 'UNDO'}

    filepath : bpy.props.StringProperty(maxlen=1024, default='', options={'HIDDEN'})
    filter_glob : bpy.props.StringProperty(default='*.pmx', options={'HIDDEN'})
    
    def execute(self, context):

        #Check if MMD tools is installed before doing anything
        if not [addon for addon in bpy.context.preferences.addons if 'mmd_tools' in addon.module]:
            self.report({'ERROR'}, 'MMD tools is not installed! Install it from the Blender extensions website: https://extensions.blender.org/')
            return {'CANCELLED'}

        #delete the default scene if present
        if len(bpy.data.objects) == 3:
            for obj in ['Camera', 'Light', 'Cube']:
                if bpy.data.objects.get(obj):
                    bpy.data.objects.remove(bpy.data.objects[obj])
        #if the default scene was not present, make sure the default collection is at least there
        if not bpy.data.collections.get('Collection'):
            new_col = bpy.data.collections.new('Collection')
            bpy.context.scene.collection.children.link(new_col)
            bpy.context.scene.view_layers[0].active_layer_collection = bpy.context.view_layer.layer_collection.children[new_col.name]

        #Set the view transform 
        bpy.data.scenes[0].display_settings.display_device = 'sRGB'
        bpy.context.scene.view_settings.view_transform = 'Standard'
        bpy.data.scenes[0].view_settings.look = 'None'

        #save filepath for later
        bpy.context.scene.kkbp.import_dir = str(self.filepath)[:-9] if self.filepath else bpy.context.scene.kkbp.import_dir

        #check if there is at least one "Outfit ##" folder inside of this directory
        #   if there isn't, then the user incorrectly chose the .pmx file inside of the outfit directory
        #   correct the path to the .pmx file inside of the root directory
        subdirs = [i[1] for i in os.walk(c.get_import_path())][0]
        outfit_subdirs = [i for i in subdirs if 'Outfit ' in i]
        if not outfit_subdirs:
            bpy.context.scene.kkbp.import_dir = os.path.dirname(os.path.dirname(c.get_import_path()))
            c.kklog('User chose wrong pmx file. Defaulting to pmx file located at ' + str(c.get_import_path()), 'warn')
        
        try:
            c.json_file_manager.init()
        except:
            self.report({'ERROR'}, 'There was an issue reading the JSON files! Make sure there are .json files in the same folder as your .pmx file! Also make sure you are using the correct version of the exporter (Koikatsu Sunshine uses a different exporter .dll).')
            return {'CANCELLED'}
        
        bpy.context.scene.kkbp.character_name = c.json_file_manager.get_json_file(f'{c.get_prefix()}_CharacterInfoData.json')[0]['Name']
        
        #Enforce version checking
        if c.is_kk():
            card_exporter_version = [int(i) for i in c.json_file_manager.get_json_file('KK_KKBPExporterConfig.json')['exporterVersion'].split('.')]
            if card_exporter_version[0] < c.get_latest_exporter_version()[0] or card_exporter_version[1] < c.get_latest_exporter_version()[1]:
                bpy.context.scene.kkbp.use_rigify = False
                self.report({'ERROR'}, f'This card was exported with an outdated version of the KKBP Exporter! Please re-export using KKBP Exporter version {c.get_latest_exporter_version()[0]}.{str(c.get_latest_exporter_version()[1]).zfill(2)}!')
                return {'CANCELLED'}

        #if the name is longer than 64 characters, blender will cut off the name, leading to some issues later on. 
        #so I'll arbitrarily cut off the name at 40 characters to be safe (needs to be an even number). The .encode() is used to handle multibyte characters like japanese / korean names
        if len(bpy.context.scene.kkbp.character_name.encode()) >= 40:
            try:
                bpy.context.scene.kkbp.character_name = bpy.context.scene.kkbp.character_name.encode()[:40].decode()
            except:
                #There was a combination of multibyte and alphanumeric characters that resulted in an odd number
                bpy.context.scene.kkbp.character_name = bpy.context.scene.kkbp.character_name.encode()[:39].decode()


        #force pmx armature selection if exportCurrentPose in the Exporter Config json is true
        if c.is_kk():
            force_current_pose = c.json_file_manager.get_json_file('KK_KKBPExporterConfig.json')['exportCurrentPose']
            if force_current_pose:
                bpy.context.scene.kkbp.use_rigify = False

        functions = [
                lambda:bpy.ops.kkbp.modifymesh('INVOKE_DEFAULT'),
                lambda:bpy.ops.kkbp.modifyarmature('INVOKE_DEFAULT'),
                lambda:bpy.ops.kkbp.modifymaterial('INVOKE_DEFAULT'),
                lambda:bpy.ops.kkbp.postoperations('INVOKE_DEFAULT'),
            ]
        
        #run functions
        c.toggle_console()
        self.import_pmx_models()
        for index, function in enumerate(functions):
            print('Import function {} running'.format(index))
            function()
        c.toggle_console()
        c.kklog('KKBP import finished in {} minutes'.format(round(((datetime.datetime.now().minute * 60 + datetime.datetime.now().second + datetime.datetime.now().microsecond / 1e6) - bpy.context.scene.kkbp.total_timer) / 60, 2)))
        return {'FINISHED'}
        
    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

    def import_pmx_models(self):
        c.kklog('Importing pmx files with mmdtools...')
        
        for subdir, dirs, files in os.walk(c.get_import_path()):
            for file in [f for f in files if f == 'model.pmx']:
                pmx_path = os.path.join(subdir, file)
                outfit = 'Outfit' in subdir
                outfit_id = str(subdir[-2:])

                #import the pmx file with mmd_tools
                bpy.ops.mmd_tools.import_model('EXEC_DEFAULT',
                    filepath=pmx_path,
                    scale=1,
                    clean_model = False,
                    types={'MESH', 'ARMATURE', 'MORPHS'})

                #tag the newly imported object. The active object is the empty, so apply it to the armature and the mesh
                bpy.context.view_layer.objects.active['name'] = c.get_name()
                bpy.context.view_layer.objects.active.children[0]['name'] = c.get_name()
                bpy.context.view_layer.objects.active.children[0].children[0]['name'] = c.get_name()
                #keep track of the outfit ID if this is an outfit
                if outfit:
                    bpy.context.view_layer.objects.active.children[0].children[0]['coord'] = outfit_id
                    bpy.context.view_layer.objects.active.children[0].children[0]['id'] = outfit_id
                    bpy.context.view_layer.objects.active.children[0].children[0]['outfit'] = True
                    bpy.context.view_layer.objects.active.children[0].children[0].name = f'Outfit {outfit_id} {c.get_name()}'
                else:
                    bpy.context.view_layer.objects.active.children[0].children[0].name = 'Body ' + c.get_name()
                    bpy.context.view_layer.objects.active.children[0].children[0]['body'] = True
                    bpy.context.view_layer.objects.active.children[0].name = 'Armature ' + c.get_name()
                    bpy.context.view_layer.objects.active.children[0]['armature'] = True
                #get rid of the text files the mmd tools addon generates
                if bpy.data.texts.get('Model'):
                    bpy.data.texts.remove(bpy.data.texts['Model'])
                    bpy.data.texts.remove(bpy.data.texts['Model_e'])
        #rename the collection to the character name
        bpy.data.collections['Collection'].name = c.get_name()
        c.initialize_timer()
        c.print_timer('Import PMX')
