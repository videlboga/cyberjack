# KKBP Importer

![image](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/readme.jpg)

This is a plugin pack for exporting Koikatsu cards to Blender.  

The ```KKBP Exporter``` exports the card's textures, mesh and armature from the game. The ```KKBP Importer``` uses that data to setup the character in Blender.  
Imported characters can be used in Blender for animations, renders, etc. They can also be converted to FBX files to use in other programs. 

* **[Download](https://gitgoon.dev/kkbp-dev/KKBP_Importer/releases)**
* **[Alternate download](https://gitgoon.dev/kkbp-dev/KKBP_Importer/archive/refs/heads/development.zip)** (this is a live snapshot of the development version that might not work!) 

## Supported games
|Game|Feature support|
|---|---|
|Koikatsu| Full support|
|Koikatsu Party| Full support|
|Koikatsu Sunshine| Full support|
|Summer Vacation Scramble| Partial support|
|Aicomi| Partial support|

## Features
* Near perfect mesh and texture replication
* All face / tear / cartoon eye expressions available as shape keys
* Can import animations and poses from the game
* Works in EEVEE and Cycles
* Fully featured Rigify armature
* Export the model as .fbx for Unity VRM or Unreal Engine
* Easily edit colors for most materials, just like in the game!
* SFW mode 

## Video walkthrough of the plugins

[(Click for playlist!)  
![ ](https://raw.githubusercontent.com/kkbpwiki/kkbpwiki.github.io/master/assets/images/readmeyt.png)](https://www.youtube.com/watch?v=VqhpOlonCEY&list=PLhiuav2SCuvf8u0UW5NWhGOxqKeAc5lfJ&index=1)

## How to use it

#### Export the card from Koikatsu
<details>
  <summary> click here to show export instructions</summary>

1. Install the dependencies  
    * The easiest way to mod your game and install all dependencies is the **[HF Patch for Koikatsu](https://github.com/ManlyMarco/KK-HF_Patch)** or the **[HF Patch for Koikatsu Sunshine](https://github.com/ManlyMarco/KKS-HF_Patch)**  
    * If you are already using the pre-modded **Better Repack**, you need to do one of the following:  
      * manually install the "Character Maker Poses" zipmod  
          * [Koikatsu link](https://sideload.betterrepack.com/download/KKEC/Sideloader%20Modpack%20-%20Exclusive%20KK/DeathWeasel%20AKA%20Anon11/)  
          * [Koikatsu Sunshine link](https://sideload.betterrepack.com/download/KKEC/Sideloader%20Modpack%20-%20Exclusive%20KKS/DeathWeasel/)  
      * OR, update your mods using the auto-updater in the launcher  
      * OR, install the HF patch over the repack  
    * If your game is already modded, but you don't want to install the HF patch, just install KKAPI, KK Accessory States, KK Pushup, and the poses zipmod linked above

1. Find your Koikatsu install directory and drag the **[KKBP exporter .dll](https://gitgoon.dev/kkbp-dev/KKBP_Exporter/releases)** into the /bepinex/plugins/ folder

1. Start Koikatsu and open the Character Maker
   
1. Enable the KKBP Exporter window.  
![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/export.jpg)

1. Click the "Export Model for KKBP" button at the top of the screen. 
    * This may take a few minutes depending on your computer hardware. 
    * [An explanation of all export options can be found here](https://gitgoon.dev/kkbp-dev/KKBP_Importer/src/branch/master/wiki/readme.md#exporter-panel-settings)   
   
3. A folder in your Koikatsu install directory will popup when the export is finished
</details>

#### Export the card from Summer Vacation Scramble or Aicomi
<details>
  <summary> click here to show export instructions</summary>

1. Install the dependencies  
  The easiest way to mod your game and install all dependencies is the HF Patch
    * [HF Patch for Summer Vacation Scramble](https://github.com/ManlyMarco/SVS-HF_Patch)
    * [HF Patch for Aicomi](https://github.com/ManlyMarco/AC-HF_Patch)

2. Export your SVS or AC model using one of the following plugins by **Sonogami_Rinne**:
    * [SVS_CharacterExporter](https://github.com/Sonogami-Rinne/SVS_CharacterExporter)
    * [ACExporter](https://github.com/Sonogami-Rinne/ACExporter)

3. Import the pmx file to blender using KKBP 9.3.0 or higher. The import instructions are in the next section.
</details>

#### Import the model to Blender
<details>
  <summary> click here to show import instructions</summary>

1. Open Blender 5.2. **Other versions are not guaranteed to work.** [Click here if you are not using Blender 5.2](https://gitgoon.dev/kkbp-dev/KKBP_Importer/src/branch/master/wiki)
   
1. Install **[mmd_tools](https://extensions.blender.org/add-ons/mmd-tools/)** in Blender
   
1. Install **[KKBP Importer](https://gitgoon.dev/kkbp-dev/KKBP_Importer/releases)** in Blender
   
1. After you install both addons, you can click the "Import model" button in the KKBP panel. 
    * [An explanation of all import options can be found here](https://gitgoon.dev/kkbp-dev/KKBP_Importer/src/branch/master/wiki/readme.md#import-panel-options)   
    * ![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/import.jpg)

1. Choose the .pmx file from the export folder 
![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/select_pmx.jpg)

1. The blender console will appear and begin importing the model. This may take a few minutes depending on your computer hardware  
![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/console.jpg)

1. Check there were no errors during import in the scripting tab. A successful import will end in "KKBP import finished in XX minutes"  
![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/error.jpg)

</details>

#### (Optional) Exporting as fbx
<details>
  <summary> click here to show fbx export instructions</summary>

1. If you want to reduce the bone count, or convert the model's armature for VRM / VRChat / Unreal Engine, click the "Prep for target application" button in the KKBP panel.  This will also create an atlas file for your body / hair / clothes and save them to the atlas_files folder in your export folder

1. After you click the button, hide the original collection in the outliner and show the new collection  
![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/show_atlas.jpg)

1. Click the export button in the collection tab to export an fbx file to the atlas_files folder in the export folder  
![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/export_fbx.jpg)
</details>

#### (Optional) Bulk exporting and the Python API
<details>
  <summary> click here to show bulk operation info</summary>

**Bulk exporting**  
The KKBP exporter allows you to bulk export a folder of cards. In the export panel, enable the bulk export option, click the export button and choose the folder you want to bulk export. Only the cards in the folder you select will export. No subfolders will be exported. They will be stored in the /Koikatsu/Export_PMX/ folder. This feature works about 80% of the time. If one of your cards has an issue the bulk export, you can try exporting the card again manually and it should work.  
The KKBP importer also supports bulk importing. In blender, expand the KKBP Extras section of the panel and click the bulk import button. Choose the folder that contains all your bulk exports, so for example the Export_PMX folder. Blender will begin importing each character in the Export_PMX folder and save a .blend file after it's done processing each character.

**Python API**  
You can use Blender's built in bpy library to automatically import a model without manually clicking through the KKBP panel.

````
import bpy
pmx_folder = r'C:\Koikatsu\Export_PMX\20260119173812_SamekoSaba'
bpy.context.scene.kkbp.import_dir = pmx_folder
bpy.ops.kkbp.kkbpimport('EXEC_DEFAULT')
````

You can also automatically set up the import options and export the model as an fbx file; no clicking required! 

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
</details>


## Help

[Check the wiki for FAQ and basic info.](https://gitgoon.dev/kkbp-dev/KKBP_Importer/src/branch/master/wiki/)  
I also setup a [Discord](https://discord.gg/NU53kH8ngw) for general discussion / help  
If you're still having trouble please [create a new issue](https://gitgoon.dev/kkbp-dev/KKBP_Importer/issues)  

## Contributing

Any contributions are welcome! Please check out the links below:
* [The issues page](https://gitgoon.dev/kkbp-dev/KKBP_Importer/issues)
* [Make a pull request](https://gitgoon.dev/kkbp-dev/KKBP_Importer/pulls)
* [Translate the KKBP interface](https://gitgoon.dev/kkbp-dev/KKBP_Importer/src/branch/master/interface)  

## Community Port Guides
* [Kokatsu Port Tools](https://gitgoon.dev/sialim/KKBP_Helper/) - Port KKBP models to GMOD
* [KKBP Rigify Conversion Guide](https://discord.com/channels/1462953864264286377/1537071286457737318) - Convert KKBP's Rigify armatures to Godot (and Unity) compatible rigs

## Similar Projects

* [KKBP Exporter](https://gitgoon.dev/kkbp-dev/KKBP_Exporter) - The exporter plugin for this project
* [SVS CharacterExporter](https://github.com/Sonogami-Rinne/SVS_CharacterExporter) - Character exporter for Summer Vacation Scramble
* [AC Exporter](https://github.com/Sonogami-Rinne/ACExporter) - Character exporter for Aicomi
* [SKLX Studio lite](https://www.patreon.com/posts/153048461) - Export Koikatsu cards to Blender
* [KKPMX](https://github.com/CazzoPMX/KKPMX) - Export Koikatsu cards to MMD
* [Koikatsu Pmx Exporter (Reverse Engineered & updated)](https://github.com/Snittern/KoikatsuPmxExporterReverseEngineered) - The original Koikatsu mesh exporter decompiled and updated
