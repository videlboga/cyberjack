#The init file for the plugin
bl_info = {
    "name" : "KKBP (Koikatsu Blender Porter)",
    "author" : "a blendlet and some blenderchads",
    "location" : "View 3D > Tool Shelf > KKBP",
    "description" : "Imports Koikatsu models into Blender",
    "version": (9, 5, 0),
    "blender" : (5, 2, 0),
    "category" : "3D View",
    "tracker_url" : "https://gitgoon.dev/kkbp-dev/KKBP_Importer",
    "doc_url": "https://gitgoon.dev/kkbp-dev/KKBP_Importer/src/branch/master/wiki",
}
import bpy
from .exporting.material_combiner.extend_types import register_smc_types, unregister_smc_types
from bpy.utils import register_class, unregister_class
from bpy.types import Scene
from bpy.props import PointerProperty

def reg_unreg(register_bool):
    from .preferences import KKBPPreferences
    if register_bool:
        register_class(KKBPPreferences)
    else:
        unregister_class(KKBPPreferences)

    from .importing.importbuttons import kkbp_import
    from .importing.modifymesh import modify_mesh
    from .importing.modifyarmature import modify_armature
    from .importing.modifymaterial import modify_material
    from .importing.postoperations import post_operations

    from .exporting.bakematerials import bake_materials
    from .exporting.exportprep import export_prep
    from .exporting.material_combiner.combiner import Combiner
    from .exporting.material_combiner.combine_list import RefreshObData, CombineSwitch
    from .exporting.material_combiner.extend_types import CombineList
    from .exporting.material_combiner.get_pillow import InstallPIL

    from .extras.createanimationlibrary import anim_asset_lib
    from .extras.linkshapekeys import link_shapekeys
    from .extras.rigifywrapper import rigify_convert
    from .extras.rigifyscripts.rigify_before import rigify_before
    from .extras.rigifyscripts.rigify_after import rigify_after
    from .extras.catsscripts.armature_manual import MergeWeights
    from .extras.importanimation import anim_import, ik_snap
    from .extras.matcombsetup import mat_comb_setup
    from .extras.matcombswitch import mat_comb_switch
    from .extras.linkhair import link_hair
    from .extras.editmaterial import edit_material, cancel_material, reset_material, save_material
    from .extras.bulklaunch import bulk_launch

    from . KKPanel import PlaceholderProperties
    from . KKPanel import (
        IMPORTINGHEADER_PT_panel,
        IMPORTING_PT_panel,
        EXPORTING_PT_panel,
        EXTRAS_PT_panel,
        HAIR_PT_panel,
        EDIT_PT_panel
    )

    classes = (
        bake_materials, 
        export_prep,

        anim_asset_lib,
        link_shapekeys,
        rigify_convert,
        rigify_before,
        rigify_after,
        MergeWeights,
        anim_import,
        ik_snap,
        Combiner,
        RefreshObData,
        CombineSwitch,
        CombineList,
        mat_comb_setup,
        mat_comb_switch,
        InstallPIL,
        link_hair,
        edit_material,
        cancel_material,
        reset_material,
        save_material,
        bulk_launch,

        kkbp_import,
        modify_mesh,
        modify_armature,
        modify_material,
        post_operations,

        PlaceholderProperties, 
        IMPORTINGHEADER_PT_panel,
        IMPORTING_PT_panel,
        EXPORTING_PT_panel,
        EXTRAS_PT_panel,
        HAIR_PT_panel,
        EDIT_PT_panel
        )

    for cls in classes:
        register_class(cls) if register_bool else unregister_class(cls)
    
    if register_bool:
        Scene.kkbp = PointerProperty(type=PlaceholderProperties)
    else:
        del Scene.kkbp

def load_user_defaults():
    panel = bpy.context.scene.kkbp
    default_setting = bpy.context.preferences.addons[__package__].preferences

    panel.shader_dropdown   = default_setting.shader_dropdown
    panel.use_rigify        = default_setting.use_rigify
    panel.sfw_mode          = default_setting.sfw_mode
    panel.fix_seams         = default_setting.fix_seams
    panel.use_outline       = default_setting.use_outline
    panel.separate_clothes  = default_setting.separate_clothes
    panel.prep_dropdown     = default_setting.prep_dropdown
    panel.simp_dropdown     = default_setting.simp_dropdown
    panel.atlas_dropdown    = default_setting.atlas_dropdown

    bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1)                

def register():
    reg_unreg(True)
    register_smc_types()
    
    #load panel defaults after blender has fully loaded
    bpy.app.timers.register(load_user_defaults, first_interval=0.1)

def unregister():
    reg_unreg(False)
    unregister_smc_types()

if __name__ == "__main__":
    register()
