# Importing

This file will describe what operations are performed during import.

### importbuttons.py

This file will run when you click the import button in the panel. First it will run these operations:

* Change the view transform from the default of Agx to Standard
* Get the character name
* Use MMD tools to import the model pmx file, then each outfit's pmx files

Then it will perform additional operations by running these files (in this order):
1. modifymesh.py
1. modifyarmature.py
1. modifymaterial.py
1. postoperations.py

### modifymesh.py

This file does mesh related cleanup, like separating the hair from the clothes and creating shapekeys:

* Renames the UV maps
* There is a tongue controlled by shape keys, and there is a rigged tongue controlled by armature bones. This rigged tongue will be separated into it's own collection and hidden by default. If there is a normal shape key tongue, but no rigged tongue, a rigged tongue will be created automatically.
* If there is hair, it will be separated from the outfit object. If there is more than one outfit, the hair for each outfit will be separated.
* If there are alternate clothing, for example shift or hang state clothing, they will be separated into their own collections. If there's more than one outfit, the alts for each outfit will be separated. This is done using the smr enum index found in the `KK_MaterialDataComplete.json` file found in the same folder as the exported pmx file. This enum is compared to the full list of enums found in the `modifymesh.md` file, and if it's a particular value it'll be identified as an alt. For example, S_CTOP_T_NUGE (index 93), S_TPARTS_00_NUGE (index 112), etc correspond to the shift state for the top clothing so they will be separated as an alt. The enums that are separated by the plugin are: 93, 97, 112, 114, 116, 120, 95, 99, 101, 118, 107, 108, 110. 
* If there's a shadowcast / standard / bonelyfans / o_mask mesh it will be deleted
* If there are hitboxes, they will be separated into their own collection
* The shape keys on the clothes or hair objects are removed. There aren't supposed to be shape keys on either object
* Translates the shape key names into english, then combines them. Each shape key originally comes split into several pieces, but this makes it so you only have to activate one shape key to get the desired expression
* Separates the tears and "gag / cartoon eyes" from the body object and creates shapekeys and drivers to make them work
* Performs a "merge by distance" operation on the body object to prevent seams appearing down the chest and sides of the body

### modifyarmature.py

This file does armature related cleanup, like deleting useless bones and categorizing the remaining bones into bone collections

* Removes all constraints and bone locks created by mmd tools
* Visually scales down the size of all bones
* Rebuilds the bone data for most bones. When the model is exported, all bones are reset to a scale of 1. The model is imported into blender at a scale of 1, then the KK_EditBoneInfo.json is used to re-scale the bones to their proper sizes inside of blender. Once the bones are scaled, they're applied as the default deform using the mysteryem.apply_pose_as_rest_pose_plus script
* Deletes all bones that aren't a parent of the `cf_n_height` bone on the armature. `cf_j_root` and `p_cf_body_bone` are also preserved
* Bends the knee bone slightly forward and the elbow bone slightly backwards to ensure IKs don't bend backwards
* Categorizes each bone into a bone collection. Arm bones get their own collection, face bones get their own collection, etc. There is also an accessory bone collection that holds bones for hair and accessories like handbags, necklaces, tails and other props. 
* Creates an eye controller bone for the Rigify armature 
* Rotates the finger bones to follow the mesh
* Sets up the joint bones. Joint bones are helper bones that move automatically when you move a limb bone. For example, when you move the left arm bone to bend inward towards the chest, the `cf_d_arm01_L` bone will automatically move along with it to smooth out the deform in the elbow. This is achieved using a mix of drivers and bone constraint modifiers. It's setup for the elbows, wrists, hips and knee joints
* Renames some of the main bones to be easier to read. For example "cf_J_hitomi_tx_L" --> "Left Eye"

### modifymaterial.py

This file does material related cleanup, like removing duplicate material slots and loading all the image textures into each material

* Removes any unused material slots
* Removes any duplicated material slots
* Loads all of the png texture files from the Outfit folders and the "pre_light" and "pre_dark" folders into blender. 
* Loads the material templates into blender
* Replaces each material slot with the material template, then loads the images for that material into the template. This is done for every object (hair, body, clothes, alternate clothing, tongue). Special objects like the tears, gag eyes and glasses get their own templates. If the material is supposed to be semitransparent, the blending mode is set to "Blended", else it will look very noisy.
* Creates drivers to make the gag eye shapekeys change which texture is loaded on the material

### postoperations.py

This file does a few optional operations after the model is setup, such as changing the shader type to Cycles, or setting up the Rigify armature.

* (optional) Changes the shader type to Cycles Toon, Cycles Classic, EEVEE MOD, or Principled BSDF if selected in the import panel
* (optional) Sets up the Rigify armature
* (optional) Attempts to delete some NSFW parts of the model
* (optional) Separates each piece of clothing into it's own object
* (optional) Add outlines to the character
* Attempts to set the viewport colors. These are the colors you see in object mode. Doesn't always work and is not accurate most of the time, but at least it's something different from the usual gray.