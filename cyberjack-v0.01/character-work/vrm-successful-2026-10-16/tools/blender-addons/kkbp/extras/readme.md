# Extras

There's a lot of extra features in this addon

### bulklaunch.py and auto_import.py

These allow you to bulk import multiple models one after another. Click the button in the panel and choose the folder that has all of your exported models, for example the C:/Koikatsu/Export_PMX/ folder. Each model in that folder will be imported using the auto_import.py script, then saved as separate .blend files to the same folder you selected. If an error is encountered during import, the file will be saved as "Error - CharacterName.blend" so you can easily check which ones the addon couldn't import. This feature works about 80% of the time. 20% of the time it fails to work because the bulk export failed. You can try exporting the card again manually and it'll work.

These files also serve as an example of how the kkbp plugin can be used in other python scripts. The two key lines are  

````
bpy.context.scene.kkbp.import_dir = pmx_folder
bpy.ops.kkbp.kkbpimport('EXEC_DEFAULT')
````
Which sets the folder of the .pmx model then imports it

Setting up the KKBP panel import preferences and exporting the model as an fbx without interacting with the KKBP panel is also easy. 

````
import bpy, os

#Set panel preferences
panel = bpy.context.scene.kkbp
panel.shader_dropdown   = 'A' #A: Eevee, B:Cycles Toon, D: Cycles Classic, C: Eevee Mod, E: Principled
panel.use_rigify        = False #Must be false if you are using the export features
panel.sfw_mode          = False
panel.fix_seams         = True
panel.use_outline       = True
panel.separate_clothes  = False

#import the model
pmx_folder = r'C:\Koikatsu\Export_PMX\1234567890_MyCard'
bpy.context.scene.kkbp.import_dir = pmx_folder
bpy.ops.kkbp.kkbpimport('EXEC_DEFAULT')

#Run export prep on the model
panel.prep_dropdown     = 'VRM' #'VRM', 'VRC', 'Unreal', 'Koikatsu', 'no_change'
panel.simp_dropdown     = 'A' #A: Very Simple, B: Simple, C: No changes
panel.atlas_dropdown    = 'Atlas' #'Atlas', 'skip_eyes', 'None'
bpy.ops.kkbp.exportprep('EXEC_DEFAULT')

def get_layer_collection_from_name(base_collection: bpy.types.LayerCollection,
                                   search_term: str) -> bpy.types.LayerCollection:
    '''Returns the view layer collection object by name'''
    # check if this is it
    if (base_collection.name == search_term):
        return base_collection
    # If not, recursively go through the collection's children for the search term
    for child in base_collection.children:
        if child.name == search_term:
            return child
        else:
            recursive_result = get_layer_collection_from_name(child, search_term)
            if recursive_result:
                return recursive_result
def show_layer_collection(collection_name: str, state: bool):
    '''Sets the exclude state of a view layer collection'''
    base_collection = bpy.context.view_layer.layer_collection
    collection = get_layer_collection_from_name(base_collection, collection_name)
    collection.exclude = state
def get_name():
    return bpy.context.scene.kkbp.character_name

#hide the original collection
show_layer_collection('Rigged tongue ' + get_name(), True)
show_layer_collection(get_name(), True)

#show the new collection
show_layer_collection('Rigged tongue ' + get_name() + '.001', False)
show_layer_collection(get_name() + ' atlas', False)

#make the new collection active
layer_collection = bpy.context.view_layer.layer_collection.children[get_name() + ' atlas']
bpy.context.view_layer.active_layer_collection = layer_collection

#Click the export collection button
bpy.ops.collection.export_all()

#Save the blend file to the pmx folder
save_path = os.path.join(pmx_folder, 'imported_to_blender.blend')
bpy.ops.wm.save_as_mainfile(filepath=save_path)

#quit blender
bpy.ops.wm.quit_blender()

````

### importanimation.py and createanimationlibrary.py

