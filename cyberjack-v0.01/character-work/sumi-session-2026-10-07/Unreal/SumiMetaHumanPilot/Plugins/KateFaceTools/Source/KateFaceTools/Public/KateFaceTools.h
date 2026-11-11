#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "MetaHumanConformTargetParams.h"
#include "MetaHumanCharacterTargetKeyPoints.h"
#include "KateFaceTools.generated.h"
class UMetaHumanCharacter;
class USkeletalMesh;
class UWorld;
class UAnimBlueprint;
class UAnimSequence;
class UBlueprint;
class UStaticMesh;
class UGroomAsset;
class UGroomComponent;
class UGroomBindingAsset;
class UPhysicsAsset;
UCLASS()
class KATEFACETOOLS_API UKateFaceTools : public UBlueprintFunctionLibrary {
 GENERATED_BODY()
public:
 UFUNCTION(BlueprintCallable, Category="Sumi") static FString EmbedBodyDNA(USkeletalMesh* Mesh,UMetaHumanCharacter* Character);
 UFUNCTION(BlueprintCallable, Category="Sumi") static FString InspectBodyRigData(USkeletalMesh* Mesh,UAnimBlueprint* Blueprint);
 UFUNCTION(BlueprintCallable, Category="Sumi") static UAnimSequence* CreateBalancedBodyMotion(USkeletalMesh* Mesh,const FString& AssetPath);
 UFUNCTION(BlueprintCallable, Category="Sumi") static FString RebalanceBodyChestWeights(USkeletalMesh* Mesh,float Strength,int32 Iterations);
 UFUNCTION(BlueprintCallable, Category="Sumi") static FString SmoothBodyChestWeights(USkeletalMesh* Mesh,float Strength,int32 Iterations);
 UFUNCTION(BlueprintCallable, Category="Sumi") static bool SetHeadScale(UAnimBlueprint* Blueprint,USkeletalMesh* Face,float Scale);
 UFUNCTION(BlueprintCallable, Category="Sumi") static FString SetBodyHeadRatio(UBlueprint* Blueprint,UAnimBlueprint* FaceBP,USkeletalMesh* Face,float BodyScale);
 UFUNCTION(BlueprintCallable, Category="Sumi") static USkeletalMesh* CloneFaceMesh(USkeletalMesh* Mesh,const FString& Path);
 UFUNCTION(BlueprintCallable, Category="Sumi") static FString AttachGenericFaceDrivers(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh,const TMap<FName,FString>& Expressions);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool AttachBodySurface(UBlueprint* Blueprint,USkeletalMesh* Mesh);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool SaveGroomDynamics(UGroomComponent* Source,UBlueprint* Blueprint);
 UFUNCTION(BlueprintCallable, Category="Kate") static UPhysicsAsset* CreateScalpPhysics(UGroomComponent* Groom,UBlueprint* Blueprint,const FString& Path);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString DumpGroomColliders(UGroomComponent* Groom,const FString& Directory);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString DumpNativeGroomState(UGroomComponent* Groom,const FString& Directory);
 UFUNCTION(BlueprintCallable, Category="Kate")
 static FString CaptureGroomTest(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,float Time,float Roll,bool Simulate,const FString& File);
 UFUNCTION(BlueprintCallable, Category="Kate") static UGroomAsset* CreateNativeGroom(const FString& AssetPath,const FString& CurveFile);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString AttachNativeGroom(UBlueprint* Blueprint,UGroomAsset* Groom,UGroomBindingAsset* Binding,UPhysicsAsset* Physics);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString InspectNativeGroom(UGroomAsset* Groom,UGroomBindingAsset* Binding,const FString& GuideFile);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool EnableHairDynamics(UBlueprint* Blueprint);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool DumpHairRigBind(USkeletalMesh* Mesh,const FString& File);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString AttachAssemblyHairRig(UWorld* World,UBlueprint* Blueprint,USkeletalMesh* Mesh,UAnimSequence* BodyNeutral,UAnimSequence* HairClip,const FString& MatrixFile);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool DumpStaticHair(UStaticMesh* Mesh,const FString& File);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString AttachAssemblyHair(UWorld* World,UBlueprint* Blueprint,UStaticMesh* Mesh,UAnimSequence* Seq,const FString& MatrixFile);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool DumpBindBoneMatrices(USkeletalMesh* Mesh,const FString& File);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString MuteFaceCorrectiveLayer(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh,int32 Mode);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool DumpRenderSkinWeights(USkeletalMesh* Mesh,const FString& File);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool DumpFaceRenderUV(USkeletalMesh* Mesh,const FString& File);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool CaptureFaceMaterialPose(UWorld* World,USkeletalMesh* Mesh,UAnimSequence* Seq,float Time,const FString& File,float ExposureBias=-7.f);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString AttachFaceCorrectiveDrivers(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString AttachFaceRelaxation(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh,float Strength,bool EyelidsOnly=false,bool CornersOnly=false);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString DumpFaceControls(UMetaHumanCharacter* Character);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString EmbedFaceDNA(USkeletalMesh* Mesh,UMetaHumanCharacter* Character);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString DumpMeshSections(USkeletalMesh* Mesh,int32 LOD);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString SmoothFaceWeights(USkeletalMesh* Mesh,float Strength,int32 Iterations);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool ConfigureArmpitNormals(USkeletalMesh* Mesh);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool CaptureAssemblyPose(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,float Time,const FString& File);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool CaptureAssemblyMaterialPose(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,float Time,const FString& File,float ViewYaw=0.f,float LightYaw=-55.f,int32 Buffer=0);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString ExportAssemblyRange(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,const FString& Folder,float StartSeconds,float EndSeconds,float FPS);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool SetVertexNormals(USkeletalMesh* Mesh,int32 LOD,const FString& CSV,bool Finalize=true);
 UFUNCTION(BlueprintCallable, Category="Kate") static UAnimSequence* CreateNeckMotion(USkeletalMesh* Mesh,const FString& AssetPath);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool ApplyVertexOffsets(USkeletalMesh* Mesh,int32 LOD,const FString& CSV,bool Finalize=true);
 UFUNCTION(BlueprintCallable, Category="Kate") static UBlueprint* CreateBodyFaceAssembly(USkeletalMesh* Body,USkeletalMesh* Face,const FString& Path);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString SetAssemblyFace(UBlueprint* Blueprint,USkeletalMesh* Mesh);
 UFUNCTION(BlueprintCallable, Category="Kate") static UAnimSequence* CreateShoulderTest(USkeletalMesh* Mesh,const FString& AssetPath,float ClavicleDegrees);
 UFUNCTION(BlueprintCallable, Category="Kate") static UAnimSequence* CreateBodyMotion(USkeletalMesh* Mesh,const FString& AssetPath);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString SetAssemblyBody(UBlueprint* Blueprint,USkeletalMesh* Mesh);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString ExportAssemblyMotion(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,const FString& Folder,int32 Step);
 UFUNCTION(BlueprintCallable, Category="Kate") static UAnimSequence* CreateHipMotion(USkeletalMesh* Mesh, const FString& AssetPath);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString ExportHipMotion(UWorld* World, USkeletalMesh* Mesh, UAnimSequence* Sequence, const FString& Folder, int32 LOD, int32 Step);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString DumpBodyLODs(USkeletalMesh* Mesh,const FString& Folder);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool AddHipMorphLOD(USkeletalMesh* Mesh,FName Name,int32 LOD,const FString& DeltaFile);
 UFUNCTION(BlueprintCallable, Category="Kate") static void EnableHipMorphCurves(USkeletalMesh* Mesh);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString DumpFaceMorphSource(USkeletalMesh* Mesh,const FString& Folder);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool AddFaceMorphLODBatch(USkeletalMesh* Mesh,const FString& ManifestFile);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool AddFaceMorphBatch(USkeletalMesh* Mesh,const FString& ManifestFile);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool AddHipMorph(USkeletalMesh* Mesh, FName Name, const FString& DeltaFile);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString AttachHipDrivers(UAnimBlueprint* Blueprint, USkeletalMesh* Mesh, int32 AxisL, float SignL, int32 AxisR, float SignR);
 UFUNCTION(BlueprintCallable, Category="Kate") static int32 SmoothHipWeights(USkeletalMesh* Mesh, float Strength, int32 Iterations);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString ClearWardrobe(UMetaHumanCharacter* Character);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString ProbeBodyPose(UWorld* World, USkeletalMesh* Mesh, const TMap<FName,FVector>& Rotations, const FString& OutputPath, bool DisablePostProcess);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool RestoreTargetPose(UMetaHumanCharacter* Character,const FMetaHumanCharacterTargetMeshKey& Key);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool RefineTarget(UMetaHumanCharacter* Character,const FMetaHumanCharacterTargetMeshKey& Key,const FRefinementTargetParams& Params);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool HasFullFaceRig(UMetaHumanCharacter* Character);
 UFUNCTION(BlueprintCallable, Category="Kate") static FString InspectGizmos(UMetaHumanCharacter* Character);
 UFUNCTION(BlueprintCallable, Category="Kate") static void ScaleGizmo(UMetaHumanCharacter* Character,int32 Index,float Scale);
 UFUNCTION(BlueprintCallable, Category="Kate") static void MoveGizmo(UMetaHumanCharacter* Character,int32 Index,FVector Position);
 UFUNCTION(BlueprintCallable, Category="Kate") static bool RefreshMorphNormals(USkeletalMesh* Mesh,FName Name,int32 LOD,bool Bake=false);
};
