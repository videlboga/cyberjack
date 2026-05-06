using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using Cyberjack.UI;

namespace Cyberjack.Editor
{
    public class CyberjackRagdollGenerator : EditorWindow
    {
        [System.Serializable]
        public class BoneMapping
        {
            public string uiName;       // Имя, которое видит пользователь (Pelvis, Left Arm, Nipples)
            public string partId;       // ID для UI скрипта
            public Transform bone;      // Трансформ, к которому этот якорь прикрепится
            public bool isPhysical;     // Это капсула с Rigidbody, или просто Sphere-якорь?
            
            // Внутренние данные для авто-расчета
            public HumanBodyBones defaultHumanoidBone;
            public HumanBodyBones defaultEndBone; // Чтобы считать длину
            public Vector3 offsetDirection;
            public float offsetDistanceMultiplier;
        }

        public GameObject targetModel;
        public string subjectId = "S-AV-01";
        
        [SerializeField] public List<BoneMapping> mappings = new List<BoneMapping>();

        private Vector2 scrollPos;
        private SerializedObject so;

        [MenuItem("Cyberjack/Ragdoll Configurator")]
        public static void ShowWindow() { GetWindow<CyberjackRagdollGenerator>("Ragdoll Configurator"); }

        private void OnEnable()
        {
            so = new SerializedObject(this);
            InitializeMappingTemplate();
        }

        private void InitializeMappingTemplate()
        {
            if (mappings.Count > 0) return;

            // --- ФИЗИЧЕСКИЕ КОСТИ (Capsule + Rigidbody + UI Anchor) ---
            AddMap("Pelvis", "belly", true, HumanBodyBones.Hips, HumanBodyBones.Spine);
            AddMap("Middle Spine", "back", true, HumanBodyBones.Spine, HumanBodyBones.Chest);
            AddMap("Chest", "Chest", true, HumanBodyBones.Chest, HumanBodyBones.UpperChest);
            
            AddMap("Left Upper Arm", "arms", true, HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm);
            AddMap("Left Lower Arm", "arms", true, HumanBodyBones.LeftLowerArm, HumanBodyBones.LeftHand);
            AddMap("Right Upper Arm", "arms", true, HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm);
            AddMap("Right Lower Arm", "arms", true, HumanBodyBones.RightLowerArm, HumanBodyBones.RightHand);
            
            AddMap("Left Upper Leg", "legs", true, HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg);
            AddMap("Left Lower Leg", "legs", true, HumanBodyBones.LeftLowerLeg, HumanBodyBones.LeftFoot);
            AddMap("Right Upper Leg", "legs", true, HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg);
            AddMap("Right Lower Leg", "legs", true, HumanBodyBones.RightLowerLeg, HumanBodyBones.RightFoot);

            // --- ДОПОЛНИТЕЛЬНЫЕ ЯКОРЯ (Sphere Trigger + UI Anchor) ---
            AddMap("Head Base", "head", false, HumanBodyBones.Head, HumanBodyBones.LastBone, Vector3.up, 0.1f);
            AddMap("Face", "face", false, HumanBodyBones.Head, HumanBodyBones.LastBone, Vector3.forward, 0.12f);
            AddMap("Lips", "Lips", false, HumanBodyBones.Head, HumanBodyBones.LastBone, new Vector3(0, -0.4f, 1f), 0.15f);
            
            AddMap("Mind State", "mind_state", false, HumanBodyBones.Head, HumanBodyBones.LastBone, Vector3.up, 0.3f);
            AddMap("Systemic", "systemic", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(1f, 1f, 0f), 0.6f);
            AddMap("Posture", "posture", false, HumanBodyBones.Spine, HumanBodyBones.LastBone, Vector3.back, 0.25f);
            AddMap("Neck", "neck", false, HumanBodyBones.Neck, HumanBodyBones.Head);
            
            AddMap("Left Shoulder", "shoulders", false, HumanBodyBones.LeftShoulder, HumanBodyBones.LeftUpperArm);
            AddMap("Right Shoulder", "shoulders", false, HumanBodyBones.RightShoulder, HumanBodyBones.RightUpperArm);
            
            AddMap("Left Hand", "hands", false, HumanBodyBones.LeftHand, HumanBodyBones.LeftMiddleDistal);
            AddMap("Right Hand", "hands", false, HumanBodyBones.RightHand, HumanBodyBones.RightMiddleDistal);
            AddMap("Left Foot", "feet", false, HumanBodyBones.LeftFoot, HumanBodyBones.LeftToes);
            AddMap("Right Foot", "feet", false, HumanBodyBones.RightFoot, HumanBodyBones.RightToes);

            // Анатомия
            AddMap("Left Nipple", "nipples", false, HumanBodyBones.UpperChest, HumanBodyBones.LastBone, new Vector3(-0.35f, 0.1f, 1f), 0.13f);
            AddMap("Right Nipple", "nipples", false, HumanBodyBones.UpperChest, HumanBodyBones.LastBone, new Vector3(0.35f, 0.1f, 1f), 0.13f);

            AddMap("Left Inner Thigh", "inner_thighs", false, HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg, Vector3.right, 0.15f);
            AddMap("Right Inner Thigh", "inner_thighs", false, HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg, Vector3.left, 0.15f);

            AddMap("Left Buttock", "buttocks", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(-0.3f, -0.3f, -1f), 0.15f);
            AddMap("Right Buttock", "buttocks", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(0.3f, -0.3f, -1f), 0.15f);
            
            AddMap("Anus", "anus", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(0f, -0.5f, -0.6f), 0.1f);
            AddMap("Groin", "groin", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(0f, -0.5f, 0.8f), 0.1f);
            AddMap("Penis", "penis", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(0f, -0.6f, 0.9f), 0.15f);
            AddMap("Testicles", "testicles", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(0f, -0.8f, 0.6f), 0.1f);
            AddMap("Prostate", "prostate", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(0f, -0.2f, 0f), 0.05f);
            AddMap("Vulva", "vulva", false, HumanBodyBones.Hips, HumanBodyBones.LastBone, new Vector3(0f, -0.6f, 0.5f), 0.1f);
        }

