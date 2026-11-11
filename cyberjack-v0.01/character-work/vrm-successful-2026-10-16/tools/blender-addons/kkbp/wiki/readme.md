## Frequently asked questions

## Which version of KKBP should I use?
It depends on which Blender version you're using. Check the table below. 

You don't necessarily need to use the specific mmd_tools or HF Patch version listed, it's just the last version that the plugin was tested on. Also note that minor versions are usually incompatible with each other. For example, KKBP 8.0.0 is likely not compatible with 8.1.0, so you'll have to re-import the character on a new minor version. Patch versions like 8.0.0 vs 8.0.1 are always compatible with each other.

|Blender version|Last working KKBP version|PMX Importer dependency version|Koikatsu HF Patch version|Koikatsu Sunshine HF Patch version|Video guide link|
|---|---|---|---|---|---|
5.2 LTS|9.4.0|mmd_tools 4.5.12|HF Patch 4.0|HF Patch for KKS 2.0|[Here](https://www.youtube.com/watch?v=VqhpOlonCEY&list=PLhiuav2SCuvf8u0UW5NWhGOxqKeAc5lfJ)|
5.1**|9.4.0|mmd_tools 4.5.12|HF Patch 4.0|HF Patch for KKS 2.0|[Here](https://www.youtube.com/watch?v=VqhpOlonCEY&list=PLhiuav2SCuvf8u0UW5NWhGOxqKeAc5lfJ)|
5.0|9.4.0|mmd_tools 4.5.12|HF Patch 4.0|HF Patch for KKS 2.0|[Here](https://www.youtube.com/watch?v=VqhpOlonCEY&list=PLhiuav2SCuvf8u0UW5NWhGOxqKeAc5lfJ)|
4.5 LTS|9.4.0|mmd_tools 4.5.12|HF Patch 4.0|HF Patch for KKS 2.0|[Here](https://www.youtube.com/watch?v=VqhpOlonCEY&list=PLhiuav2SCuvf8u0UW5NWhGOxqKeAc5lfJ)|
4.4|8.1.0|mmd_tools 4.3.10|HF Patch 3.32|HF Patch for KKS 1.22|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuveMgQUA2YqqbSE7BtOrkZ-Q)|
4.3|8.1.0|mmd_tools 4.3.10|HF Patch 3.32|HF Patch for KKS 1.22|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuveMgQUA2YqqbSE7BtOrkZ-Q)|
4.2 LTS|8.1.0|mmd_tools 4.3.10|HF Patch 3.32|HF Patch for KKS 1.22|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuveMgQUA2YqqbSE7BtOrkZ-Q)|
|3.6 LTS|6.6.3|mmd_tools 2.9.2|HF Patch 3.22|HF Patch for KKS 1.7|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvc-wbexi2vwSnVHnZFwkYNP)|
|3.5|6.5.0|mmd_tools 2.9.2|HF Patch 3.22|HF Patch for KKS 1.7|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvc-wbexi2vwSnVHnZFwkYNP)|
|3.4|6.4.2|mmd_tools 2.9.2|HF Patch 3.22|HF Patch for KKS 1.7|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvc-wbexi2vwSnVHnZFwkYNP)|
|3.3|6.2.1|mmd_tools 2.9.2|HF Patch 3.17|HF Patch for KKS 1.7|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvc-wbexi2vwSnVHnZFwkYNP)|
|3.2|5.1.1|CATS Blender Plugin 0.19|HF Patch 3.13|--|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvdEAbUzJxSqp61fNiPTFfwb)|
|2.93|4.3.0|CATS Blender Plugin 0.18|HF Patch 3.7|--|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvd5eAOb3Ct1eovFAlgv-iwe)|
|2.91.2|4.2.1|CATS Blender Plugin 0.18|HF Patch 3.7|--|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvd5eAOb3Ct1eovFAlgv-iwe)|
|2.83.4|3.06|CATS Blender Plugin 0.17|HF Patch 3.0|--|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvfIJ20QrEzkoFl__F9VaRk2)|
|2.82.7|V2|[This outdated mmd_tools version](https://github.com/powroupi/blender_mmd_tools?tab=readme-ov-file)|--|--|[Here](https://www.youtube.com/playlist?list=PLhiuav2SCuvfx_IJw2TnYmPdWYwIzo7SO)|

** KKBP does not completely work on Blender 5.1 due to an unresolved issue with the Shader to RGB node 

## I'm using the right versions but it's still not working
**Some heavily modded characters will not import correctly.** Custom head mods, body mods and other mods that change body material names or shapekey names from the default have a lower chance of working. Try exporting the default character that you get when you startup the character creator, and double check the table for choosing the right version at the top of the page. If that works, slowly try adding back each piece of clothing / hair / headmod until the item that causes the issue is found. If that didn't work and you are having issues with the default character, triple check you installed everything in the version table at the top of the page.

## My top is missing
KKBP applies an "alphamask" to the body by default. If your character is supposed to be a shirtless guy, you can find the body material...

![image](https://raw.githubusercontent.com/kkbpwiki/kkbpwiki.github.io/master/assets/images/faq1.png)

and enable the "Force visibility" slider to show the top of the body

![image](https://raw.githubusercontent.com/kkbpwiki/kkbpwiki.github.io/master/assets/images/faq2.png)

If you're using multiple outfits, the alphamask image may change based on the outfit. If you need to change the alphamask you can open up the Body material in the shader editor, and change the alphamask there. Alphamasks for different outfits can be found in your .pmx export folder as cf_m_body_AM_##.png, where ## corresponds with the outfit number.

![image](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/alpha_mask.jpg)

## Some clothes are missing
Make sure the clothing you're looking for isn't hidden in the outliner. In certain situations, KKBP will automatically hide some clothing objects from view. In rare cases, the outfit will just not export. Check the "Outfit 00" folder in your export folder for a .pmx file. If there's no .pmx file, then the kkbp exporter failed to get the clothing.  Please submit a new issue on the gitgoon if you find a card that does this.

## I'm getting fully white textures after importing my character
The import script failed somewhere. In Blender, click the Scripting tab on the top of the window. Any errors will appear at the bottom of the log. A successful import log will end in "KKBP import finished"

## I don't have an error and my clothing or hair doesn't look correct
KKBP should load in a majority of clothing and hair correctly. Please submit a new issue on the gitgoon if you find a card that does this.

## Blender crashed during import
Try importing again. The import process can take around 1GB of RAM and 2GB of VRAM (or around 4.5GB of RAM and 3GB of VRAM on complex cards with many accessories), so if you're low on either of those it may crash because of that too.

# Exporter Panel settings
Each setting in the exporter panel will be briefly detailed on this page.  

![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/export_close.jpg)

### Freeze current pose

The pose is usually reset to a T pose during export. Enable this option to not reset to a T pose, and to keep the pose you have selected in the character maker. Because a pose is pre-applied to the armature, the armature will not work correctly in blender. This setting may be useful for 3D prints of koikatsu models or for stills. This exporter setting will force the FK armature in blender. See the picture below for an example of a pose being applied to the model. 

![ ](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/freeze_pose.jpg)

### Export without physics

Some outfits rely on in-game physics to look correct. Enable this option to disable the in-game physics during export. This may make certain outfits look weird because of the lack of physics, but it is useful if you want to apply your own physics to the model in blender.

![ ](https://raw.githubusercontent.com/kkbpwiki/kkbpwiki.github.io/master/assets/images/exporter2.1.png)

### Freeze shapekeys

Shapekeys are reverted to their default values during export. Enable this option to freeze any shapekeys you have enabled in the character maker to the base mesh. Because the mesh is pre-deformed, other shapekeys will not work correctly in blender. Tear and gag eye shapekeys will also not work in blender. See the picture below for an example of some shapekeys being pre-applied to the base mesh. 

![ ](https://raw.githubusercontent.com/kkbpwiki/kkbpwiki.github.io/master/assets/images/exporter3.png)

### Export variations

This will export any available clothing variations. Not all clothes have variations.  
When imported, the variations will be hidden in the outliner by default.

![ ](https://raw.githubusercontent.com/kkbpwiki/kkbpwiki.github.io/master/assets/images/exporter1.png)

### Export all outfits

This will make the exporter export all of the card's outfits instead of just the currently selected one. This will dramatically increase koikatsu export times and blender import times.

### Export hit meshes

This will export the hit mesh. An example of the hit mesh is shown below.

![ ](https://raw.githubusercontent.com/kkbpwiki/kkbpwiki.github.io/master/assets/images/exporter2.png)


### Bulk exporter

This vibe-coded feature allows you to bulk export a folder of cards. Enable the bulk export option and click the Export button to open the bulk exporter window. The default folder will be the /Koikatsu/UserData/chara/ folder. You can select which folder you want to export using the window. Only the cards in the folder you select will be exported, no subfolders will be exported. The cards will be exported to the normal Export_PMX folder that all other exports are stored in. This feature works about 80% of the time. The other 20% of the time, the card will export but not import. If you encounter one of these errors for a specific card, you can try exporting the card again manually and it should work.

# Import panel options

**You can hold your mouse over each option in the KKBP panel to get an explanation on what it does!**  

This page will only cover things that are not immediately obvious from the explanations built into the panel.

## Default panel settings
If you expand KKBP in Blender's addon menu, you can set default settings for the panel (so you don't have to set them each time you restart Blender).  
![image](https://raw.githubusercontent.com/kkbpwiki/kkbpwiki.github.io/master/assets/images/panel1.png)

## Extras panel

![image](https://gitgoon.dev/kkbp-dev/KKBP_Importer/raw/branch/master/wiki/extras.jpg)

* You can bulk import a folder of exported models using the bulk import feature. Click the button in the extras panel and a folder picker window will appear. Choose the folder that contains the exported models. For example, the Export_PMX folder. All models in the folder will be imported into blender, then saved as a .blend file in the same folder. If an error is encountered during import, the model will be saved as "Error - CharacterName.blend" so you can easily check which ones the addon couldn't import. Since the bulk exporter is vibe-coded, it only works about 80% of the time. Try manually exporting the models that didn't work and import again and there's a higher likelihood of it working.
* Instructions for exporting animations from the game and applying them using the button in the panel can be found [here if you prefer text](https://github.com/FlailingFog/KK-Blender-Porter-Pack/blob/master/extras/animationlibrary/createanimationlibrary.py) or [here if you prefer video](https://www.youtube.com/watch?v=Ezsy6kwgBE0)
* If the "FK Armature" option was selected during import but you now want to swap to a Rigify armature, you can click the "Convert for Rigify" button to permanentally convert the FK one to a Rigify one.
* The "Separate Eyes and Eyebrows" button will separate the eyes and eyebrows into separate objects, then link their shapekeys to the Body object's shapekeys. This can be combined with the Cryptomatte compositor features to make the Eyes and Eyebrows show through the hair. See [this video for an example of selecting objects with Cryptomatte](https://www.youtube.com/watch?v=3UR4eXxMlsU).
* The "Setup Materials for Material Combiner" button will set up your materials for [Shotariya's Material Combiner addon](https://github.com/Grim-es/material-combiner-addon). You must Finalize your materials before you can do this.

## Editing materials

You can edit a material by selecting the material in the material list and clicking "Edit". There's a very in-depth breakdown of what every single option does at this github pages site: https://kkbpwiki.github.io/material_breakdown