These allow you to import animations from the game, and apply them to your character using the Rokoko Studio Live retargeter. You can also import Mixamo animations by using the toggle. You only need to install the Rokoko plugin, you do not need to create a Rokoko account or login to use this feature. The rokoko plugin will use the retargeting list `.json` files to link the bone names in the animation file to your character's rigify armature. `importanimation.py` will import a single animation and apply it to your character's rigify armature as a new action. Since these animations are stored as actions, you can import more than one animation and switch between them using the action editor, or string them together using the NLA editor. `createanimationlibrary.py` will import multiple animations, then create a pose asset library with preview images and tags so you can use those poses in any file. When creating a pose library, the animation files need to be in a specific folder structure. Check the comments at the top of `createanimationlibrary.py` for more information. 

### editmaterial.py

This file is run when you select a material in the material list, then click the "Edit" button. It allows you to edit the colors on the material in a similar way to the in-game editor. This works on most body, hair and clothes materials. There are some materials or headmods that won't work as expected and will likely throw an error when you click the button. It performs the following operations to the material:

* Loads the images needed for this material into blender. If any of these files are a "_MT.png" or "_MT_CT.png" type file, they're loaded and then their pixel colors are saturated in chunks using a process nearly identical to the in-game one. 
* The material is replaced with a complex material template that supports more textures and supports changing the colors on the material, locations of overlay textures, etc.
* The light textures (aka saturated MT files) are loaded into the complex material template
* The dark textures are generated using a process nearly identical to the in-game one, then loaded into the material template

At that point, you can freely edit the complex material using the color options in the material tab, or edit them in blender's shading tab. You can save or revert the changes. If you revert the changes it'll simply throw away your changes and revert to the original material. If you save the changes, the bakematerials.py script is run, which does the following:

* Creates a flat plane and an orthographic camera
* Assigns the complex material to the flat plane
* Points the camera at the flat plane and takes a picture of the plane. This is repeated for both light and dark textures 
* The flat plane and camera are deleted
* The complex material is replaced with the simple one (this is the one you originally get when you initially load the model into blender)
* The new light and dark textures from the complex material are loaded into the simple material

### linkhair.py

This file is run when you are currently editing a hair material, have it selected in the material list, and click the "update hair" button. If you're editing multiple hair materials at the same time, it will take the settings for the current hair material and applies those settings to any other pieces of hair that are also currently being edited

### linkshapekeys.py

This file is run when you click the "Separate eyes and eyebrows" button in the panel. It will separate the pupils, eyelashes, eyewhites and eyebrows into their own object and add drivers to the shape keys so they're linked to the body object's shape keys. It will also disable the outlines on the new eye object. This is useful if you want to make the eyes and eyebrows appear over the hair using the cryptomatte features in the compositing tab.

### matcombsetup.py and matcombswitch.py

The `matcombsetup.py` file is run when you click the "Setup materials for material combiner" button in the panel. It will add an image node and an emission node, then incorrectly label the emission node as "Principled BSDF" to make every material compatible with Shotariya's Material Combiner addon. KKBP already uses the Material Combiner addon to create an atlas automatically, but if you want to manually create your atlas this button will let you do that. This will initially load the light textures into the image node so when you manually create the atlas you'll only get the light version. The `matcombswitch.py` file will switch the light textures with the dark textures so you can create the dark version of the atlas. So the process for manually creating the atlases would be...

* click the "Setup materials for material combiner" button
* the light textures are loaded on your model
* create your light atlas using the material combiner addon
* hit Undo / ctrl + Z
* click the "Toggle light / dark for Material Combiner" button
* the dark textures are now loaded on your model
* create your dark atlas using the material combiner addon again
  * don't change any settings or it may create an atlas with a different layout!

### rigifywrapper.py

If you imported with the FK armature and want to upgrade to the Rigify armature, this file will run the specific function in postoperations.py that does this exact thing.