        private void AddMap(string label, string pId, bool isPhys, HumanBodyBones start, HumanBodyBones end, Vector3 dir = default, float dist = 0f)
        {
            mappings.Add(new BoneMapping {
                uiName = label, partId = pId, isPhysical = isPhys,
                defaultHumanoidBone = start, defaultEndBone = end,
                offsetDirection = dir, offsetDistanceMultiplier = dist
            });
        }

        private void OnGUI()
        {
            if (so == null) {
                so = new SerializedObject(this);
                if (mappings.Count == 0) InitializeMappingTemplate();
            }
            so.Update();

            GUILayout.Label("Cyberjack Ragdoll Builder", EditorStyles.boldLabel);
            EditorGUILayout.Space();

            EditorGUI.BeginChangeCheck();
            targetModel = (GameObject)EditorGUILayout.ObjectField("Target Model", targetModel, typeof(GameObject), true);
            if (EditorGUI.EndChangeCheck() && targetModel != null)
            {
                AutoFillTransforms();
            }

            subjectId = EditorGUILayout.TextField("Subject ID", subjectId);

            EditorGUILayout.Space();
            if (GUILayout.Button("Create", GUILayout.Height(30)))
            {
                Generate();
            }

            EditorGUILayout.Space();
            scrollPos = EditorGUILayout.BeginScrollView(scrollPos);

            SerializedProperty mapProp = so.FindProperty("mappings");
            for (int i = 0; i < mapProp.arraySize; i++)
            {
                SerializedProperty elem = mapProp.GetArrayElementAtIndex(i);
                
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField(elem.FindPropertyRelative("uiName").stringValue, GUILayout.Width(150));
                EditorGUILayout.PropertyField(elem.FindPropertyRelative("bone"), GUIContent.none);
                EditorGUILayout.EndHorizontal();
            }

            EditorGUILayout.EndScrollView();
            so.ApplyModifiedProperties();
        }

        private void AutoFillTransforms()
        {
            Animator anim = targetModel.GetComponent<Animator>();
            if (anim == null || !anim.isHuman)
            {
                Debug.LogWarning("Cyberjack: Selected Target Model is not a Humanoid! Please assign bones manually.");
                return;
            }

            Undo.RecordObject(this, "Auto-fill Ragdoll Bones");

            foreach (var map in mappings)
            {
                if (map.defaultHumanoidBone != HumanBodyBones.LastBone)
                {
                    Transform foundBone = anim.GetBoneTransform(map.defaultHumanoidBone);
                    
                    // Smart-fallback для Таза (Pelvis) 
                    // Если Humanoid вернул Root/Hips, но внутри есть реальная кость pelvis — берем её.
                    if (map.uiName == "Pelvis" && foundBone != null)
                    {
                        Transform realPelvis = FindChildByNameContains(foundBone, "pelvis");
                        if (realPelvis != null) foundBone = realPelvis;
                    }

                    // Smart-fallback для Груди (если нужна специфичная грудная кость, а не нижний Spine)
                    if (map.uiName == "Chest" && foundBone != null)
                    {
                        Transform realChest = FindChildByNameContains(foundBone, "chest");
                        if (realChest != null) foundBone = realChest;
                    }

                    map.bone = foundBone;
                }
            }
            
            EditorUtility.SetDirty(this);
        }

