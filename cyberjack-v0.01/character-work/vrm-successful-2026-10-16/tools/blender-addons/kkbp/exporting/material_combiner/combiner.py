import bpy, os
from bpy.props import *
from .combiner_ops import *
from .packer import BinPacker
from ... import common as c
from ..exportprep import get_image_node

def resize_texture_to_resolution(texture_image, target_size):
    """
    Resize a texture image to match the target size using PIL.
    Used for normal and detail textures to ensure consistent atlas resolution.
    Returns a new Blender image with the resized texture.
    """
    if not texture_image or texture_image.size[:] == target_size:
        return texture_image
    
    try:
        from PIL import Image
        import numpy as np
        
        # Ensure the image is packed so we can access pixels
        if not texture_image.packed_file:
            texture_image.pack()
        
        # Get the current image pixels
        pixels = np.array(texture_image.pixels[:]).reshape((texture_image.size[1], texture_image.size[0], texture_image.channels))
        
        # Convert to PIL Image (flip Y axis for correct orientation)
        if texture_image.channels == 4:
            pil_image = Image.fromarray((pixels[::-1] * 255).astype('uint8'), 'RGBA')
        else:
            pil_image = Image.fromarray((pixels[::-1] * 255).astype('uint8'), 'RGB')
        
        # Resize using high-quality Lanczos resampling
        resized_pil = pil_image.resize(target_size, Image.Resampling.LANCZOS)
        
        # Ensure output has alpha channel
        if resized_pil.mode != 'RGBA':
            resized_pil = resized_pil.convert('RGBA')
        
        # Convert back to numpy array
        resized_array = np.array(resized_pil).astype('float32') / 255.0
        
        # Flip Y axis back
        resized_array = resized_array[::-1]
        
        # Create new Blender image with alpha channel
        new_image_name = f"{texture_image.name}_resized"
        new_image = bpy.data.images.new(new_image_name, target_size[0], target_size[1], alpha=True)
        
        # Set pixels (ensure we have 4 channels for RGBA)
        new_image.pixels = resized_array.flatten().tolist()
        new_image.update()
        
        # Pack the new image for later use
        new_image.pack()
        
        c.kklog(f"Resized texture '{texture_image.name}' from {texture_image.size[:]} to {target_size}")
        
        return new_image
    except ImportError:
        c.kklog("Warning: PIL not available, cannot resize texture", type='warn')
        return texture_image
    except Exception as e:
        c.kklog(f"Error resizing texture: {str(e)}", type='error')
        return texture_image

class Combiner(bpy.types.Operator):
    bl_idname = 'kkbp.combiner'
    bl_label = 'Create Atlas'
    bl_description = 'Combine materials'
    bl_options = {'UNDO', 'INTERNAL'}

    def execute(self, context: bpy.types.Context) -> Set[str]:
        #from invoke
        scn = context.scene
        bpy.ops.kkbp.refresh_ob_data()
        for index, object in enumerate([o for o in bpy.data.collections[c.get_name() + ' atlas'].all_objects if o.type == 'MESH' and not o.hide_get()]):
            #check if this object is worth doing anything with 
            if not [mat_slot.material for mat_slot in object.material_slots if mat_slot.material.get('name')]:
                continue
            
            set_ob_mode(context.view_layer, scn.kkbp_ob_data)
            self.data = get_data(scn.kkbp_ob_data, object)
            self.mats_uv = get_mats_uv(scn, self.data)
            clear_empty_mats(scn, self.data, self.mats_uv)
            get_duplicates(self.mats_uv)
            self.structure = get_structure(scn, self.data, self.mats_uv)
            
            #from execute
            scn.kkbp_save_path = os.path.join(context.scene.kkbp.import_dir, 'atlas_files')
            self.structure = BinPacker(get_size(scn, self.structure)).fit()

            size = get_atlas_size(self.structure)
            atlas_size = calculate_adjusted_size(scn, size)

            if max(atlas_size, default=0) > 20000:
                text = 'The output image size of {0}x{1}px is too large'.format(*atlas_size)
                c.kklog(text)
                self.report({'ERROR'}, text)
                return {'FINISHED'}
            
            bake_types = ['light', 'dark', 'normal']
            if bpy.context.scene.kkbp.atlas_dropdown == 'all_textures':
                bake_types.extend(['detail', 'alphamask', 'detailnormal', 'colormask'])

            for type in bake_types:
                #replace all images
                for material in [mat_slot.material for mat_slot in object.material_slots if mat_slot.material.get('name')]:
                    if not material.node_tree.nodes.get('Image Texture'):
                        continue
                    if node := material.node_tree.nodes.get(get_image_node(type)):
                        material.node_tree.nodes['Image Texture'].image = None
                        image = node.image
                    else:
                        continue

                    if type == 'detail':
                        if material.get('outfit') or material.get('hair'):
                            id = material.get('id')
                            coord = material.get('coord')
                            new_image_path = os.path.join(context.scene.kkbp.import_dir, f'Outfit {coord}', f'{id}_DM.png')
                            try:
                                image = bpy.data.images.load(new_image_path)
                            except:
                                image = None
                        elif material.get('body'):
                            id = material.get('id')
                            new_image_path = os.path.join(context.scene.kkbp.import_dir, f'{id}_DM.png')
                            try:
                                image = bpy.data.images.load(new_image_path)
                            except:
                                image = None
                    
                    elif type == 'clothalpha':
                        # Cloth Alpha - load from {id}_Cloth_alpha.png (outfit only)
                        if material.get('outfit'):
                            id = material.get('id')
                            coord = material.get('coord')
                            new_image_path = os.path.join(context.scene.kkbp.import_dir, f'Outfit {coord}', f'{id}_Cloth_alpha.png')
                            try:
                                image = bpy.data.images.load(new_image_path)
                            except:
                                image = None
                    
                    elif type == 'clothalphabot':
                        # Cloth Alpha Bottom - load from {id}_Cloth_alpha_bot.png (outfit only)
                        if material.get('outfit'):
                            id = material.get('id')
                            coord = material.get('coord')
                            new_image_path = os.path.join(context.scene.kkbp.import_dir, f'Outfit {coord}', f'{id}_Cloth_alpha_bot.png')
                            try:
                                image = bpy.data.images.load(new_image_path)
                            except:
                                image = None
                    
                    # Resize texture to match target resolution if needed
                    if (image and 
                        bpy.context.scene.kkbp.atlas_dropdown == 'all_textures' and
                        type in ['normal', 'detail', 'detailnormal', 'alphamask', 'colormask']):
                        if light_node := material.node_tree.nodes.get(get_image_node('light')):
                            if light_node.image:
                                target_resolution = tuple(light_node.image.size[:])
                                image = resize_texture_to_resolution(image, target_resolution)
                    
                    if image:
                        if image.name in ['Template: Placeholder', 'Template: Normal detail placeholder']:
                            image = None
                    if not image:
                        continue
                    else:
                        material.node_tree.nodes['Image Texture'].image = image
                
                #then run the atlas creation
                atlas = get_atlas(scn, self.structure, atlas_size)
                comb_mats = get_comb_mats(scn, atlas, self.mats_uv, type, index)
                c.print_timer(f'save atlas for {object.name} {type}')

            align_uvs(scn, self.structure, atlas.size, size)
            bpy.ops.kkbp.refresh_ob_data()

        return {'FINISHED'}

