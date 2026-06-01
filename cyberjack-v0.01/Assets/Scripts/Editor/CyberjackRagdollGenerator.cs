using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using Cyberjack.UI;

namespace Cyberjack.Editor
{
    public class CyberjackRagdollGenerator : EditorWindow
    {
        [Header("Settings")]
        public GameObject targetModel;
        public string subjectId = "S-AV-01";
        
        private string[] bodyParts = new string[] {
            "head", "face", "lips", "neck", "chest", "nipples", 
            "belly", "arms", "hands", "back", "legs", "feet", "systemic"
        };

        [MenuItem("Cyberjack/Ragdoll Generator")]
        public static void ShowWindow()
        {
            GetWindow<CyberjackRagdollGenerator>("Ragdoll Gen");
        }

        private void OnGUI()
        {
            GUILayout.Label("Cyberjack Ragdoll & Anchor Generator", EditorStyles.boldLabel);
            targetModel = (GameObject)EditorGUILayout.ObjectField("Target Model", targetModel, typeof(GameObject), true);
            subjectId = EditorGUILayout.TextField("Subject ID", subjectId);

            if (GUILayout.Button("Generate Ragdoll & Anchors"))
            {
                if (targetModel == null)
                {
                    EditorUtility.DisplayDialog("Error", "Please select a target model!", "OK");
                    return;
                }
                Generate();
            }
        }

        private void Generate()
        {
            Animator animator = targetModel.GetComponent<Animator>();
            if (animator == null || animator.avatar == null || !animator.isHuman)
            {
                EditorUtility.DisplayDialog("Error", "Model must have a Humanoid Animator!", "OK");
                return;
            }

            Undo.RegisterFullObjectHierarchyUndo(targetModel, "Generate Cyberjack Ragdoll");

            // 1. Create Ragdoll Proxies (Physics)
            SetupPhysicsProxies(animator);

            // 2. Create Interaction Anchors (UI & Logic)
            SetupInteractionAnchors(animator);

            Debug.Log($"[Cyberjack] Ragdoll and Anchors generated for {targetModel.name} (Subject: {subjectId})");
        }

        private void SetupPhysicsProxies(Animator animator)
        {
            // Mapping Humanoid bones to approximate physics proxy setups
            var boneMap = new Dictionary<HumanBodyBones, string>
            {
                { HumanBodyBones.Hips, "Pelvis" },
                { HumanBodyBones.Spine, "Spine" },
                { HumanBodyBones.Chest, "Chest" },
                { HumanBodyBones.Head, "Head" },
                { HumanBodyBones.LeftUpperArm, "Arm_L" },
                { HumanBodyBones.LeftLowerArm, "Forearm_L" },
                { HumanBodyBones.RightUpperArm, "Arm_R" },
                { HumanBodyBones.RightLowerArm, "Forearm_R" },
                { HumanBodyBones.LeftUpperLeg, "Thigh_L" },
                { HumanBodyBones.LeftLowerLeg, "Calf_L" },
                { HumanBodyBones.RightUpperLeg, "Thigh_R" },
                { HumanBodyBones.RightLowerLeg, "Calf_R" }
            };

            foreach (var mapping in boneMap)
            {
                Transform bone = animator.GetBoneTransform(mapping.Key);
                if (bone == null) continue;

                string proxyName = "Collider_Proxy_" + mapping.Value;
                Transform proxy = bone.Find(proxyName);
                if (proxy == null)
                {
                    proxy = new GameObject(proxyName).transform;
                    proxy.SetParent(bone);
                    proxy.localPosition = Vector3.zero;
                    proxy.localRotation = Quaternion.identity;
                    
                    // Add basic physics components to proxy
                    Rigidbody rb = proxy.gameObject.AddComponent<Rigidbody>();
                    rb.mass = 1.0f; // Default mass

                    // Setup Joint (connecting to parent's proxy or bone)
                    if (mapping.Key != HumanBodyBones.Hips)
                    {
                        CharacterJoint joint = proxy.gameObject.AddComponent<CharacterJoint>();
                        // Logic to find connected body would go here
                    }

                    // Add collider to proxy
                    CapsuleCollider col = proxy.gameObject.AddComponent<CapsuleCollider>();
                    col.radius = 0.05f;
                    col.height = 0.2f;
                    col.direction = 1; // Y Axis
                }
            }
        }

        private void SetupInteractionAnchors(Animator animator)
        {
            var anchorMap = new Dictionary<string, HumanBodyBones> {
                { "head", HumanBodyBones.Head },
                { "face", HumanBodyBones.Head },
                { "lips", HumanBodyBones.Head },
                { "neck", HumanBodyBones.Neck },
                { "chest", HumanBodyBones.Chest },
                { "nipples", HumanBodyBones.Chest },
                { "belly", HumanBodyBones.Spine },
                { "back", HumanBodyBones.Spine },
                { "arms", HumanBodyBones.LeftUpperArm }, // Simplified
                { "hands", HumanBodyBones.LeftHand },
                { "legs", HumanBodyBones.LeftUpperLeg },
                { "feet", HumanBodyBones.LeftFoot },
                { "systemic", HumanBodyBones.Hips }
            };

            foreach (var part in anchorMap)
            {
                Transform parentBone = animator.GetBoneTransform(part.Value);
                if (parentBone == null) continue;

                string anchorName = "Anchor_" + part.Key;
                Transform anchor = parentBone.Find(anchorName);
                if (anchor == null)
                {
                    anchor = new GameObject(anchorName).transform;
                    anchor.SetParent(parentBone);
                    anchor.localPosition = Vector3.zero;
                    anchor.localRotation = Quaternion.identity;

                    var uiAnchor = anchor.gameObject.AddComponent<BodyPartUIAnchor>();
                    uiAnchor.subjectId = subjectId;
                    uiAnchor.partId = part.Key;

                    // Add interaction collider (trigger)
                    SphereCollider trigger = anchor.gameObject.AddComponent<SphereCollider>();
                    trigger.isTrigger = true;
                    trigger.radius = 0.1f;
                }
            }
        }
    }
}
