
# This file performs the following operations

#	Remove unused material slots on all objects
#	Remap duplicate material slots on all objects

#	Replace all materials with templates from the KK Shader file
# 	Remove all duplicate node groups after importing everything

# 	Import all textures from .pmx directory
# 	Saturates all main textures and creates dark versions of all main textures
# 	Load all textures to correct spot on all materials
# 	Sets up drivers to make the gag eye shapekeys work correctly

# 	Load all colors from KK_MaterialDataComplete.json to correct spot on all materials
# 	Adds an outline modifier and outline materials to the face, body, hair and outfit meshes

# Color and image saturation code taken from MediaMoots https://github.com/FlailingFog/KK-Blender-Porter-Pack/blob/ecad6a136e86aaf6c51194705157200797f91e5f/importing/importcolors.py
# Dark color conversion code taken from Xukmi https://github.com/xukmi/KKShadersPlus/tree/main/Shaders


import bpy
from pathlib import Path
from .. import common as c

class modify_material(bpy.types.Operator):
    bl_idname = "kkbp.modifymaterial"
    bl_label = bl_idname
    bl_description = bl_idname
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        try:
            is_kk = c.is_kk()

            self.load_materials()
            self.remove_unused_material_slots()
            self.remap_duplicate_material_slots()

            self.load_images()
            self.replace_materials_and_link_textures()
            self.SVS_set_body_alpha_mask()

            if is_kk:
                self.change_body_render_method()
                self.replace_materials_for_tears_tongue_gageye()
            else:
                self.replace_materials_for_tears_SVS()
                self.move_eyelids_forward()

            self.link_textures_for_tongue_tear_gag()
            self.setup_expression()
            if is_kk:
                self.setup_gag_eye_material_drivers()
            else:
                self.setup_svs_gag_eye_material_drivers()

            c.clean_orphaned_data()
            return {'FINISHED'}
        except Exception as error:
            c.handle_error(self, error)
            return {"CANCELLED"}

    def load_materials(self):
        c.switch(c.get_body(), 'object')
        templateList = [
            'KK Body',
            'KK Tears',
            'KK Gag00',
            'KK Gag01',
            'KK Gag02',
            'KK EyeR (hitomi)',
            'KK EyeL (hitomi)',
            'KK Eyebrows (mayuge)',
            'KK Eyeline down',
            'KK Eyeline kage',
            'KK Eyeline up',
            'KK Eyewhites (sirome)',
            'KK Face',
            'KK General',
            'KK Hair',
            'KK Nose',
            'KK Teeth (tooth)',
            'KK Simple',
            'KK Glasses',
            'Outline General',
            'Outline Body',
            'KK Light Dark Texture',
            'KK Transparent',
            'SVS Light Dark Texture',
            'SVS Gag',
            'Misc'
        ]
        c.import_from_library_file(category='Material', list_of_items=templateList, use_fake_user=True)
    # %% Main functions
    def remove_unused_material_slots(self):
        '''Remove unused mat slots on all visible objects'''
        objects = c.get_outfits()
        objects.extend(c.get_alts())
        objects.append(c.get_body)
        objects.extend(c.get_hairs())
        for object in objects:
            try:
                c.switch(object, 'object')
                bpy.ops.object.material_slot_remove_unused()

                #If this is an outfit, and there's only one material slot, check if it's a duplicate material.
                #If it's a duplicate the object actually had no materials to begin with, but the material_slot_remove_unused function left a slot behind
                #This can happen if the outfit does not contain any clothes
                if len(object.material_slots) == 1 and object.get('outfit') and bpy.data.objects.get('Hair ' + object.name):
                    if object.material_slots[0].material.get('id') == bpy.data.objects.get(object.name.replace('Ouftit', 'Hair Outfit')).material_slots[0].material.get('id'):
                        c.kklog(f'No materials detected in outfit "{object.name}". Deleting...', 'warn')
                        bpy.data.objects.remove(object)
            except:
                pass
        c.print_timer('remove_unused_material_slots')

    def remap_duplicate_material_slots(self):
        c.switch(c.get_body(), 'object')
        objects = c.get_outfits()
        objects.extend(c.get_alts())
        objects.append(c.get_body())
        objects.extend(c.get_hairs())


        for obj in objects:
            c.switch(obj, 'object')
            try:
                bpy.ops.object.material_slot_remove_unused()
            except:
                #there were no materials on this object
                continue
            c.switch(obj, 'edit')
            #combine duplicated material slots
            for mat_name in [o.name for o in obj.data.materials]:
                index = 1
                base_material = bpy.data.materials.get(mat_name)
                while redundant_material := bpy.data.materials.get(f'{mat_name}.{index:03d}'):
                    index += 1
                    redundant_material.user_remap(base_material)
                    bpy.data.materials.remove(redundant_material)

            #then clean material slots by going through each slot and reassigning the slots that are repeated
            repeats = {}
            material_list = obj.data.materials
            for index, mat in enumerate(material_list):
                if mat.name not in repeats:
                    repeats[mat.name] = [index]
                else:
                    repeats[mat.name].append(index)

            for material_name in repeats.keys():
                if len(repeats[material_name]) > 1:
                    for repeated_slot in repeats[material_name]:
                        #don't touch the first slot
                        if repeated_slot == repeats[material_name][0]:
                            continue
                        c.kklog("Moving duplicate material {} in slot {} to the original slot {}".format(material_name, repeated_slot, repeats[material_name][0]))
                        obj.active_material_index = repeated_slot
                        bpy.ops.object.material_slot_select()
                        obj.active_material_index = repeats[material_name][0]
                        bpy.ops.object.material_slot_assign()
                        bpy.ops.mesh.select_all(action='DESELECT')
            c.switch(obj, 'object')
            bpy.ops.object.material_slot_remove_unused()
        c.print_timer('remap_duplicate_material_slots')

    def replace_materials_for_tears_tongue_gageye(self):

        #give the tears a material template
        c_name = c.get_name()
        if tears := c.get_tears():
            template = bpy.data.materials['KK Tears'].copy()
            template.name = 'KK Tears ' + c_name
            template['tears'] = True
            template['id'] = c.get_material_names('cf_O_namida_L')[0]
            tears.material_slots[0].material = bpy.data.materials[template.name]
            template_group = template.node_tree.nodes['textures'].node_tree.copy()
            template.node_tree.nodes['textures'].node_tree = template_group
            template_group.name += ' ' + c_name

        #replace tongue material if it exists
        if c.get_body().material_slots.get('KK General ' + c_name):
            #Make the tongue material unique so parts of the General Template aren't overwritten
            template = bpy.data.materials['KK General'].copy()
            template.name = 'KK Tongue ' + c_name
            template['tongue'] = True
            template['bake'] = True
            # template['id'] = c.get_material_names('o_tang')[0]
            for material_name in c.get_material_names('o_tang'): # avoid getting the deleted material
                if bpy.data.materials.get(material_name):
                    template['id'] = material_name
                    break
            if template.get('id') is None:
                c.kklog('Failed to replace tongue material', 'warn')

            c.get_body().material_slots['KK General ' + c_name].material = template
            template_group = template.node_tree.nodes['textures'].node_tree.copy()
            template.node_tree.nodes['textures'].node_tree = template_group
            template_group.name = 'Tex Tongue ' + c_name
            template_group_pos = template.node_tree.nodes['textures'].node_tree.nodes['pospattern'].node_tree.copy()
            template.node_tree.nodes['textures'].node_tree.nodes['pospattern'].node_tree = template_group_pos
            template_group_pos.name = 'Position Tongue ' + c_name

            #give the rigged tongue the existing material template
            if c.get_tongue():
                c.get_tongue().material_slots[0].material = template

        #give the gag eyes a material template if they exist
        if gag := c.get_gags():
            for num in ['00', '01', '02']:
                template = bpy.data.materials['KK Gag'+num].copy()
                template['gag'] = True
                template['id'] = c.get_material_names('cf_O_gag_eye_'+num)[0]
                gag.material_slots['cf_m_gageye_'+num].material = template
                template.name = 'KK Gag' + num + ' ' + c_name
                template_group = template.node_tree.nodes['textures'].node_tree.copy()
                template.node_tree.nodes['textures'].node_tree = template_group
                template_group.name = 'Tex Gag' + num + ' ' + c_name
        c.print_timer('replace_materials_for_tears_tongue_gageye')

    def replace_materials_for_tears_SVS(self):
        #give the tears a material template
        c_name = c.get_name()
        if tears := c.get_tears():
            template = bpy.data.materials['KK Tears'].copy()
            template.name = f'{c.get_prefix()} Tears ' + c_name
            template['tears'] = True
            template['id'] = c.get_material_names('cf_O_namida_L')[0]
            tears.material_slots[0].material = bpy.data.materials[template.name]
            template_group = template.node_tree.nodes['textures'].node_tree.copy()
            template.node_tree.nodes['textures'].node_tree = template_group
            template_group.name += ' ' + c_name

        #replace tongue material if it exists
        if slot := c.get_body().material_slots.get(f'{c.get_prefix()} cf_m_tango.002'):
            #separate the duplicated tongue mesh and give the real tongue the correct material
            c.switch(c.get_body(), 'edit')
            c.get_body().active_material_index = c.get_body().data.materials.find(f'{c.get_prefix()} cf_m_tango')
            bpy.ops.object.material_slot_select()
            bpy.ops.mesh.delete(type='VERT')
            c.switch(c.get_body(), 'object')
            slot.material = c.get_body().material_slots.get(f'{c.get_prefix()} cf_m_tango').material
            slot.material['tongue'] = True
            slot.material['bake'] = True

        # give the gag eyes a material template if they exist
        if gag := c.get_gags():
            json_filename = c.get_prefix() + '_BlendShapeInfo.json'
            gag_keys = [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] >= 0]

            template = bpy.data.materials['SVS Gag'].copy()
            template['gag'] = True
            template['id'] = c.get_material_names('cf_O_gag_eye_00')[0]
            gag.material_slots['cf_m_gageye_00'].material = template
            template.name = f'{c.get_prefix()} Gag00 ' + c_name
            last_choice = template.node_tree.nodes['Choice 0']

            for index, gag_key in enumerate(gag_keys):
                if index > 0:
                    new_node = template.node_tree.nodes.new('ShaderNodeGroup')
                    new_node.node_tree = template.node_tree.nodes['Choice 0'].node_tree.copy()
                    new_node.name = f'Choice {index}'
                    new_node.label = new_node.name

                    template.node_tree.links.new(last_choice.outputs['Gag Choice'], new_node.inputs['Gag Choice'])
                    template.node_tree.links.new(last_choice.outputs['Frame'], new_node.inputs['Frame'])
                    template.node_tree.links.new(last_choice.outputs['Left or Right'], new_node.inputs['Left or Right'])
                    template.node_tree.links.new(last_choice.outputs['Color'], new_node.inputs['Default Color'])
                    template.node_tree.links.new(last_choice.outputs['Alpha'], new_node.inputs['Default Alpha'])

                    last_choice = new_node

                last_choice.inputs['Angle Speed Left'].default_value = gag_key['angleSpeed'] / 5
                last_choice.inputs['Angle Speed Right'].default_value = gag_key['angleSpeedR'] / 5
                last_choice.inputs['Size Speed Left'].default_value = gag_key['sizeSpeed'] / 3
                last_choice.inputs['Size Speed Right'].default_value = gag_key['sizeSpeedR'] / 3
                last_choice.inputs['Size Width Left'].default_value = gag_key['sizeWidth']
                last_choice.inputs['Size Width Right'].default_value = gag_key['sizeWidthR']
                last_choice.inputs['TileX Left'].default_value = gag_key['vector3TileAnimation'][0]
                last_choice.inputs['TileX Right'].default_value = gag_key['vector3TileAnimationR'][0]
                last_choice.inputs['TileY Left'].default_value = gag_key['vector3TileAnimation'][1]
                last_choice.inputs['TileY Right'].default_value = gag_key['vector3TileAnimationR'][1]

                if gag_key['sizeSpeed'] != 0:
                    last_choice.node_tree.nodes['Base Size'].inputs[1].default_value = 2
            if len(gag_keys) > 1:
                template.node_tree.links.new(last_choice.outputs['Color'],
                                             template.node_tree.nodes['Mix Shader'].inputs[2])
                template.node_tree.links.new(last_choice.outputs['Alpha'],
                                             template.node_tree.nodes['Mix Shader'].inputs[0])

        c.print_timer('replace_materials_for_tears_SVS')

    def move_eyelids_forward(self):
        '''Move the SVS eyelash mesh out a bit to fix the clipping'''
        mats = ['cf_m_eyelid_00', 'cf_m_eyelash_up_00']

        for mat in mats:
            i = c.get_body().data.materials.find(c.get_prefix() + ' ' + mat)
            if i > -1:
                c.switch(c.get_body(), 'edit')
                bpy.context.object.active_material_index = i
                bpy.ops.object.material_slot_select()
                bpy.ops.transform.translate(value=(-0, -0.0005, -0), orient_type='GLOBAL')
                c.switch(c.get_body(), 'object')

    def load_images(self):
        c.switch(c.get_body(), 'object')
        file_dir = Path(bpy.context.scene.kkbp.import_dir)

        files = list(file_dir.rglob('**/pre_light/*'))
        files.extend(list(file_dir.rglob('**/pre_dark/*')))
        files.extend(list(file_dir.rglob('*_AM.png')))
        files.extend(list(file_dir.rglob('*_NMP_CNV.png')))
        files.extend(list(file_dir.rglob('*_NMPD_CNV.png')))
        files.extend(list(file_dir.rglob('*_Cloth_alpha.png')))
        files.extend(list(file_dir.rglob('*_Cloth_alpha_bot.png')))
        files.extend(list(file_dir.rglob('*_Normal_map.png')))
        files.extend(list(file_dir.rglob('*_Normal.png')))
        files.extend(list(file_dir.rglob('*_DetailNormal.png')))
        files.extend(list(file_dir.rglob('cf_m_gageye_0*.png')))
        files.extend(list(file_dir.rglob('cf_m_namida_00_MT_CT.png')))
        files.extend(list(file_dir.rglob('cf_t_gageye_*.png')))
        files.extend(list(file_dir.rglob('*_EXPR.png')))

        for file in files:
            bpy.ops.image.open(filepath=str(file), use_udim_detecting=False)
            try:
                bpy.data.images[file.name].pack()
            except:
                c.kklog(
                    'This image was not automatically loaded in because its filename exceeds 64 characters: ' + file.name, type='error')

    def replace_materials_and_link_textures(self):
        prefix = c.get_prefix()
        is_kk = c.is_kk()

        remap = {
            '_light.png': '_light.png',
            '_dark.png': '_dark.png',
            '_NMP_CNV.png': '_NMP_CNV.png',
            '_NMPD_CNV.png': '_NMPD_CNV.png',
            '_AM.png': '_AM.png',
            '_Normal_map.png': '_NMP_CNV.png',
            '_Normal.png': '_NMP_CNV.png',
            '_DetailNormal.png': '_NMPD_CNV.png'
        }

        textures = list(remap.keys())

        target_materials = c.json_file_manager.get_json_file(f"{prefix}_LightDarkMaterials.json")
        meshes = [('body', c.get_body()), ('tongue', c.get_tongue())]

        def swap_mesh_material(original_material: str, target_material: str, mesh_type: str, mesh):
            # remove dupes and check the material slot actually exists
            if mesh.material_slots.get(original_material):
                template = bpy.data.materials[target_material].copy()
                template[mesh_type] = True
                template['name'] = c.get_name()
                template['id'] = original_material
                template['coord'] = mesh.get('coord')
                template.name = prefix + ' ' + original_material
                mesh.material_slots[original_material].material = template
            else:
                c.kklog(
                    f'material or template wasn\'t found when replacing body materials: {str(original_material)}, {target_material}', 'warn')

        for hair in c.get_hairs():
            meshes.append(('hair', hair))
        for outfit in c.get_outfits():
            meshes.append(('outfit', outfit))
        for alt in c.get_alts():
            meshes.append(('outfit', alt))

        for mesh_type, mesh in meshes:
            if mesh is None:
                continue
            c.switch(mesh, 'OBJECT')
            if mesh.data.uv_layers is None:
                continue
            for material_name in target_materials:
                if (material_index := mesh.material_slots.find(material_name)) >= 0:
                    # Update the shader
                    swap_mesh_material(material_name, f'{"SVS" if prefix == "AC" else prefix} Light Dark Texture', mesh_type, mesh)
                    material = mesh.material_slots[material_index].material
                    material.node_tree.nodes["shader"].inputs[0].default_value = 2 if material.name != 'KK cf_m_face_00' else 0

                    for texture_name in textures:
                        if image := bpy.data.images.get(material_name + texture_name):
                            material.node_tree.nodes[remap[texture_name]].image = image
                    material.node_tree.update_tag()

            for material_slot in mesh.material_slots:
                #  Replace mesh's materials that do not show in the list with a transparent one
                if not material_slot.material.name.startswith(prefix):
                    swap_mesh_material(material_slot.material.name, f'KK Transparent', mesh_type, mesh)

                #If the in-game shader of this material is set to "main alpha" or glasses, set the material to "blended" in blender
                shaders = ['Shader Forge/main_alpha', 'Koikano/main_clothes_alpha', 'xukmi/MainAlphaPlus', 'xukmi/MainAlphaPlusTess', 'xukmi/MainItemAlphaPlus', 'IBL_Shader_alpha',]
                #find this material in the MaterialDataComplete.json and see if it's an alpha shader
                material = material_slot.material
                if c.get_shader_name(material['id']) in shaders:
                    c.kklog('Detected alpha shader. Setting render method to blended: {}'.format(material['id']))
                    material.surface_render_method = 'BLENDED'
                    material.use_transparency_overlap = False
                
                shaders = ['Shader Forge/toon_glasses_lod0', 'Koikano/main_clothes_item_glasses']
                if c.get_shader_name(material['id']) in shaders:
                    c.kklog('Detected glasses shader. Setting render method to blended: {}'.format(material['id']))
                    material.surface_render_method = 'BLENDED'
                    material['glasses'] = True

                #special exception to clip the emblem image because I am tired of seeing it repeat at the edges
                if 'KK cf_m_emblem ' in material.name:
                    material.node_tree.nodes['_light.png'].extension = 'CLIP'
                    material.node_tree.nodes['_dark.png'].extension = 'CLIP'

        # Do not forget tongue.001
        if is_kk and c.get_tongue():
            if (material_index := c.get_tongue().material_slots.find('cf_m_tang.001')) >= 0:
                swap_mesh_material('cf_m_tang.001', 'KK Light Dark Texture', 'tongue', c.get_tongue())
                for texture_name in textures:
                    if image := bpy.data.images.get('cf_m_tang' + texture_name):
                        c.get_tongue().material_slots[material_index].material.node_tree.nodes[texture_name] = image

        # force to update
        bpy.context.view_layer.update()
        bpy.context.evaluated_depsgraph_get().update()

    def SVS_set_body_alpha_mask(self):
        if c.is_kk():
            return
        prefix = c.get_prefix()
        file_dir = Path(bpy.context.scene.kkbp.import_dir)
        material_name = c.json_file_manager.get_material_info_by_smr('o_body')[0]['MaterialInformation'][0]['MaterialName']
        material = c.get_body().material_slots.get(f'{prefix} ' + material_name).material

        for file in file_dir.rglob('*_Cloth_alpha.png'):
            if image := bpy.data.images.get(file.name):
                material.node_tree.nodes['_AM.png'].image = image
                break

        for file in file_dir.rglob('*_Cloth_alpha_bot.png'):
            if image := bpy.data.images.get(file.name):
                material.node_tree.nodes['_AMB.png'].image = image
                break

        material.node_tree.update_tag()

    def change_body_render_method(self):
        prefix = c.get_prefix()
        mats = c.get_material_names('cf_O_eyeline')
        for mat in [
            'cf_O_eyeline_low',
            'cf_O_noseline',
            'cf_O_mayuge',
            'cf_Ohitomi_L',
            'cf_Ohitomi_L02',
            'cf_Ohitomi_R02',
            ]:
            mats.extend(c.get_material_names(mat))
        for mat in mats:
            material = bpy.data.materials.get(f'{prefix} ' + mat)
            if material:
                material.surface_render_method = 'BLENDED'
                #disable force visibility for blender 5.1 to fix a weird color issue
                # These mats don't have alpha masks anyway
                if bpy.app.version[0] == 5 and bpy.app.version[1] == 1:
                    old_shader = material.node_tree.nodes["shader"].node_tree
                    try:
                        material.node_tree.nodes["shader"].node_tree = bpy.data.node_groups['.KK no force visibility']
                    except:
                        new_shader = old_shader.copy()
                        new_shader.name = '.KK no force visibility'
                        material.node_tree.nodes["shader"].node_tree = bpy.data.node_groups['.KK no force visibility']
                    mix = new_shader.nodes['mix']
                    input = new_shader.nodes['input']
                    new_shader.links.remove(mix.inputs[0].links[0])
                    new_shader.links.new(input.outputs['Light image alpha'], mix.inputs[0])
                    if material.name == 'KK cf_m_eyeline_kage':
                        material.surface_render_method = 'DITHERED'
                if bpy.app.version[0] == 5 and bpy.app.version[1] > 1:
                    material.use_transparent_shadow = True
        #move the eyeline down material slot up so it doesn't appear over the eyeline up
        body = c.get_body()
        c.switch(body, 'object')
        if mat := body.material_slots.get('KK cf_m_eyeline_down'):
            print(body.data.materials.find(mat.name))
            body.active_material_index = body.data.materials.find(mat.name)
            bpy.ops.object.material_slot_move(direction='UP')
            bpy.ops.object.material_slot_move(direction='UP')
        
    def link_textures_for_tongue_tear_gag(self):

        #load all gag eye textures if it exists
        if c.get_gags():
            if c.is_kk():
                self.image_load('Gag00', '_cf_t_gageye_00_MT_CT.png')
                self.image_load('Gag00', '_cf_t_gageye_02_MT_CT.png')
                self.image_load('Gag00', '_cf_t_gageye_04_MT_CT.png')
                self.image_load('Gag00', '_cf_t_gageye_05_MT_CT.png')
                self.image_load('Gag00', '_cf_t_gageye_06_MT_CT.png')
                self.image_load('Gag01', '_cf_t_gageye_03_MT_CT.png')
                self.image_load('Gag01', '_cf_t_gageye_01_MT_CT.png')
                self.image_load('Gag02', '_cf_t_gageye_07_MT_CT.png')
                self.image_load('Gag02', '_cf_t_gageye_08_MT_CT.png')
                self.image_load('Gag02', '_cf_t_gageye_09_MT_CT.png')
            else:
                json_filename = c.get_prefix() + '_BlendShapeInfo.json'
                gag_keys = [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] >= 0]
                for index, gag_key in enumerate(gag_keys):
                    self.image_load('Gag00', image_override=gag_key['gagMaterialTex'] + '.png', node_override='ImageL',
                                    group_override=f'Choice {index}')
                    self.image_load('Gag00', image_override=gag_key['gagMaterialTexR'] + '.png', node_override='ImageR',
                                    group_override=f'Choice {index}')

        #load the tears texture in
        if c.get_tears():
            self.image_load('Tears', '_MT_CT.png')

        c.print_timer('link_textures_for_tongue_tear_gag')

    def setup_expression(self):
        json_filename = c.get_prefix() + '_BlendShapeInfo.json'
        expressions = [i for i in c.json_file_manager.get_json_file(json_filename) if i['isExpression']]
        if len(expressions) == 0:
            return
        # assert len(expression_images) == 2
        expressions = expressions[:2]
        mats = []
        for mat in [
            'cf_Ohitomi_L02',
            'cf_Ohitomi_R02',
        ]:
            mats.extend(c.get_material_names(mat))
        prefix = c.get_prefix()
        expression_node = bpy.data.materials['Misc'].node_tree.nodes['Expression']
        for mat in mats:
            material = bpy.data.materials.get(f'{prefix} ' + mat)
            if material:
                new_node = material.node_tree.nodes.new('ShaderNodeGroup')
                new_node.node_tree = expression_node.node_tree.copy()
                new_node.node_tree.nodes['Expression 1'].image = bpy.data.images.get('cf_m_hitomi_00_' + expressions[0]['expressionMaterialTex'] + '_EXPR.png')
                new_node.node_tree.nodes['Expression 2'].image = bpy.data.images.get('cf_m_hitomi_00_' + expressions[1]['expressionMaterialTex'] + '_EXPR.png')
                material.node_tree.links.new(material.node_tree.nodes['shader'].outputs[0], new_node.inputs[1])
                material.node_tree.links.new(new_node.outputs[0], material.node_tree.nodes['Material Output'].inputs[0])

                skey_driver = new_node.inputs[0].driver_add('default_value')
                skey_driver.driver.type = 'SCRIPTED'

                expression1 = skey_driver.driver.variables.new()
                expression1.name = 'Expression1'
                expression1.type = 'SINGLE_PROP'
                expression1.targets[0].id_type = 'KEY'
                expression1.targets[0].id = c.get_body().data.shape_keys
                expression1.targets[0].data_path = 'key_blocks["Eye ' + expressions[0]['patternName'] + '"].value'

                expression2 = skey_driver.driver.variables.new()
                expression2.name = 'Expression2'
                expression2.type = 'SINGLE_PROP'
                expression2.targets[0].id_type = 'KEY'
                expression2.targets[0].id = c.get_body().data.shape_keys
                expression2.targets[0].data_path = 'key_blocks["Eye ' + expressions[1]['patternName'] + '"].value'

                skey_driver.driver.expression = '0 if Expression1 else 1 if Expression2 else 2'
        c.print_timer('setup expression')

    def setup_gag_eye_material_drivers(self):
        '''setup gag eye drivers. these drivers will control what gag eye expression is shown on the gag mesh'''
        if c.get_gags():
            body = c.get_body()
            json_filename = c.get_prefix() + '_BlendShapeInfo.json'
            gag_keys = {
                0: [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == 0],
                1: [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == 1],
                2: [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == 2]
            }

            def get_gag_var_names(gag_number):
                #first let's collect the gag shape keys that use this gag eye mesh
                gag_keysa = [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == gag_number]
                #then, we need to assign each gag eye a unique variable for the driver. 
                # The shape key name cannot be used because it can be made of non-alphanumeric characters, so just use generic names
                return [f"gag{gag_number}{i+1}" for i, _ in enumerate(gag_keysa)]

            def create_driver(material, expression1, expression2, gag_index):
                skey_driver = bpy.data.materials[material].node_tree.nodes['Parser'].inputs[0].driver_add('default_value')
                skey_driver.driver.type = 'SCRIPTED'
                for index, key in enumerate(get_gag_var_names(gag_index)):
                    newVar = skey_driver.driver.variables.new()
                    newVar.name = key.replace(' ','')
                    newVar.type = 'SINGLE_PROP'
                    newVar.targets[0].id_type = 'KEY'
                    newVar.targets[0].id = body.data.shape_keys
                    newVar.targets[0].data_path = 'key_blocks["Eye ' + gag_keys[gag_index][index]['patternName'] +'"].value'
                skey_driver.driver.expression = expression1
                skey_driver = bpy.data.materials[material].node_tree.nodes['hider'].inputs[0].driver_add('default_value')
                skey_driver.driver.type = 'SCRIPTED'
                for index, key in enumerate(get_gag_var_names(gag_index)):
                    newVar = skey_driver.driver.variables.new()
                    newVar.name = key.replace(' ','')
                    newVar.type = 'SINGLE_PROP'
                    newVar.targets[0].id_type = 'KEY'
                    newVar.targets[0].id = body.data.shape_keys
                    newVar.targets[0].data_path = 'key_blocks["Eye ' + gag_keys[gag_index][index]['patternName'] +'"].value'
                skey_driver.driver.expression = expression2

            def get_gag_vars(gag_number):
                gag_keys = ['Eye ' + i['patternName'] for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == gag_number]
                return " or ".join(f"gag{gag_number}{i+1}" for i, _ in enumerate(gag_keys))

            def get_gag_indexes(gag_number):
                gag_keys = ['Eye ' + i['patternName'] for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == gag_number]
                return " ".join(f"{i} if gag{gag_number}{i+1} else" for i in range(len(gag_keys) - 1)) + f" {len(gag_keys) - 1}"

            create_driver (
                'KK Gag00 ' + c.get_name(),
                get_gag_indexes(0),
                get_gag_vars(0),
                0
                )

            create_driver (
                'KK Gag01 ' + c.get_name(),
                get_gag_indexes(1),
                get_gag_vars(1),
                1
                )

            create_driver (
                'KK Gag02 ' + c.get_name(),
                get_gag_indexes(2),
                get_gag_vars(2),
                2
                )
        c.print_timer('setup_gag_eye_material_drivers')

    def setup_svs_gag_eye_material_drivers(self):
        '''setup gag eye drivers for svs and ac'''
        if c.get_gags():
            body = c.get_body()
            json_filename = c.get_prefix() + '_BlendShapeInfo.json'
            gag_keys = [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] >= 0]

            # There are 22 gag keys in aicomi, original style: '0 if gag0 else 1 if gag1 ...'
            # exceed the max length of driver expression, even '0 if a else 1 if b...' exceed too.
            # so I change to another style.
            def get_gag_var_names():
                return [f'{chr(97 + i)}' for i in range(len(gag_keys))]

            def create_driver(material, expression):
                skey_driver = bpy.data.materials[material].node_tree.nodes['Gag Choice'].outputs[0].driver_add('default_value')
                skey_driver.driver.type = 'SCRIPTED'
                for index, key in enumerate(get_gag_var_names()):
                    newVar = skey_driver.driver.variables.new()
                    newVar.name = key.replace(' ', '')
                    newVar.type = 'SINGLE_PROP'
                    newVar.targets[0].id_type = 'KEY'
                    newVar.targets[0].id = body.data.shape_keys
                    newVar.targets[0].data_path = 'key_blocks["' + c.json_file_manager.get_remapped('shapekey', 'Eye ' + gag_keys[index]['patternName']) + '"].value'
                skey_driver.driver.expression = expression

            def get_expression():
                return '+'.join([f'{i + 1}*({chr(97 + i + 1)}>0)' for i in range(len(gag_keys) - 1)]) + f' or (a==0)*{len(gag_keys)}'

            create_driver(
                f'{c.get_prefix()} Gag00 ' + c.get_name(),
                get_expression()
            )
        c.print_timer('setup_gag_eye_material_drivers')

    # %% Supporting functions
    @staticmethod
    def apply_texture_data_to_image(mat: str, image: str, node:str, group = 'textures'):
        '''Sets offset and scale of an image node using the TextureData.json '''
        json_tex_data = c.json_file_manager.get_json_file('KK_TextureData.json')
        if json_tex_data is None:
            return
        texture_data = [t for t in json_tex_data if t["textureName"] == image]
        if texture_data and bpy.data.materials.get(mat):
            #Apply Offset and Scale
            bpy.data.materials[mat].node_tree.nodes[group].node_tree.nodes[node].texture_mapping.translation[0] = texture_data[0]["offset"]["x"]
            bpy.data.materials[mat].node_tree.nodes[group].node_tree.nodes[node].texture_mapping.translation[1] = texture_data[0]["offset"]["y"]
            bpy.data.materials[mat].node_tree.nodes[group].node_tree.nodes[node].texture_mapping.scale[0] = texture_data[0]["scale"]["x"]
            bpy.data.materials[mat].node_tree.nodes[group].node_tree.nodes[node].texture_mapping.scale[1] = texture_data[0]["scale"]["y"]

    def image_load(self, material_name: str, image_suffix = '', image_override = None, node_override = None, group_override = None):
        '''Automatically load image into mat's texture slot'''
        #get the id from the material
        material_name = c.get_prefix() + ' ' + material_name + ' ' + c.get_name()
        material = bpy.data.materials[material_name]
        #get the image name using the id and the suffix
        image_name = image_override if image_override else material['id'] + image_suffix
        #then load the image into the texture slot
        if bpy.data.images.get(image_name):
            node = node_override if node_override else image_name.replace(material['id'], '')
            group = group_override if group_override else 'textures'
            bpy.data.materials[material_name].node_tree.nodes[group].node_tree.nodes[node].image = bpy.data.images[image_name]
            #also apply scaling and offset data to the image
            self.apply_texture_data_to_image(material_name, image_name, node, group)
        else:
            c.kklog('File wasnt found, skipping: ' + image_name)
