# Exporting

This file will describe what operations are performed during export / the prep button.

### exportprep.py

This file will run when you click the Prep for Target Application button in the panel. It runs these operations:

* (optional) Converts the armature to be Unity or Unreal compatible. If Generic FBX is selected, no changes will be made to the armature.
* The alpha mask is applied to each light and dark texture. Usually these files are separate so you can disable the alpha mask at any time, but it causes issues with the atlas so the alpha mask is permanentally applied when creating an atlased model.
* Uses shotariya's material combiner to automatically convert the multiple materials into a single atlas file that you can easily load into other programs.
* Removes the outlines because they're not carried into the fbx format

### bakematerials.py

Described in the editmaterial.py section of the readme in the extras folder