        private Transform FindChildByNameContains(Transform parent, string keyword)
        {
            keyword = keyword.ToLower();
            foreach (Transform child in parent.GetComponentsInChildren<Transform>())
            {
                if (child.name.ToLower().Contains(keyword))
                    return child;
            }
            return null;
        }

        private void Generate()
        {
            if (targetModel == null) { Debug.LogError("Assign Target Model!"); return; }
            Undo.RegisterFullObjectHierarchyUndo(targetModel, "Generate Cyberjack Ragdoll Context");

            // Needed for measuring
            Animator anim = targetModel.GetComponent<Animator>();

            foreach (var map in mappings)
            {
                if (map.bone == null) continue;

                if (map.isPhysical)
                {
                    GeneratePhysicalProxy(map, anim);
                }
                else
                {
                    GenerateTriggerAnchor(map, anim);
                }
            }

            Debug.Log("Cyberjack: Ragdoll and UI Anchors successfully generated.");
        }

        private void GeneratePhysicalProxy(BoneMapping map, Animator anim)
        {
            Transform endT = (anim != null && map.defaultEndBone != HumanBodyBones.LastBone) ? anim.GetBoneTransform(map.defaultEndBone) : null;
            if (endT == null && map.bone.childCount > 0) endT = map.bone.GetChild(0);

            string objName = "Collider_Proxy_" + map.bone.name;
            Transform p = map.bone.Find(objName);
            if (p == null) { p = new GameObject(objName).transform; p.SetParent(map.bone); }
            
            p.gameObject.layer = 3; // Interactable Layer
            p.localPosition = Vector3.zero;

            if (endT != null) {
                p.rotation = Quaternion.LookRotation((endT.position - map.bone.position).normalized);
                p.Rotate(90, 0, 0);
            } else {
                p.localRotation = Quaternion.identity;
            }

            p.localScale = Vector3.one;
            float worldDist = (endT != null) ? Vector3.Distance(map.bone.position, endT.position) : 0.2f;
            float s = (map.bone.lossyScale.x + map.bone.lossyScale.y + map.bone.lossyScale.z) / 3f;

            CapsuleCollider col = p.gameObject.GetComponent<CapsuleCollider>();
            if (col == null) col = p.gameObject.AddComponent<CapsuleCollider>();
            col.direction = 1;
            col.height = worldDist / s;
            col.radius = (worldDist * 0.25f) / s;
            col.center = new Vector3(0, (worldDist * 0.5f) / s, 0);

            Rigidbody rb = p.gameObject.GetComponent<Rigidbody>(); if (rb == null) rb = p.gameObject.AddComponent<Rigidbody>(); rb.isKinematic = true; rb.useGravity = false;

            BodyPartUIAnchor ui = p.gameObject.GetComponent<BodyPartUIAnchor>();
            if (ui == null) ui = p.gameObject.AddComponent<BodyPartUIAnchor>();
            ui.subjectId = subjectId;
            ui.partId = map.partId;
        }

        private void GenerateTriggerAnchor(BoneMapping map, Animator anim)
        {
            Transform endT = (anim != null && map.defaultEndBone != HumanBodyBones.LastBone) ? anim.GetBoneTransform(map.defaultEndBone) : null;

            string objName = "Anchor_" + map.partId + "_" + map.bone.name;
            Transform a = map.bone.Find(objName);
            if (a == null) { a = new GameObject(objName).transform; a.SetParent(map.bone); }
            
            a.gameObject.layer = 3; // Interactable Layer
            a.localScale = Vector3.one;

            float dist = (endT != null) ? Vector3.Distance(map.bone.position, endT.position) : 0.2f;
            float s = (map.bone.lossyScale.x + map.bone.lossyScale.y + map.bone.lossyScale.z) / 3f;

            if (map.offsetDistanceMultiplier == 0f && endT != null) {
                a.position = Vector3.Lerp(map.bone.position, endT.position, 0.5f);
            } else {
                Vector3 worldOffset = map.bone.TransformDirection(map.offsetDirection) * map.offsetDistanceMultiplier;
                a.position = map.bone.position + worldOffset;
            }

            SphereCollider sc = a.gameObject.GetComponent<SphereCollider>();
            if (sc == null) sc = a.gameObject.AddComponent<SphereCollider>();
            sc.isTrigger = true;
            // Делаем триггер пропорциональным размеру измеряемого участка, но не гигантским.
            sc.radius = (dist * 0.40f) / s;

            BodyPartUIAnchor ui = a.gameObject.GetComponent<BodyPartUIAnchor>();
            if (ui == null) ui = a.gameObject.AddComponent<BodyPartUIAnchor>();
            ui.subjectId = subjectId;
            ui.partId = map.partId;
        }
    }
}
