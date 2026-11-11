
# This file performs the following operations

# 	Hide all clothes except the first outfit (alts are always hidden)

#   (Cycles) Applies Cycles conversion script
#   (Eevee Mod) Applies Eevee Mod conversion script
#   (Rigify) Applies Rigify conversion script
#   (SFW) Runs SFW cleanup script

# 	Clean orphaned data as long as users = 0 and fake user = False

# Parts of cycles replacement was taken from https://github.com/FlailingFog/KK-Blender-Porter-Pack/issues/234


import bpy
import numpy as np
from .. import common as c

class post_operations(bpy.types.Operator):
    bl_idname = "kkbp.postoperations"
    bl_label = bl_idname
    bl_description = bl_idname
    bl_options = {'REGISTER', 'UNDO'}
    
    def execute(self, context):
        try:
            self.apply_cycles()
            self.apply_eeveemod()
            self.apply_principled()
            self.apply_rigify()
            self.apply_sfw()
            self.separate_meshes()
            self.apply_outlines()
            self.mark_body_freestyle_faces()
            self.apply_viewport_colors()

            self.hide_unused_objects()

            c.switch(c.get_rig() if c.get_rig() else c.get_armature(), 'object')
            c.clean_orphaned_data()
            c.set_viewport_shading('SOLID')

            return {'FINISHED'}
        except Exception as error:
            c.handle_error(self, error)
            return {"CANCELLED"}

    # %% Main functions    
    def hide_unused_objects(self):
        """
        Hides unused objects in the Blender scene based on certain conditions.

        This method performs the following operations:
        1. Ensures the correct armature is visible.
        3. Hides all outfits except the one with the lowest ID.
        4. Moves eyegags and tears into their own collection.
        5. Always hides the rigged tongue if present.
        6. Always hides the Bone Widgets collection.
        """
        if c.is_kk():
            c.get_armature().hide_set(True if bpy.context.scene.kkbp.use_rigify else False)
        #hide all outfits except the first one
        #but don't hide the collection if separate by material is enabled
        clothes_and_hair = c.get_outfits()
        clothes_and_hair.extend(c.get_hairs())
        outfit_ids = (int(c['id']) for c in clothes_and_hair if c.get('id'))
        outfit_ids = list(set(outfit_ids))
        for id in outfit_ids:
            clothes_in_this_id = [c for c in clothes_and_hair if c.get('id') == str(id).zfill(2)]
            c.move_and_hide_collection(clothes_in_this_id, 'Outfit ' + str(id).zfill(2) + ' ' + c.get_name(), hide = (id != min(outfit_ids) and not bpy.context.scene.kkbp.separate_clothes))

        #put any clothes variations into their own collection
        outfit_ids = (int(c['id']) for c in c.get_alts() if c.get('id'))
        outfit_ids = list(set(outfit_ids))
        for index, id in enumerate(outfit_ids):
            clothes_in_this_id = [c for c in c.get_alts() if c.get('id') == str(id).zfill(2)]
            c.switch(clothes_in_this_id[0], 'OBJECT')
            #find the character index
            character_collection_index = len(bpy.context.view_layer.layer_collection.children)-1
            #find the index of the outfit collection
            for i, child in enumerate(bpy.context.view_layer.layer_collection.children[character_collection_index].children):
                if child.name == 'Outfit ' + str(id).zfill(2) + ' ' + c.get_name():
                    break
            for ob in clothes_in_this_id:
                ob.select_set(True)
                bpy.context.view_layer.objects.active=ob
            new_collection_name = 'Alts ' + str(id).zfill(2) + ' ' + c.get_name()
            c.move_and_hide_collection(bpy.context.selected_objects, new_collection_name)

        #put the eyegags and tears into their own collection
        face_objects = []
        if c.get_gags():
            face_objects.append(c.get_gags())
        if c.get_tears():
            face_objects.append(c.get_tears())
        if face_objects:
            c.move_and_hide_collection(face_objects, 'Tears and gag eyes ' + c.get_name(), hide = False)

        #always hide the rigged tongue if present
        if c.get_tongue():
            c.move_and_hide_collection([c.get_tongue()], 'Rigged tongue ' + c.get_name(), hide = True)
        
        #always hide the hitboxes collection
        if bpy.data.collections.get('Hitboxes ' + c.get_name()):
            c.switch(c.get_rig() if c.get_rig() else c.get_armature(), 'OBJECT')
            for child in bpy.context.view_layer.layer_collection.children[0].children:
                if ('Hitboxes ' + c.get_name()) in child.name:
                    child.exclude = True

        #always hide the bone widgets collection
        if bpy.data.collections.get('Bone Widgets'):
            c.switch(c.get_rig() if c.get_rig() else c.get_armature(), 'OBJECT')
            for child in bpy.context.view_layer.layer_collection.children[0].children:
                if child.name == 'Bone Widgets':
                    child.exclude = True
        
        c.print_timer('hide_unused_objects')

    def apply_cycles(self):
        if not bpy.context.scene.kkbp.shader_dropdown in ['B', 'D']:
            return
        c.kklog('Applying Cycles adjustments...')
        c.import_from_library_file('NodeTree', ['.Cycles', '.Cycles no shadows', '.Cycles Classic'], True)
        c.import_from_library_file('Image', ['Template: Black'], True)
                    
        ####fix the eyelash mesh overlap
        # deselect everything and make body active object
        c.switch(c.get_body(), 'edit')

        # move the eyeline out a bit
        bpy.context.object.active_material_index = c.get_body().data.materials.find('KK cf_m_eyeline_down')
        bpy.ops.object.material_slot_select()
        bpy.ops.transform.translate(value=(0, -1 * 0.0002, 0))
        bpy.context.object.active_material_index = c.get_body().data.materials.find('KK cf_m_eyeline_00_up')
        bpy.ops.object.material_slot_select()
        bpy.ops.object.material_slot_assign() #fix an issue with kage and eyeline up being assigned to the same faces
        bpy.ops.transform.translate(value=(0, -1 * 0.0003, 0))
        c.switch(c.get_body(), 'object')

        ignore_list = [
            'KK Eyebrows (mayuge) ' + c.get_name(),
            'KK EyeL (hitomi) ' + c.get_name(),
            'KK EyeR (hitomi) ' + c.get_name(),
            'KK Eyeline up ' + c.get_name(),
            'KK Eyewhites (sirome) ' + c.get_name()]
        everything = [c.get_body()]
        everything.extend(c.get_hairs())
        everything.extend(c.get_alts())
        everything.extend(c.get_outfits())

        #add cycles node group
        for object in everything:
            for node_tree in [mat_slot.material.node_tree for mat_slot in object.material_slots if mat_slot.material.name not in ignore_list]:
                nodes = node_tree.nodes
                if nodes.get('shader'):
                    nodes['shader'].node_tree = bpy.data.node_groups['.Cycles' if bpy.context.scene.kkbp.shader_dropdown == 'B' else '.Cycles Classic']

                    #Cycles makes missing images PINK (?!) instead of black for some reason and this screws with the shaders
                    #If an image is missing, fill it in with Template: Black
                    if nodes.get('_NMP_CNV.png'):
                        for image_node in [n for n in nodes if n.type == 'TEX_IMAGE']:
                            if not image_node.image:
                                image_node.image = bpy.data.images['Template: Black']
        
        #set eyeline up and eyebrows as shadowless
        shadowless_mats =  ['KK cf_m_eyeline_00_up', 'KK cf_m_eyeline_down', 'KK cf_m_mayuge_00']
        for mat_name in shadowless_mats:
            if mat := bpy.data.materials.get(mat_name):
                if node := mat.node_tree.nodes.get('shader'):
                    node.node_tree = bpy.data.node_groups['.Cycles no shadows']
                
        bpy.context.scene.render.engine = 'CYCLES'
        bpy.context.scene.cycles.preview_samples = 10

    def apply_eeveemod(self):
        if not bpy.context.scene.kkbp.shader_dropdown == 'C':
            return
        c.import_from_library_file('NodeTree', ['.Eevee Mod'], True)

        c.kklog('Applying Eevee Shader adjustments...')
        #Import eevee mod node group and replace the combine colors group with the eevee mod group
        ignore_list = [
            'KK cf_m_mayuge_00',
            'KK cf_m_hitomi_00_cf_Ohitomi_L02',
            'KK cf_m_hitomi_00_cf_Ohitomi_R02',
            'KK cf_m_eyeline_00_up',
            'KK cf_m_sirome_00']
        everything = [c.get_body()]
        everything.extend(c.get_hairs())
        everything.extend(c.get_alts())
        everything.extend(c.get_outfits())
        
        for object in everything:
            for material in [mat_slot.material for mat_slot in object.material_slots if mat_slot.material.name not in ignore_list]:
                node_tree = material.node_tree
                nodes = node_tree.nodes
                links = node_tree.links
                if nodes.get('shader'):
                    nodes['shader'].node_tree = bpy.data.node_groups['.Eevee Mod']
                    if object.name == c.get_body().name:
                        # nodes['shader'].inputs['Enable Ambient Occlusion'].default_value = 'Disable ambient occlusion'
                        nodes['shader'].inputs['Enable fresnel'].default_value = 'Disable fresnel'
                        if material.name.endswith('cf_m_body'):
                            #add a head shadow to the body so it matches the face
                            c.import_from_library_file('Image', ['Template: Body neck shadow'])
                            nodes['perma'].image = bpy.data.images['Template: Body neck shadow']
                            #then disable by default
                            nodes['shader'].inputs['Disable permalight mask'].default_value = True
                        if material.name.endswith('cf_m_face_00'):
                            #add SDF group to the face
                            c.import_from_library_file('NodeTree', ['.Light Rotation Catcher', '.SDF_Cel_Shader'])
                            geonodes_mod = object.modifiers.new('Light Rotation Catcher', 'NODES')
                            geonodes_mod.node_group = bpy.data.node_groups['.Light Rotation Catcher']

                            sdf_node = node_tree.nodes.new('ShaderNodeGroup')
                            sdf_node.node_tree = bpy.data.node_groups['.SDF_Cel_Shader']
                            links.new(sdf_node.outputs[0], nodes['shader'].inputs[7])

                            #then disable by default
                            nodes['shader'].inputs['Disable permalight mask'].default_value = True

            #make the eyes and eyewhites always lit by making the permamask input pure red    
            for material in [mat_slot.material for mat_slot in object.material_slots if mat_slot.material.name in ignore_list]:
                node_tree = material.node_tree
                nodes = node_tree.nodes
                links = node_tree.links
                if shader := nodes.get('shader'):
                    links.remove(shader.inputs['Permalight mask'].links[0])
                    shader.inputs['Permalight mask'].default_value = (1,0,0,1)

        #select entire face and body, then reset normal vectors to prevent Amb Occ seam around the neck 
        body = c.get_body()
        bpy.ops.object.select_all(action='DESELECT')
        body.select_set(True)
        bpy.context.view_layer.objects.active=body
        bpy.ops.object.mode_set(mode = 'EDIT')
        body.active_material_index = 1
        bpy.ops.object.material_slot_select()
        bpy.ops.mesh.normals_tools(mode='RESET')
        bpy.ops.object.mode_set(mode = 'OBJECT')
        c.print_timer('apply_eeveemod')

    def apply_principled(self):
        if not bpy.context.scene.kkbp.shader_dropdown == 'E':
            return
        
        everything = [c.get_body()]
        everything.extend(c.get_hairs())
        everything.extend(c.get_alts())
        everything.extend(c.get_outfits())

        for object in everything:
            for node_tree in [mat_slot.material.node_tree for mat_slot in object.material_slots]:
                nodes = node_tree.nodes
                links = node_tree.links
                if light_node := nodes.get('_light.png'):
                    #remove all the nodes except the light node and connect it to a principled bsdf
                    for node in nodes:
                        if node != light_node:
                            nodes.remove(node)
                    
                    #add principled bsdf
                    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
                    links.new(bsdf.inputs[0], light_node.outputs[0])
                    links.new(bsdf.inputs[4], light_node.outputs[1])
                    out = nodes.new(type='ShaderNodeOutputMaterial')
                    links.new(bsdf.outputs[0], out.inputs[0])
        c.print_timer('apply_principled')

    @classmethod
    def apply_rigify(cls):
        self = cls

        if not bpy.context.scene.kkbp.use_rigify:
            return
        
        #Activate the built in Rigify addon if it isn't already enabled.
        if "rigify" not in bpy.context.preferences.addons:
            c.kklog('Rigify was not enabled. Enabling it now...', 'warn')
            bpy.ops.preferences.addon_enable(module='rigify')
            bpy.ops.wm.save_userpref()
        
        c.kklog('Running Rigify conversion scripts...')
        armature = c.get_armature()
        c.switch(armature, 'object')

        #run a script to prepare the armature for rigify
        bpy.ops.kkbp.rigbefore('INVOKE_DEFAULT')
        
        #generate the rigify rig
        bpy.ops.pose.rigify_generate()

        #cleanup the generated rigify rig
        bpy.ops.kkbp.rigafter('INVOKE_DEFAULT')

        #make sure everything is deselected in edit mode for the body
        c.switch(c.get_body(), 'edit')
        c.switch(c.get_body(), 'object')

        #then finally switch to the rig as the last selected object
        c.switch(c.get_rig(), 'object')
        bpy.context.scene.tool_settings.transform_pivot_point = 'INDIVIDUAL_ORIGINS'
        bpy.context.tool_settings.mesh_select_mode = (False, False, True) #enable face select in edit mode
        c.print_timer('apply_rigify')
        return {'FINISHED'}

    def apply_sfw(self):
        if not bpy.context.scene.kkbp.sfw_mode:
            return
        c.kklog('Applying mesh adjustments...')
        #mark nsfw parts of mesh as freestyle faces so they don't show up in the outline
        body = c.get_body()
        c.switch(body, mode = 'EDIT')
        def mark_group_as_freestyle(group_list):
            for group in group_list:
                group_found = body.vertex_groups.find(group)      
                if group_found > -1:
                    bpy.context.object.active_material_index = group_found
                    bpy.ops.object.vertex_group_select()
                # else:
                #     c.kklog('Group wasn\'t found when freestyling vertex groups: ' + group, 'warn')
            bpy.ops.mesh.mark_freestyle_face(clear=False)
        freestyle_list = [
            'cf_j_bnip02_L', 'cf_j_bnip02_R',
            'cf_s_bust03_L', 'cf_s_bust03_R']
        mark_group_as_freestyle(freestyle_list)
        bpy.ops.mesh.select_all(action = 'DESELECT')

        #delete nsfw parts of the mesh
        def delete_group_and_bone(ob, group_list):
            c.switch(ob, 'EDIT')
            bpy.ops.mesh.select_all(action = 'DESELECT')
            for group in group_list:
                group_found = ob.vertex_groups.find(group)      
                if group_found > -1:
                    bpy.context.object.vertex_groups.active_index = group_found
                    bpy.ops.object.vertex_group_select()
                # else:
                    # c.kklog('Group wasn\'t found when deleting vertex groups: ' + group, 'warn')
            bpy.ops.mesh.delete(type='VERT')
            bpy.ops.mesh.select_all(action = 'DESELECT')

        delete_list = ['cf_s_bnip025_L', 'cf_s_bnip025_R', 'cf_s_bnip02_L', 'cf_s_bnip02_R',
        'cf_j_kokan', 'cf_j_ana', 'cf_d_ana', 'cf_d_kokan', 'cf_s_ana',
        'Vagina_Root', 'Vagina_B', 'Vagina_F', 'Vagina_001_L', 'Vagina_002_L',
        'Vagina_003_L', 'Vagina_004_L', 'Vagina_005_L',  'Vagina_001_R', 'Vagina_002_R',
        'Vagina_003_R', 'Vagina_004_R', 'Vagina_005_R']
        delete_group_and_bone(body, delete_list)
        #also do this on the clothes because the bra can show up
        delete_list = ['cf_s_bnip02_L', 'cf_s_bnip02_R', 'cf_s_bnip025_L', 'cf_s_bnip025_R', ]
        for ob in [o for o in bpy.data.objects if o.get('outfit')]:
            delete_group_and_bone(ob, delete_list)

        #delete nsfw bones
        rig = c.get_rig()
        if bpy.context.scene.kkbp.sfw_mode and bpy.context.scene.kkbp.use_rigify:
            rig.data.collections_all['NSFW'].is_visible = True
            def delete_bone(group_list):
                bpy.ops.object.mode_set(mode = 'OBJECT')
                bpy.ops.object.select_all(action='DESELECT')
                rig.select_set(True)
                bpy.context.view_layer.objects.active = rig
                bpy.ops.object.mode_set(mode = 'EDIT')
                bpy.ops.armature.select_all(action='DESELECT')
                for bone in group_list:
                    if rig.data.bones.get(bone):
                        rig.data.edit_bones[bone].select = True
                        bpy.ops.kkbp.cats_merge_weights()
                    # else:
                    #     c.kklog('Bone wasn\'t found when deleting bones: ' + bone, 'warn')
                bpy.ops.armature.select_all(action='DESELECT')
                bpy.ops.object.mode_set(mode = 'OBJECT')

            delete_list = ['cf_s_bnip025_L', 'cf_s_bnip025_R',
            'cf_j_kokan', 'cf_j_ana', 'cf_d_ana', 'cf_d_kokan', 'cf_s_ana',
            'cf_J_Vagina_root',
            'cf_J_Vagina_B',
            'cf_J_Vagina_F',
            'cf_J_Vagina_L.005',
            'cf_J_Vagina_R.005',
            'cf_J_Vagina_L.004',
            'cf_J_Vagina_L.001',
            'cf_J_Vagina_L.002',
            'cf_J_Vagina_L.003',
            'cf_J_Vagina_R.001',
            'cf_J_Vagina_R.002',
            'cf_J_Vagina_R.003',
            'cf_J_Vagina_R.004',
            'cf_j_bnip02root_L',
            'cf_j_bnip02_L',
            'cf_s_bnip01_L',
            #'cf_s_bust03_L',
            'cf_s_bust02_L',
            'cf_j_bnip02root_R',
            'cf_j_bnip02_R',
            'cf_s_bnip01_R',
            #'cf_s_bust03_R',
            'cf_s_bust02_R',]
            delete_bone(delete_list)
            rig.data.collections_all['NSFW'].is_visible = False
            rig.data.collections_all['NSFW'].name = 'Chest'

    def separate_meshes(self):
        if bpy.context.scene.kkbp.separate_clothes:
            #separate each outfit by material
            for obj in c.get_outfits():
                if obj.modifiers.get('Outline Modifier'):
                    obj.modifiers['Outline Modifier'].show_render = False
                    obj.modifiers['Outline Modifier'].show_viewport = False
                c.switch(obj, 'OBJECT')
                bpy.ops.object.material_slot_remove_unused()
                c.switch(obj, 'EDIT')
                bpy.ops.mesh.separate(type='MATERIAL')

            #once they are all separated, rename them to their material name
            for obj in c.get_outfits():
                try:
                    obj.name = obj.material_slots[0].name
                except:
                    #oh well
                    pass
    
    def mark_body_freestyle_faces(self):
        if not bpy.context.scene.kkbp.shader_dropdown == 'C':
            return
        c.switch(c.get_body(), 'edit')
        #mark certain materials as freestyle faces
        def mark_as_freestyle(mat_list: bpy.types.Material):
            for mat in mat_list:
                c.kklog(f'KK {mat}')
                mat_found = c.get_body().data.materials.find(f'KK {mat}')
                if mat_found > -1:
                    c.kklog(f'KK {mat}')
                    bpy.context.object.active_material_index = mat_found
                    bpy.ops.object.material_slot_select()
                else:
                    c.kklog('Material wasn\'t found when freestyling body materials: ' + mat, 'warn')
            bpy.ops.mesh.mark_freestyle_face(clear=False)
        freestyle_list = [
        'cf_Ohitomi_L02',
        'cf_Ohitomi_R02',
        'cf_Ohitomi_L',
        'cf_Ohitomi_R',
        'cf_O_eyeline_low',
        'cf_O_eyeline',
        'cf_O_noseline',
        'cf_O_mayuge',]
        mats = []
        for mat in freestyle_list:
            mats.extend(c.get_material_names(mat))
        mark_as_freestyle(mats)
        bpy.ops.mesh.select_all(action = 'DESELECT')
        bpy.ops.object.mode_set(mode = 'OBJECT')
        c.print_timer('mark_body_freestyle_faces')

    def apply_outlines(self):
        if not bpy.context.scene.kkbp.use_outline or bpy.context.scene.kkbp.shader_dropdown in ['B', 'D', 'E']:
            return
        c.kklog('Adding outlines to character...')
        self.add_outlines_to_body()
        self.add_outlines_to_hair_clothes()

    def add_outlines_to_body(self):
        #Add face and body outlines, then load in the clothes transparency mask to body outline
        body = c.get_body()
        c.switch(body, 'object')
        mod = body.modifiers.new(type='SOLIDIFY', name='Outline Modifier')
        mod.thickness = 0.0005
        mod.offset = 0
        mod.material_offset = len(body.material_slots)
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.name = 'Outline Modifier'
        mod.show_expanded = False
        face_material_name = 'KK cf_m_face_00' if c.is_kk() else f'{c.get_prefix()} cf_m_head_00'
        body_material_name = 'KK cf_m_body' if c.is_kk() else f'{c.get_prefix()} cf_m_body_00'
        #face first
        if bpy.data.materials.get(face_material_name):
            faceOutlineMat = bpy.data.materials[face_material_name].copy()
            faceOutlineMat.name = f'Outline cf_m_{"face" if c.is_kk() else "head"}_00'
            body.data.materials.append(faceOutlineMat)
            faceOutlineMat.use_backface_culling = True
            faceOutlineMat.use_backface_culling_shadow = True
            faceOutlineMat.node_tree.nodes['_light.png'].image = bpy.data.images['Template: BlackWithAlpha']
            faceOutlineMat.node_tree.nodes['_dark.png'].image = bpy.data.images['Template: BlackWithAlpha']

            # hide outline around eyes.
            faceOutlineMat.node_tree.nodes['_AM.png'].image = bpy.data.images['KK OutlineMask.png' if c.is_kk() else 'SVS OutlineMask.png']
            faceOutlineMat.node_tree.nodes['shader'].inputs[0].default_value = 2
        else:
            c.kklog('Could not find face material to create outline from.', 'error')
        if bpy.data.materials.get(body_material_name):
            body_outline_mat = bpy.data.materials[body_material_name].copy()
            body_outline_mat.name = f'Outline cf_m_body{None if c.is_kk() else "_00"}'
            body.data.materials.append(body_outline_mat)
            body_outline_mat.use_backface_culling = True
            body_outline_mat.use_backface_culling_shadow = True
            body_outline_mat.node_tree.nodes['_light.png'].image = bpy.data.images['Template: BlackWithAlpha']
            body_outline_mat.node_tree.nodes['_dark.png'].image = bpy.data.images['Template: BlackWithAlpha']
        else:
            c.kklog('Could not find face material to create outline from.', 'error')
        c.print_timer('add_outlines_to_body')

    def add_outlines_to_hair_clothes(self):
        #Give each piece of hair/clothes with an alphamask on each object it's own outline group
        objects = c.get_hairs()
        objects.extend(c.get_outfits())
        objects.extend(c.get_alts())

        outline_starts = {}

        for ob in objects:
            #Get the length of the material list before starting
            outlineStart = len(ob.material_slots)
            outline_starts[ob.name] = outlineStart
            #link all polygons to material name
            mats_to_gons = {}
            for slot in ob.material_slots:
                mats_to_gons[slot.material.name] = []
            for gon in ob.data.polygons:
                    mats_to_gons[ob.material_slots[gon.material_index].material.name].append(gon)
            #find all materials that use an alpha mask or maintex
            alpha_users = []
            for mat in ob.material_slots:
                AlphaImage = ((tmp := mat.material.node_tree.nodes.get('_AM.png')) and tmp.image.name not in ['Template: Placeholder', 'Template: BlackWithAlpha'])
                MainImage = ((tmp := mat.material.node_tree.nodes.get('_light.png')) and tmp.image.name != 'Template: Placeholder')
                AlphaImageBot = ((tmp := mat.material.node_tree.nodes.get('_AMB.png')) and tmp.image.name not in ['Template: Placeholder', 'Template: BlackWithAlpha'])
                # AlphaImage = mat.material.node_tree.nodes['_AM.png'].image    if mat.material.node_tree.nodes['_AM.png'].image.name    != 'Template: Placeholder' else None
                # MainImage =  mat.material.node_tree.nodes['_light.png'].image if mat.material.node_tree.nodes['_light.png'].image.name != 'Template: Placeholder' else None
                if AlphaImage or MainImage or AlphaImageBot:
                    alpha_users.append(mat.material.name)
            #reorder material_list to place alpha/maintex users first
            new_mat_list_order = [mat_slot.material.name for mat_slot in ob.material_slots if mat_slot.material.name not in alpha_users]
            new_mat_list_order = alpha_users + new_mat_list_order
            #reorder mat slot list
            for index, mat_slot in enumerate(ob.material_slots):
                mat_slot.material = bpy.data.materials[new_mat_list_order[index]]
            #create slots for new alpha user outlines
            for index, mat in enumerate(alpha_users):
                ob.data.materials.append(None)
                OutlineMat = bpy.data.materials[mat].copy()
                OutlineMat.name = bpy.data.materials[mat].name.replace(f'{c.get_prefix()} ', 'Outline ')
                OutlineMat.use_backface_culling = True
                OutlineMat.use_backface_culling_shadow = True
                OutlineMat.node_tree.links.remove(OutlineMat.node_tree.nodes['_light.png'].outputs[0].links[0])
                OutlineMat.node_tree.links.remove(OutlineMat.node_tree.nodes['_dark.png'].outputs[0].links[0])
                if c.is_kk():
                    OutlineMat.node_tree.nodes['shader'].inputs['Light image'].default_value   = (0, 0, 0, 1)
                    OutlineMat.node_tree.nodes['shader'].inputs['Dark image'].default_value   = (0, 0, 0, 1)
                else:
                    OutlineMat.node_tree.nodes['shader'].inputs['Light texture'].default_value = (0, 0, 0, 1)
                    OutlineMat.node_tree.nodes['shader'].inputs['Dark texture'].default_value = (0, 0, 0, 1)
                ob.material_slots[index + outlineStart].material = OutlineMat
            #if the outline material is for a glasses material, disable it
                if bpy.data.materials[mat].get('glasses'):
                    OutlineMat.node_tree.links.remove(OutlineMat.node_tree.nodes['shader'].inputs[f'Light {"image alpha" if c.is_kk() else "txture Alpha"}'].links[0])
            #update polygon material indexes
            for mat in mats_to_gons:
                for gon in mats_to_gons[mat]:
                    gon.material_index = new_mat_list_order.index(mat)

        #Add a general outline that covers the rest of the materials on the object that don't need transparency
        for ob in objects:
            bpy.context.view_layer.objects.active = ob
            mod = ob.modifiers.new(
                type='SOLIDIFY',
                name='Outline Modifier')
            mod.thickness = 0.0005
            mod.offset = 1
            mod.material_offset = outline_starts[ob.name]
            mod.use_flip_normals = True
            mod.use_rim = False
            mod.show_expanded = False
            finalOutlineMat = ob.material_slots[0].material.copy()
            finalOutlineMat.use_backface_culling = True
            finalOutlineMat.use_backface_culling_shadow = True
            finalOutlineMat.node_tree.nodes['_light.png'].image = bpy.data.images['Template: BlackWithAlpha']
            finalOutlineMat.node_tree.nodes['_dark.png'].image = bpy.data.images['Template: BlackWithAlpha']
            finalOutlineMat.node_tree.nodes['_AM.png'].image = bpy.data.images['Template: Placeholder']
            finalOutlineMat.name = 'Outline ' + ob.name
            
            ob.data.materials.append(finalOutlineMat)

        c.print_timer('add_outlines_to_hair_clothes')

    def apply_viewport_colors(self):
        objects = c.get_all_objects()
        for object in objects:
            for mat_slot in [m for m in object.material_slots if not m.name.startswith('Outline ')]:
                try:
                    #grab a random color from the light image
                    nodes = mat_slot.material.node_tree.nodes
                    if image_node := nodes.get('_light.png'):
                        color = self.generalized_color_grid(image_node.image)
                        mat_slot.material.diffuse_color = color
                except Exception as ack:
                    #oh well
                    c.kklog(f'damn: {mat_slot.name} {ack}')
                    pass
            for mat_slot in [m for m in object.material_slots if m.name.startswith('Outline ')]:
                try:
                    mat_slot.material.diffuse_color = (0,0,0,0)
                except:
                    #oh well
                    pass
        c.print_timer('apply_viewport_colors')

    def generalized_color_grid(self, image, nth=200, alpha_weighted=True):
        width, height = image.size

        if width == 0 or height == 0:
            return (0.0, 0.0, 0.0, 1.0)

        nth = max(1, int(nth))

        # Transfer pixels from Blender using the faster RNA bulk API
        pixel_buffer = np.empty(width * height * 4, dtype=np.float32)
        image.pixels.foreach_get(pixel_buffer)

        # Reshape to [height, width, RGBA]
        pixels = pixel_buffer.reshape((height, width, 4))

        # Sample every nth pixel horizontally and vertically
        sampled = pixels[::nth, ::nth]

        rgb = sampled[:, :, :3]
        alpha = sampled[:, :, 3]

        if alpha_weighted:
            weight_total = np.sum(alpha, dtype=np.float64)

            if weight_total == 0:
                return (0.0, 0.0, 0.0, 1.0)

            weighted_rgb = rgb * alpha[:, :, None]
            color = np.sum(weighted_rgb, axis=(0, 1), dtype=np.float64)
            color /= weight_total
        else:
            color = np.mean(rgb, axis=(0, 1), dtype=np.float64)

        # Optional: one timer call instead of one call per sampled pixel
        # c.print_timer(f"{image.name}: {sampled.shape[0] * sampled.shape[1]} samples")

        return (
            float(color[0]),
            float(color[1]),
            float(color[2]),
            1.0,
        )

