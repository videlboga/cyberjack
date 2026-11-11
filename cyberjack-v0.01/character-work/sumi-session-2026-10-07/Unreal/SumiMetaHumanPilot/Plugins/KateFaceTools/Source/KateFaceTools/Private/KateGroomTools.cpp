#include "KateFaceTools.h"
#include "GroomAsset.h"
#include "GroomComponent.h"
#include "GroomBindingAsset.h"
#include "GroomBindingCompiler.h"
#include "HairDescription.h"
#include "HairAttributes.h"
#include "NiagaraSystem.h"
#include "Engine/Blueprint.h"
#include "Engine/SCS_Node.h"
#include "Engine/SimpleConstructionScript.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "Serialization/MemoryReader.h"
#include "Misc/FileHelper.h"
#include "Misc/PackageName.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "PhysicsEngine/PhysicsAsset.h"
UGroomAsset* UKateFaceTools::CreateNativeGroom(const FString& AssetPath,const FString& CurveFile){
 TArray<uint8> Data;if(!FFileHelper::LoadFileToArray(Data,*CurveFile))return nullptr;FMemoryReader R(Data);uint32 Magic,Count,N;R<<Magic<<Count<<N;if(Magic!=0x4b475231 || Count>1000000 || N<2 || N>512)return nullptr;
 FHairDescription D;int Groups=0;
 for(uint32 I=0;I<Count;I++){uint32 Group,Guide;float Width;R<<Group<<Guide<<Width;Groups=FMath::Max(Groups,int(Group)+1);FStrandID S=D.AddStrand();SetHairStrandAttribute(D,S,HairAttribute::Strand::VertexCount,int(N));SetHairStrandAttribute(D,S,HairAttribute::Strand::GroupID,int(Group));SetHairStrandAttribute(D,S,HairAttribute::Strand::Guide,int(Guide));SetHairStrandAttribute(D,S,HairAttribute::Strand::Width,Width);SetHairStrandAttribute(D,S,HairAttribute::Strand::ID,int(I));SetHairStrandAttribute(D,S,HairAttribute::Strand::GroupName,FName(Group==0?TEXT("Bangs"):Group==1?TEXT("LeftCurls"):Group==2?TEXT("RightCurls"):TEXT("BackCurls")));
  for(uint32 J=0;J<N;J++){float X,Y,Z;R<<X<<Y<<Z;FVertexID V=D.AddVertex();SetHairVertexAttribute(D,V,HairAttribute::Vertex::Position,FVector3f(X,Y,Z));SetHairVertexAttribute(D,V,HairAttribute::Vertex::Width,Width*FMath::Lerp(1.f,.1f,FMath::Pow(float(J)/(N-1),5.f)));}
 }
 if(R.IsError() || !D.IsValid())return nullptr;UPackage* P=CreatePackage(*AssetPath);auto* G=NewObject<UGroomAsset>(P,*FPackageName::GetLongPackageAssetName(AssetPath),RF_Public|RF_Standalone);G->SetNumGroup(Groups);
 FHairGroupsMaterial Mat;Mat.SlotName=TEXT("Hair");Mat.Material=LoadObject<UMaterialInterface>(nullptr,TEXT("/HairStrands/Materials/HairDefaultMaterial.HairDefaultMaterial"));G->GetHairGroupsMaterials().Add(Mat);
 for(int I=0;I<Groups;I++){
  auto& Interp=G->GetHairGroupsInterpolation()[I];Interp.InterpolationSettings.GuideType=EGroomGuideType::Imported;Interp.InterpolationSettings.InterpolationQuality=EHairInterpolationQuality::Low;Interp.InterpolationSettings.InterpolationDistance=EHairInterpolationWeight::Parametric;Interp.InterpolationSettings.bRandomizeGuide=false;Interp.InterpolationSettings.bUseUniqueGuide=true;
  auto& LOD=G->GetHairGroupsLOD()[I];LOD.LODs.SetNum(1);LOD.LODs[0].GeometryType=EGroomGeometryType::Strands;LOD.LODs[0].BindingType=EGroomBindingType::Skinning;LOD.LODs[0].Simulation=EGroomOverrideType::Enable;
  auto& Render=G->GetHairGroupsRendering()[I];Render.MaterialSlotName=TEXT("Hair");
  auto& Ph=G->GetHairGroupsPhysics()[I];Ph.SolverSettings.EnableSimulation=true;Ph.SolverSettings.NiagaraSolver=EGroomNiagaraSolvers::CosseratRods;Ph.SolverSettings.CustomSystem=LoadObject<UNiagaraSystem>(nullptr,TEXT("/HairStrands/Emitters/StableRodsSystem.StableRodsSystem"));Ph.SolverSettings.SubSteps=5;Ph.SolverSettings.IterationCount=8;Ph.StrandsParameters.StrandsSize=EGroomStrandsSize::Size32;Ph.StrandsParameters.StrandsSmoothing=.02f;Ph.ExternalForces.AirDrag=.2f;Ph.MaterialConstraints.BendConstraint.BendStiffness=I==0?.3f:.04f;Ph.MaterialConstraints.BendConstraint.BendDamping=.05f;Ph.MaterialConstraints.CollisionConstraint.CollisionRadius=.3f;Ph.MaterialConstraints.CollisionConstraint.StrandsViscosity=.3f;
 }
 G->CommitHairDescription(MoveTemp(D),EHairDescriptionType::Source);if(!G->CacheDerivedDatas())return nullptr;G->UpdateHairGroupsInfo();G->MarkPackageDirty();FAssetRegistryModule::AssetCreated(G);return G;
}
FString UKateFaceTools::AttachNativeGroom(UBlueprint* Blueprint,UGroomAsset* Groom,UGroomBindingAsset* Binding,UPhysicsAsset* Physics){
 if(!Blueprint || !Groom || !Binding || !Binding->IsValid())return TEXT("invalid inputs/binding");USCS_Node* Parent=nullptr;for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(N->GetVariableName()==TEXT("Face"))Parent=N;if(!Parent)return TEXT("face node missing");auto* N=Blueprint->SimpleConstructionScript->CreateNode(UGroomComponent::StaticClass(),TEXT("KateGroom118"));auto* C=Cast<UGroomComponent>(N->ComponentTemplate);C->SetGroomAsset(Groom,Binding,false);C->SetPhysicsAsset(Physics);C->SimulationSettings.SimulationSetup.LocalBone=TEXT("head");C->SimulationSettings.SolverSettings.bEnableSimulation=true;C->SetRelativeTransform(FTransform::Identity);Parent->AddChildNode(N);FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();return Blueprint->Status==BS_Error?TEXT("compile error"):TEXT("ok");
}
FString UKateFaceTools::InspectNativeGroom(UGroomAsset* Groom,UGroomBindingAsset* Binding,const FString& GuideFile){
 if(!Groom)return TEXT("{}");FGroomBindingCompilingManager::Get().FinishAllCompilation();FString Out=FString::Printf(TEXT("{\"groom_valid\":%s,\"binding_valid\":%s,\"groups\":["),Groom->IsValid()?TEXT("true"):TEXT("false"),Binding&&Binding->IsValid()?TEXT("true"):TEXT("false"));FString CSV;
 for(int I=0;I<Groom->GetNumHairGroups();I++){FHairStrandsDatas S,D;bool Ok=Groom->GetHairStrandsDatas(I,S,D);if(I)Out+=TEXT(",");Out+=FString::Printf(TEXT("{\"group\":%d,\"curves\":%u,\"guides\":%u,\"points\":%u,\"data_valid\":%s,\"simulation_enabled\":%s}"),I,S.GetNumCurves(),D.GetNumCurves(),S.GetNumPoints(),Ok?TEXT("true"):TEXT("false"),Groom->IsSimulationEnable(I,0)?TEXT("true"):TEXT("false"));if(!GuideFile.IsEmpty()){for(uint32 C=0;C<D.GetNumCurves();C++){uint32 Begin=D.StrandsCurves.CurvesOffset[C],Num=D.StrandsCurves.CurvesCount[C];for(uint32 J=0;J<Num;J++){auto V=D.StrandsPoints.PointsPosition[Begin+J];CSV+=FString::Printf(TEXT("%d,%u,%u,%.8f,%.8f,%.8f\n"),I,C,J,V.X,V.Y,V.Z);}}}
 }
 if(!GuideFile.IsEmpty())FFileHelper::SaveStringToFile(CSV,*GuideFile);return Out+TEXT("]}");
}

// Binding compilation must complete before validation.
