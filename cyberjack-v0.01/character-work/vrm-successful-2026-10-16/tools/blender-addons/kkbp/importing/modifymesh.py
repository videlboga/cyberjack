'''
This file performs the following operations

.   Separates the rigged tongue, hair, shift/hang state clothing,
        hitboxes, and puts them into their own collections
·	Delete mask material, shadowcast mesh, and bonelyfans mesh if present

·	Remove shapekeys on all objects except body / tears / gag eyes
·	Rename UV maps on body object and outfit objects
·	Translates all shapekey names to english
·	Combines shapekeys based on face part prefix and emotion suffix
·	Creates tear shapekeys
·	Creates gag eye shapekeys and drivers for shapekeys

.   Removes doubles on body object to prevent seams (if selected)

·	Mark certain body materials as freestyle faces for freestyle exclusion
'''
import re

import bpy
from .. import common as c
from ..extras.linkshapekeys import link_keys

class modify_mesh(bpy.types.Operator):
    bl_idname = "kkbp.modifymesh"
    bl_label = bl_idname
    bl_description = bl_idname
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        try:
            is_kk = c.is_kk()
            self.rename_uv_maps()

            self.clean_up_duplicates()
            self.separate_rigged_tongue()
            self.separate_hair()
            self.separate_alternate_clothing()
            self.delete_shad_bone()
            self.combine_shapekeys()

            if is_kk:
                self.separate_hitboxes()
                self.delete_mask_quad()
                self.create_gag_and_tear_shapekeys()
                self.create_gag_eye_drivers_and_separate_gags()
            else:
                self.combine_mouth_shapekeys()
                self.create_svs_tear_shapekeys()
                self.create_eye_vertex_groups()
            
            self.delete_remaining_partial_shapekeys()
            self.rename_shapekeys()
            if not is_kk:
                self.create_svs_gag_eye_drivers_and_separate_gags()

            self.remove_body_seams()
            c.clean_orphaned_data()

            return {'FINISHED'}
        except Exception as error:
            c.handle_error(self, error)
            return {"CANCELLED"}

    def clean_up_duplicates(self):
        '''Removes duplicate materials on the body object (there should only be one each)'''
        c.clean_orphaned_data()
        pattern = re.compile(r'\.\d{3}$')
        for material in c.get_body().data.materials:
            if pattern.search(material.name):
                new_name = material.name[:-4]
                c.kklog(f'Renamed duplicate body material {material.name} to {new_name}')
                material.name = new_name
                material['id'] = new_name
                material['name'] = c.get_name()

    # %% Main functions
    def separate_rigged_tongue(self):
        """
        Separates the rigged tongue object from the main body mesh.
        If there's no rigged tongue, create one if the general tongue exists
        """

        rigged_tongue_material = None
        general_tongue_material = None
        tongue_datas = c.json_file_manager.get_material_info_by_smr('o_tang')

        if tongue_datas is None:
            c.kklog('No tongue material was found', 'warn')
            c.print_timer('Skipped')
            return

        for item in tongue_datas:
            if item['SMRPath'].endswith('N_cf_haed/o_tang'):
                general_tongue_material = item['MaterialInformation'][0]['MaterialName']
            else:
                rigged_tongue_material = item['MaterialInformation'][0]['MaterialName']

        if rigged_tongue_material == general_tongue_material:
            rigged_tongue_material += '.001'

        #  if rigged tongue doesn't exist,
        #  rename tongue material to .001, duplicate tongue material and rename to general name, separate mesh by .001,
        #  duplicate tongue mesh as general tongue and join back to body
        if rigged_tongue_material is None or general_tongue_material is None: # Some model only have N_cf_haed/o_tang or n_tang/o_tang
            if general_tongue_material:
                base_name = general_tongue_material

            else:
                base_name = rigged_tongue_material
                general_tongue_material = base_name
            rigged_tongue_material = base_name + '.001'

            ori_material = bpy.data.materials[general_tongue_material]

            # rename original material to .001, so we do not need to change the faces's material to new one
            ori_material['name'] = c.get_name()
            ori_material['id'] = rigged_tongue_material
            ori_material.name = rigged_tongue_material

            new_material = ori_material.copy()

            new_material['name'] = c.get_name()
            new_material['id'] = general_tongue_material
            new_material.name = general_tongue_material

            tongue = self.separate_materials(c.get_body(), [rigged_tongue_material], 'Tongue (rigged) ' + c.get_name())

            c.get_body().data.materials.append(new_material)
            bpy.ops.object.material_slot_move(direction='DOWN')

            # copy the tongue mesh and join it back to body
            bpy.ops.object.mode_set(mode='OBJECT')
            tongue_copy = tongue.copy()
            tongue_copy.data = tongue.data.copy()
            bpy.context.collection.objects.link(tongue_copy)
            bpy.ops.object.select_all(action='DESELECT')
            tongue_copy.select_set(True)
            c.get_body().select_set(True)
            bpy.context.view_layer.objects.active = c.get_body()
            bpy.ops.object.join()

            tongue['tongue'] = True
        else:
            tongue = self.separate_materials(c.get_body(), [rigged_tongue_material], 'Tongue (rigged) ' + c.get_name())
            tongue['tongue'] = True

        # Now remap the rigged tongue material with the original to allow the rigged tongue and the tongue on the body to share the same material
        if bpy.data.materials.get(rigged_tongue_material):
            bpy.data.materials[rigged_tongue_material].user_remap(
                bpy.data.materials[general_tongue_material])
            bpy.data.materials.remove(bpy.data.materials[rigged_tongue_material],do_unlink=True) # forcing to delete
        c.switch(tongue, 'object')
        bpy.ops.object.material_slot_remove_unused()
        c.print_timer('separate_rigged_tongue')

    def separate_hair(self):
        '''Separates the hair from the clothes object'''
        outfits = c.get_outfits()

        #Separate the hair from each outfit
        material_data = c.json_file_manager.get_materials_info()
        hair_materials = [
            material['MaterialName']
            for obj in material_data.values()
            for sub_obj in obj
            for material in sub_obj['MaterialInformation']
            if material['isHair']
        ]
        for outfit in outfits:
            #find all the hair mats for this outfit
            cur_hair_mat_list = []
            outfit_materials = [mat_slot.material.name for mat_slot in outfit.material_slots]

            for material in hair_materials:
            # some hair materials are repeated. The order goes 'hair_material', 'hair_material 00', 'hair_material 01', etc. Check for those too.
                cur_hair_mat_list.extend([m for m in outfit_materials if material in m])

            if cur_hair_mat_list:
                hair_object = self.separate_materials(outfit, cur_hair_mat_list, 'Hair ' + outfit.name)
                hair_object['hair'] = True
                hair_object['outfit'] = False
        c.print_timer('separate_hair')

    def separate_alternate_clothing(self):
        '''Separates the alternate clothing pieces then hides them'''

        #These are the enum indexes that need to be separated
        clothes_labels = {
            999:            'Indoor shoes',
            93:             'Top shift',
            97:             'Top shift',
            112:            'Top shift',
            114:            'Top shift',
            116:            'Top shift',
            120:            'Top shift',
            95:             'Bottom shift',
            99:             'Bottom shift',
            101:            'Bra shift',
            118:            'Bra shift',
            107:            'Underwear shift',
            108:            'Underwear hang',
            110:            'Pantyhose shift',
        }

        material_data = c.json_file_manager.get_materials_info()
        for outfit in c.get_outfits():
            for label in clothes_labels:
                materials_to_separate = []
                for smr_name, smr_items in material_data.items():
                    for smr_item in smr_items:
                        if label == smr_item['EnumIndex']:
                            materials_to_separate.extend(c.get_material_names(smr_name))

                if materials_to_separate:
                    alt_clothes = self.separate_materials(outfit, materials_to_separate, clothes_labels[label] + ' ' + outfit['id'] + ' ' + c.get_name())
                    if alt_clothes:
                        alt_clothes['alt'] = True
                        alt_clothes['outfit'] = False
                        c.kklog('Separated {} alternate clothing {} automatically'.format(materials_to_separate, clothes_labels[label]))
        c.print_timer('separate_alternate_clothing')

    def delete_shad_bone(self):
        '''Delete the shadowcast and bonelyfans meshes, if present'''
        mat_list = ['c_m_shadowcast', 'Standard']
        shadowcast = self.separate_materials(c.get_body(), mat_list, 'shadowcast', search_type = 'fuzzy')
        if shadowcast:
            bpy.data.objects.remove(shadowcast)

        # Delete the bonelyfans mesh if any
        mat_list = c.get_material_names('Highlight_o_body_a_rend')
        mat_list.extend(c.get_material_names('Highlight_cf_O_face_rend'))
        mat_list = list(set(mat_list))
        extended = []
        #some model have .002, even .003, .004
        for mat in mat_list:
            index = 1
            while bpy.data.materials.get((name := f'{mat}.{index:03d}')):
                index += 1
                extended.append(name)

        mat_list.extend(extended)
        bonely = self.separate_materials(c.get_body(), mat_list, 'bonelyfans')
        if bonely:
            bpy.data.objects.remove(bonely)
        c.print_timer('delete_shad_bone')

    def separate_hitboxes(self):
        '''Separate the hitbox mesh, if present'''
        material_data = c.json_file_manager.get_materials_info()
        hitbox_names = []
        for smr_name, smr_infos in material_data.items():
            if smr_name.startswith('o_hit'):
                hitbox_names.extend([
                    item['MaterialName']
                    for smr_info in smr_infos
                    for item in smr_info['MaterialInformation']
                ])

        hitbox_names = list(set(hitbox_names))
        # first remap all of the duplicate hitbox materials to share the same material name, or some separations will be missed
        for hitbox_name in hitbox_names:
            index = 1
            while bpy.data.materials.get((hitbox := f'{hitbox_name}.{index:03d}')):
                bpy.data.materials[hitbox].user_remap(bpy.data.materials[hitbox_name])
                bpy.data.materials.remove(bpy.data.materials[hitbox])
                index += 1
        hitbox = self.separate_materials(c.get_body(), hitbox_names, 'Hitboxes Body ' + c.get_name())
        if hitbox:
            hitbox['hitbox'] = True
            hitbox['body'] = False
        for outfit in c.get_outfits():
            hitbox = self.separate_materials(outfit, hitbox_names, 'Hitboxes ' + outfit['id'] + ' ' + c.get_name())
            if hitbox:
                hitbox['hitbox'] = True
                hitbox['outfit'] = False
        c.move_and_hide_collection(c.get_hitboxes(), "Hitboxes " + c.get_name())
        c.print_timer('separate_hitboxes')

    def delete_mask_quad(self):
        '''delete the mask material'''
        material_names = []
        material_data = c.json_file_manager.get_materials_info()
        for smr_name, smr_infos in material_data.items():
            if smr_name.startswith('o_Mask'):
                material_names.extend([
                    item['MaterialName']
                    for smr_info in smr_infos
                    for item in smr_info['MaterialInformation']
                    if item['ShaderName'] == "Shader Forge/AlphaMaskMultiply"
                ])
        material_names = set(material_names)

        for outfit in c.get_outfits():
            for mat in outfit.material_slots:
                if mat.name in material_names:
                    self.delete_materials(outfit, [mat])
        c.print_timer('delete_mask_quad')

    def rename_uv_maps(self):
        '''Make UV map names clearer'''
        c.get_body().data.uv_layers[0].name = 'uv_main'
        c.get_body().data.uv_layers[1].name = 'uv_nipple_and_shine'
        c.get_body().data.uv_layers[2].name = 'uv_underhair'
        c.get_body().data.uv_layers[3].name = 'uv_eyeshadow'

        for outfit in c.get_outfits():
            outfit.data.uv_layers[0].name = 'uv_main'
            outfit.data.uv_layers[1].name = 'uv_nipple_and_shine'
            outfit.data.uv_layers[2].name = 'uv_underhair'
            outfit.data.uv_layers[3].name = 'uv_eyeshadow'
        c.print_timer('rename_uv_maps')

    def rename_shapekeys(self):
        '''Renames the mouth shapekeys to match the Eye names'''
        translation_dict = {

            #Emotions (eyes and mouth)
            "_def_":                "Default",
            "_egao_":               "Smiling",
            "_bisyou_":             "Happy",
            "_uresi_ss_":           "Happy Slight",
            "_uresi_s_":            "Happy Moderate",
            "_uresi_":              "Happy Broad",
            "_doki_ss_":            "Doki Slight",
            "_doki_s_":             "Doki Moderate",
            "_doki_":               "Doki",
            "_ikari_":              "Angry",
            "_ikari02_":            "Angry 2",
            "_sinken_":             "Serious",
            "_sinken02_":           "Serious 2",
            "_sinken03_":           "Serious 3",
            "_keno_":               "Hate",
            "_sabisi_":             "Lonely",
            "_aseri_":              "Impatient",
            "_huan_":               "Displeased",
            "_human_":              "Displeased",
            "_akire_":              "Amazed",
            "_odoro_s_":            "Shocked Moderate",
            "_odoro_":              "Shocked",
            "_doya_":               "Smug",
            "_pero_":               "Lick",
            "_name_":               "Eating",
            "_tabe_":               "Eating 2",
            "_kuwae_":              "Hold in Mouth",
            "_kisu_":               "Kiss",
            "_name02_":             "Tongue Out",
            "_mogu_":               "Chewing",
            "_niko_":               "Cartoony Smile",
            '_neko_':               'Cat',
            "_san_":                "Triangle",

            #Emotions (Eyebrows)
            "_koma_":               "Worried",
            "_gimoL_":              "Doubt Left",
            "_gimoR_":              "Doubt Right",
            "_sianL_":              "Thinking Left",
            "_sianR_":              "Thinking Right",
            "_oko_":                "Angry",
            "_oko2L_":              "Angry Left",
            "_oko2R_":              "Angry Right",
            "_tmara_":              "Bored",
            "_tumara_":             "Bored",
            "_rakutan_":            "Dejected",
            "_winkl_":              "Wink Left",
            "_winkr_":              "Wink Right",

            #Emotions extra
            '_e_s_':                  'e Small',
            '_i_s_':                  'i Small',
            '_a_s_':                  'a Small',
            '_u_s_':                  'u Small',
            '_o_s_':                  'o Small',
            '_n_s_':                  'n Small',
            '_e_l_':                  'e Big',
            '_i_l_':                  'i Big',
            '_a_l_':                  'a Big',
            '_u_l_':                  'u Big',
            '_o_l_':                  'o Big',
            '_n_l_':                  'n Big',

            #SVS emotions
            '_kisu':                  'Kiss',
            '_kuwae':                 'Hold in Mouth',
            '_san':                   'Triangle',
            'Smilings_':              'Smiling Slight',
            'Angrys_':                'Angry Slight',
            'Seriouss_':              'Serious Slight',
            '_peroL':                 'Lick Left',
            '_peroR':                 'Lick Right',
            '_pero':                  'Lick' ,
            '_vo_e':                  'e' ,
            '_vo_i':                  'i' ,
            '_vo_a':                  'a' ,
            '_vo_u':                  'u' ,
            '_vo_o':                  'o' ,
            '_name':                  'Tongue Out',
            '_ikari':                 'Angry',
            '_egao':                  'Smiling',
            '_sabisi':                'Sad',
            '_komari':                'Worried',
            '_doki':                  'Doki',
            '_akire':                 'Amazed',
            '_gimon':                 'Doubt',
            '_winkL':                 'Wink Left',
            '_winkR':                 'Wink Right',
        }

        kk_translation_dict = {
            'デフォルト': 'Default'
        }

        svs_translation_dict = {
            # SVS japanese names
            'デフォルト': 'Default',
            '両目閉じ': 'Closed',
            '笑顔1': 'Happy',
            '笑顔2': 'Happy Slight',
            '笑顔　両目閉じ': 'Happy, Closed',
            '笑顔　': 'Happy ',
            '怒り': 'Angry',
            '寂し': 'Sad',
            '不満': 'Displeased',
            '疑問': 'Suspicious',
            'どや': 'Smug',
            'ウインク左': 'Winking L',
            'ウインク右': 'Winking R',
            '横一文字': 'Horizontal Line',
            'デフォルメ泣き': 'Cartoony Crying',
            'ジト目': 'Staring',
            'きょとん': 'Dazed',
            '丸目': 'Circle Eyes',
            'ぐるぐる': 'Spiral Eyes',
            '楕円': 'Oval Eyes',
            'キラリ': 'Sparkle Eyes',
            'ハート': 'Heart Eyes',
            '目に炎': 'Fire Eyes',
            'デフォルメウインク.001': 'Cartoony Wink 2',
            'デフォルメウインク': 'Cartoony Wink',
        }

        ac_translation_dict = {
            # Reference svs_translation_dict
            'デフォルト': 'Default',
            '目にキラリ': 'Sparkle Pupils',
            '目にハート': 'Heart Pupils',
            '不動ハート': 'Static Heart',
            '不動ぐるぐる': 'Static Spiral',
            'ネコ目': 'Cat Eyes',
            'バツ目': 'XX Eyes',
            '黒塗り目': 'Blackened Eyes',
            '怒り目': 'Angry Eyes',
            '泣き目': 'Sobbing Eyes',
            '笑顔　両目閉じ': 'Happy, Closed',
            '両目閉じ': 'Closed',
            '笑顔1': 'Happy',
            '笑顔2': 'Happy Slight',
            '怒り': 'Angry',
            '寂し': 'Sad',
            '不満': 'Displeased',
            '疑問': 'Suspicious',
            'どや': 'Smug',
            'ウインク左': 'Winking L',
            'ウインク右': 'Winking R',
            '横一文字': 'Horizontal Line',
            'デフォルメ泣き': 'Cartoony Crying',
            'ジト目': 'Staring',
            'きょとん': 'Dazed',
            '丸目': 'Circle Eyes',
            'ぐるぐる': 'Spiral Eyes',
            '楕円': 'Oval Eyes',
            'キラリ': 'Sparkle Eyes',
            'ハート': 'Heart Eyes',
            '目に炎': 'Fire Eyes',
            'デフォルメウインク': 'Cartoony Wink',
            # 'デフォルメウインク 2': 'デフォルメウインク 2'
        }

        #rename the shapekeys
        #for KK exports, the eyebrow shapekeys have already been generated, so nothing needs to be renamed
        eyebrow_prefixes = [] if c.is_kk() else ['mayuge.f00', 'mayuge.eye_f00']

        additional_translation_dict = kk_translation_dict
        if c.get_prefix() == 'SVS':
            additional_translation_dict = svs_translation_dict
        elif c.get_prefix() == 'AC':
            additional_translation_dict = ac_translation_dict

        for keyblock in c.get_body().data.shape_keys.key_blocks:
            for eyebrow_prefix in eyebrow_prefixes:
                keyblock.name = keyblock.name.replace(eyebrow_prefix, 'Eyebrow ')
            for key in translation_dict:
                keyblock.name = keyblock.name.replace(key, f"{translation_dict[key]}")
                if keyblock.name.endswith('op'):
                    keyblock.name = keyblock.name.replace('op', '')
                if keyblock.name.endswith('cl'):
                    keyblock.name = keyblock.name.replace('cl', ', Closed')
            for key, value in additional_translation_dict.items():
                new_name = keyblock.name.replace(key, value)
                c.json_file_manager.remap('shapekey', keyblock.name, new_name)
                keyblock.name = new_name

        #re organize shape keys
        c.switch(c.get_body(), "edit")
        c.switch(c.get_body(), "object")
        json_filename = c.get_prefix() + '_BlendShapeInfo.json'
        gag_keys = ['Eye ' + i['patternName'] for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] > -1]

        def alphabetize_and_reorder(prefix):
            keys = [block.name for block in c.get_body().data.shape_keys.key_blocks if block.name.startswith(prefix + ' ') and block.name not in gag_keys]
            keys.sort()
            for key in keys:
                c.get_body().active_shape_key_index = c.get_body().data.shape_keys.key_blocks.keys().index(key)
                bpy.ops.object.shape_key_move(type='BOTTOM')
        alphabetize_and_reorder('Eye')
        alphabetize_and_reorder('Mouth')
        alphabetize_and_reorder('Eyebrow')
        #refresh the list
        c.switch(c.get_body(), "edit")
        c.switch(c.get_body(), "object")
        already_moved = []
        for keyblock in c.get_body().data.shape_keys.key_blocks:
            if keyblock.name.startswith('Gag eye') and keyblock.name not in already_moved:
                already_moved.append(keyblock.name)
                c.get_body().active_shape_key_index = c.get_body().data.shape_keys.key_blocks.keys().index(keyblock.name)
                bpy.ops.object.shape_key_move(type='BOTTOM')

        #reset to basis shapekey
        c.get_body().active_shape_key_index = 0
        c.print_timer('translate_shapekeys')

    def combine_shapekeys(self):
        '''Creates new, full shape keys using the partial shape keys info from the KK_BlendShapeInfo.json'''

        #make the basis shapekey active
        c.switch(c.get_body(), 'object')
        c.get_body().active_shape_key_index = 0

        #get each pattern in the json file
        json_filename = c.get_prefix() + '_BlendShapeInfo.json'
        emotion_patterns = c.json_file_manager.get_json_file(json_filename)
        shapekey_block = bpy.data.shape_keys[c.get_body().data.shape_keys.name].key_blocks

        def create_shape_key(pattern, open = True):
            keys_in_this_pattern = pattern['blendShapeName']
            for index, shape_key_name in enumerate(keys_in_this_pattern):
                #if this pattern is a mouth type, don't apply the keys in the default eye shapekey
                if pattern['type'] == 'Mouth':
                    if shape_key_name in emotion_patterns[0]['blendShapeName']:
                        continue
                
                if open and shapekey_block.get(shape_key_name):
                    shapekey_block[shape_key_name].value = pattern['blendShapeWeight'][index] / 100
                
                closed_shapekey_name = shape_key_name.replace('_op', '_cl')
                if not open and shapekey_block.get(closed_shapekey_name) and closed_shapekey_name != shape_key_name:
                    shapekey_block[closed_shapekey_name].value = pattern['blendShapeWeight'][index] / 100

            #Now that the weights are applied, save the shapekey
            new_key = c.get_body().shape_key_add(name = f"{pattern['type']} {pattern['patternName']}{', Closed' if not open else ''}")

            #then reset all the values for the next one
            new_key.value = 0
            for index, shape_key_name in enumerate(keys_in_this_pattern):
                closed_shapekey_name = shape_key_name.replace('_op', '_cl')
                if shapekey_block.get(shape_key_name):
                    shapekey_block[shape_key_name].value = 0
                if shapekey_block.get(closed_shapekey_name):
                    shapekey_block[closed_shapekey_name].value = 0
        
        #Go through every key
        for pattern in emotion_patterns:
            create_shape_key(pattern, open = True)
            if pattern['type'] == 'Mouth':
                create_shape_key(pattern, open = False)
        
        #manually add missing mogu keys
        eating_keys = {
            "kuti_face.f00_mogu_op": 'Mouth Chewing',
            "kuti_face.f00_mogu_cl": 'Mouth Chewing, Closed',}
        for key in eating_keys:
            if shapekey_block.get(key):
                shapekey_block[key].name = eating_keys[key]
        #manually add missing tabe key
        tabe_keys = ["kuti_face.f00_tabe_op", "kuti_ha.ha00_def_op","kuti_yaeba.y00_def_op","kuti_sita.t00_def_op",]
        for key in tabe_keys:
            if shapekey_block.get(key):
                shapekey_block[key].value = 1
        new_key = c.get_body().shape_key_add(name='Mouth Eating 2')
        new_key.value = 0
        for key in tabe_keys:
            if shapekey_block.get(key):
                shapekey_block[key].value = 0

    def combine_mouth_shapekeys(self):
        '''Creates new full mouth shapekeys based on the partial shapekeys'''
        #Some mouth shapekeys require the default teeth or other specific shapekeys to be active

        #go through each mouth shapekey and combine the kuti_ha.ha00, kuti_yaeba.y00, kuti_sita.t00, and kuti_face.f00 keys together
        shapekey_block = bpy.data.shape_keys[c.get_body().data.shape_keys.name].key_blocks
        if c.is_kk():
            correction_list = {
                '_u_small_op'       : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_def_op',      'kuti_sita.t00_def_op'],
                '_u_big_op'         : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_def_op',      'kuti_sita.t00_def_op'],
                '_e_big_op'         : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_def_op',      'kuti_sita.t00_def_op'],
                '_o_small_op'       : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_def_op',      'kuti_sita.t00_def_op'],
                '_o_big_op'         : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_def_op',      'kuti_sita.t00_def_op'],
                '_neko_op'          : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_def_op',      'kuti_sita.t00_def_op'],
                '_san_op'           : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_def_op',      'kuti_sita.t00_def_op'],
                '_tabe_op'          : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_name02_op',   'kuti_sita.t00_sinken03_op',        'kuti_face.f00_tabe_op'],
                '_i_big_op'         : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_i_big_cl',                                        'kuti_face.f00_i_big_op'],
                '_i_small_op'       : ['kuti_yaeba.y00_def_op', 'kuti_ha.ha00_i_small_cl',                                      'kuti_face.f00_i_small_op'],
                '_e_small_op'       : ['kuti_yaeba.y00_def_op',                                                                 'kuti_face.f00_e_small_op'],
                '_niko_op'          : [                                                     'kuti_sita.t00_def_op',             'kuti_face.f00_niko_op'],
            }
            mouth_shapekeys = [k.name for k in shapekey_block if k.name.startswith('kuti_ha.ha00') or k.name.startswith('kuti_yaeba.y00') or k.name.startswith('kuti_sita.t00')]
            mouth_prefix = 'kuti_face.f00'
        else:
            correction_list = {
                '_kisu'             :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                '_neko_op'          :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                '_san'              :   ['tooth.f00_none',     'tang.f00_def_op'],
                '_egao_s_op'        :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                '_egao_op'          :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                '_doki_op'          :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'ikari_op'          :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'sinken_op'         :   ['tooth.f00_no_dw_op', ],
                'sinken_s_op'       :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'keno_op'           :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'doya_op'           :   ['tooth.f00_none',     'tang.f00_def_op'],
                'aseri_cl'          :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'aseri_op'          :   ['tooth.f00_none',     'tang.f00_def_op'],
                'sabisi_cl'         :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'sabisi_op'         :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                '_pero'             :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'vo_a'              :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'vo_i'              :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'vo_u'              :   ['tooth.f00_no_dw_op', 'tang.f00_def_op'],
                'vo_e'              :   ['tooth.f00_none',     'tang.f00_def_op'],
                'vo_o'              :   ['tooth.f00_none',     'tang.f00_def_op'],
                '_peroL'            :   ['tooth.f00_no_dw_op', ],
                'peroR'             :   ['tooth.f00_no_dw_op', ],
                'name'              :   ['tooth.f00_no_dw_op', ],
                'niko_op'           :   ['tooth.f00_none',     'tang.f00_def_op'],

            }
            mouth_shapekeys = [k.name for k in shapekey_block if k.name.startswith('tooth.f00') or k.name.startswith('tang.f00')]
            mouth_prefix = 'face.kuti_f00'
        for block in shapekey_block:
            shape_key_name = block.name
            emotion = shape_key_name.replace(mouth_prefix, '')
            if shape_key_name.startswith(mouth_prefix) and not shape_key_name.endswith('.001'):
                #check if this block needs a correction
                correction_needed = [k for k in list(correction_list.keys()) if shape_key_name.endswith(k)]
                
                #check if this block has any other keys with the same suffix
                associated_blocks = [k.name for k in shapekey_block if k.name.endswith(emotion) and k.name in mouth_shapekeys]

                #activate this shapekey, the associated blocks, and the correction blocks
                shapekey_block[shape_key_name].value = 1
                for b in associated_blocks:
                    if shapekey_block.get(b):
                        shapekey_block[b].value = 1
                for correction in correction_needed:
                    for b in correction_list[correction]:
                        if shapekey_block.get(b):
                            shapekey_block[b].value = 1

                #Now that the weights are applied, save the shapekey
                new_key = c.get_body().shape_key_add(name=('Mouth ' + emotion))

                #then reset all the values for the next one
                shapekey_block[shape_key_name].value = 0
                new_key.value = 0
                for b in associated_blocks:
                    if shapekey_block.get(b):
                        shapekey_block[b].value = 0
                for correction in correction_needed:
                    for b in correction_list[correction]:
                        if shapekey_block.get(b):
                            shapekey_block[b].value = 0
    
    def delete_remaining_partial_shapekeys(self):
        '''Delete the rest of the partial shapekeys based on the shapekey's name'''
        shapekey_block = bpy.data.shape_keys[c.get_body().data.shape_keys.name].key_blocks
        prefixes = ['mayuge.mayu00', 'mayuge_face.f00', "eye_face.f00", "kuti_face.f00", "eye_siroL.sL00", "eye_siroR.sR00", "eye_line_u.elu00", "eye_line_l.ell00", "eye_naM.naM00", "eye_nose.nl00", "kuti_nose.nl00", "kuti_ha.ha00", "kuti_yaeba.y00", "kuti_sita.t00", "eye_naL.naL00", "eye_naM.naM00", "eye_naS.naS00", 'tang.f00', 'tooth.f00', 'eyelid.eye_f00', 'eyelash.eye_f00', 'face.kuti_f00', 'face.eye_f00', ]
        for block in shapekey_block:
            remove = [block.name for i in prefixes if block.name.startswith(i)]
            if remove and block.name:
                c.get_body().shape_key_remove(shapekey_block[block.name])

    def create_gag_and_tear_shapekeys(self):
        '''Separate tears from body and create tear shapekeys'''
        # check if the tear material even exists
        try:
            tear_material_name = c.get_material_names('cf_O_namida_L')[0]
        except:
            c.kklog('Tear material did not exist.', 'warn')
            return
        # Create a reverse shapekey for each tear material
        c.switch(c.get_body(), 'edit')
        # Move tears and gag backwards on the basis shapekey
        # use head mesh as reference location
        face_material = c.get_material_names('cf_O_face')
        if face_material:
            bpy.context.object.active_material_index = c.get_body().data.materials.find(face_material[0])
        bpy.ops.object.material_slot_select()
        # refresh selection, then get head location
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.mode_set(mode='EDIT')
        selected_verts = [v.co.y for v in c.get_body().data.vertices if v.select]
        loc = 0
        for y in selected_verts:
            loc += y
        middle_of_head = loc / len(selected_verts)
        c.switch(c.get_body(), 'edit')
        tear_and_gag_mats = {
            'cf_O_namida_L': ("Tears big", []),
            'cf_O_namida_M': ("Tears med", []),
            'cf_O_namida_S': ('Tears small', []),
            'cf_O_gag_eye_00': ("Gag eye 00", []),
            'cf_O_gag_eye_01': ("Gag eye 01", []),
            'cf_O_gag_eye_02': ("Gag eye 02", []),
        }
        for cat, cat_data in tear_and_gag_mats.items():
            mats = c.get_material_names(cat)
            if (m_flag := ('M' in cat)) or 'S' in cat:
                mats = [m + ('.001' if m_flag else '.002') for m in
                        mats]  # tears share a material name, so add a .001
            for mat in mats:
                bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
                bpy.ops.object.material_slot_select()
            cat_data[1].extend(mats)

        # refresh selection, then move tears a random amount backwards
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.mode_set(mode='EDIT')
        selected_verts = [v for v in c.get_body().data.vertices if v.select]
        amount_to_move_tears_back = 2 * (selected_verts[0].co.y - middle_of_head)
        bpy.ops.transform.translate(value=(0, abs(amount_to_move_tears_back), 0))

        # move the tears forwards again the same amount in individual new shapekeys
        for cat, cat_data in tear_and_gag_mats.items():
            for mat in cat_data[1]:
                c.switch(c.get_body(), 'object')
                new_key = c.get_body().shape_key_add(from_mix=False)
                new_key.value = 0
                c.get_body().data.shape_keys.key_blocks[-1].name = cat_data[0]
                last_shapekey = len(c.get_body().data.shape_keys.key_blocks) - 1
                bpy.context.object.active_shape_key_index = last_shapekey
                c.switch(c.get_body(), 'edit')
                bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
                if c.get_body().data.materials.find(mat) == -1:
                    bpy.context.object.active_material_index += 1
                else:
                    bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
                bpy.ops.object.material_slot_select()
                # find a random vertex location of the tear and move it forwards
                c.switch(c.get_body(), 'object')
                bpy.ops.object.mode_set(mode='EDIT')
                bpy.ops.transform.translate(value=(0, -1 * (abs(amount_to_move_tears_back) + abs(0.002)), 0))
                c.switch(c.get_body(), 'object')
                bpy.ops.object.shape_key_move(type='TOP' if tear_material_name in mat else 'BOTTOM')

        # Move the Eye, eyewhite and eyeline materials back on the gageye shapekeys
        #get the gag eye shapekey names from the json file
        json_filename = c.get_prefix() + '_BlendShapeInfo.json'
        gag_keys = ['Eye ' + i['patternName'] for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] > -1]
        shapekey_block = bpy.data.shape_keys[c.get_body().data.shape_keys.name].key_blocks
        for key in gag_keys:
            #special exception
            if 'Fiery' in key:
                continue
            bpy.context.object.active_shape_key_index = shapekey_block.find(key)
            c.switch(c.get_body(), 'edit')
            for cat in [
                'cf_Ohitomi_L',
                'cf_Ohitomi_R',
                'cf_Ohitomi_L02',
                'cf_Ohitomi_R02',
                'cf_O_eyeline',
                'cf_O_eyeline_low']:
                mats = c.get_material_names(cat)
                # also append the duplicated eyewhite material
                mats.append('cf_m_sirome_00.001')
                for mat in mats:
                    bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
                    bpy.ops.object.material_slot_select()
            # find a random vertex location of the eye and move it backwards
            c.switch(c.get_body(), 'object')
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.transform.translate(value=(0, 2.5 * abs(amount_to_move_tears_back), 0))
            c.switch(c.get_body(), 'object')

        # Merge the tear materials
        c.switch(c.get_body(), 'edit')

        to_merge_materials = tear_and_gag_mats['cf_O_namida_L'][1]
        to_merge_materials.extend(tear_and_gag_mats['cf_O_namida_M'][1])
        to_merge_materials.extend(tear_and_gag_mats['cf_O_namida_S'][1])

        for mat in to_merge_materials:
            bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
            bpy.ops.object.material_slot_select()
            bpy.context.object.active_material_index = c.get_body().data.materials.find(tear_material_name)
            bpy.ops.object.material_slot_assign()
            bpy.ops.mesh.select_all(action='DESELECT')

        # make a vertex group that does not contain the tears
        bpy.ops.object.vertex_group_add()
        bpy.ops.mesh.select_all(action='SELECT')
        c.get_body().vertex_groups.active.name = "Body without Tears"
        bpy.context.object.active_material_index = c.get_body().data.materials.find(tear_material_name)
        bpy.ops.object.material_slot_deselect()
        bpy.context.object.active_material_index = c.get_body().data.materials.find(tear_material_name + '.001')
        bpy.ops.object.material_slot_deselect()
        bpy.context.object.active_material_index = c.get_body().data.materials.find(tear_material_name + '.002')
        bpy.ops.object.material_slot_deselect()
        bpy.ops.object.vertex_group_assign()

        # Separate tears from body object
        # link shapekeys of tears to body
        tears = self.separate_materials(c.get_body(), to_merge_materials, 'Tears ' + c.get_name())
        tears['tears'] = True
        bpy.ops.object.mode_set(mode='OBJECT')
        link_keys(c.get_body(), [tears])

        c.print_timer('create_tear_shapekeys')


    def create_svs_tear_shapekeys(self):
        '''Separate tears from body and create tear shapekeys'''
        # check if the tear material even exists
        try:
            tear_material_name = c.get_material_names('cf_O_namida_L')[0]
        except:
            c.kklog('Tear material did not exist.', 'warn')
            return
        # Create a reverse shapekey for each tear material
        c.switch(c.get_body(), 'edit')
        # Move tears and gag backwards on the basis shapekey
        # use head mesh as reference location
        face_material = c.get_material_names('cf_O_face')
        if face_material:
            bpy.context.object.active_material_index = c.get_body().data.materials.find(face_material[0])
        bpy.ops.object.material_slot_select()
        # refresh selection, then get head location
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.mode_set(mode='EDIT')
        selected_verts = [v.co.y for v in c.get_body().data.vertices if v.select]
        loc = 0
        for y in selected_verts:
            loc += y
        middle_of_head = loc / len(selected_verts)
        c.switch(c.get_body(), 'edit')
        tear_and_gag_mats = {
            'cf_O_namida_L': ("Tears big", []),
            'cf_O_namida_M': ("Tears med", []),
            'cf_O_namida_S': ('Tears small', []),
            'cf_O_gag_eye_00': ("Gag eye 00", []),
        }
        for cat, cat_data in tear_and_gag_mats.items():
            mats = c.get_material_names(cat)
            if (m_flag := ('M' in cat)) or 'S' in cat:
                mats = [m + ('.001' if m_flag else '.002') for m in
                        mats]  # tears share a material name, so add a .001
            for mat in mats:
                bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
                bpy.ops.object.material_slot_select()
            cat_data[1].extend(mats)

        # refresh selection, then move tears a random amount backwards
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.mode_set(mode='EDIT')
        selected_verts = [v for v in c.get_body().data.vertices if v.select]
        amount_to_move_tears_back = 2 * (selected_verts[0].co.y - middle_of_head)
        bpy.ops.transform.translate(value=(0, abs(amount_to_move_tears_back), 0))

        # move the tears forwards again the same amount in individual new shapekeys
        for cat, cat_data in tear_and_gag_mats.items():
            for mat in cat_data[1]:
                c.switch(c.get_body(), 'object')
                new_key = c.get_body().shape_key_add(from_mix=False)
                new_key.value = 0
                c.get_body().data.shape_keys.key_blocks[-1].name = cat_data[0]
                last_shapekey = len(c.get_body().data.shape_keys.key_blocks) - 1
                bpy.context.object.active_shape_key_index = last_shapekey
                c.switch(c.get_body(), 'edit')
                bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
                if c.get_body().data.materials.find(mat) == -1:
                    bpy.context.object.active_material_index += 1
                else:
                    bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
                bpy.ops.object.material_slot_select()
                # find a random vertex location of the tear and move it forwards
                c.switch(c.get_body(), 'object')
                bpy.ops.object.mode_set(mode='EDIT')
                bpy.ops.transform.translate(value=(0, -1 * (abs(amount_to_move_tears_back) + abs(0.002)), 0))
                c.switch(c.get_body(), 'object')
                bpy.ops.object.shape_key_move(type='TOP' if tear_material_name in mat else 'BOTTOM')
        
        # Move the Eye, eyewhite and eyeline materials back on the gageye shapekeys
        # get the gag eye shapekey names from the json file
        json_filename = c.get_prefix() + '_BlendShapeInfo.json'
        gag_keys = ['Eye ' + i['patternName'] for i in c.json_file_manager.get_json_file(json_filename) if
                    i['gagEye'] > -1]
        shapekey_block = bpy.data.shape_keys[c.get_body().data.shape_keys.name].key_blocks
        for key in gag_keys:
            bpy.context.object.active_shape_key_index = shapekey_block.find(key)
            c.switch(c.get_body(), 'edit')
            for cat in [
                'cf_O_eyelash_up',
                'cf_O_eyelid',
                'cf_O_hitomi_L',
                'cf_O_hitomi_R',
            ]:
                mats = c.get_material_names(cat)
                # also append the duplicated eyewhite material
                for mat in mats:
                    bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
                    bpy.ops.object.material_slot_select()
            # find a random vertex location of the eye and move it backwards
            c.switch(c.get_body(), 'object')
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.transform.translate(value=(0, 2.5 * abs(amount_to_move_tears_back), 0))
            c.switch(c.get_body(), 'object')

        # Merge the tear materials
        c.switch(c.get_body(), 'edit')

        to_merge_materials = tear_and_gag_mats['cf_O_namida_L'][1]
        to_merge_materials.extend(tear_and_gag_mats['cf_O_namida_M'][1])
        to_merge_materials.extend(tear_and_gag_mats['cf_O_namida_S'][1])

        for mat in to_merge_materials:
            bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
            bpy.ops.object.material_slot_select()
            bpy.context.object.active_material_index = c.get_body().data.materials.find(tear_material_name)
            bpy.ops.object.material_slot_assign()
            bpy.ops.mesh.select_all(action='DESELECT')

        # make a vertex group that does not contain the tears
        bpy.ops.object.vertex_group_add()
        bpy.ops.mesh.select_all(action='SELECT')
        c.get_body().vertex_groups.active.name = "Body without Tears"
        bpy.context.object.active_material_index = c.get_body().data.materials.find(tear_material_name)
        bpy.ops.object.material_slot_deselect()
        bpy.context.object.active_material_index = c.get_body().data.materials.find(tear_material_name + '.001')
        bpy.ops.object.material_slot_deselect()
        bpy.context.object.active_material_index = c.get_body().data.materials.find(tear_material_name + '.002')
        bpy.ops.object.material_slot_deselect()
        bpy.ops.object.vertex_group_assign()

        # Separate tears from body object
        # link shapekeys of tears to body
        tears = self.separate_materials(c.get_body(), to_merge_materials, 'Tears ' + c.get_name())
        tears['tears'] = True
        bpy.ops.object.mode_set(mode='OBJECT')
        link_keys(c.get_body(), [tears])

        c.print_timer('create_tear_shapekeys')

    def create_eye_vertex_groups(self):
        '''SVS models are missing the left and right eye vertex groups'''
        body = c.get_body()
        try:
            c.switch(body, 'edit')
            bpy.context.object.active_material_index = body.data.materials.find('cf_m_hitomi_00_L')
            bpy.ops.object.material_slot_select()
            bpy.ops.object.vertex_group_add()
            bpy.ops.object.vertex_group_assign()
            body.vertex_groups[-1].name = 'Left Eye'
            bpy.context.object.active_material_index = body.data.materials.find('cf_m_hitomi_00_R')
            bpy.ops.object.material_slot_select()
            bpy.ops.object.vertex_group_add()
            bpy.ops.object.vertex_group_assign()
            body.vertex_groups[-1].name = 'Right Eye'
        except:
            pass
        c.switch(body, 'object')

    def create_gag_eye_drivers_and_separate_gags(self):
        '''Separate gag eyes from body and setup the drivers for later'''
        if len(c.get_material_names('cf_O_gag_eye_00')) == 0:
            return
        #get the gag eye shapekey names from the json file
        json_filename = c.get_prefix() + '_BlendShapeInfo.json'
        gag_keys = {
            0: [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == 0],
            1: [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == 1],
            2: [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == 2],
        }
        shapekey_block = bpy.data.shape_keys[c.get_body().data.shape_keys.name].key_blocks
        
        #move the gag eye shapekeys to the top of the list
        c.switch(c.get_body(), 'object')
        for gag_index in range(3):
            for key in gag_keys[gag_index]:
                keyname = 'Eye ' + key['patternName']
                index = c.get_body().data.shape_keys.key_blocks.find(keyname)
                if index > -1:
                    bpy.context.object.active_shape_key_index = c.get_body().data.shape_keys.key_blocks.keys().index(keyname)
                    bpy.ops.object.shape_key_move(type='TOP')
        
        def get_gag_var_names(gag_number):
            #first let's collect the gag shape keys that use this gag eye mesh
            gag_keysa = [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == gag_number]
            #then, we need to assign each gag eye a unique variable for the driver. 
            # The shape key name cannot be used because it can be made of non-alphanumeric characters, so just use generic names
            return [f"gag{gag_number}{i+1}" for i, _ in enumerate(gag_keysa)]

        def create_gag_eye_driver(keyblock: str, condition: str, gag_index):
            '''creates a gag eye driver'''
            skey_driver = bpy.data.shape_keys[0].key_blocks[keyblock].driver_add('value')
            skey_driver.driver.type = 'SCRIPTED'
            for index, key in enumerate(get_gag_var_names(gag_index)):
                newVar = skey_driver.driver.variables.new()
                newVar.name = key.replace(' ','')
                newVar.type = 'SINGLE_PROP'
                newVar.targets[0].id_type = 'KEY'
                newVar.targets[0].id = c.get_body().data.shape_keys
                newVar.targets[0].data_path = 'key_blocks["Eye ' + gag_keys[gag_index][index]['patternName'] + '"].value'
            skey_driver.driver.expression = condition

        bpy.context.object.active_shape_key_index = 0

        #There are three drivers that need to be created. The real gag eye shape keys will make these gag meshes move in front of the eyes
        def get_gag_vars(gag_number):
            gag_keysa = [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] == gag_number]
            return " or ".join(f"gag{gag_number}{i+1}" for i, _ in enumerate(gag_keysa))

        create_gag_eye_driver('Gag eye 00', f'1 if ({get_gag_vars(0)}) else 0', 0)
        create_gag_eye_driver('Gag eye 01', f'1 if ({get_gag_vars(1)}) else 0', 1)
        create_gag_eye_driver('Gag eye 02', f'1 if ({get_gag_vars(2)}) else 0', 2)

        #make a vertex group that does not contain the gag_eyes
        bpy.ops.object.vertex_group_add()
        c.switch(c.get_body(), 'edit')
        bpy.ops.mesh.select_all(action='SELECT')
        c.get_body().vertex_groups.active.name = "Body without Gag eyes"

        gag_eye_materials = []
        for mat in ['cf_O_gag_eye_00', 'cf_O_gag_eye_01', 'cf_O_gag_eye_02']:
            gag_eye_data = c.json_file_manager.get_material_info_by_smr(mat)
            gag_eye_materials.extend([
                item['MaterialName']
                for smr_info in gag_eye_data
                for item in smr_info['MaterialInformation']
            ])

        gag_eye_materials = list(set(gag_eye_materials))

        for material_name in gag_eye_materials:
            bpy.context.object.active_material_index = c.get_body().data.materials.find(material_name)
            bpy.ops.object.material_slot_deselect()

        bpy.ops.object.vertex_group_assign()

        # Separate gag from body object
        # link shapekeys of gag to body
        if gag_eye_materials:
            gag_eye = self.separate_materials(c.get_body(), gag_eye_materials, 'Gag Eyes ' + c.get_name())
            gag_eye['gag'] = True
            gag_eye['body'] = False
            c.switch(c.get_body(), 'object')
            link_keys(c.get_body(), [gag_eye])

        c.print_timer('create gag_eye_shapekeys')
        return

    def create_svs_gag_eye_drivers_and_separate_gags(self):
        '''Separate gag eyes from body and setup the drivers for later'''
        if len(c.get_material_names('cf_O_gag_eye_00')) == 0:
            return
        # get the gag eye shapekey names from the json file
        json_filename = c.get_prefix() + '_BlendShapeInfo.json'
        gag_keys = [i for i in c.json_file_manager.get_json_file(json_filename) if i['gagEye'] >= 0]

        # move the gag eye shapekeys to the top of the list
        c.switch(c.get_body(), 'object')
        for key in gag_keys:
            keyname = c.json_file_manager.get_remapped('shapekey', 'Eye ' + key['patternName'])
            index = c.get_body().data.shape_keys.key_blocks.find(keyname)
            if index > -1:
                bpy.context.object.active_shape_key_index = c.get_body().data.shape_keys.key_blocks.keys().index(
                    keyname)
                bpy.ops.object.shape_key_move(type='TOP')

        def get_gag_var_names():
            return [f"gag{i + 1}" for i in range(len(gag_keys))]

        def create_gag_eye_driver(keyblock: str, condition: str):
            '''creates a gag eye driver'''
            skey_driver = bpy.data.shape_keys[0].key_blocks[keyblock].driver_add('value')
            skey_driver.driver.type = 'SCRIPTED'
            for index, key in enumerate(get_gag_var_names()):
                newVar = skey_driver.driver.variables.new()
                newVar.name = key.replace(' ', '')
                newVar.type = 'SINGLE_PROP'
                newVar.targets[0].id_type = 'KEY'
                newVar.targets[0].id = c.get_body().data.shape_keys
                newVar.targets[0].data_path = 'key_blocks["' + c.json_file_manager.get_remapped('shapekey', "Eye " + gag_keys[index]['patternName']) + '"].value'
            skey_driver.driver.expression = condition

        bpy.context.object.active_shape_key_index = 0

        # There are three drivers that need to be created. The real gag eye shape keys will make these gag meshes move in front of the eyes
        def get_gag_vars():
            return '1 if ' + ' or '.join(f'gag{i + 1}' for i in range(len(gag_keys))) + ' else 0'

        create_gag_eye_driver('Gag eye 00', get_gag_vars())

        # make a vertex group that does not contain the gag_eyes
        bpy.ops.object.vertex_group_add()
        c.switch(c.get_body(), 'edit')
        bpy.ops.mesh.select_all(action='SELECT')
        c.get_body().vertex_groups.active.name = "Body without Gag eyes"

        gag_eye_materials = []
        gag_eye_data = c.json_file_manager.get_material_info_by_smr('cf_O_gag_eye_00')
        gag_eye_materials.extend([
            item['MaterialName']
            for smr_info in gag_eye_data
            for item in smr_info['MaterialInformation']
        ])

        gag_eye_materials = list(set(gag_eye_materials))

        for material_name in gag_eye_materials:
            bpy.context.object.active_material_index = c.get_body().data.materials.find(material_name)
            bpy.ops.object.material_slot_deselect()

        bpy.ops.object.vertex_group_assign()

        # Separate gag from body object
        # link shapekeys of gag to body
        if gag_eye_materials:
            gag_eye = self.separate_materials(c.get_body(), gag_eye_materials, 'Gag Eyes ' + c.get_name())
            gag_eye['gag'] = True
            gag_eye['body'] = False
            c.switch(c.get_body(), 'object')
            link_keys(c.get_body(), [gag_eye])

        c.print_timer('create gag_eye_shapekeys')

    def remove_body_seams(self):
        '''merge the edges of certain body materials to prevent odd shading issues later on'''
        if not bpy.context.scene.kkbp.fix_seams:
            return
        c.switch(c.get_body(), 'edit')
        mats = c.get_material_names('cf_O_face')
        mats.extend(c.get_material_names('o_body_a'))

        bpy.context.tool_settings.mesh_select_mode = (True, False, False) #enable vertex select in edit mode
        for mat in mats:
            bpy.context.object.active_material_index = c.get_body().data.materials.find(mat)
            bpy.ops.object.material_slot_select()
        bpy.ops.mesh.remove_doubles(threshold=0.00001)

        # This operation still messes with the weights.
        # Maybe it's possible to save the 3D positions, weights, and UV positions for each duplicate vertex
        # then delete and make new vertices with saved info 
        # The vertices on the body object seem to be consistent across imports according to https://github.com/FlailingFog/KK-Blender-Porter-Pack/issues/82
        c.print_timer('remove_body_seams')

    def separate_materials(self, object: bpy.types.Object, mat_list: list[bpy.types.Material], new_object_name: str, search_type = 'exact') -> bpy.types.Object:
        '''Separates the materials in the mat_list on object, and renames the separated object to "new_object_name". 
        Returns the separated object, or None if there was an error'''
        c.switch(object, 'edit')
        for mat in mat_list:
            mat_found = -1
            if search_type == 'fuzzy' and ('cm_m_' in mat or 'c_m_' in mat or 'o_hit_' in mat or mat == 'cf_O_face_atari_M'):
                for matindex in range(0, len(object.data.materials), 1):
                    if mat in object.data.materials[matindex].name:
                        mat_found = matindex
            else:
                mat_found = object.data.materials.find(mat)
            if mat_found > -1:
                bpy.context.object.active_material_index = mat_found
                bpy.ops.object.material_slot_select()
            else:
                c.kklog('Material wasn\'t found when separating materials: ' + mat, 'warn')
        try:
            bpy.ops.mesh.separate(type='SELECTED')
            new_object = bpy.context.selected_objects[1]
            new_object.name = new_object_name
            return new_object
        except:
            c.kklog('Nothing was selected when separating materials from: ' + object.name, 'warn')
            bpy.ops.object.mode_set(mode = 'OBJECT')
            return None

    def delete_materials(self, object: bpy.types.Object, mat_list: bpy.types.Material):
        '''Deletes the materials in mat_list from object'''
        for mat in mat_list:
            if object.data.materials.find(mat.name) > -1:
                c.switch(object, 'edit')
                bpy.context.object.active_material_index = object.data.materials.find(mat.name)
                bpy.ops.object.material_slot_select()
                bpy.ops.mesh.delete(type='VERT')


