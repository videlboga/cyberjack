#include "KateFaceTools.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "GroomResources.h"
#include "RHIGPUReadback.h"
#include "RenderGraphBuilder.h"
#include "RenderGraphUtils.h"
#include "NiagaraSystemInstance.h"
#include "NiagaraSystemInstanceController.h"
#include "Niagara/NiagaraDataInterfaceHairStrands.h"
#include "NiagaraGpuComputeDispatchInterface.h"
#include "FXSystem.h"
#include "Engine/Engine.h"
#include "Engine/WorldInitializationValues.h"
#include "Animation/AnimSingleNodeInstance.h"
#include "Engine/StaticMesh.h"
#include "Components/StaticMeshComponent.h"
#include "StaticMeshResources.h"
#include "MetaHumanCharacterEditorSubsystem.h"
#include "Modules/ModuleManager.h"
IMPLEMENT_MODULE(FDefaultModuleImpl, KateFaceTools)
FString UKateFaceTools::InspectGizmos(UMetaHumanCharacter* Character) {
 auto S=UMetaHumanCharacterEditorSubsystem::Get()->CopyFaceState(Character);
 FString Result=TEXT("[");
 for(int32 I=0;I<S->NumGizmos();++I) {
  if(I==19) { Result+=TEXT(",{\"index\":19,\"unsupported\":true}"); continue; }
  FVector3f P=FVector3f::ZeroVector,Lo=FVector3f::ZeroVector,Hi=FVector3f::ZeroVector; float Scale=1,Min=1,Max=1;
  S->GetGizmoPosition(I,P); S->GetGizmoPositionBounds(I,Lo,Hi,0.0f,true);
  S->GetGizmoScale(I,Scale);S->GetGizmoScaleBounds(I,Min,Max,true);
  if(I) Result+=TEXT(",");
  Result+=FString::Printf(TEXT("{\"index\":%d,\"position\":[%f,%f,%f],\"min_position\":[%f,%f,%f],\"max_position\":[%f,%f,%f],\"scale\":%f,\"min_scale\":%f,\"max_scale\":%f}"),I,P.X,P.Y,P.Z,Lo.X,Lo.Y,Lo.Z,Hi.X,Hi.Y,Hi.Z,Scale,Min,Max);
 }
 return Result+TEXT("]");
}
void UKateFaceTools::ScaleGizmo(UMetaHumanCharacter* Character,int32 Index,float Scale) {
 auto Sub=UMetaHumanCharacterEditorSubsystem::Get();
 auto S=Sub->CopyFaceState(Character);
 (void)Sub->SetFaceGizmoScale(Character,S,Index,Scale,true,true);
 Sub->CommitFaceState(Character);
}
void UKateFaceTools::MoveGizmo(UMetaHumanCharacter* Character,int32 Index,FVector Position) {
 auto Sub=UMetaHumanCharacterEditorSubsystem::Get();
 auto S=Sub->CopyFaceState(Character);
 (void)Sub->SetFaceGizmoPosition(Character,S,Index,FVector3f(Position),true,true);
 Sub->CommitFaceState(Character);
}

#include "Async/TaskGraphInterfaces.h"
#include "Containers/BackgroundableTicker.h"
bool UKateFaceTools::RestoreTargetPose(UMetaHumanCharacter* Character,const FMetaHumanCharacterTargetMeshKey& Key) {
 return UMetaHumanCharacterEditorSubsystem::Get()->SetToTargetPosedState(Character,Key);
}
bool UKateFaceTools::HasFullFaceRig(UMetaHumanCharacter* Character) {
 return Character && Character->HasFaceDNA() && Character->HasFaceDNABlendshapes();
}
bool UKateFaceTools::RefineTarget(UMetaHumanCharacter* Character,const FMetaHumanCharacterTargetMeshKey& Key,const FRefinementTargetParams& Params) {
 auto Sub=UMetaHumanCharacterEditorSubsystem::Get(); bool Success=false;
 auto Handle=Sub->OnAsyncMeshConformCompleted(Character).AddLambda([&Success](bool Ok,bool Cancelled){Success=Ok&&!Cancelled;});
 bool Started=Sub->RefineVerticesToTargeAsync(Character,Key,Params);
 if(Started) while(Sub->IsAsyncConformPending(Character)) {
  FTaskGraphInterface::Get().ProcessThreadUntilIdle(ENamedThreads::GameThread);
  FTSBackgroundableTicker::GetCoreTicker().Tick(.1f);
  FPlatformProcess::Sleep(.1f);
 }
 Sub->OnAsyncMeshConformCompleted(Character).Remove(Handle);
 return Started&&Success;
}

#include "Engine/SkeletalMesh.h"
#include "Animation/AnimSequence.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimData/IAnimationDataController.h"
#include "Animation/SkeletalMeshActor.h"
#include "Components/SkeletalMeshComponent.h"
#include "Rendering/SkeletalMeshRenderData.h"
#include "Rendering/SkeletalMeshLODRenderData.h"
#include "SkeletalRenderPublic.h"
#include "Animation/MorphTarget.h"
#include "SkeletalMeshAttributes.h"
#include "Rendering/SkinWeightVertexBuffer.h"
#include "Misc/FileHelper.h"
#include "Engine/World.h"
FString UKateFaceTools::ProbeBodyPose(UWorld* World,USkeletalMesh* Mesh,const TMap<FName,FVector>& Rotations,const FString& OutputPath,bool DisablePostProcess) {
 if(!World || !Mesh) return TEXT("{\"error\":\"missing world or mesh\"}");
 const FReferenceSkeleton& Ref=Mesh->GetRefSkeleton();
 TArray<FTransform> Global=Ref.GetRefBonePose();
 for(int32 I=0;I<Global.Num();I++) {int32 P=Ref.GetParentIndex(I);if(P>=0)Global[I]=Global[I]*Global[P];}
 UAnimSequence* Seq=NewObject<UAnimSequence>();Seq->SetSkeleton(Mesh->GetSkeleton());Seq->SetRetargetSourceAsset(Mesh);Seq->UpdateRetargetSourceAssetData();
 IAnimationDataController& Ctrl=Seq->GetController();Ctrl.InitializeModel();Ctrl.OpenBracket(FText::FromString(TEXT("Diagnostic pose")),false);Ctrl.SetFrameRate(FFrameRate(30,1),false);Ctrl.SetNumberOfFrames(FFrameNumber(1),false);
 for(int32 I=0;I<Ref.GetNum();I++) {
  FName N=Ref.GetBoneName(I);FTransform T=Ref.GetRefBonePose()[I];
  if(const FVector* R=Rotations.Find(N)) { double Angle=R->Length(); if(Angle>0) {FQuat D(R->GetSafeNormal(),FMath::DegreesToRadians(Angle));int32 P=Ref.GetParentIndex(I);FQuat Parent=P>=0?Global[P].GetRotation():FQuat::Identity;T.SetRotation(Parent.Inverse()*D*Parent*T.GetRotation());}}
  Ctrl.AddBoneCurve(N,false);Ctrl.SetBoneTrackKeys(N,TArray<FVector3f>{FVector3f(T.GetTranslation()),FVector3f(T.GetTranslation())},TArray<FQuat4f>{FQuat4f(T.GetRotation()),FQuat4f(T.GetRotation())},TArray<FVector3f>{FVector3f(T.GetScale3D()),FVector3f(T.GetScale3D())},false);
 }
 Ctrl.NotifyPopulated();Ctrl.CloseBracket(false);
 ASkeletalMeshActor* Actor=World->SpawnActor<ASkeletalMeshActor>();USkeletalMeshComponent* C=Actor->GetSkeletalMeshComponent();
 C->SetSkeletalMesh(Mesh);C->SetDisablePostProcessBlueprint(DisablePostProcess);C->SetForcedLOD(1);C->SetAnimationMode(EAnimationMode::AnimationSingleNode);C->SetAnimation(Seq);C->SetPosition(0,false);C->SetUpdateAnimationInEditor(true);
 for(int I=0;I<4;I++){C->TickAnimation(1.f/30,false);C->RefreshBoneTransforms();C->UpdateComponentToWorld();}
 TArray<FFinalSkinVertex> V;C->GetCPUSkinnedVertices(V,0);
 FString Obj;for(const auto& X:V)Obj+=FString::Printf(TEXT("v %.8f %.8f %.8f\n"),X.Position.X,X.Position.Y,X.Position.Z);
 const auto& L=Mesh->GetResourceForRendering()->LODRenderData[0];const auto* Ind=L.MultiSizeIndexContainer.GetIndexBuffer();
 for(uint32 I=0;I+2<Ind->Num();I+=3)Obj+=FString::Printf(TEXT("f %u %u %u\n"),Ind->Get(I)+1,Ind->Get(I+1)+1,Ind->Get(I+2)+1);
 FFileHelper::SaveStringToFile(Obj,*OutputPath);
 FString Result=FString::Printf(TEXT("{\"vertex_count\":%d,\"post_process\":\"%s\",\"bones\":["),V.Num(),C->GetPostProcessInstance()?*C->GetPostProcessInstance()->GetClass()->GetPathName():TEXT("None"));
 for(int32 I=0;I<Ref.GetNum();I++){FVector R=Global[I].GetTranslation(),P=C->GetBoneTransform(I).GetTranslation();if(I)Result+=TEXT(",");Result+=FString::Printf(TEXT("{\"name\":\"%s\",\"rest\":[%f,%f,%f],\"posed\":[%f,%f,%f]}"),*Ref.GetBoneName(I).ToString(),R.X,R.Y,R.Z,P.X,P.Y,P.Z);}
 
 Result+=TEXT("]");
 for(const TCHAR* Side:{TEXT("l"),TEXT("r")}) {int32 I=Ref.FindBoneIndex(FName(FString(TEXT("thigh_"))+Side));int32 Parent=Ref.GetParentIndex(I);FTransform Local=C->GetBoneTransform(I).GetRelativeTransform(C->GetBoneTransform(Parent));FVector E=(Local.GetRotation()*Ref.GetRefBonePose()[I].GetRotation().Inverse()).Euler();float Curve=C->GetPostProcessInstance()?C->GetPostProcessInstance()->GetCurveValue(FName(FString(TEXT("KateHip_"))+Side)):0;Result+=FString::Printf(TEXT(",\"driver_%s\":[%f,%f,%f],\"curve_%s\":%f"),Side,E.X,E.Y,E.Z,Side,Curve);}
 Result+=FString::Printf(TEXT(",\"registered_morphs\":%d,\"active_morphs\":%d,\"morph_disabled\":%d,\"deltas\":["),Mesh->GetMorphTargets().Num(),C->ActiveMorphTargets.Num(),int(C->bDisableMorphTarget));
 for(int I=0;I<Mesh->GetMorphTargets().Num();I++){if(I)Result+=TEXT(",");Result+=FString::Printf(TEXT("%d"),Mesh->GetMorphTargets()[I]->GetMorphTargetDeltas(0).Num());}
 Result+=TEXT("]}");
 if(OutputPath.Contains(TEXT("author"))) {
  TArray<FMatrix44f> Mat;C->GetCurrentRefToLocalMatrices(Mat,0);auto* Weights=C->GetSkinWeightBuffer(0);FString Rows;
  for(const auto& S:L.RenderSections){for(uint32 I=S.BaseVertexIndex;I<S.BaseVertexIndex+S.NumVertices;I++) {
   FMatrix44f Blend=FMatrix44f::Identity;for(int A=0;A<4;A++)for(int B=0;B<4;B++)Blend.M[A][B]=0;
   for(uint32 K=0;K<Weights->GetMaxBoneInfluences();K++){float W=Weights->GetBoneWeight(I,K)/65535.f;if(W>0){int32 BI=S.BoneMap[Weights->GetBoneIndex(I,K)];for(int A=0;A<3;A++)for(int B=0;B<3;B++)Blend.M[A][B]+=W*Mat[BI].M[A][B];}}
   Rows+=FString::Printf(TEXT("%u"),I);for(int A=0;A<3;A++)for(int B=0;B<3;B++)Rows+=FString::Printf(TEXT(",%.10f"),Blend.M[A][B]);Rows+=TEXT("\n");
  }}
  FFileHelper::SaveStringToFile(Rows,*(OutputPath+TEXT(".skin.csv")));
 }
 Actor->Destroy();return Result;
}

#include "MetaHumanCharacter.h"
#include "MetaHumanCollection.h"
#include "MetaHumanInstance.h"
FString UKateFaceTools::ClearWardrobe(UMetaHumanCharacter* Character) {
 auto Collection=Character->GetInternalCollection();auto Instance=Collection->GetMutableDefaultInstance();
 auto Selections=Instance->GetSlotSelectionData();FString Removed;
 for(const auto& S:Selections){if(S.Selection.SelectedItem!=Character->GetInternalCollectionKey()){Removed+=S.Selection.SlotName.ToString()+TEXT(";");Instance->TryRemoveSlotSelection(S.Selection);}}
 Character->MarkPackageDirty();return Removed;
}

#include "SkinWeightModifier.h"
#include "MeshDescription.h"
#include "StaticMeshAttributes.h"
int32 UKateFaceTools::SmoothHipWeights(USkeletalMesh* Mesh,float Strength,int32 Iterations) {
 if(!Mesh) return -1;
 USkinWeightModifier* Mod=NewObject<USkinWeightModifier>();if(!Mod->SetSkeletalMesh(Mesh))return -2;
 const FMeshDescription* Desc=Mesh->GetMeshDescription(0);if(!Desc)return -3;
 const auto Pos=Desc->GetVertexPositions();int32 N=Mod->GetNumVertices();
 TArray<TMap<FName,float>> W;W.SetNum(N);TArray<TArray<int32>> Adj;Adj.SetNum(N);TArray<float> Mask;Mask.Init(0,N);
 TMap<FString,TArray<int32>> Coincident;
 for(FVertexID V:Desc->Vertices().GetElementIDs()) {int32 I=V.GetValue();if(I>=N)return -4;W[I]=Mod->GetVertexWeights(I);auto P=Pos[V];
  auto Ramp=[](float T){T=FMath::Clamp(T,0.f,1.f);return T*T*(3-2*T);};
  Mask[I]=Ramp((P.Z-71.f)/9.f)*Ramp((101.f-P.Z)/8.f);
  for(FEdgeID E:Desc->GetVertexConnectedEdges(V)){auto A=Desc->GetEdgeVertex(E,0);auto B=Desc->GetEdgeVertex(E,1);Adj[I].AddUnique((A==V?B:A).GetValue());}
  Coincident.FindOrAdd(FString::Printf(TEXT("%.3f,%.3f,%.3f"),P.X,P.Y,P.Z)).Add(I);
 }
 for(const auto& Pair:Coincident)if(Pair.Value.Num()>1)for(int32 I:Pair.Value)for(int32 J:Pair.Value)if(I!=J)Adj[I].AddUnique(J);
 for(int It=0;It<Iterations;It++) {auto New=W;for(int I=0;I<N;I++)if(Mask[I]>0 && Adj[I].Num()>0){float A=Strength*Mask[I];TMap<FName,float> Avg;for(int J:Adj[I])for(const auto& K:W[J])Avg.FindOrAdd(K.Key)+=K.Value/Adj[I].Num();New[I].Empty();for(const auto& K:W[I])New[I].FindOrAdd(K.Key)+=(1-A)*K.Value;for(const auto& K:Avg)New[I].FindOrAdd(K.Key)+=A*K.Value;}W=MoveTemp(New);}
 int32 Count=0;for(int I=0;I<N;I++)if(Mask[I]>0){Mod->SetVertexWeights(I,W[I],true);Count++;}
 if(!Mod->CommitWeightsToSkeletalMesh())return -5;return Count;
}

#include "Animation/MorphTarget.h"
#include "SkeletalMeshAttributes.h"
#include "Rendering/SkeletalMeshModel.h"
#include "Rendering/SkeletalMeshLODModel.h"
#include "Animation/AnimBlueprint.h"
#include "AnimGraphNode_Root.h"
#include "AnimGraphNode_BoneDrivenController.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "Curves/CurveFloat.h"
#include "EdGraph/EdGraph.h"
#include "EdGraph/EdGraphSchema.h"
bool UKateFaceTools::AddHipMorph(USkeletalMesh* Mesh,FName Name,const FString& DeltaFile) {
 FString Text;if(!FFileHelper::LoadFileToString(Text,*DeltaFile))return false;TArray<FString> Lines;Text.ParseIntoArrayLines(Lines);TArray<FMorphTargetDelta> D;
 for(const FString& Line:Lines){TArray<FString> A;Line.ParseIntoArray(A,TEXT(","));if(A.Num()!=4)continue;FMorphTargetDelta V;V.SourceIdx=FCString::Atoi(*A[0]);V.PositionDelta=FVector3f(FCString::Atof(*A[1]),FCString::Atof(*A[2]),FCString::Atof(*A[3]));V.TangentZDelta=FVector3f::ZeroVector;D.Add(V);}

 FMeshDescription* Desc=Mesh->GetMeshDescription(0);if(!Desc)return false;
 FSkeletalMeshAttributes Attr(*Desc);Attr.RegisterMorphTargetAttribute(Name,false);auto Delta=Attr.GetVertexMorphPositionDelta(Name);auto Positions=Desc->GetVertexPositions();
 const auto& Buffer=Mesh->GetResourceForRendering()->LODRenderData[0].StaticVertexBuffers.PositionVertexBuffer;
 TMap<FString,FVector3f> Sum;TMap<FString,int32> Counts;
 auto Key=[](FVector3f P){return FString::Printf(TEXT("%.4f,%.4f,%.4f"),P.X,P.Y,P.Z);};
 for(const auto& V:D){FString K=Key(Buffer.VertexPosition(V.SourceIdx));Sum.FindOrAdd(K,FVector3f::ZeroVector)+=V.PositionDelta;Counts.FindOrAdd(K)++;}
 int32 Matched=0;for(FVertexID V:Desc->Vertices().GetElementIDs()){FString K=Key(Positions[V]);if(auto* X=Sum.Find(K)){Delta[V]=*X/Counts[K];Matched++;}else Delta[V]=FVector3f::ZeroVector;}
 if(Matched==0)return false;Mesh->CommitMeshDescription(0);Mesh->PostEditChange();Mesh->MarkPackageDirty();return true;
}
FString UKateFaceTools::AttachHipDrivers(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh,int32 AxisL,float SignL,int32 AxisR,float SignR) {
 TArray<UEdGraph*> Graphs;Blueprint->GetAllGraphs(Graphs);UEdGraph* Graph=nullptr;UAnimGraphNode_Root* Root=nullptr;
 for(auto* G:Graphs)if(G->GetFName()==TEXT("AnimGraph"))for(auto& N:G->Nodes)if(auto* R=Cast<UAnimGraphNode_Root>(N.Get())){Root=R;Graph=G;break;}
 if(!Root)return TEXT("No root");UEdGraphPin* Input=nullptr;for(auto* P:Root->Pins)if(P->Direction==EGPD_Input && P->LinkedTo.Num()==1){Input=P;break;}if(!Input)return TEXT("No root input");auto* Previous=Input->LinkedTo[0];Input->BreakAllPinLinks();
 for(int Side=0;Side<2;Side++){
  FString S=Side==0?TEXT("l"):TEXT("r");FGraphNodeCreator<UAnimGraphNode_BoneDrivenController> Creator(*Graph);auto* N=Creator.CreateNode();N->Node.SourceBone.BoneName=FName(TEXT("thigh_")+S);N->Node.SourceComponent=static_cast<EComponentType::Type>(static_cast<int>(EComponentType::RotationX)+(Side==0?AxisL:AxisR));N->Node.DestinationMode=EDrivenDestinationMode::MorphTarget;N->Node.ParameterName=FName(TEXT("KateHip_")+S);N->Node.Multiplier=1.f;
  UCurveFloat* Curve=NewObject<UCurveFloat>(Blueprint,FName(TEXT("KateHipCurve_")+S));float Sign=Side==0?SignL:SignR;
  for(int A=-180;A<=180;A+=5){float T=FMath::Clamp((A*Sign-30.f)/40.f,0.f,1.f);Curve->FloatCurve.AddKey(A,T*T*(3-2*T));}N->Node.DrivingCurve=Curve;Creator.Finalize();
  auto* In=N->FindPin(TEXT("ComponentPose"));auto* Out=N->FindPin(TEXT("Pose"));if(!In||!Out)return TEXT("Missing controller pins");if(!Graph->GetSchema()->TryCreateConnection(Previous,In))return TEXT("Input connection failed");Previous=Out;
 }
 if(!Graph->GetSchema()->TryCreateConnection(Previous,Input))return TEXT("Output connection failed");FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);if(Blueprint->Status==BS_Error)return TEXT("Compile failed");Mesh->SetPostProcessAnimBlueprint(TSubclassOf<UAnimInstance>(Blueprint->GeneratedClass.Get()));Mesh->MarkPackageDirty();return TEXT("ok");
}

#include "Animation/AnimCurveMetadata.h"
void UKateFaceTools::EnableHipMorphCurves(USkeletalMesh* Mesh) {
 auto* Meta=Mesh->GetAssetUserData<UAnimCurveMetaData>();if(!Meta){Meta=NewObject<UAnimCurveMetaData>(Mesh);Mesh->AddAssetUserData(Meta);}
 for(FName N:{FName(TEXT("KateHip_l")),FName(TEXT("KateHip_r")),FName(TEXT("KateFaceBlink")),FName(TEXT("KateFaceSmile")),FName(TEXT("KateFaceSmileJaw")),FName(TEXT("KateFaceJaw")),FName(TEXT("KateFacePerioralMid")),FName(TEXT("KateFacePerioralHigh")),FName(TEXT("KateFacePerioralSmile")),FName(TEXT("KateFacePerioralSmileJaw")),FName(TEXT("KateFaceRestShape"))}){Meta->AddCurveMetaData(N);Meta->SetCurveMetaDataMorphTarget(N,true);}
 Mesh->MarkPackageDirty();
}


bool UKateFaceTools::AddFaceMorphBatch(USkeletalMesh* Mesh,const FString& ManifestFile){
 if(!Mesh)return false;FString Text;if(!FFileHelper::LoadFileToString(Text,*ManifestFile))return false;
 auto* Desc=Mesh->GetMeshDescription(0);if(!Desc)return false;FSkeletalMeshAttributes Attr(*Desc);auto Positions=Desc->GetVertexPositions();const auto& Buffer=Mesh->GetResourceForRendering()->LODRenderData[0].StaticVertexBuffers.PositionVertexBuffer;
 auto Key=[](FVector3f P){return FString::Printf(TEXT("%.4f,%.4f,%.4f"),P.X,P.Y,P.Z);};
 auto* Meta=Mesh->GetAssetUserData<UAnimCurveMetaData>();if(!Meta){Meta=NewObject<UAnimCurveMetaData>(Mesh);Mesh->AddAssetUserData(Meta);}
 TArray<FString> Lines;Text.ParseIntoArrayLines(Lines);int Count=0;
 for(auto& Line:Lines){FString Name,Path;if(!Line.Split(TEXT("|"),&Name,&Path))return false;FString Data;if(!FFileHelper::LoadFileToString(Data,*Path))return false;
  TMap<FString,FVector3f> Sum;TMap<FString,int32> Counts;TArray<FString> Rows;Data.ParseIntoArrayLines(Rows);
  for(auto& Row:Rows){TArray<FString>A;Row.ParseIntoArray(A,TEXT(","));if(A.Num()!=4)return false;int I=FCString::Atoi(*A[0]);if(I<0||I>=int(Buffer.GetNumVertices()))return false;auto K=Key(Buffer.VertexPosition(I));Sum.FindOrAdd(K,FVector3f::ZeroVector)+=FVector3f(FCString::Atof(*A[1]),FCString::Atof(*A[2]),FCString::Atof(*A[3]));Counts.FindOrAdd(K)++;}
  FName N(*Name);Attr.RegisterMorphTargetAttribute(N,false);auto Delta=Attr.GetVertexMorphPositionDelta(N);int Matched=0;
  for(FVertexID V:Desc->Vertices().GetElementIDs()){auto K=Key(Positions[V]);if(auto* D=Sum.Find(K)){Delta[V]=*D/Counts[K];Matched++;}else Delta[V]=FVector3f::ZeroVector;}
  if(!Matched)return false;Meta->AddCurveMetaData(N);Meta->SetCurveMetaDataMorphTarget(N,true);Count++;
 }
 if(!Count)return false;Mesh->CommitMeshDescription(0);Mesh->PostEditChange();Mesh->MarkPackageDirty();return true;
}

#include "Misc/PackageName.h"
#include "HAL/FileManager.h"
UAnimSequence* UKateFaceTools::CreateHipMotion(USkeletalMesh* Mesh,const FString& AssetPath) {
 auto* Package=CreatePackage(*AssetPath);auto* Seq=NewObject<UAnimSequence>(Package,FName(FPackageName::GetShortName(AssetPath)),RF_Public|RF_Standalone);
 Seq->SetSkeleton(Mesh->GetSkeleton());Seq->SetRetargetSourceAsset(Mesh);Seq->UpdateRetargetSourceAssetData();Seq->SetPreviewMesh(Mesh);
 const auto& Ref=Mesh->GetRefSkeleton();auto Global=Ref.GetRefBonePose();for(int I=0;I<Global.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)Global[I]=Global[I]*Global[P];}
 TArray<TArray<FVector3f>> Pos,Scale;TArray<TArray<FQuat4f>> Rot;Pos.SetNum(Ref.GetNum());Scale.SetNum(Ref.GetNum());Rot.SetNum(Ref.GetNum());
 FVector Lateral=(Global[Ref.FindBoneIndex(TEXT("upperarm_r"))].GetTranslation()-Global[Ref.FindBoneIndex(TEXT("upperarm_l"))].GetTranslation()).GetSafeNormal();FVector Forward=FVector::CrossProduct(Lateral,FVector::UpVector).GetSafeNormal();FVector Bend=FVector::CrossProduct(-FVector::UpVector,Forward).GetSafeNormal();
 int BL=Ref.FindBoneIndex(TEXT("ball_l")),BR=Ref.FindBoneIndex(TEXT("ball_r"));
 for(int Frame=0;Frame<=240;Frame++){
  int Part=FMath::Min(Frame/80,2);float T=(Frame-Part*80)/80.f;float Wave=FMath::Square(FMath::Sin(PI*T));auto Local=Ref.GetRefBonePose();TMap<FName,float> Angles;
  for(int Side=0;Side<2;Side++)if(Part==0 || Part==Side+1){FString S=Side==0?TEXT("l"):TEXT("r");float A=(Part==0?70.f:90.f)*Wave;Angles.Add(FName(TEXT("thigh_")+S),A);Angles.Add(FName(TEXT("calf_")+S),-A*(Part==0?110.f/70.f:1.05f));Angles.Add(FName(TEXT("foot_")+S),A*(Part==0?40.f/70.f:.05f));}
  if(Part==0)Angles.Add(TEXT("spine_01"),-10.f*Wave);
  for(const auto& KV:Angles){int I=Ref.FindBoneIndex(KV.Key);int P=Ref.GetParentIndex(I);FQuat Parent=P>=0?Global[P].GetRotation():FQuat::Identity;FQuat D(Bend,FMath::DegreesToRadians(KV.Value));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  if(Part==0){auto FK=Local;for(int I=0;I<FK.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)FK[I]=FK[I]*FK[P];}FVector Delta=(Global[BL].GetTranslation()+Global[BR].GetTranslation()-FK[BL].GetTranslation()-FK[BR].GetTranslation())*.5;Local[0].AddToTranslation(Delta);}
  for(int I=0;I<Local.Num();I++){Pos[I].Add(FVector3f(Local[I].GetTranslation()));Rot[I].Add(FQuat4f(Local[I].GetRotation()));Scale[I].Add(FVector3f(Local[I].GetScale3D()));}
 }
 auto& C=Seq->GetController();C.InitializeModel();C.OpenBracket(FText::FromString(TEXT("Kate native hip motion")),false);C.SetFrameRate(FFrameRate(30,1),false);C.SetNumberOfFrames(FFrameNumber(240),false);
 for(int I=0;I<Ref.GetNum();I++){C.AddBoneCurve(Ref.GetBoneName(I),false);C.SetBoneTrackKeys(Ref.GetBoneName(I),Pos[I],Rot[I],Scale[I],false);}C.NotifyPopulated();C.CloseBracket(false);Seq->MarkPackageDirty();return Seq;
}
FString UKateFaceTools::ExportHipMotion(UWorld* World,USkeletalMesh* Mesh,UAnimSequence* Seq,const FString& Folder,int32 LOD,int32 Step){
 IFileManager::Get().MakeDirectory(*Folder,true);auto* A=World->SpawnActor<ASkeletalMeshActor>();auto* C=A->GetSkeletalMeshComponent();C->SetSkeletalMesh(Mesh);C->SetForcedLOD(LOD+1);C->bDisableMorphTarget=Folder.Contains(TEXT("bones-only"));C->SetAnimationMode(EAnimationMode::AnimationSingleNode);C->SetAnimation(Seq);C->Stop();C->SetUpdateAnimationInEditor(true);
 FString Report=TEXT("[");const auto& L=Mesh->GetResourceForRendering()->LODRenderData[LOD];const auto* Ind=L.MultiSizeIndexContainer.GetIndexBuffer();
 for(int F=0;F<=FMath::CeilToInt(Seq->GetPlayLength()*30.f);F+=FMath::Max(Step,1)){C->SetPosition(F/30.f,false);C->TickAnimation(1.f/30,false);C->RefreshBoneTransforms();C->UpdateComponentToWorld();TArray<FFinalSkinVertex> V;
  if(GUsingNullRHI){
   // NullRHI has no MeshObject. Evaluate morphs and linear skinning from CPU buffers.
   const uint32 NumVerts=L.StaticVertexBuffers.PositionVertexBuffer.GetNumVertices();TArray<FVector3f> P;P.SetNumUninitialized(NumVerts);
   for(uint32 I=0;I<NumVerts;I++)P[I]=L.StaticVertexBuffers.PositionVertexBuffer.VertexPosition(I);
   if(!C->bDisableMorphTarget)for(const auto& Active:C->ActiveMorphTargets){const auto* Morph=Active.Key;const int32 WeightIndex=Active.Value;if(!Morph || !C->MorphTargetWeights.IsValidIndex(WeightIndex))continue;const float Weight=C->MorphTargetWeights[WeightIndex];if(FMath::IsNearlyZero(Weight))continue;for(const auto& D:Morph->GetMorphTargetDeltas(LOD))if(P.IsValidIndex(D.SourceIdx))P[D.SourceIdx]+=D.PositionDelta*Weight;}
   TArray<FMatrix44f> Mat;C->GetCurrentRefToLocalMatrices(Mat,LOD);const auto* Weights=C->GetSkinWeightBuffer(LOD);V.SetNum(NumVerts);
   for(const auto& Section:L.RenderSections)for(uint32 I=Section.BaseVertexIndex;I<Section.BaseVertexIndex+Section.NumVertices;I++){FVector3f Skinned=FVector3f::ZeroVector;float Sum=0;for(uint32 K=0;K<Weights->GetMaxBoneInfluences();K++){const float Weight=Weights->GetBoneWeight(I,K)/65535.f;if(Weight<=0)continue;const int32 LocalBone=Weights->GetBoneIndex(I,K);if(!Section.BoneMap.IsValidIndex(LocalBone))continue;const int32 Bone=Section.BoneMap[LocalBone];if(!Mat.IsValidIndex(Bone))continue;Skinned+=Mat[Bone].TransformPosition(P[I])*Weight;Sum+=Weight;}V[I].Position=Sum>0?Skinned/Sum:P[I];}
  }else C->GetCPUSkinnedVertices(V,LOD);
  FString Obj;for(const auto& P:V)Obj+=FString::Printf(TEXT("v %.8f %.8f %.8f\n"),P.Position.X,P.Position.Y,P.Position.Z);for(uint32 I=0;I+2<Ind->Num();I+=3)Obj+=FString::Printf(TEXT("f %u %u %u\n"),Ind->Get(I)+1,Ind->Get(I+1)+1,Ind->Get(I+2)+1);FFileHelper::SaveStringToFile(Obj,*FString::Printf(TEXT("%s/frame_%04d.obj"),*Folder,F));

  if(Folder.Contains(TEXT("corrective-author-all")) || (Folder.Contains(TEXT("corrective-author")) && (F==0 || F==15 || F==45 || F==105 || F==135 || F==195 || F==225))) {
   TArray<FMatrix44f> Mat;C->GetCurrentRefToLocalMatrices(Mat,LOD);auto* Weights=C->GetSkinWeightBuffer(LOD);FString Rows;
   for(const auto& S:L.RenderSections)for(uint32 I=S.BaseVertexIndex;I<S.BaseVertexIndex+S.NumVertices;I++){
    FMatrix44f Blend=FMatrix44f::Identity;for(int Row=0;Row<3;Row++)for(int B=0;B<3;B++)Blend.M[Row][B]=0;
    for(uint32 K=0;K<Weights->GetMaxBoneInfluences();K++){float W=Weights->GetBoneWeight(I,K)/65535.f;if(W>0){int32 BI=S.BoneMap[Weights->GetBoneIndex(I,K)];for(int Row=0;Row<3;Row++)for(int B=0;B<3;B++)Blend.M[Row][B]+=W*Mat[BI].M[Row][B];}}
    Rows+=FString::Printf(TEXT("%u"),I);for(int Row=0;Row<3;Row++)for(int B=0;B<3;B++)Rows+=FString::Printf(TEXT(",%.10f"),Blend.M[Row][B]);Rows+=TEXT("\n");
   }
   FFileHelper::SaveStringToFile(Rows,*FString::Printf(TEXT("%s/frame_%04d.skin.csv"),*Folder,F));
  }
  float WL=C->GetPostProcessInstance()?C->GetPostProcessInstance()->GetCurveValue(TEXT("KateHip_l")):0;float WR=C->GetPostProcessInstance()?C->GetPostProcessInstance()->GetCurveValue(TEXT("KateHip_r")):0;auto PL=C->GetBoneLocation(TEXT("ball_l")),PR=C->GetBoneLocation(TEXT("ball_r"));
  if(F)Report+=TEXT(",");auto* PP=C->GetPostProcessInstance();float CJ=PP?PP->GetCurveValue(TEXT("CTRL_expressions_jawOpen")):0;float CS=PP?PP->GetCurveValue(TEXT("KateFaceSmile")):0;float CW=PP?PP->GetCurveValue(TEXT("KateFaceSmileJaw")):0;
  Report+=FString::Printf(TEXT("{\"frame\":%d,\"left\":%f,\"right\":%f,\"jaw_raw\":%f,\"smile_corrective\":%f,\"combo_corrective\":%f,\"active_morphs\":%d,\"morphs\":["),F,WL,WR,CJ,CS,CW,C->ActiveMorphTargets.Num());
  for(int MI=0;MI<Mesh->GetMorphTargets().Num();MI++){auto* MT=Mesh->GetMorphTargets()[MI].Get();if(MT->GetName().StartsWith(TEXT("KateFace")) || MT->GetName().StartsWith(TEXT("SumiMotion"))){float Weight=0;if(auto* Index=C->ActiveMorphTargets.Find(MT))if(C->MorphTargetWeights.IsValidIndex(*Index))Weight=C->MorphTargetWeights[*Index];Report+=FString::Printf(TEXT("{\"name\":\"%s\",\"deltas\":%d,\"curve\":%f,\"weight\":%f},"),*MT->GetName(),MT->GetMorphTargetDeltas(LOD).Num(),PP?PP->GetCurveValue(FName(*MT->GetName())):0,Weight);}}
  Report+=TEXT("null]}");
 }A->Destroy();return Report+TEXT("]");
}
FString UKateFaceTools::DumpBodyLODs(USkeletalMesh* Mesh,const FString& Folder){IFileManager::Get().MakeDirectory(*Folder,true);FString R=TEXT("[");for(int L=0;L<Mesh->GetLODNum();L++){
 auto* D=Mesh->GetMeshDescription(L);if(!D)return TEXT("[]");auto P=D->GetVertexPositions();FStaticMeshAttributes UVAttrs(*D);auto UV=UVAttrs.GetVertexInstanceUVs();auto Slots=UVAttrs.GetPolygonGroupMaterialSlotNames();FString UVRows,GroupRows;for(FVertexInstanceID VI:D->VertexInstances().GetElementIDs()){auto Q=UV.Get(VI,0);UVRows+=FString::Printf(TEXT("%d,%.9f,%.9f\n"),D->GetVertexInstanceVertex(VI).GetValue(),Q.X,Q.Y);}for(FTriangleID TI:D->Triangles().GetElementIDs())GroupRows+=FString::Printf(TEXT("%d,%s\n"),TI.GetValue(),*Slots[D->GetTrianglePolygonGroup(TI)].ToString());FFileHelper::SaveStringToFile(UVRows,*FString::Printf(TEXT("%s/lod%d_uv.csv"),*Folder,L));FFileHelper::SaveStringToFile(GroupRows,*FString::Printf(TEXT("%s/lod%d_groups.csv"),*Folder,L));FString V,F;for(FVertexID I:D->Vertices().GetElementIDs()){auto Q=P[I];V+=FString::Printf(TEXT("%d,%.8f,%.8f,%.8f\n"),I.GetValue(),Q.X,Q.Y,Q.Z);}for(FTriangleID I:D->Triangles().GetElementIDs()){auto T=D->GetTriangleVertices(I);F+=FString::Printf(TEXT("%d,%d,%d\n"),T[0].GetValue(),T[1].GetValue(),T[2].GetValue());}FFileHelper::SaveStringToFile(V,*FString::Printf(TEXT("%s/lod%d_vertices.csv"),*Folder,L));FFileHelper::SaveStringToFile(F,*FString::Printf(TEXT("%s/lod%d_faces.csv"),*Folder,L));if(L)R+=TEXT(",");R+=FString::Printf(TEXT("{\"lod\":%d,\"vertices\":%d}"),L,D->Vertices().Num());}return R+TEXT("]");}
bool UKateFaceTools::AddHipMorphLOD(USkeletalMesh* Mesh,FName Name,int32 LOD,const FString& DeltaFile){auto* D=Mesh->GetMeshDescription(LOD);if(!D)return false;FString T;if(!FFileHelper::LoadFileToString(T,*DeltaFile))return false;FSkeletalMeshAttributes Attr(*D);Attr.RegisterMorphTargetAttribute(Name,false);auto Delta=Attr.GetVertexMorphPositionDelta(Name);for(FVertexID I:D->Vertices().GetElementIDs())Delta[I]=FVector3f::ZeroVector;TArray<FString> Lines;T.ParseIntoArrayLines(Lines);for(auto& Line:Lines){TArray<FString>A;Line.ParseIntoArray(A,TEXT(","));if(A.Num()==4)Delta[FVertexID(FCString::Atoi(*A[0]))]=FVector3f(FCString::Atof(*A[1]),FCString::Atof(*A[2]),FCString::Atof(*A[3]));}Mesh->CommitMeshDescription(LOD);Mesh->PostEditChange();Mesh->MarkPackageDirty();return true;}

UAnimSequence* UKateFaceTools::CreateBodyMotion(USkeletalMesh* Mesh,const FString& AssetPath) {
 auto* Package=CreatePackage(*AssetPath);auto* Seq=NewObject<UAnimSequence>(Package,FName(FPackageName::GetShortName(AssetPath)),RF_Public|RF_Standalone);
 Seq->SetSkeleton(Mesh->GetSkeleton());Seq->SetRetargetSourceAsset(Mesh);Seq->UpdateRetargetSourceAssetData();Seq->SetPreviewMesh(Mesh);
 const auto& Ref=Mesh->GetRefSkeleton();auto Global=Ref.GetRefBonePose();for(int I=0;I<Global.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)Global[I]=Global[I]*Global[P];}
 TArray<TArray<FVector3f>> Pos,Scale;TArray<TArray<FQuat4f>> Rot;Pos.SetNum(Ref.GetNum());Scale.SetNum(Ref.GetNum());Rot.SetNum(Ref.GetNum());
 FVector Lateral=(Global[Ref.FindBoneIndex(TEXT("upperarm_r"))].GetTranslation()-Global[Ref.FindBoneIndex(TEXT("upperarm_l"))].GetTranslation()).GetSafeNormal();FVector Forward=FVector::CrossProduct(Lateral,FVector::UpVector).GetSafeNormal();FVector Bend=FVector::CrossProduct(-FVector::UpVector,Forward).GetSafeNormal();
 int BL=Ref.FindBoneIndex(TEXT("ball_l")),BR=Ref.FindBoneIndex(TEXT("ball_r"));
 for(int Frame=0;Frame<=240;Frame++){
  int Part=FMath::Min(Frame/80,2);float T=(Frame-Part*80)/80.f;float Wave=FMath::Square(FMath::Sin(PI*T));auto Local=Ref.GetRefBonePose();TMap<FName,float> Angles;
  for(int Side=0;Side<2;Side++)if(Part==0 || Part==Side+1){FString S=Side==0?TEXT("l"):TEXT("r");float A=(Part==0?70.f:90.f)*Wave;Angles.Add(FName(TEXT("thigh_")+S),A);Angles.Add(FName(TEXT("calf_")+S),-A*(Part==0?110.f/70.f:1.05f));Angles.Add(FName(TEXT("foot_")+S),A*(Part==0?40.f/70.f:.05f));}
  if(Part==0)Angles.Add(TEXT("spine_01"),-10.f*Wave);
  for(const auto& KV:Angles){int I=Ref.FindBoneIndex(KV.Key);int P=Ref.GetParentIndex(I);FQuat Parent=P>=0?Global[P].GetRotation():FQuat::Identity;FQuat D(Bend,FMath::DegreesToRadians(KV.Value));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  for(int Side=0;Side<2;Side++)if(Part==0 || Part==Side+1){FString S=Side==0?TEXT("l"):TEXT("r");int U=Ref.FindBoneIndex(FName(TEXT("upperarm_")+S));int E=Ref.FindBoneIndex(FName(TEXT("lowerarm_")+S));FVector Arm=(Global[E].GetTranslation()-Global[U].GetTranslation()).GetSafeNormal();FVector Axis=FVector::CrossProduct(Arm,FVector::UpVector).GetSafeNormal();for(FName Bone:{FName(TEXT("clavicle_")+S),FName(TEXT("upperarm_")+S)}){int I=Ref.FindBoneIndex(Bone);int P=Ref.GetParentIndex(I);FQuat Parent=Global[P].GetRotation();FQuat D(Axis,FMath::DegreesToRadians((I==U?95.f:10.f)*Wave));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}}
  if(Part>0){int I=Ref.FindBoneIndex(TEXT("spine_02"));FQuat Parent=Global[Ref.GetParentIndex(I)].GetRotation();FQuat D(FVector::UpVector,FMath::DegreesToRadians((Part==1?12.f:-12.f)*Wave));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  if(Part==0){auto FK=Local;for(int I=0;I<FK.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)FK[I]=FK[I]*FK[P];}FVector Delta=(Global[BL].GetTranslation()+Global[BR].GetTranslation()-FK[BL].GetTranslation()-FK[BR].GetTranslation())*.5;Local[0].AddToTranslation(Delta);}
  for(int I=0;I<Local.Num();I++){Pos[I].Add(FVector3f(Local[I].GetTranslation()));Rot[I].Add(FQuat4f(Local[I].GetRotation()));Scale[I].Add(FVector3f(Local[I].GetScale3D()));}
 }
 auto& C=Seq->GetController();C.InitializeModel();C.OpenBracket(FText::FromString(TEXT("Kate native hip motion")),false);C.SetFrameRate(FFrameRate(30,1),false);C.SetNumberOfFrames(FFrameNumber(240),false);
 for(int I=0;I<Ref.GetNum();I++){C.AddBoneCurve(Ref.GetBoneName(I),false);C.SetBoneTrackKeys(Ref.GetBoneName(I),Pos[I],Rot[I],Scale[I],false);}C.NotifyPopulated();C.CloseBracket(false);Seq->MarkPackageDirty();return Seq;
}

#include "Engine/SimpleConstructionScript.h"
#include "Engine/SCS_Node.h"
#include "Engine/Blueprint.h"
FString UKateFaceTools::SetAssemblyBody(UBlueprint* Blueprint,USkeletalMesh* Mesh){
 int Count=0;FString Names;for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(auto* C=Cast<USkeletalMeshComponent>(N->ComponentTemplate)) {Names+=N->GetVariableName().ToString()+TEXT(";");if(N->GetVariableName().ToString().Equals(TEXT("Body"),ESearchCase::IgnoreCase)){C->SetSkeletalMesh(Mesh);Count++;}}
 if(Count!=1)return TEXT("Failed body count: ")+FString::FromInt(Count)+TEXT(" nodes: ")+Names;
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();return Blueprint->Status==BS_Error?TEXT("Compile failed"):TEXT("ok");
}
FString UKateFaceTools::ExportAssemblyMotion(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,const FString& Folder,int32 Step){
 auto* A=World->SpawnActor<AActor>(Blueprint->GeneratedClass.Get(),FTransform::Identity);if(!A)return TEXT("{}");TArray<USkeletalMeshComponent*> Comps;A->GetComponents(Comps);USkeletalMeshComponent* Body=nullptr;
 for(auto* C:Comps)if(C->GetName().Equals(TEXT("Body"),ESearchCase::IgnoreCase))Body=C;if(!Body){A->Destroy();return TEXT("{}");}
 Body->SetAnimationMode(EAnimationMode::AnimationSingleNode);Body->SetAnimation(Seq);Body->Stop();
 for(auto* C:Comps){C->SetForcedLOD(1);C->VisibilityBasedAnimTickOption=EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;C->SetUpdateAnimationInEditor(true);}
 IFileManager::Get().MakeDirectory(*Folder,true);FString Report=TEXT("{\"body_mesh\":\"")+Body->GetSkeletalMeshAsset()->GetPathName()+TEXT("\",\"frames\":[");
 for(int F=0;F<=240;F+=Step){Body->SetPosition(F/30.f,false);
  for(int Warm=0;Warm<3;Warm++){Body->TickAnimation(1.f/30,false);Body->RefreshBoneTransforms();Body->UpdateComponentToWorld();for(auto* C:Comps)if(C!=Body && C->GetSkeletalMeshAsset()){C->TickAnimation(1.f/30,false);C->RefreshBoneTransforms();C->UpdateComponentToWorld();}}
  {const auto& Ref=Body->GetSkeletalMeshAsset()->GetRefSkeleton();FString Rows;for(int I=0;I<Ref.GetNum();I++){int P=Ref.GetParentIndex(I);FTransform Local=P>=0?Body->GetBoneTransform(I).GetRelativeTransform(Body->GetBoneTransform(P)):Body->GetBoneTransform(I);FTransform Bind=Ref.GetRefBonePose()[I];FVector D=Local.GetTranslation()-Bind.GetTranslation();FVector E=(Local.GetRotation()*Bind.GetRotation().Inverse()).Euler();Rows+=FString::Printf(TEXT("%s,%.9f,%.9f,%.9f,%.9f,%.9f,%.9f\n"),*Ref.GetBoneName(I).ToString(),D.X,D.Y,D.Z,E.X,E.Y,E.Z);}FFileHelper::SaveStringToFile(Rows,*FString::Printf(TEXT("%s/body_local_bones_%04d.csv"),*Folder,F));}
  if(F)Report+=TEXT(",");Report+=FString::Printf(TEXT("{\"frame\":%d,\"components\":["),F);bool First=true;
  for(auto* C:Comps)if(auto* Mesh=C->GetSkeletalMeshAsset()){
   TArray<FFinalSkinVertex> V;const auto& L=Mesh->GetResourceForRendering()->LODRenderData[0];  if(GUsingNullRHI){
   // NullRHI has no MeshObject. Evaluate morphs and linear skinning from CPU buffers.
   const uint32 NumVerts=L.StaticVertexBuffers.PositionVertexBuffer.GetNumVertices();TArray<FVector3f> P;P.SetNumUninitialized(NumVerts);
   for(uint32 I=0;I<NumVerts;I++)P[I]=L.StaticVertexBuffers.PositionVertexBuffer.VertexPosition(I);
   if(!C->bDisableMorphTarget)for(const auto& Active:C->ActiveMorphTargets){const auto* Morph=Active.Key;const int32 WeightIndex=Active.Value;if(!Morph || !C->MorphTargetWeights.IsValidIndex(WeightIndex))continue;const float Weight=C->MorphTargetWeights[WeightIndex];if(FMath::IsNearlyZero(Weight))continue;for(const auto& D:Morph->GetMorphTargetDeltas(0))if(P.IsValidIndex(D.SourceIdx))P[D.SourceIdx]+=D.PositionDelta*Weight;}
   TArray<FMatrix44f> Mat;C->GetCurrentRefToLocalMatrices(Mat,0);const auto* Weights=C->GetSkinWeightBuffer(0);V.SetNum(NumVerts);
   for(const auto& Section:L.RenderSections)for(uint32 I=Section.BaseVertexIndex;I<Section.BaseVertexIndex+Section.NumVertices;I++){FVector3f Skinned=FVector3f::ZeroVector;float Sum=0;for(uint32 K=0;K<Weights->GetMaxBoneInfluences();K++){const float Weight=Weights->GetBoneWeight(I,K)/65535.f;if(Weight<=0)continue;const int32 LocalBone=Weights->GetBoneIndex(I,K);if(!Section.BoneMap.IsValidIndex(LocalBone))continue;const int32 Bone=Section.BoneMap[LocalBone];if(!Mat.IsValidIndex(Bone))continue;Skinned+=Mat[Bone].TransformPosition(P[I])*Weight;Sum+=Weight;}V[I].Position=Sum>0?Skinned/Sum:P[I];}

   if(F==0){FString Rows;for(const auto& Section:L.RenderSections)for(uint32 I=Section.BaseVertexIndex;I<Section.BaseVertexIndex+Section.NumVertices;I++){float Sum=0;FMatrix44f B=FMatrix44f::Identity;for(int X=0;X<4;X++)for(int Y=0;Y<4;Y++)B.M[X][Y]=0;for(uint32 K=0;K<Weights->GetMaxBoneInfluences();K++){float W=Weights->GetBoneWeight(I,K)/65535.f;int LB=Weights->GetBoneIndex(I,K);if(W<=0||!Section.BoneMap.IsValidIndex(LB))continue;int Bone=Section.BoneMap[LB];if(!Mat.IsValidIndex(Bone))continue;for(int X=0;X<3;X++)for(int Y=0;Y<3;Y++)B.M[X][Y]+=Mat[Bone].M[X][Y]*W;Sum+=W;}auto Ref=L.StaticVertexBuffers.PositionVertexBuffer.VertexPosition(I);Rows+=FString::Printf(TEXT("%u,%.9f,%.9f,%.9f"),I,Ref.X,Ref.Y,Ref.Z);for(int X=0;X<3;X++)for(int Y=0;Y<3;Y++)Rows+=FString::Printf(TEXT(",%.10f"),Sum>0?B.M[X][Y]/Sum:(X==Y?1.f:0.f));Rows+=TEXT("\n");}FFileHelper::SaveStringToFile(Rows,*FString::Printf(TEXT("%s/%s_linear_0000.csv"),*Folder,*C->GetName()));}
  }else C->GetCPUSkinnedVertices(V,0);const auto* Ind=L.MultiSizeIndexContainer.GetIndexBuffer();FString Obj;
   for(const auto& P:V){FVector Q=C->GetComponentTransform().TransformPosition(FVector(P.Position));Obj+=FString::Printf(TEXT("v %.8f %.8f %.8f\n"),Q.X,Q.Y,Q.Z);}for(uint32 I=0;I+2<Ind->Num();I+=3)Obj+=FString::Printf(TEXT("f %u %u %u\n"),Ind->Get(I)+1,Ind->Get(I+1)+1,Ind->Get(I+2)+1);FFileHelper::SaveStringToFile(Obj,*FString::Printf(TEXT("%s/%s_%04d.obj"),*Folder,*C->GetName(),F));
   if(!GUsingNullRHI){   FString Normals;for(const auto& P:V){FVector N=C->GetComponentTransform().TransformVectorNoScale(P.TangentZ.ToFVector()).GetSafeNormal();Normals+=FString::Printf(TEXT("%.8f,%.8f,%.8f\n"),N.X,N.Y,N.Z);}FFileHelper::SaveStringToFile(Normals,*FString::Printf(TEXT("%s/%s_%04d.normals.csv"),*Folder,*C->GetName(),F));
}
   if(!First)Report+=TEXT(",");First=false;FVector Neck=C->GetBoneLocation(TEXT("neck_01"));Report+=FString::Printf(TEXT("{\"name\":\"%s\",\"vertices\":%d,\"mesh\":\"%s\",\"anim\":\"%s\",\"postprocess\":\"%s\",\"neck\":[%f,%f,%f]}"),*C->GetName(),V.Num(),*Mesh->GetPathName(),C->GetAnimInstance()?*C->GetAnimInstance()->GetClass()->GetPathName():TEXT("none"),C->GetPostProcessInstance()?*C->GetPostProcessInstance()->GetClass()->GetPathName():TEXT("none"),Neck.X,Neck.Y,Neck.Z);
  }
  Report+=TEXT("]}");
 }A->Destroy();return Report+TEXT("]}");
}

UAnimSequence* UKateFaceTools::CreateShoulderTest(USkeletalMesh* Mesh,const FString& AssetPath,float ClavicleDegrees) {
 auto* Package=CreatePackage(*AssetPath);auto* Seq=NewObject<UAnimSequence>(Package,FName(FPackageName::GetShortName(AssetPath)),RF_Public|RF_Standalone);
 Seq->SetSkeleton(Mesh->GetSkeleton());Seq->SetRetargetSourceAsset(Mesh);Seq->UpdateRetargetSourceAssetData();Seq->SetPreviewMesh(Mesh);
 const auto& Ref=Mesh->GetRefSkeleton();auto Global=Ref.GetRefBonePose();for(int I=0;I<Global.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)Global[I]=Global[I]*Global[P];}
 TArray<TArray<FVector3f>> Pos,Scale;TArray<TArray<FQuat4f>> Rot;Pos.SetNum(Ref.GetNum());Scale.SetNum(Ref.GetNum());Rot.SetNum(Ref.GetNum());
 FVector Lateral=(Global[Ref.FindBoneIndex(TEXT("upperarm_r"))].GetTranslation()-Global[Ref.FindBoneIndex(TEXT("upperarm_l"))].GetTranslation()).GetSafeNormal();FVector Forward=FVector::CrossProduct(Lateral,FVector::UpVector).GetSafeNormal();FVector Bend=FVector::CrossProduct(-FVector::UpVector,Forward).GetSafeNormal();
 int BL=Ref.FindBoneIndex(TEXT("ball_l")),BR=Ref.FindBoneIndex(TEXT("ball_r"));
 for(int Frame=0;Frame<=240;Frame++){
  int Part=FMath::Min(Frame/80,2);float T=(Frame-Part*80)/80.f;float Wave=FMath::Square(FMath::Sin(PI*T));auto Local=Ref.GetRefBonePose();TMap<FName,float> Angles;
  for(int Side=0;Side<2;Side++)if(Part==0 || Part==Side+1){FString S=Side==0?TEXT("l"):TEXT("r");float A=(Part==0?70.f:90.f)*Wave;Angles.Add(FName(TEXT("thigh_")+S),A);Angles.Add(FName(TEXT("calf_")+S),-A*(Part==0?110.f/70.f:1.05f));Angles.Add(FName(TEXT("foot_")+S),A*(Part==0?40.f/70.f:.05f));}
  if(Part==0)Angles.Add(TEXT("spine_01"),-10.f*Wave);
  for(const auto& KV:Angles){int I=Ref.FindBoneIndex(KV.Key);int P=Ref.GetParentIndex(I);FQuat Parent=P>=0?Global[P].GetRotation():FQuat::Identity;FQuat D(Bend,FMath::DegreesToRadians(KV.Value));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  for(int Side=0;Side<2;Side++)if(Part==0 || Part==Side+1){FString S=Side==0?TEXT("l"):TEXT("r");int U=Ref.FindBoneIndex(FName(TEXT("upperarm_")+S));int E=Ref.FindBoneIndex(FName(TEXT("lowerarm_")+S));FVector Arm=(Global[E].GetTranslation()-Global[U].GetTranslation()).GetSafeNormal();FVector Axis=FVector::CrossProduct(Arm,FVector::UpVector).GetSafeNormal();for(FName Bone:{FName(TEXT("clavicle_")+S),FName(TEXT("upperarm_")+S)}){int I=Ref.FindBoneIndex(Bone);int P=Ref.GetParentIndex(I);FQuat Parent=Global[P].GetRotation();FQuat D(Axis,FMath::DegreesToRadians((I==U?95.f:ClavicleDegrees)*Wave));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}}
  if(Part>0){int I=Ref.FindBoneIndex(TEXT("spine_02"));FQuat Parent=Global[Ref.GetParentIndex(I)].GetRotation();FQuat D(FVector::UpVector,FMath::DegreesToRadians((Part==1?12.f:-12.f)*Wave));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  if(Part==0){auto FK=Local;for(int I=0;I<FK.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)FK[I]=FK[I]*FK[P];}FVector Delta=(Global[BL].GetTranslation()+Global[BR].GetTranslation()-FK[BL].GetTranslation()-FK[BR].GetTranslation())*.5;Local[0].AddToTranslation(Delta);}
  for(int I=0;I<Local.Num();I++){Pos[I].Add(FVector3f(Local[I].GetTranslation()));Rot[I].Add(FQuat4f(Local[I].GetRotation()));Scale[I].Add(FVector3f(Local[I].GetScale3D()));}
 }
 auto& C=Seq->GetController();C.InitializeModel();C.OpenBracket(FText::FromString(TEXT("Kate native hip motion")),false);C.SetFrameRate(FFrameRate(30,1),false);C.SetNumberOfFrames(FFrameNumber(240),false);
 for(int I=0;I<Ref.GetNum();I++){C.AddBoneCurve(Ref.GetBoneName(I),false);C.SetBoneTrackKeys(Ref.GetBoneName(I),Pos[I],Rot[I],Scale[I],false);}C.NotifyPopulated();C.CloseBracket(false);Seq->MarkPackageDirty();return Seq;
}


#include "AnimGraphNode_CopyPoseFromMesh.h"
FString UKateFaceTools::SetAssemblyFace(UBlueprint* Blueprint,USkeletalMesh* Mesh){
 int Count=0;FString Names;for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(auto* C=Cast<USkeletalMeshComponent>(N->ComponentTemplate)){
  Names+=N->GetVariableName().ToString()+TEXT(";");if(!N->GetVariableName().ToString().Equals(TEXT("Face"),ESearchCase::IgnoreCase))continue;
  auto Class=C->GetAnimClass();auto* Main=Class?Cast<UAnimBlueprint>(Class->ClassGeneratedBy):nullptr;C->SetSkeletalMesh(Mesh);Count++;
  if(Main && Blueprint->GetName().Contains(TEXT("Sumi"))){
   FString Path=Blueprint->GetOutermost()->GetName()+TEXT("_FaceFollow");auto* Follow=LoadObject<UAnimBlueprint>(nullptr,*(Path+TEXT(".")+FPackageName::GetShortName(Path)));
   if(!Follow){Follow=DuplicateObject<UAnimBlueprint>(Main,CreatePackage(*Path),*FPackageName::GetShortName(Path));Follow->SetFlags(RF_Public|RF_Standalone);FAssetRegistryModule::AssetCreated(Follow);}
   Follow->TargetSkeleton=Mesh->GetSkeleton();TArray<UEdGraph*> Graphs;Follow->GetAllGraphs(Graphs);int Nodes=0;
   for(auto* G:Graphs)for(auto& Entry:G->Nodes)if(auto* Copy=Cast<UAnimGraphNode_CopyPoseFromMesh>(Entry.Get())){Copy->Node.bCopyCurves=true;Nodes++;}
   if(!Nodes)return TEXT("no CopyPose nodes in face main blueprint");FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Follow);FKismetEditorUtilities::CompileBlueprint(Follow);if(Follow->Status==BS_Error)return TEXT("face follow compile failed");Follow->MarkPackageDirty();C->SetAnimInstanceClass(Follow->GeneratedClass.Get());
  }
 }
 if(Count!=1)return TEXT("Failed face count: ")+FString::FromInt(Count)+TEXT(" nodes: ")+Names;
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();return Blueprint->Status==BS_Error?TEXT("Compile failed"):TEXT("ok");
}

bool UKateFaceTools::ApplyVertexOffsets(USkeletalMesh* Mesh,int32 LOD,const FString& CSV,bool Finalize){
 auto* D=Mesh->GetMeshDescription(LOD);if(!D)return false;auto Pos=D->GetVertexPositions();TMap<FVertexID,FVector3f> Before,OldN,NewN;TSet<FVertexID> Boundary;
 for(FVertexID I:D->Vertices().GetElementIDs()){Before.Add(I,Pos[I]);OldN.Add(I,FVector3f::ZeroVector);NewN.Add(I,FVector3f::ZeroVector);}
 for(FEdgeID E:D->Edges().GetElementIDs())if(D->GetEdgeConnectedTriangles(E).Num()==1){auto V=D->GetEdgeVertices(E);Boundary.Add(V[0]);Boundary.Add(V[1]);}
 FString T;if(!FFileHelper::LoadFileToString(T,*CSV))return false;TArray<FString> Rows;T.ParseIntoArrayLines(Rows);for(auto& Row:Rows){TArray<FString>A;Row.ParseIntoArray(A,TEXT(","));if(A.Num()==4){FVertexID I(FCString::Atoi(*A[0]));Pos[I]+=FVector3f(FCString::Atof(*A[1]),FCString::Atof(*A[2]),FCString::Atof(*A[3]));}}
 for(FTriangleID I:D->Triangles().GetElementIDs()){auto V=D->GetTriangleVertices(I);FVector3f O=FVector3f::CrossProduct(Before[V[1]]-Before[V[0]],Before[V[2]]-Before[V[0]]),N=FVector3f::CrossProduct(Pos[V[1]]-Pos[V[0]],Pos[V[2]]-Pos[V[0]]);for(auto X:V){OldN[X]+=O;NewN[X]+=N;}}
 FStaticMeshAttributes Attr(*D);auto Norm=Attr.GetVertexInstanceNormals();auto Tang=Attr.GetVertexInstanceTangents();
 for(FVertexInstanceID VI:D->VertexInstances().GetElementIDs()){FVertexID V=D->GetVertexInstanceVertex(VI);if(Boundary.Contains(V))continue;FVector3f O=OldN[V].GetSafeNormal(),N=NewN[V].GetSafeNormal();if(!O.IsNearlyZero()&&!N.IsNearlyZero()){FQuat4f Q=FQuat4f::FindBetweenNormals(O,N);Norm[VI]=Q.RotateVector(Norm[VI]);Tang[VI]=Q.RotateVector(Tang[VI]);}}
 Mesh->CommitMeshDescription(LOD);if(Finalize)Mesh->PostEditChange();Mesh->MarkPackageDirty();return true;
}

UAnimSequence* UKateFaceTools::CreateNeckMotion(USkeletalMesh* Mesh,const FString& AssetPath) {
 auto* Package=CreatePackage(*AssetPath);auto* Seq=NewObject<UAnimSequence>(Package,FName(FPackageName::GetShortName(AssetPath)),RF_Public|RF_Standalone);
 Seq->SetSkeleton(Mesh->GetSkeleton());Seq->SetRetargetSourceAsset(Mesh);Seq->UpdateRetargetSourceAssetData();Seq->SetPreviewMesh(Mesh);
 const auto& Ref=Mesh->GetRefSkeleton();auto Global=Ref.GetRefBonePose();for(int I=0;I<Global.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)Global[I]=Global[I]*Global[P];}
 TArray<TArray<FVector3f>> Pos,Scale;TArray<TArray<FQuat4f>> Rot;Pos.SetNum(Ref.GetNum());Scale.SetNum(Ref.GetNum());Rot.SetNum(Ref.GetNum());
 FVector Lateral=(Global[Ref.FindBoneIndex(TEXT("upperarm_r"))].GetTranslation()-Global[Ref.FindBoneIndex(TEXT("upperarm_l"))].GetTranslation()).GetSafeNormal();FVector Forward=FVector::CrossProduct(Lateral,FVector::UpVector).GetSafeNormal();FVector Bend=FVector::CrossProduct(-FVector::UpVector,Forward).GetSafeNormal();
 int BL=Ref.FindBoneIndex(TEXT("ball_l")),BR=Ref.FindBoneIndex(TEXT("ball_r"));
 for(int Frame=0;Frame<=240;Frame++){
  int Part=FMath::Min(Frame/80,2);float T=(Frame-Part*80)/80.f;float Wave=FMath::Square(FMath::Sin(PI*T));auto Local=Ref.GetRefBonePose();TMap<FName,float> Angles;
  if(Part>0)Angles.Add(TEXT("neck_01"),(Part==1?25.f:-20.f)*Wave);
  for(const auto& KV:Angles){int I=Ref.FindBoneIndex(KV.Key);int P=Ref.GetParentIndex(I);FQuat Parent=P>=0?Global[P].GetRotation():FQuat::Identity;FQuat D(Bend,FMath::DegreesToRadians(KV.Value));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  if(Part==0){int I=Ref.FindBoneIndex(TEXT("head"));FQuat Parent=Global[Ref.GetParentIndex(I)].GetRotation();FQuat D(FVector::UpVector,FMath::DegreesToRadians(45.f*Wave));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  if(Part==0){auto FK=Local;for(int I=0;I<FK.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)FK[I]=FK[I]*FK[P];}FVector Delta=(Global[BL].GetTranslation()+Global[BR].GetTranslation()-FK[BL].GetTranslation()-FK[BR].GetTranslation())*.5;Local[0].AddToTranslation(Delta);}
  for(int I=0;I<Local.Num();I++){Pos[I].Add(FVector3f(Local[I].GetTranslation()));Rot[I].Add(FQuat4f(Local[I].GetRotation()));Scale[I].Add(FVector3f(Local[I].GetScale3D()));}
 }
 auto& C=Seq->GetController();C.InitializeModel();C.OpenBracket(FText::FromString(TEXT("Kate native hip motion")),false);C.SetFrameRate(FFrameRate(30,1),false);C.SetNumberOfFrames(FFrameNumber(240),false);
 for(int I=0;I<Ref.GetNum();I++){C.AddBoneCurve(Ref.GetBoneName(I),false);C.SetBoneTrackKeys(Ref.GetBoneName(I),Pos[I],Rot[I],Scale[I],false);}C.NotifyPopulated();C.CloseBracket(false);Seq->MarkPackageDirty();return Seq;
}



bool UKateFaceTools::SetVertexNormals(USkeletalMesh* Mesh,int32 LOD,const FString& CSV,bool Finalize){
 auto* D=Mesh->GetMeshDescription(LOD);if(!D)return false;FString T;if(!FFileHelper::LoadFileToString(T,*CSV))return false;TMap<int32,FVector3f> Map;TArray<FString> Rows;T.ParseIntoArrayLines(Rows);for(auto& R:Rows){TArray<FString>A;R.ParseIntoArray(A,TEXT(","));if(A.Num()==4)Map.Add(FCString::Atoi(*A[0]),FVector3f(FCString::Atof(*A[1]),FCString::Atof(*A[2]),FCString::Atof(*A[3])).GetSafeNormal());}
 FStaticMeshAttributes Attr(*D);auto Norm=Attr.GetVertexInstanceNormals();auto Tang=Attr.GetVertexInstanceTangents();for(FVertexInstanceID VI:D->VertexInstances().GetElementIDs())if(auto* N=Map.Find(D->GetVertexInstanceVertex(VI).GetValue())){FQuat4f Q=FQuat4f::FindBetweenNormals(Norm[VI].GetSafeNormal(),*N);Norm[VI]=*N;Tang[VI]=Q.RotateVector(Tang[VI]);}
 Mesh->CommitMeshDescription(LOD);if(Finalize)Mesh->PostEditChange();Mesh->MarkPackageDirty();return true;
}

FString UKateFaceTools::ExportAssemblyRange(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,const FString& Folder,float StartSeconds,float EndSeconds,float FPS){
 auto* A=World->SpawnActor<AActor>(Blueprint->GeneratedClass.Get(),FTransform::Identity);if(!A)return TEXT("{}");if(Folder.Contains(TEXT("inverted"))){A->SetActorRotation(FRotator(0,0,180));A->SetActorLocation(FVector(0,0,175));}TArray<USkeletalMeshComponent*> Comps;A->GetComponents(Comps);USkeletalMeshComponent* Body=nullptr;
 for(auto* C:Comps)if(C->GetName().Equals(TEXT("Body"),ESearchCase::IgnoreCase))Body=C;if(!Body){A->Destroy();return TEXT("{}");}
 Body->SetAnimationMode(EAnimationMode::AnimationSingleNode);Body->SetAnimation(Seq);Body->Stop();
 for(auto* C:Comps){C->SetForcedLOD(1);C->VisibilityBasedAnimTickOption=EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;C->SetUpdateAnimationInEditor(true);}
 IFileManager::Get().MakeDirectory(*Folder,true);FString Report=TEXT("{\"body_mesh\":\"")+Body->GetSkeletalMeshAsset()->GetPathName()+TEXT("\",\"frames\":[");
 const float End=FMath::Min(EndSeconds,Seq->GetPlayLength());const int32 Total=FMath::CeilToInt((End-StartSeconds)*FPS);
 for(int F=0;F<=Total;F++){if((Folder.Contains(TEXT("dynamics-roll")) || Folder.Contains(TEXT("dynamics-video-roll")))){float U=FMath::Clamp((F/FPS-1.f)/3.f,0.f,1.f);U=U*U*(3-2*U);FRotator R(0,0,180.f*U);A->SetActorRotation(R);A->SetActorLocation(FVector(0,0,165)-R.RotateVector(FVector(0,0,165)));}const float Time=FMath::Min(End,StartSeconds+F/FPS);Body->SetPosition((Folder.Contains(TEXT("dynamics-roll")) || Folder.Contains(TEXT("dynamics-video-roll")))?0.f:Time,false);for(auto* C:Comps)if(C->GetName().Contains(TEXT("HairRig"))){if(auto* H=C->GetSingleNodeInstance();H && H->GetLength()>KINDA_SMALL_NUMBER){H->SetPlaying(false);H->SetPosition(FMath::Fmod(Time,H->GetLength()),false);}}
  for(int Warm=0;Warm<(Folder.Contains(TEXT("dynamics"))?(F==0?120:1):3);Warm++){Body->TickAnimation(Folder.Contains(TEXT("dynamics"))?1.f/FPS:1.f/30,false);Body->RefreshBoneTransforms();Body->UpdateComponentToWorld();for(auto* C:Comps)if(C!=Body && C->GetSkeletalMeshAsset()){C->TickAnimation(Folder.Contains(TEXT("dynamics"))?1.f/FPS:1.f/30,false);C->RefreshBoneTransforms();C->UpdateComponentToWorld();}}
  if(F)Report+=TEXT(",");Report+=FString::Printf(TEXT("{\"frame\":%d,\"time\":%f,\"hip_l\":%f,\"hip_r\":%f,\"components\":["),F,Time,Body->GetPostProcessInstance()?Body->GetPostProcessInstance()->GetCurveValue(TEXT("KateHip_l")):0.f,Body->GetPostProcessInstance()?Body->GetPostProcessInstance()->GetCurveValue(TEXT("KateHip_r")):0.f);bool First=true;
  for(auto* C:Comps)if(auto* Mesh=C->GetSkeletalMeshAsset()){const FString OutputName=C->GetName().Contains(TEXT("HairRig"))?TEXT("Hair"):C->GetName();
   TArray<FFinalSkinVertex> V;C->GetCPUSkinnedVertices(V,0);const auto& L=Mesh->GetResourceForRendering()->LODRenderData[0];const auto* Ind=L.MultiSizeIndexContainer.GetIndexBuffer();if(Folder.Contains(TEXT("video-binary"))){
    TArray<float> Data;Data.Reserve(V.Num()*6);for(const auto& P:V){FVector Q=C->GetComponentTransform().TransformPosition(FVector(P.Position)),N=C->GetComponentTransform().TransformVectorNoScale(P.TangentZ.ToFVector()).GetSafeNormal();Data.Append({float(Q.X),float(Q.Y),float(Q.Z),float(N.X),float(N.Y),float(N.Z)});}
    FFileHelper::SaveArrayToFile(MakeArrayView(reinterpret_cast<const uint8*>(Data.GetData()),Data.Num()*sizeof(float)),*FString::Printf(TEXT("%s/%s_%04d.bin"),*Folder,*OutputName,F));
    if(F==0){TArray<uint32> Tri;Tri.Reserve(Ind->Num());for(uint32 I=0;I<Ind->Num();I++)Tri.Add(Ind->Get(I));FFileHelper::SaveArrayToFile(MakeArrayView(reinterpret_cast<const uint8*>(Tri.GetData()),Tri.Num()*sizeof(uint32)),*FString::Printf(TEXT("%s/%s.indices"),*Folder,*OutputName));}
   }else{FString Obj;
   for(const auto& P:V){FVector Q=C->GetComponentTransform().TransformPosition(FVector(P.Position));Obj+=FString::Printf(TEXT("v %.8f %.8f %.8f\n"),Q.X,Q.Y,Q.Z);}for(uint32 I=0;I+2<Ind->Num();I+=3)Obj+=FString::Printf(TEXT("f %u %u %u\n"),Ind->Get(I)+1,Ind->Get(I+1)+1,Ind->Get(I+2)+1);FFileHelper::SaveStringToFile(Obj,*FString::Printf(TEXT("%s/%s_%04d.obj"),*Folder,*OutputName,F));
   FString Normals;for(const auto& P:V){FVector N=C->GetComponentTransform().TransformVectorNoScale(P.TangentZ.ToFVector()).GetSafeNormal();Normals+=FString::Printf(TEXT("%.8f,%.8f,%.8f\n"),N.X,N.Y,N.Z);}FFileHelper::SaveStringToFile(Normals,*FString::Printf(TEXT("%s/%s_%04d.normals.csv"),*Folder,*OutputName,F));

   }
   
   if(Folder.Contains(TEXT("assembly-author"))){
    TArray<FMatrix44f> Mat;C->GetCurrentRefToLocalMatrices(Mat,0);auto* Weights=C->GetSkinWeightBuffer(0);FString Rows;
    const FMatrix44f WorldMatrix(C->GetComponentTransform().ToMatrixWithScale());
    for(const auto& S:L.RenderSections)for(uint32 I=S.BaseVertexIndex;I<S.BaseVertexIndex+S.NumVertices;I++){
     FMatrix44f Blend=FMatrix44f::Identity;for(int Row=0;Row<4;Row++)for(int Col=0;Col<4;Col++)Blend.M[Row][Col]=0;
     for(uint32 K=0;K<Weights->GetMaxBoneInfluences();K++){float W=Weights->GetBoneWeight(I,K)/65535.f;if(W>0){int BI=S.BoneMap[Weights->GetBoneIndex(I,K)];for(int Row=0;Row<3;Row++)for(int Col=0;Col<3;Col++)Blend.M[Row][Col]+=W*Mat[BI].M[Row][Col];}}
     Blend.M[3][3]=1;Blend=Blend*WorldMatrix;Rows+=FString::Printf(TEXT("%u"),I);for(int Row=0;Row<3;Row++)for(int Col=0;Col<3;Col++)Rows+=FString::Printf(TEXT(",%.10f"),Blend.M[Row][Col]);Rows+=TEXT("\n");
    }
    FFileHelper::SaveStringToFile(Rows,*FString::Printf(TEXT("%s/%s_%04d.skin.csv"),*Folder,*OutputName,F));
   }
if(!First)Report+=TEXT(",");First=false;FVector Neck=C->GetBoneLocation(TEXT("neck_01"));Report+=FString::Printf(TEXT("{\"name\":\"%s\",\"vertices\":%d,\"mesh\":\"%s\",\"anim\":\"%s\",\"postprocess\":\"%s\",\"neck\":[%f,%f,%f]}"),*C->GetName(),V.Num(),*Mesh->GetPathName(),C->GetAnimInstance()?*C->GetAnimInstance()->GetClass()->GetPathName():TEXT("none"),C->GetPostProcessInstance()?*C->GetPostProcessInstance()->GetClass()->GetPathName():TEXT("none"),Neck.X,Neck.Y,Neck.Z);
  }

  TArray<UStaticMeshComponent*> HairComponents;A->GetComponents(HairComponents);
  for(auto* C:HairComponents)if(C->GetName().Contains(TEXT("KateHair")) && C->GetStaticMesh()){
   C->UpdateComponentToWorld();const auto& L=C->GetStaticMesh()->GetRenderData()->LODResources[0];FString Obj,Normals;const FTransform Transform=C->GetComponentTransform();
   for(uint32 I=0;I<L.VertexBuffers.PositionVertexBuffer.GetNumVertices();I++){FVector V=Transform.TransformPosition(FVector(L.VertexBuffers.PositionVertexBuffer.VertexPosition(I)));Obj+=FString::Printf(TEXT("v %.8f %.8f %.8f\n"),V.X,V.Y,V.Z);FVector N=Transform.TransformVector(FVector(L.VertexBuffers.StaticMeshVertexBuffer.VertexTangentZ(I))).GetSafeNormal();Normals+=FString::Printf(TEXT("%.8f,%.8f,%.8f\n"),N.X,N.Y,N.Z);}
   const bool Flip=Transform.GetScale3D().X*Transform.GetScale3D().Y*Transform.GetScale3D().Z<0;
   for(int I=0;I+2<L.IndexBuffer.GetNumIndices();I+=3)Obj+=FString::Printf(TEXT("f %u %u %u\n"),L.IndexBuffer.GetIndex(I)+1,L.IndexBuffer.GetIndex(I+(Flip?2:1))+1,L.IndexBuffer.GetIndex(I+(Flip?1:2))+1);
   FFileHelper::SaveStringToFile(Obj,*FString::Printf(TEXT("%s/Hair_%04d.obj"),*Folder,F));FFileHelper::SaveStringToFile(Normals,*FString::Printf(TEXT("%s/Hair_%04d.normals.csv"),*Folder,F));
  }

  Report+=TEXT("]}");
 }A->Destroy();return Report+TEXT("]}");
}

#include "Engine/SceneCapture2D.h"
#include "Components/SceneCaptureComponent2D.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Engine/DirectionalLight.h"
#include "Components/DirectionalLightComponent.h"
#include "Materials/MaterialInterface.h"
#include "ImageUtils.h"
#include "RenderingThread.h"
#include "AssetCompilingManager.h"
#include "TextureCompiler.h"
#include "MaterialShared.h"
#include "ShaderCompiler.h"
bool UKateFaceTools::ConfigureArmpitNormals(USkeletalMesh* Mesh){
 if(!Mesh)return false;
 for(int L=0;L<Mesh->GetLODNum();L++){
  auto* D=Mesh->GetMeshDescription(L);if(!D)return false;FStaticMeshAttributes Attr(*D);auto Colors=Attr.GetVertexInstanceColors();auto Pos=D->GetVertexPositions();TArray<FVector3f> Boundary;for(FEdgeID E:D->Edges().GetElementIDs())if(D->GetNumEdgeConnectedTriangles(E)==1){Boundary.AddUnique(Pos[D->GetEdgeVertex(E,0)]);Boundary.AddUnique(Pos[D->GetEdgeVertex(E,1)]);}
  auto Ramp=[](float T){T=FMath::Clamp(T,0.f,1.f);return T*T*(3-2*T);};
  for(FVertexInstanceID I:D->VertexInstances().GetElementIDs()){auto P=Pos[D->GetVertexInstanceVertex(I)];float X=FMath::Abs(P.X);float Mask=Ramp((X-12)/5)*Ramp((39-X)/7)*Ramp((P.Z-107)/9)*Ramp((145-P.Z)/7);float Dist=10000;for(auto B:Boundary)Dist=FMath::Min(Dist,(P-B).Length());Mask*=Ramp((Dist-.5f)/3.f);auto C=Colors[I];C.Z=Mask;Colors[I]=C;}
  Mesh->GetLODInfo(L)->SkinCacheUsage=ESkinCacheUsage::Enabled;Mesh->CommitMeshDescription(L);
 }
 Mesh->SetHasVertexColors(true);Mesh->PostEditChange();Mesh->MarkPackageDirty();return true;
}
bool UKateFaceTools::CaptureAssemblyPose(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,float Time,const FString& File){
 auto* A=World->SpawnActor<AActor>(Blueprint->GeneratedClass.Get(),FTransform::Identity);if(!A)return false;TArray<USkeletalMeshComponent*> Comps;A->GetComponents(Comps);USkeletalMeshComponent* Body=nullptr;
 auto* Clay=LoadObject<UMaterialInterface>(nullptr,TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
 for(auto* C:Comps){if(C->GetName().Equals(TEXT("Body"),ESearchCase::IgnoreCase))Body=C;C->SetForcedLOD(1);C->VisibilityBasedAnimTickOption=EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;C->SetUpdateAnimationInEditor(true);for(int M=0;M<C->GetNumMaterials();M++)C->SetMaterial(M,Clay);}
 if(!Body){A->Destroy();return false;}Body->SetAnimationMode(EAnimationMode::AnimationSingleNode);Body->SetAnimation(Seq);Body->Stop();Body->SetPosition(Time,false);
 TArray<ADirectionalLight*> Lights;
 for(int I=0;I<3;I++){auto* Light=World->SpawnActor<ADirectionalLight>();Light->SetActorRotation(I==0?FRotator(-35,-55,0):(I==1?FRotator(-15,145,0):FRotator(-60,60,0)));Light->GetLightComponent()->SetIntensity(I==0?3.f:1.f);Light->GetLightComponent()->SetCastShadows(false);Lights.Add(Light);}
 auto* Capture=World->SpawnActor<ASceneCapture2D>();auto* C=Capture->GetCaptureComponent2D();C->bCaptureEveryFrame=false;C->bCaptureOnMovement=false;C->ProjectionType=ECameraProjectionMode::Orthographic;C->OrthoWidth=110;FVector Center(0,3,146),Location=Center+FVector(-220,500,25);Capture->SetActorLocation(Location);Capture->SetActorRotation((Center-Location).Rotation());
 auto* RT=NewObject<UTextureRenderTarget2D>();RT->RenderTargetFormat=RTF_RGBA8;RT->ClearColor=FLinearColor(.12,.12,.12,1);RT->InitAutoFormat(800,900);RT->UpdateResourceImmediate(true);C->TextureTarget=RT;C->CaptureSource=ESceneCaptureSource::SCS_FinalColorLDR;C->PostProcessSettings.bOverride_AutoExposureMethod=true;C->PostProcessSettings.AutoExposureMethod=EAutoExposureMethod::AEM_Manual;C->PostProcessSettings.bOverride_AutoExposureBias=true;C->PostProcessSettings.AutoExposureBias=1.f;
 Clay->EnsureIsComplete();
 for(int I=0;I<8;I++){Body->TickAnimation(1.f/30,false);Body->RefreshBoneTransforms();Body->UpdateComponentToWorld();for(auto* O:Comps)if(O!=Body&&O->GetSkeletalMeshAsset()){O->TickAnimation(1.f/30,false);O->RefreshBoneTransforms();O->UpdateComponentToWorld();}for(auto* O:Comps)O->MarkRenderDynamicDataDirty();World->SendAllEndOfFrameUpdates();FlushRenderingCommands();C->CaptureScene();FlushRenderingCommands();}
 TArray<FColor> Pixels;bool OK=RT->GameThread_GetRenderTargetResource()->ReadPixels(Pixels);if(OK){TArray64<uint8> PNG;FImageUtils::PNGCompressImageArray(800,900,Pixels,PNG);OK=FFileHelper::SaveArrayToFile(PNG,*File);}Capture->Destroy();for(auto* L:Lights)L->Destroy();A->Destroy();return OK;
}

bool UKateFaceTools::CaptureAssemblyMaterialPose(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,float Time,const FString& File,float ViewYaw,float LightYaw,int32 Buffer){
 auto* A=World->SpawnActor<AActor>(Blueprint->GeneratedClass.Get(),FTransform::Identity);if(!A)return false;TArray<USkeletalMeshComponent*> Comps;A->GetComponents(Comps);USkeletalMeshComponent* Body=nullptr;
 auto* Clay=LoadObject<UMaterialInterface>(nullptr,TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
 for(auto* C:Comps){if(C->GetName().Equals(TEXT("Body"),ESearchCase::IgnoreCase))Body=C;C->SetForcedLOD(1);C->VisibilityBasedAnimTickOption=EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;C->SetUpdateAnimationInEditor(true);for(int M=0;M<C->GetNumMaterials();M++)if(auto* Mat=C->GetMaterial(M))Mat->EnsureIsComplete();}
 if(!Body){A->Destroy();return false;}Body->SetAnimationMode(EAnimationMode::AnimationSingleNode);Body->SetAnimation(Seq);Body->Stop();Body->SetPosition(Time,false);
 TArray<ADirectionalLight*> Lights;
 for(int I=0;I<4;I++){auto* Light=World->SpawnActor<ADirectionalLight>();Light->SetActorRotation(I==0?FRotator(-35,LightYaw,0):(I==1?FRotator(0,-90,0):(I==2?FRotator(-15,-130,0):FRotator(30,-90,0))));Light->GetLightComponent()->SetIntensity(I==0?3.f:(I==1?2.f:(I==2?1.f:.5f)));Light->GetLightComponent()->SetCastShadows(false);Lights.Add(Light);}
 auto* Capture=World->SpawnActor<ASceneCapture2D>();auto* C=Capture->GetCaptureComponent2D();C->bCaptureEveryFrame=false;C->bCaptureOnMovement=false;C->ProjectionType=ECameraProjectionMode::Orthographic;C->OrthoWidth=95;FVector Center(0,3,111),Location=Center+FVector(500*FMath::Sin(FMath::DegreesToRadians(ViewYaw)),500*FMath::Cos(FMath::DegreesToRadians(ViewYaw)),0);Capture->SetActorLocation(Location);Capture->SetActorRotation((Center-Location).Rotation());
 auto* RT=NewObject<UTextureRenderTarget2D>();RT->RenderTargetFormat=RTF_RGBA8;RT->ClearColor=FLinearColor(.12,.12,.12,1);RT->InitAutoFormat(600,700);RT->UpdateResourceImmediate(true);C->TextureTarget=RT;C->CaptureSource=Buffer==1?ESceneCaptureSource::SCS_BaseColor:(Buffer==2?ESceneCaptureSource::SCS_Normal:ESceneCaptureSource::SCS_FinalColorLDR);C->PostProcessSettings.bOverride_AutoExposureMethod=true;C->PostProcessSettings.AutoExposureMethod=EAutoExposureMethod::AEM_Manual;C->PostProcessSettings.bOverride_AutoExposureBias=true;C->PostProcessSettings.AutoExposureBias=1.5f;
 FTextureCompilingManager::Get().FinishAllCompilation();
 TSet<UMaterialInterface*> Required;
 for(auto* O:Comps)for(int M=0;M<O->GetNumMaterials();M++)if(auto* Mat=O->GetMaterial(M))Required.Add(Mat);
 for(auto* Mat:Required){
  auto* Resource=Mat->GetMaterialResource(GMaxRHIShaderPlatform);
  if(!Resource){UE_LOG(LogTemp,Error,TEXT("Capture: missing resource %s"),*Mat->GetPathName());return false;}
  Resource->SubmitCompileJobs_GameThread(EShaderCompileJobPriority::ForceLocal);
  Resource->FinishCompilation();
  UE_LOG(LogTemp,Display,TEXT("Capture: ready %s complete=%d"),*Mat->GetPathName(),Resource->IsGameThreadShaderMapComplete());
  if(!Resource->IsGameThreadShaderMapComplete())return false;
 }
 for(auto* O:Comps)O->MarkRenderStateDirty();
 World->SendAllEndOfFrameUpdates();FlushRenderingCommands();
 Clay->EnsureIsComplete();
 for(int I=0;I<8;I++){Body->TickAnimation(1.f/30,false);Body->RefreshBoneTransforms();Body->UpdateComponentToWorld();for(auto* O:Comps)if(O!=Body&&O->GetSkeletalMeshAsset()){O->TickAnimation(1.f/30,false);O->RefreshBoneTransforms();O->UpdateComponentToWorld();}for(auto* O:Comps)O->MarkRenderDynamicDataDirty();World->SendAllEndOfFrameUpdates();FlushRenderingCommands();C->CaptureScene();FlushRenderingCommands();}
 TArray<FColor> Pixels;bool OK=RT->GameThread_GetRenderTargetResource()->ReadPixels(Pixels);if(OK){TArray64<uint8> PNG;FImageUtils::PNGCompressImageArray(600,700,Pixels,PNG);OK=FFileHelper::SaveArrayToFile(PNG,*File);}Capture->Destroy();for(auto* L:Lights)L->Destroy();A->Destroy();return OK;
}

FString UKateFaceTools::SmoothFaceWeights(USkeletalMesh* Mesh,float Strength,int32 Iterations) {
 if(!Mesh)return TEXT("missing mesh");FString Report=TEXT("[");int BaseN=0;
 const auto& Ref=Mesh->GetRefSkeleton();
 for(int L=0;L<Mesh->GetLODNum();L++){
  auto* D=Mesh->GetMeshDescription(L);if(!D)return TEXT("missing mesh description LOD ")+FString::FromInt(L);
  auto P=D->GetVertexPositions();auto Skin=FSkeletalMeshAttributes(*D).GetVertexSkinWeights();int N=D->Vertices().GetArraySize();if(L==0)BaseN=N;
  TArray<TMap<int32,float>> W;W.SetNum(N);TArray<TArray<int32>> Adj;Adj.SetNum(N);TArray<float> Mask;Mask.Init(0,N);TSet<int32> SkinIds;
  for(FTriangleID T:D->Triangles().GetElementIDs())if(D->GetTrianglePolygonGroup(T).GetValue()==0){auto V=D->GetTriangleVertices(T);for(int I=0;I<3;I++){SkinIds.Add(V[I].GetValue());Adj[V[I].GetValue()].AddUnique(V[(I+1)%3].GetValue());Adj[V[(I+1)%3].GetValue()].AddUnique(V[I].GetValue());}}
  auto Ramp=[](float X){X=FMath::Clamp(X,0.f,1.f);return X*X*(3-2*X);};
  TMap<FString,TArray<int32>> Coincident;int MaxInfluences=0;
  for(FVertexID V:D->Vertices().GetElementIDs()){
   int I=V.GetValue();float Region=0,Rim=0;FString WeightKey;
   for(const auto& B:Skin.Get(V)){int BI=B.GetBoneIndex();float BW=B.GetWeight();W[I].Add(BI,BW);FString Name=Ref.GetBoneName(BI).ToString();
    if(Name.Contains(TEXT("Cheek"))||Name.Contains(TEXT("Nasolabial"))||Name.Contains(TEXT("EyelidUpperB"))||Name.Contains(TEXT("EyelidLowerB"))||Name.Contains(TEXT("EyelidUpperFurrow")))Region+=BW;
    if(Name.Contains(TEXT("EyelidUpperA"))||Name.Contains(TEXT("EyelidLowerA")))Rim+=BW;
    WeightKey+=FString::Printf(TEXT(";%d:%d"),BI,B.GetRawWeight());
   }
   MaxInfluences=FMath::Max(MaxInfluences,W[I].Num());
   if(SkinIds.Contains(I)){Mask[I]=Ramp(Region/.65f)*(1-Ramp(Rim/.65f));auto Q=P[V];Coincident.FindOrAdd(FString::Printf(TEXT("%.4f,%.4f,%.4f"),Q.X,Q.Y,Q.Z)+WeightKey).Add(I);}
  }
  for(const auto& Pair:Coincident)if(Pair.Value.Num()>1){TArray<int32> Union;for(int I:Pair.Value){Union.AddUnique(I);for(int J:Adj[I])Union.AddUnique(J);}for(int I:Pair.Value)Adj[I]=Union;}
  int Its=FMath::Max(1,FMath::RoundToInt(Iterations*FMath::Sqrt(float(N)/BaseN)));auto Original=W;
  for(int It=0;It<Its;It++){auto Next=W;for(int I:SkinIds)if(Mask[I]>.001f && Adj[I].Num()>0){float A=Strength*Mask[I];TMap<int32,float> Avg;for(int J:Adj[I])for(const auto& K:W[J])Avg.FindOrAdd(K.Key)+=K.Value/Adj[I].Num();Next[I].Empty();for(const auto& K:W[I])Next[I].FindOrAdd(K.Key)+=(1-A)*K.Value;for(const auto& K:Avg)Next[I].FindOrAdd(K.Key)+=A*K.Value;}W=MoveTemp(Next);}
  UE::AnimationCore::FBoneWeightsSettings Settings;Settings.SetNormalizeType(UE::AnimationCore::EBoneWeightNormalizeType::Always);Settings.SetMaxWeightCount(MaxInfluences);
  int Changed=0;float MaxL1=0;for(int I:SkinIds)if(Mask[I]>.001f){TArray<UE::AnimationCore::FBoneWeight> Values;float L1=0;for(const auto& K:W[I]){Values.Add(UE::AnimationCore::FBoneWeight(K.Key,K.Value));L1+=FMath::Abs(K.Value-Original[I].FindRef(K.Key));}Skin.Set(FVertexID(I),UE::AnimationCore::FBoneWeights::Create(Values,Settings));Changed++;MaxL1=FMath::Max(MaxL1,L1);}
  Mesh->CommitMeshDescription(L);if(L)Report+=TEXT(",");Report+=FString::Printf(TEXT("{\"lod\":%d,\"vertices\":%d,\"changed\":%d,\"iterations\":%d,\"max_weight_l1\":%f}"),L,N,Changed,Its,MaxL1);
 }
 Mesh->PostEditChange();Mesh->MarkPackageDirty();return Report+TEXT("]");
}

FString UKateFaceTools::DumpMeshSections(USkeletalMesh* Mesh,int32 LOD){
 if(!Mesh || LOD<0 || LOD>=Mesh->GetLODNum())return TEXT("[]");
 const auto& Data=Mesh->GetResourceForRendering()->LODRenderData[LOD];FString R=TEXT("[");
 for(int I=0;I<Data.RenderSections.Num();I++){const auto& S=Data.RenderSections[I];if(I)R+=TEXT(",");FString Name=Mesh->GetMaterials().IsValidIndex(S.MaterialIndex)?Mesh->GetMaterials()[S.MaterialIndex].MaterialSlotName.ToString():TEXT("unknown");
 R+=FString::Printf(TEXT("{\"section\":%d,\"material\":%d,\"name\":\"%s\",\"first_triangle\":%u,\"triangles\":%u}"),I,S.MaterialIndex,*Name,S.BaseIndex/3,S.NumTriangles);}
 return R+TEXT("]");
}

#include "DNA.h"
#include "DNAAssetUserData.h"
#include "DNAUtils.h"
#include "MetaHumanCharacter.h"
FString UKateFaceTools::EmbedFaceDNA(USkeletalMesh* Mesh,UMetaHumanCharacter* Character){
 if(!Mesh || !Character)return TEXT("missing mesh/character");auto Buffer=Character->GetFaceDNABuffer();auto Reader=ReadDNAFromBuffer(&Buffer,EDNADataLayer::All);
 if(!Reader.IsValid())return TEXT("no reader");auto* User=Mesh->GetAssetUserData<UDNAAssetUserData>();if(!User){User=NewObject<UDNAAssetUserData>(Mesh);Mesh->AddAssetUserData(User);}
 UDNA* Owned=NewObject<UDNA>(Mesh,NAME_None,RF_Transactional);Owned->SetDNAReader(Reader,EDNACopyPolicy::Copy,ERigLogicInitPolicy::Defer);Owned->RestoreLegacyUEMHCCompatibility();User->DNAAsset=Owned;Mesh->MarkPackageDirty();
 return FString::Printf(TEXT("{\"joints\":%d,\"raw_controls\":%d,\"blendshape_channels\":%d,\"owned_dna\":\"%s\"}"),Reader->GetJointCount(),Reader->GetRawControlCount(),Reader->GetBlendShapeChannelCount(),*Owned->GetPathName());
}

#include "AnimGraphNode_ModifyBone.h"
FString UKateFaceTools::AttachFaceRelaxation(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh,float Strength,bool EyelidsOnly,bool CornersOnly){
 if(!Blueprint || !Mesh)return TEXT("missing blueprint/mesh");
 UEdGraph* Graph=nullptr;UAnimGraphNode_Root* Root=nullptr;TArray<UEdGraph*> Graphs;Blueprint->GetAllGraphs(Graphs);
 for(auto* G:Graphs)if(G->GetFName()==TEXT("AnimGraph"))for(auto& N:G->Nodes)if(auto* R=Cast<UAnimGraphNode_Root>(N.Get())){Root=R;Graph=G;break;}
 if(!Root)return TEXT("no root");UEdGraphPin* Input=nullptr;for(auto* P:Root->Pins)if(P->Direction==EGPD_Input && P->LinkedTo.Num()==1){Input=P;break;}
 if(!Input)return TEXT("no input");auto* Previous=Input->LinkedTo[0];Input->BreakAllPinLinks();int Count=0;const auto& Ref=Mesh->GetRefSkeleton();
 for(int I=0;I<Ref.GetNum();I++){
  FString Name=Ref.GetBoneName(I).ToString();
  bool Selected=Name.Contains(TEXT("Nasolabial"))||Name.Contains(TEXT("LipLowerSkin"))||Name.Contains(TEXT("LipLowerOuterSkin"))||Name.Contains(TEXT("EyelidUpperB"))||Name.Contains(TEXT("EyelidLowerB"))||Name.Contains(TEXT("EyelidUpperFurrow"));
  if(EyelidsOnly)Selected=Name.Contains(TEXT("EyelidUpperB"))||Name.Contains(TEXT("EyelidLowerB"))||Name.Contains(TEXT("EyelidUpperFurrow"));
  if(CornersOnly)Selected=Name.Contains(TEXT("LipCorner1"))||Name.Contains(TEXT("LipCorner2"))||Name.Contains(TEXT("LipCorner3"));
  if(!Selected)continue;
  auto T=Ref.GetRefBonePose()[I];FGraphNodeCreator<UAnimGraphNode_ModifyBone> Creator(*Graph);auto* N=Creator.CreateNode();
  N->Node.BoneToModify.BoneName=Ref.GetBoneName(I);N->Node.Translation=T.GetTranslation();N->Node.Rotation=T.Rotator();N->Node.Scale=T.GetScale3D();
  N->Node.TranslationMode=BMM_Replace;N->Node.RotationMode=BMM_Replace;N->Node.ScaleMode=BMM_Replace;
  N->Node.TranslationSpace=BCS_ParentBoneSpace;N->Node.RotationSpace=BCS_ParentBoneSpace;N->Node.ScaleSpace=BCS_ParentBoneSpace;N->Node.Alpha=Strength;
  Creator.Finalize();auto* In=N->FindPin(TEXT("ComponentPose"));auto* Out=N->FindPin(TEXT("Pose"));if(!In||!Out)return TEXT("missing pins");
  if(!Graph->GetSchema()->TryCreateConnection(Previous,In))return TEXT("input failed");Previous=Out;Count++;
 }
 if(!Graph->GetSchema()->TryCreateConnection(Previous,Input))return TEXT("output failed");
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);if(Blueprint->Status==BS_Error)return TEXT("compile failed");
 Mesh->SetPostProcessAnimBlueprint(TSubclassOf<UAnimInstance>(Blueprint->GeneratedClass.Get()));Mesh->MarkPackageDirty();
 return FString::Printf(TEXT("{\"nodes\":%d,\"relaxation\":%f}"),Count,Strength);
}
#include "AnimGraphNode_RemapCurves.h"
#include "ExpressionEvaluator.h"
FString UKateFaceTools::AttachFaceCorrectiveDrivers(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh){
 UAnimGraphNode_Root* Root=nullptr;UEdGraph* Graph=nullptr;TArray<UEdGraph*> Graphs;Blueprint->GetAllGraphs(Graphs);
 using namespace CurveExpression::Evaluator;auto Parsed=FEngine().Parse(TEXT("clamp(((CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) * CTRL_expressions_jawOpen / 0.63), 0, 1)"));if(auto* Err=Parsed.TryGet<FParseError>())return TEXT("parse error: ")+Err->Message;
 for(auto* G:Graphs)if(G->GetFName()==TEXT("AnimGraph"))for(auto& N:G->Nodes)if(auto* R=Cast<UAnimGraphNode_Root>(N.Get())){Root=R;Graph=G;break;}
 for(auto* G:Graphs)for(auto& Entry:G->Nodes)if(auto* Existing=Cast<UAnimGraphNode_RemapCurves>(Entry.Get()))if(Existing->Node.CurveExpressions.Contains(TEXT("KateFaceSmileJaw"))){
  Existing->Node.CurveExpressions[TEXT("KateFaceSmileJaw")]=TEXT("clamp(((CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) * CTRL_expressions_jawOpen / 0.63), 0, 1)");
  Existing->ReconstructNode();FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);if(Blueprint->Status==BS_Error)return TEXT("compile failed");
  Mesh->SetPostProcessAnimBlueprint(TSubclassOf<UAnimInstance>(Blueprint->GeneratedClass.Get()));Mesh->MarkPackageDirty();return TEXT("ok");
 }
 if(!Root)return TEXT("no root");UEdGraphPin* Input=nullptr;for(auto* P:Root->Pins)if(P->Direction==EGPD_Input && P->LinkedTo.Num()==1){Input=P;break;}
 if(!Input)return TEXT("no input");auto* Previous=Input->LinkedTo[0];Input->BreakAllPinLinks();
 FGraphNodeCreator<UAnimGraphNode_RemapCurves> Creator(*Graph);auto* Node=Creator.CreateNode();Node->Node.ExpressionSource=ERemapCurvesExpressionSource::ExpressionMap;
 Node->Node.CurveExpressions.Add(TEXT("KateFaceRestShape"),TEXT("1"));
 Node->Node.CurveExpressions.Add(TEXT("KateFaceBlink"),TEXT("(CTRL_expressions_eyeBlinkL + CTRL_expressions_eyeBlinkR) / 2"));
 Node->Node.CurveExpressions.Add(TEXT("KateFaceSmile"),TEXT("(CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) / 1.4"));
 Node->Node.CurveExpressions.Add(TEXT("KateFaceSmileJaw"),TEXT("clamp(((CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) * CTRL_expressions_jawOpen / 0.63), 0, 1)"));
 Node->Node.CurveExpressions.Add(TEXT("KateFaceJaw"),TEXT("clamp((CTRL_expressions_jawOpen * CTRL_expressions_jawOpen / 0.5625), 0, 1) * clamp((1 - (CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) / 0.8), 0, 1)"));
 Node->Node.CurveExpressions.Add(TEXT("KateFacePerioralMid"),TEXT("clamp((CTRL_expressions_jawOpen / 0.45), 0, 1) * clamp(((0.75 - CTRL_expressions_jawOpen) / 0.30), 0, 1) * clamp((1 - (CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) / 0.8), 0, 1)"));
 Node->Node.CurveExpressions.Add(TEXT("KateFacePerioralHigh"),TEXT("clamp(((CTRL_expressions_jawOpen - 0.45) / 0.30), 0, 1) * clamp((1 - (CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) / 0.8), 0, 1)"));
 Node->Node.CurveExpressions.Add(TEXT("KateFacePerioralSmile"),TEXT("(CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) / 1.4"));
 Node->Node.CurveExpressions.Add(TEXT("KateFacePerioralSmileJaw"),TEXT("clamp(((CTRL_expressions_mouthCornerPullL + CTRL_expressions_mouthCornerPullR) * CTRL_expressions_jawOpen / 0.63), 0, 1)"));

 if(Mesh->GetName().Contains(TEXT("Side09"))){
  for(const TCHAR* Name:{TEXT("KateFaceSmile"),TEXT("KateFaceSmileJaw"),TEXT("KateFacePerioralSmile"),TEXT("KateFacePerioralSmileJaw"),TEXT("KateFacePerioralMid"),TEXT("KateFacePerioralHigh")})Node->Node.CurveExpressions.Add(FName(Name),TEXT("0"));
  for(const FString& Side:{FString(TEXT("L")),FString(TEXT("R"))}){
   FString Pull=TEXT("CTRL_expressions_mouthCornerPull")+Side;
   FString Smile=TEXT("clamp((")+Pull+TEXT(" / 0.7), 0, 1)");
   FString Combo=TEXT("clamp((")+Pull+TEXT(" * CTRL_expressions_jawOpen / 0.315), 0, 1)");
   FString Suppress=TEXT(" * clamp((1 - ")+Pull+TEXT(" / 0.4), 0, 1)");
   for(const FString& Base:{FString(TEXT("KateFaceSmile")),FString(TEXT("KateFacePerioralSmile"))})Node->Node.CurveExpressions.Add(FName(*(Base+Side)),Smile);
   for(const FString& Base:{FString(TEXT("KateFaceSmileJaw")),FString(TEXT("KateFacePerioralSmileJaw"))})Node->Node.CurveExpressions.Add(FName(*(Base+Side)),Combo);
   Node->Node.CurveExpressions.Add(FName(*(TEXT("KateFacePerioralMid")+Side)),TEXT("clamp((CTRL_expressions_jawOpen / 0.45), 0, 1) * clamp(((0.75 - CTRL_expressions_jawOpen) / 0.30), 0, 1)")+Suppress);
   Node->Node.CurveExpressions.Add(FName(*(TEXT("KateFacePerioralHigh")+Side)),TEXT("clamp(((CTRL_expressions_jawOpen - 0.45) / 0.30), 0, 1)")+Suppress);
  }
 }

 for(auto& Expr:Node->Node.CurveExpressions){auto Test=FEngine().Parse(Expr.Value);if(auto* Error=Test.TryGet<FParseError>())return Expr.Key.ToString()+TEXT(": ")+Error->Message;}
 Creator.Finalize();auto* In=Node->FindPin(TEXT("SourcePose"));auto* Out=Node->FindPin(TEXT("Pose"));if(!In||!Out)return TEXT("missing pins");
 if(!Graph->GetSchema()->TryCreateConnection(Previous,In)||!Graph->GetSchema()->TryCreateConnection(Out,Input))return TEXT("connect failed");
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);if(Blueprint->Status==BS_Error)return TEXT("compile failed");
 Mesh->SetPostProcessAnimBlueprint(TSubclassOf<UAnimInstance>(Blueprint->GeneratedClass.Get()));Mesh->MarkPackageDirty();return TEXT("ok");
}


FString UKateFaceTools::DumpFaceMorphSource(USkeletalMesh* Mesh,const FString& Folder){
 if(!Mesh)return TEXT("missing mesh");IFileManager::Get().MakeDirectory(*Folder,true);auto* Base=Mesh->GetMeshDescription(0);if(!Base)return TEXT("missing description");FSkeletalMeshAttributes Attr(*Base);int Count=0;
 for(FName Name:Attr.GetMorphTargetNames())if(Name.ToString().StartsWith(TEXT("KateFace"))){auto Delta=Attr.GetVertexMorphPositionDelta(Name);FString Rows;
  for(FVertexID V:Base->Vertices().GetElementIDs()){auto Q=Delta[V];if(Q.SizeSquared()>1e-16f)Rows+=FString::Printf(TEXT("%d,%.10f,%.10f,%.10f\n"),V.GetValue(),Q.X,Q.Y,Q.Z);}
  FFileHelper::SaveStringToFile(Rows,*(Folder/TEXT("morph_")+Name.ToString()+TEXT(".csv")));Count++;
 }
 for(int L=0;L<Mesh->GetLODNum();L++){auto* D=Mesh->GetMeshDescription(L);if(!D)return TEXT("missing LOD");auto UV=FStaticMeshAttributes(*D).GetVertexInstanceUVs();FString Rows;
  for(FTriangleID T:D->Triangles().GetElementIDs())if(D->GetTrianglePolygonGroup(T).GetValue()==0){auto Vs=D->GetTriangleVertices(T);auto VI=D->GetTriangleVertexInstances(T);auto A=UV.Get(VI[0],0),B=UV.Get(VI[1],0),C=UV.Get(VI[2],0);Rows+=FString::Printf(TEXT("%d,%d,%d,%.10f,%.10f,%.10f,%.10f,%.10f,%.10f\n"),Vs[0].GetValue(),Vs[1].GetValue(),Vs[2].GetValue(),A.X,A.Y,B.X,B.Y,C.X,C.Y);}
  FFileHelper::SaveStringToFile(Rows,*FString::Printf(TEXT("%s/lod%d_skin_tri_uv.csv"),*Folder,L));
 }return FString::FromInt(Count);
}
bool UKateFaceTools::AddFaceMorphLODBatch(USkeletalMesh* Mesh,const FString& ManifestFile){
 if(!Mesh)return false;FString Text;if(!FFileHelper::LoadFileToString(Text,*ManifestFile))return false;TArray<FString> Lines;Text.ParseIntoArrayLines(Lines);TSet<int> Changed;
 for(auto& Line:Lines){TArray<FString>A;Line.ParseIntoArray(A,TEXT("|"));if(A.Num()!=3)return false;int L=FCString::Atoi(*A[0]);if(L<=0||L>=Mesh->GetLODNum())return false;auto* D=Mesh->GetMeshDescription(L);if(!D)return false;FSkeletalMeshAttributes Attr(*D);FName Name(*A[1]);Attr.RegisterMorphTargetAttribute(Name,false);auto Delta=Attr.GetVertexMorphPositionDelta(Name);
  for(FVertexID V:D->Vertices().GetElementIDs())Delta[V]=FVector3f::ZeroVector;FString Data;if(!FFileHelper::LoadFileToString(Data,*A[2]))return false;TArray<FString> Rows;Data.ParseIntoArrayLines(Rows);
  for(auto& Row:Rows){TArray<FString>B;Row.ParseIntoArray(B,TEXT(","));if(B.Num()!=4)return false;FVertexID V(FCString::Atoi(*B[0]));if(!D->Vertices().IsValid(V))return false;Delta[V]=FVector3f(FCString::Atof(*B[1]),FCString::Atof(*B[2]),FCString::Atof(*B[3]));}Changed.Add(L);
 }
 if(!Changed.Num())return false;for(int L:Changed)Mesh->CommitMeshDescription(L);Mesh->PostEditChange();Mesh->MarkPackageDirty();return true;
}

FString UKateFaceTools::DumpFaceControls(UMetaHumanCharacter* Character){if(!Character)return TEXT("");auto Buffer=Character->GetFaceDNABuffer();auto Reader=ReadDNAFromBuffer(&Buffer,EDNADataLayer::All);if(!Reader.IsValid())return TEXT("");FString R;for(uint16 I=0;I<Reader->GetRawControlCount();I++)R+=Reader->GetRawControlName(I)+TEXT("\n");return R;}

bool UKateFaceTools::CaptureFaceMaterialPose(UWorld* World,USkeletalMesh* Mesh,UAnimSequence* Seq,float Time,const FString& File,float ExposureBias){
 if(!World||!Mesh||!Seq)return false;
 auto* A=World->SpawnActor<ASkeletalMeshActor>();auto* C=A->GetSkeletalMeshComponent();C->SetSkeletalMesh(Mesh);C->SetForcedLOD(1);C->VisibilityBasedAnimTickOption=EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;C->SetUpdateAnimationInEditor(true);C->SetAnimationMode(EAnimationMode::AnimationSingleNode);C->SetAnimation(Seq);C->Stop();C->SetPosition(Time,false);
 for(int I=0;I<C->GetNumMaterials();I++)if(auto* M=C->GetMaterial(I))M->EnsureIsComplete();
 TArray<ADirectionalLight*> Lights;
 for(int I=0;I<3;I++){auto* L=World->SpawnActor<ADirectionalLight>();L->SetActorRotation(I==0?FRotator(-20,-55,0):(I==1?FRotator(-10,140,0):FRotator(-45,60,0)));L->GetLightComponent()->SetIntensity((I==0?4.f:2.f)*FMath::Pow(2.f,ExposureBias+7.f));L->GetLightComponent()->SetCastShadows(false);Lights.Add(L);}
 auto* Capture=World->SpawnActor<ASceneCapture2D>();auto* S=Capture->GetCaptureComponent2D();S->bCaptureEveryFrame=false;S->bCaptureOnMovement=false;S->ProjectionType=ECameraProjectionMode::Orthographic;S->OrthoWidth=36;FVector Center(0,8,150),Location=Center+FVector(-300,500,0);Capture->SetActorLocation(Location);Capture->SetActorRotation((Center-Location).Rotation());
 auto* RT=NewObject<UTextureRenderTarget2D>();RT->RenderTargetFormat=RTF_RGBA8;RT->ClearColor=FLinearColor(.08,.08,.08,1);RT->InitAutoFormat(800,700);RT->UpdateResourceImmediate(true);S->TextureTarget=RT;S->CaptureSource=ESceneCaptureSource::SCS_FinalColorLDR;S->PostProcessSettings.bOverride_AutoExposureMethod=true;S->PostProcessSettings.AutoExposureMethod=EAutoExposureMethod::AEM_Manual;S->PostProcessSettings.bOverride_AutoExposureBias=true;S->PostProcessSettings.AutoExposureBias=ExposureBias;
 for(int I=0;I<10;I++){C->TickAnimation(1.f/30,false);C->RefreshBoneTransforms();C->UpdateComponentToWorld();C->MarkRenderDynamicDataDirty();World->SendAllEndOfFrameUpdates();FlushRenderingCommands();S->CaptureScene();FlushRenderingCommands();}
 TArray<FColor> Pixels;bool OK=RT->GameThread_GetRenderTargetResource()->ReadPixels(Pixels);if(OK){TArray64<uint8> PNG;FImageUtils::PNGCompressImageArray(800,700,Pixels,PNG);OK=FFileHelper::SaveArrayToFile(PNG,*File);}Capture->Destroy();for(auto* L:Lights)L->Destroy();A->Destroy();return OK;
}

bool UKateFaceTools::DumpFaceRenderUV(USkeletalMesh* Mesh,const FString& File){if(!Mesh)return false;const auto& L=Mesh->GetResourceForRendering()->LODRenderData[0];const auto& B=L.StaticVertexBuffers.StaticMeshVertexBuffer;FString R;for(uint32 I=0;I<B.GetNumVertices();I++){auto UV=B.GetVertexUV(I,0);R+=FString::Printf(TEXT("%u,%.9f,%.9f\n"),I,UV.X,UV.Y);}return FFileHelper::SaveStringToFile(R,*File);}

bool UKateFaceTools::DumpRenderSkinWeights(USkeletalMesh* Mesh,const FString& File){if(!Mesh)return false;const auto& L=Mesh->GetResourceForRendering()->LODRenderData[0];auto* W=L.GetSkinWeightVertexBuffer();const auto& Ref=Mesh->GetRefSkeleton();FString R;for(const auto& S:L.RenderSections)for(uint32 I=S.BaseVertexIndex;I<S.BaseVertexIndex+S.NumVertices;I++)for(uint32 K=0;K<W->GetMaxBoneInfluences();K++){float Weight=W->GetBoneWeight(I,K)/65535.f;if(Weight>0)R+=FString::Printf(TEXT("%u,%s,%.9f\n"),I,*Ref.GetBoneName(S.BoneMap[W->GetBoneIndex(I,K)]).ToString(),Weight);}return FFileHelper::SaveStringToFile(R,*File);}

FString UKateFaceTools::MuteFaceCorrectiveLayer(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh,int32 Mode){if(!Blueprint||!Mesh)return TEXT("missing");TArray<UEdGraph*> Graphs;Blueprint->GetAllGraphs(Graphs);FString R;for(auto* G:Graphs)for(auto& Entry:G->Nodes)if(auto* Node=Cast<UAnimGraphNode_RemapCurves>(Entry.Get())){bool Changed=false;for(auto& KV:Node->Node.CurveExpressions){FString K=KV.Key.ToString();bool Mute=false;if(Mode==1)Mute=K.StartsWith(TEXT("KateFace"))&&K!=TEXT("KateFaceRestShape")&&K!=TEXT("KateFaceBlink");if(Mode==2)Mute=K.StartsWith(TEXT("KateFaceSmile"))||K==TEXT("KateFaceJaw");if(Mode==3)Mute=K.StartsWith(TEXT("KateFacePerioral"));if(Mute){KV.Value=TEXT("0");R+=K+TEXT("\n");Changed=true;}}if(Changed)Node->ReconstructNode();}FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);if(Blueprint->Status==BS_Error)return TEXT("compile failed");Mesh->SetPostProcessAnimBlueprint(TSubclassOf<UAnimInstance>(Blueprint->GeneratedClass.Get()));Mesh->MarkPackageDirty();return R;}

bool UKateFaceTools::DumpBindBoneMatrices(USkeletalMesh* Mesh,const FString& File){if(!Mesh)return false;const auto& Ref=Mesh->GetRefSkeleton();auto Global=Ref.GetRefBonePose();FString R;for(int I=0;I<Global.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)Global[I]=Global[I]*Global[P];auto M=Global[I].ToMatrixWithScale();R+=Ref.GetBoneName(I).ToString();for(int A=0;A<4;A++)for(int B=0;B<4;B++)R+=FString::Printf(TEXT(",%.10f"),M.M[A][B]);R+=TEXT("\n");}return FFileHelper::SaveStringToFile(R,*File);}


#include "Engine/StaticMesh.h"
#include "Components/StaticMeshComponent.h"
#include "StaticMeshResources.h"
bool UKateFaceTools::DumpStaticHair( UStaticMesh* Mesh,const FString& File){
 if(!Mesh || !Mesh->GetRenderData() || !Mesh->GetRenderData()->LODResources.Num())return false;
 const auto& L=Mesh->GetRenderData()->LODResources[0];FString Rows;
 for(uint32 I=0;I<L.VertexBuffers.PositionVertexBuffer.GetNumVertices();I++){auto V=L.VertexBuffers.PositionVertexBuffer.VertexPosition(I);Rows+=FString::Printf(TEXT("%.9f,%.9f,%.9f\n"),V.X,V.Y,V.Z);}
 return FFileHelper::SaveStringToFile(Rows,*File);
}
FString UKateFaceTools::AttachAssemblyHair(UWorld* World,UBlueprint* Blueprint,UStaticMesh* Mesh,UAnimSequence* Seq,const FString& MatrixFile){
 FString Text;if(!FFileHelper::LoadFileToString(Text,*MatrixFile))return TEXT("matrix missing");TArray<FString> Rows;Text.ParseIntoArrayLines(Rows);if(Rows.Num()!=4)return TEXT("matrix rows");FMatrix Matrix=FMatrix::Identity;
 for(int I=0;I<4;I++){TArray<FString> Fields;Rows[I].ParseIntoArray(Fields,TEXT(","));if(Fields.Num()!=4)return TEXT("matrix columns");for(int J=0;J<4;J++)Matrix.M[I][J]=FCString::Atod(*Fields[J]);}
 auto* Actor=World->SpawnActor<AActor>(Blueprint->GeneratedClass.Get(),FTransform::Identity);if(!Actor)return TEXT("spawn failed");TArray<USkeletalMeshComponent*> Components;Actor->GetComponents(Components);USkeletalMeshComponent* Body=nullptr;USkeletalMeshComponent* Face=nullptr;
 for(auto* C:Components){if(C->GetName()==TEXT("Body"))Body=C;if(C->GetName()==TEXT("Face"))Face=C;}if(!Body || !Face){Actor->Destroy();return TEXT("body face missing");}
 Body->SetAnimationMode(EAnimationMode::AnimationSingleNode);Body->SetAnimation(Seq);Body->Stop();Body->SetPosition(0.f,false);
 for(int Warm=0;Warm<3;Warm++){Body->TickAnimation(1.f/30,false);Body->RefreshBoneTransforms();Body->UpdateComponentToWorld();for(auto* C:Components)if(C!=Body){C->TickAnimation(1.f/30,false);C->RefreshBoneTransforms();C->UpdateComponentToWorld();}}
 FTransform Head=Face->GetSocketTransform(TEXT("head"),RTS_World);Actor->Destroy();USCS_Node* Parent=nullptr;
 for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(N->GetVariableName()==TEXT("Face"))Parent=N;if(!Parent)return TEXT("face node missing");
 auto* Node=Blueprint->SimpleConstructionScript->CreateNode(UStaticMeshComponent::StaticClass(),TEXT("KateHair113"));auto* Component=Cast<UStaticMeshComponent>(Node->ComponentTemplate);Component->SetStaticMesh(Mesh);Component->SetMobility(EComponentMobility::Movable);Component->SetCollisionEnabled(ECollisionEnabled::NoCollision);Component->SetRelativeTransform(FTransform(Matrix)*Head.Inverse());Node->AttachToName=TEXT("head");Parent->AddChildNode(Node);
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();return Blueprint->Status==BS_Error?TEXT("compile failed"):TEXT("ok");
}

FString UKateFaceTools::AttachAssemblyHairRig(UWorld* World,UBlueprint* Blueprint,USkeletalMesh* Mesh,UAnimSequence* BodyNeutral,UAnimSequence* HairClip,const FString& MatrixFile){
 FString Text;if(!FFileHelper::LoadFileToString(Text,*MatrixFile))return TEXT("matrix missing");TArray<FString> Rows;Text.ParseIntoArrayLines(Rows);if(Rows.Num()!=4)return TEXT("matrix rows");FMatrix Matrix=FMatrix::Identity;
 for(int I=0;I<4;I++){TArray<FString> Fields;Rows[I].ParseIntoArray(Fields,TEXT(","));if(Fields.Num()!=4)return TEXT("matrix columns");for(int J=0;J<4;J++)Matrix.M[I][J]=FCString::Atod(*Fields[J]);}
 auto* Actor=World->SpawnActor<AActor>(Blueprint->GeneratedClass.Get(),FTransform::Identity);if(!Actor)return TEXT("spawn failed");TArray<USkeletalMeshComponent*> Components;Actor->GetComponents(Components);USkeletalMeshComponent* Body=nullptr;USkeletalMeshComponent* Face=nullptr;
 for(auto* C:Components){if(C->GetName()==TEXT("Body"))Body=C;if(C->GetName()==TEXT("Face"))Face=C;}if(!Body || !Face){Actor->Destroy();return TEXT("body face missing");}
 Body->SetAnimationMode(EAnimationMode::AnimationSingleNode);Body->SetAnimation(BodyNeutral);Body->Stop();Body->SetPosition(0.f,false);
 for(int Warm=0;Warm<3;Warm++){Body->TickAnimation(1.f/30,false);Body->RefreshBoneTransforms();Body->UpdateComponentToWorld();for(auto* C:Components)if(C!=Body){C->TickAnimation(1.f/30,false);C->RefreshBoneTransforms();C->UpdateComponentToWorld();}}
 FTransform Head=Face->GetSocketTransform(TEXT("head"),RTS_World);Actor->Destroy();USCS_Node* Parent=nullptr;
 for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(N->GetVariableName()==TEXT("Face"))Parent=N;if(!Parent)return TEXT("face node missing");
 auto* Node=Blueprint->SimpleConstructionScript->CreateNode(USkeletalMeshComponent::StaticClass(),TEXT("KateHairRig115"));auto* Component=Cast<USkeletalMeshComponent>(Node->ComponentTemplate);Component->SetSkeletalMesh(Mesh);Component->SetAnimationMode(EAnimationMode::AnimationSingleNode);Component->AnimationData.AnimToPlay=HairClip;Component->AnimationData.bSavedLooping=true;Component->AnimationData.bSavedPlaying=HairClip!=nullptr;Component->SetMobility(EComponentMobility::Movable);Component->SetCollisionEnabled(ECollisionEnabled::NoCollision);Component->SetRelativeTransform(FTransform(Matrix)*Head.Inverse());Node->AttachToName=TEXT("head");Parent->AddChildNode(Node);
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();return Blueprint->Status==BS_Error?TEXT("compile failed"):TEXT("ok");
}

bool UKateFaceTools::DumpHairRigBind(USkeletalMesh* Mesh,const FString& File){if(!Mesh)return false;const auto& L=Mesh->GetResourceForRendering()->LODRenderData[0];FString Rows;for(uint32 I=0;I<L.StaticVertexBuffers.PositionVertexBuffer.GetNumVertices();I++){auto V=L.StaticVertexBuffers.PositionVertexBuffer.VertexPosition(I);Rows+=FString::Printf(TEXT("%.9f,%.9f,%.9f\n"),V.X,V.Y,V.Z);}return FFileHelper::SaveStringToFile(Rows,*File);}

#include "KateHairDynamics.h"
bool UKateFaceTools::EnableHairDynamics(UBlueprint* Blueprint){if(!Blueprint)return false;for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(auto* C=Cast<USkeletalMeshComponent>(N->ComponentTemplate);C && N->GetVariableName().ToString().Contains(TEXT("HairRig"))){C->SetAnimationMode(EAnimationMode::AnimationBlueprint);C->SetAnimInstanceClass(UKateHairDynamics::StaticClass());C->VisibilityBasedAnimTickOption=EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;C->bEnableUpdateRateOptimizations=false;}FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();return Blueprint->Status!=BS_Error;}

#include "GroomComponent.h"
#include "NiagaraComponent.h"
#include "NiagaraSystem.h"
#include "ShaderCompiler.h"
FString UKateFaceTools::CaptureGroomTest(UWorld* World,UBlueprint* Blueprint,UAnimSequence* Seq,float Time,float Roll,bool Simulate,const FString& File){
 UWorld::InitializationValues IV;IV.AllowAudioPlayback(false).RequiresHitProxies(false).CreateNavigation(false).CreateAISystem(false).ShouldSimulatePhysics(false).SetTransactional(false).CreateFXSystem(true);
 World=UWorld::CreateWorld(EWorldType::Game,false,NAME_None,nullptr,true,ERHIFeatureLevel::SM6,&IV);GEngine->CreateNewWorldContext(EWorldType::Game).SetCurrentWorld(World);if(!World->FXSystem)World->FXSystem=FFXSystemInterface::Create(World->GetFeatureLevel(),World->Scene);World->InitializeActorsForPlay(FURL());World->BeginPlay();
 auto* A=World->SpawnActor<AActor>(Blueprint->GeneratedClass.Get(),FTransform::Identity);if(!A)return TEXT("spawn/body failed");TArray<USkeletalMeshComponent*> Comps;A->GetComponents(Comps);USkeletalMeshComponent* Body=nullptr;
 auto* Clay=LoadObject<UMaterialInterface>(nullptr,TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
 for(auto* C:Comps){if(C->GetName().Equals(TEXT("Body"),ESearchCase::IgnoreCase))Body=C;C->SetForcedLOD(1);C->VisibilityBasedAnimTickOption=EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;C->SetUpdateAnimationInEditor(true);for(int M=0;M<C->GetNumMaterials();M++)C->SetMaterial(M,Clay);}
 if(!Body){A->Destroy();return TEXT("spawn/body failed");}Body->SetAnimationMode(EAnimationMode::AnimationSingleNode);Body->SetAnimation(Seq);Body->Stop();Body->SetPosition(Time,false);
 TArray<UGroomComponent*> Grooms;A->GetComponents(Grooms);Grooms.RemoveAll([](UGroomComponent* G){return G->GetName()!=TEXT("KateGroom118");});for(auto* G:Grooms){G->CollisionComponents.Add(Body);G->SimulationSettings.bOverrideSettings=true;G->SetEnableSimulation(Simulate);G->SetForcedLOD(0);G->UpdateHairSimulation();UE_LOG(LogTemp,Warning,TEXT("GROOM_DIAG group0simulation=%d worldinit=%d"),G->IsSimulationEnable(0,0),World->bIsWorldInitialized);for(auto N:G->NiagaraComponents)if(N){if(!N->GetAsset() && Simulate){N->SetAsset(LoadObject<UNiagaraSystem>(nullptr,TEXT("/HairStrands/Emitters/StableRodsSystem.StableRodsSystem")));if(!N->IsRegistered())N->RegisterComponentWithWorld(World);}UE_LOG(LogTemp,Warning,TEXT("GROOM_DIAG solverasset=%s registered=%d"),*GetNameSafe(N->GetAsset()),N->IsRegistered());if(!N->GetAsset())continue;N->GetAsset()->WaitForCompilationComplete(true,false);GShaderCompilingManager->FinishAllCompilation();UE_LOG(LogTemp,Warning,TEXT("GROOM_DIAG init sim=%d worldinit=%d registered=%d assetready=%d canrender=%d"),Simulate,World->bIsWorldInitialized,N->IsRegistered(),N->GetAsset()->IsReadyToRun(),FApp::CanEverRender());N->SetAllowScalability(false);N->SetForceSolo(true);N->ReinitializeSystem();N->Activate(true);UE_LOG(LogTemp,Warning,TEXT("GROOM_DIAG activated=%d"),N->IsActive());}}
 TArray<ADirectionalLight*> Lights;
 for(int I=0;I<3;I++){auto* Light=World->SpawnActor<ADirectionalLight>();Light->GetLightComponent()->SetMobility(EComponentMobility::Movable);Light->SetActorRotation(I==0?FRotator(-35,-55,0):(I==1?FRotator(-15,145,0):FRotator(-60,60,0)));Light->GetLightComponent()->SetIntensity(I==0?3.f:1.f);Light->GetLightComponent()->SetCastShadows(false);Lights.Add(Light);}
 auto* Capture=World->SpawnActor<ASceneCapture2D>();auto* C=Capture->GetCaptureComponent2D();C->bCaptureEveryFrame=false;C->bAlwaysPersistRenderingState=true;C->bCaptureOnMovement=false;C->ProjectionType=ECameraProjectionMode::Orthographic;C->OrthoWidth=85;FVector Center(0,3,147),Location=Center+FVector(-220,500,25);Capture->SetActorLocation(Location);Capture->SetActorRotation((Center-Location).Rotation());
 auto* RT=NewObject<UTextureRenderTarget2D>();RT->RenderTargetFormat=RTF_RGBA8;RT->ClearColor=FLinearColor(.12,.12,.12,1);RT->InitAutoFormat(800,900);RT->UpdateResourceImmediate(true);C->TextureTarget=RT;C->CaptureSource=ESceneCaptureSource::SCS_FinalColorLDR;C->PostProcessSettings.bOverride_AutoExposureMethod=true;C->PostProcessSettings.AutoExposureMethod=EAutoExposureMethod::AEM_Manual;C->PostProcessSettings.bOverride_AutoExposureBias=true;C->PostProcessSettings.AutoExposureBias=0.f;C->PostProcessSettings.bOverride_AutoExposureApplyPhysicalCameraExposure=true;C->PostProcessSettings.AutoExposureApplyPhysicalCameraExposure=false;
 Clay->EnsureIsComplete();for(auto* G:Grooms)for(int M=0;M<G->GetNumMaterials();M++)if(auto* Mat=G->GetMaterial(M))Mat->EnsureIsComplete();World->SendAllEndOfFrameUpdates();FlushRenderingCommands();Clay->CheckMaterialUsage_Concurrent(MATUSAGE_SkeletalMesh);Clay->EnsureIsComplete();for(auto* G:Grooms)for(int M=0;M<G->GetNumMaterials();M++)if(auto* Mat=G->GetMaterial(M)){Mat->CheckMaterialUsage_Concurrent(MATUSAGE_HairStrands);Mat->EnsureIsComplete();}
 FString MotionDir=FPaths::Combine(FPaths::GetPath(File),TEXT("native-motion"));if(Simulate)IFileManager::Get().MakeDirectory(*MotionDir,true);
 for(int I=0;I<100;I++){GFrameCounter++;GFrameNumber++;FApp::SetDeltaTime(1.0/30.0);FApp::SetCurrentTime(FApp::GetCurrentTime()+1.0/30.0);const uint32 ProbeFrame=GFrameNumber;ENQUEUE_RENDER_COMMAND(KateAdvanceRenderFrame)([ProbeFrame](FRHICommandListImmediate& RHICmd){GFrameNumberRenderThread=ProbeFrame;});float R=Roll*FMath::Clamp(float(I-30)/40.f,0.f,1.f);FVector Pivot(0,0,150);FQuat Q(FVector(1,0,0),FMath::DegreesToRadians(R));A->SetActorTransform(FTransform(Q,Pivot-Q.RotateVector(Pivot)));Body->TickAnimation(1.f/30,false);Body->RefreshBoneTransforms();Body->UpdateComponentToWorld();for(auto* O:Comps)if(O!=Body&&O->GetSkeletalMeshAsset()){O->TickAnimation(1.f/30,false);O->RefreshBoneTransforms();O->UpdateComponentToWorld();}for(auto* O:Comps)O->MarkRenderDynamicDataDirty();World->Tick(LEVELTICK_All,1.f/30);World->SendAllEndOfFrameUpdates();FlushRenderingCommands();if(Simulate)if(auto* GPU=FNiagaraGpuComputeDispatchInterface::Get(World)){GPU->FlushPendingTicks_GameThread();FlushRenderingCommands();}C->CaptureScene();FlushRenderingCommands();if(Simulate && (I==0||I==1||I==30||I==99)){for(auto* G:Grooms){for(int J=0;J<G->NiagaraComponents.Num();J++){auto* N=G->NiagaraComponents[J].Get();if(!N)continue;auto Ctrl=N->GetSystemInstanceController();auto* SI=Ctrl?Ctrl->GetSystemInstance_Unsafe():nullptr;UE_LOG(LogTemp,Warning,TEXT("GROOM_RESOURCE frame=%d group=%d rest=%d attach=%s platformguides=%u instance=%d"),I,J,G->GetGuideStrandsRestResource(J)!=nullptr,*GetNameSafe(N->GetAttachParent()),G->GroomAsset->GetHairGroupsPlatformData()[J].Guides.BulkData.GetNumCurves(),SI!=nullptr);if(SI)for(int K=0;K<64;K++){UNiagaraDataInterface* DI=nullptr;void* P=nullptr;SI->GetDataInterfaceInstanceDataInfo(K,DI,P);if(!DI)break;if(auto* H=Cast<UNiagaraDataInterfaceHairStrands>(DI)){auto* D=static_cast<FNDIHairStrandsData*>(P);UE_LOG(LogTemp,Warning,TEXT("GROOM_NDI frame=%d componentgroup=%d group=%d strands=%d size=%d buffer=%d source=%s"),I,J,D->HairGroupIndex,D->NumStrands,D->StrandsSize,D->HairStrandsBuffer!=nullptr,*GetNameSafe(H->SourceComponent.Get()));}}}}}if(Simulate && I%3==0){TArray<FColor> FP;if(RT->GameThread_GetRenderTargetResource()->ReadPixels(FP)){TArray64<uint8> B;FImageUtils::PNGCompressImageArray(800,900,FP,B);FFileHelper::SaveArrayToFile(B,*FPaths::Combine(MotionDir,FString::Printf(TEXT("frame_%03d.png"),I/3)));}}}
 if(Simulate){for(auto* G:Grooms)for(int J=0;J<G->GetGroupCount();J++)for(int Probe=0;Probe<2;Probe++){auto* Inst=G->GetGroupInstance(J);auto* Res=Inst?(Probe==0?Inst->Guides.DeformedResource:Inst->Strands.DeformedResource):nullptr;if(!Res)continue;FString Base=FPaths::Combine(FPaths::GetPath(File),FString::Printf(TEXT("gpu-%s-%d"),Probe==0?TEXT("guide"):TEXT("strand"),J));ENQUEUE_RENDER_COMMAND(KateGuideReadback)([Res,Base](FRHICommandListImmediate& RHICmd){auto Read=[&](TRefCountPtr<FRDGPooledBuffer> Buffer,const FString& Path){if(!Buffer)return;uint32 Bytes=Buffer->GetRHI()->GetSize();FRHIGPUBufferReadback RB(TEXT("KateGuideProbe"));FRDGBuilder Graph(RHICmd);auto* B=Graph.RegisterExternalBuffer(Buffer,TEXT("KateGuideProbeInput"));AddEnqueueCopyPass(Graph,&RB,B,Bytes);Graph.Execute();RHICmd.SubmitCommandsAndFlushGPU();RHICmd.BlockUntilGPUIdle();if(RB.IsReady()){auto* P=static_cast<const uint8*>(RB.Lock(Bytes));TArray<uint8> Data;Data.Append(P,Bytes);RB.Unlock();FFileHelper::SaveArrayToFile(Data,*Path);}};Read(Res->GetBuffer(FHairStrandsDeformedResource::Current).Buffer,Base+TEXT(".bin"));Read(Res->GetPositionOffsetBuffer(FHairStrandsDeformedResource::Current).Buffer,Base+TEXT(".offset.bin"));FVector O=Res->GetPositionOffset(FHairStrandsDeformedResource::Current);FFileHelper::SaveStringToFile(FString::Printf(TEXT("{\"offset\":[%.9f,%.9f,%.9f],\"points\":%u}"),O.X,O.Y,O.Z,Res->BulkData.GetNumPoints()),*(Base+TEXT(".json")));});}FlushRenderingCommands();}
 TArray<FColor> Pixels;bool OK=RT->GameThread_GetRenderTargetResource()->ReadPixels(Pixels);if(OK){TArray64<uint8> PNG;FImageUtils::PNGCompressImageArray(800,900,Pixels,PNG);OK=FFileHelper::SaveArrayToFile(PNG,*File);}Capture->Destroy();for(auto* L:Lights)L->Destroy();int Systems=0,Active=0;for(auto* G:Grooms)for(auto N:G->NiagaraComponents)if(N){Systems++;if(N->IsActive())Active++;}A->Destroy();World->DestroyWorld(false);GEngine->DestroyWorldContext(World);return FString::Printf(TEXT("{\"captured\":%s,\"grooms\":%d,\"niagara_systems\":%d,\"active_systems\":%d}"),OK?TEXT("true"):TEXT("false"),Grooms.Num(),Systems,Active);
}

FString UKateFaceTools::DumpNativeGroomState(UGroomComponent* Groom,const FString& Directory){
 if(!Groom || !Groom->GroomAsset)return TEXT("invalid groom");IFileManager::Get().MakeDirectory(*Directory,true);FlushRenderingCommands();FString Report=TEXT("[");
 for(int32 Group=0;Group<Groom->GetGroupCount();Group++){
  auto* Instance=Groom->GetGroupInstance(Group);auto* Resource=Instance?Instance->Guides.DeformedResource:nullptr;if(Group)Report+=TEXT(",");Report+=FString::Printf(TEXT("{\"group\":%d,\"simulation_enabled\":%s,\"resource\":%s}"),Group,Groom->IsSimulationEnable(Group,0)?TEXT("true"):TEXT("false"),Resource?TEXT("true"):TEXT("false"));if(!Resource)continue;
  FString Base=FPaths::Combine(Directory,FString::Printf(TEXT("guide-%d"),Group));ENQUEUE_RENDER_COMMAND(KateLiveGuideReadback)([Resource,Base](FRHICommandListImmediate& Cmd){
   auto Read=[&](TRefCountPtr<FRDGPooledBuffer> Buffer,const FString& Path){if(!Buffer)return;uint32 Bytes=Buffer->GetRHI()->GetSize();FRHIGPUBufferReadback Readback(TEXT("KateLiveGuideProbe"));FRDGBuilder Graph(Cmd);auto* Input=Graph.RegisterExternalBuffer(Buffer,TEXT("KateLiveGuides"));AddEnqueueCopyPass(Graph,&Readback,Input,Bytes);Graph.Execute();Cmd.SubmitCommandsAndFlushGPU();Cmd.BlockUntilGPUIdle();if(Readback.IsReady()){auto* Source=static_cast<const uint8*>(Readback.Lock(Bytes));TArray<uint8> Copy;Copy.Append(Source,Bytes);Readback.Unlock();FFileHelper::SaveArrayToFile(Copy,*Path);}};
   Read(Resource->GetBuffer(FHairStrandsDeformedResource::Current).Buffer,Base+TEXT(".bin"));Read(Resource->GetPositionOffsetBuffer(FHairStrandsDeformedResource::Current).Buffer,Base+TEXT(".offset.bin"));FVector Offset=Resource->GetPositionOffset(FHairStrandsDeformedResource::Current);FFileHelper::SaveStringToFile(FString::Printf(TEXT("{\"offset\":[%.9f,%.9f,%.9f],\"points\":%u}"),Offset.X,Offset.Y,Offset.Z,Resource->BulkData.GetNumPoints()),*(Base+TEXT(".json")));
  });
 }
 FlushRenderingCommands();Report+=TEXT("]");FFileHelper::SaveStringToFile(Report,*FPaths::Combine(Directory,TEXT("report.json")));return Report;
}

#include "NiagaraDataInterfacePhysicsAsset.h"
#include "PhysicsEngine/SkeletalBodySetup.h"
FString UKateFaceTools::DumpGroomColliders(UGroomComponent* Groom,const FString& Directory){
 if(!Groom)return TEXT("invalid");IFileManager::Get().MakeDirectory(*Directory,true);FString Rows=TEXT("component,bone,type,x,y,z,qx,qy,qz,qw,radius,length\n"),Report;
 TArray<USkeletalMeshComponent*> Meshes;Groom->GetOwner()->GetComponents(Meshes);
 for(auto* Mesh:Meshes){auto* Asset=Mesh->GetName()==TEXT("Face") ? Groom->PhysicsAsset.Get() : Mesh->GetPhysicsAsset();if(!Asset)continue;Report+=FString::Printf(TEXT("Mesh %s Physics %s\n"),*Mesh->GetName(),*Asset->GetPathName());
 for(auto Body:Asset->SkeletalBodySetups){if(!Body)continue;FTransform Bone=Mesh->GetSocketTransform(Body->BoneName,RTS_World);
 auto Append=[&](const FString& Type,FTransform Local,float Radius,float Length){auto T=Local*Bone;auto V=T.GetLocation();auto Q=T.GetRotation();Rows+=FString::Printf(TEXT("%s,%s,%s,%f,%f,%f,%f,%f,%f,%f,%f,%f\n"),*Mesh->GetName(),*Body->BoneName.ToString(),*Type,V.X,V.Y,V.Z,Q.X,Q.Y,Q.Z,Q.W,Radius,Length);};
 for(auto& E:Body->AggGeom.SphereElems)Append(TEXT("sphere"),FTransform(E.Center),E.Radius,0);
 for(auto& E:Body->AggGeom.SphylElems)Append(TEXT("capsule"),E.GetTransform(),E.Radius,E.Length);
 }}
 for(int J=0;J<Groom->NiagaraComponents.Num();J++){auto* N=Groom->NiagaraComponents[J].Get();if(!N)continue;auto Ctrl=N->GetSystemInstanceController();auto* SI=Ctrl?Ctrl->GetSystemInstance_Unsafe():nullptr;if(!SI)continue;
 for(int K=0;K<64;K++){UNiagaraDataInterface* DI=nullptr;void* P=nullptr;SI->GetDataInterfaceInstanceDataInfo(K,DI,P);if(!DI)break;if(auto* Physics=Cast<UNiagaraDataInterfacePhysicsAsset>(DI)){auto* Data=static_cast<FNDIPhysicsAssetData*>(P);Report+=FString::Printf(TEXT("Group %d DI %s sources=%d assets=%d primitives=%u buffer=%d\n"),J,*DI->GetName(),Physics->SourceComponents.Num(),Physics->PhysicsAssets.Num(),Data->AssetArrays.ElementOffsets.NumElements,Data->AssetBuffer!=nullptr);for(auto M:Physics->SourceComponents)Report+=FString::Printf(TEXT(" Source %s\n"),*GetNameSafe(M.Get()));for(auto A:Physics->PhysicsAssets)Report+=FString::Printf(TEXT(" Asset %s\n"),*GetPathNameSafe(A.Get()));}}
 }
 FFileHelper::SaveStringToFile(Rows,*FPaths::Combine(Directory,TEXT("colliders.csv")));FFileHelper::SaveStringToFile(Report,*FPaths::Combine(Directory,TEXT("collision-runtime.txt")));return Report;
}

#include "AssetRegistry/AssetRegistryModule.h"

UPhysicsAsset* UKateFaceTools::CreateScalpPhysics(UGroomComponent* Groom,UBlueprint* Blueprint,const FString& Path){
 if(!Groom||!Groom->PhysicsAsset)return nullptr;auto* Face=Cast<USkeletalMeshComponent>(Groom->GetAttachParent());if(!Face)return nullptr;
 auto* Asset=LoadObject<UPhysicsAsset>(nullptr,*Path);if(!Asset){FString PackageName=Path;auto* Package=CreatePackage(*PackageName);Asset=DuplicateObject<UPhysicsAsset>(Groom->PhysicsAsset,Package,*FPaths::GetBaseFilename(Path));Asset->SetFlags(RF_Public|RF_Standalone);FAssetRegistryModule::AssetCreated(Asset);}
 FTransform Head=Face->GetSocketTransform(TEXT("head"),RTS_World);
 for(auto Body:Asset->SkeletalBodySetups)if(Body && Body->BoneName==TEXT("head")){Body->AggGeom.EmptyElements();for(float Y:{0.85f,2.5f,4.15f}){FKSphereElem Sphere;Sphere.Center=Head.InverseTransformPosition(FVector(-.27,Y,156.8));Sphere.Radius=11.55;Sphere.SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);Body->AggGeom.SphereElems.Add(Sphere);}Body->InvalidatePhysicsData();Body->CreatePhysicsMeshes();}
 Asset->UpdateBodySetupIndexMap();Asset->MarkPackageDirty();Groom->PhysicsAsset=Asset;
 if(Blueprint){for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(auto* G=Cast<UGroomComponent>(N->ComponentTemplate);G && G->GroomAsset){G->PhysicsAsset=Asset;G->SimulationSettings.bOverrideSettings=true;G->SimulationSettings.SolverSettings.bEnableSimulation=true;G->SimulationSettings.MaterialConstraints.CollisionRadius=0.1f;}FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();}
 return Asset;
}

bool UKateFaceTools::SaveGroomDynamics(UGroomComponent* Source,UBlueprint* Blueprint){
 if(!Source||!Blueprint)return false;bool Found=false;for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(auto* G=Cast<UGroomComponent>(N->ComponentTemplate);G && G->GroomAsset){G->SimulationSettings=Source->SimulationSettings;G->SimulationSettings.SolverSettings.bEnableSimulation=true;G->PhysicsAsset=Source->PhysicsAsset;Found=true;}if(Found){FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();}return Found && Blueprint->Status!=BS_Error;
}

#include "KateBodySurfaceComponent.h"
bool UKateFaceTools::AttachBodySurface(UBlueprint* Blueprint,USkeletalMesh* Mesh){
 if(!Blueprint||!Mesh)return false;USCS_Node* Parent=nullptr;for(auto* N:Blueprint->SimpleConstructionScript->GetAllNodes())if(N->GetVariableName()==TEXT("Body"))Parent=N;if(!Parent)return false;
 auto* Node=Blueprint->SimpleConstructionScript->CreateNode(UKateBodySurfaceComponent::StaticClass(),TEXT("BodySurface214"));auto* C=Cast<UKateBodySurfaceComponent>(Node->ComponentTemplate);C->SetSkeletalMesh(Mesh);C->SetRelativeTransform(FTransform::Identity);C->SetCollisionEnabled(ECollisionEnabled::NoCollision);Parent->AddChildNode(Node);FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();return Blueprint->Status!=BS_Error;
}

#include "Animation/Skeleton.h"
USkeletalMesh* UKateFaceTools::CloneFaceMesh(USkeletalMesh* Mesh,const FString& Path){
 if(!Mesh || FindObject<USkeletalMesh>(nullptr,*Path))return nullptr;
 auto* P=CreatePackage(*Path);auto* Copy=DuplicateObject<USkeletalMesh>(Mesh,P,*FPackageName::GetShortName(Path));if(!Copy)return nullptr;Copy->SetFlags(RF_Public|RF_Standalone);
 if(auto* S=Mesh->GetSkeleton())if(S->GetOutermost()==GetTransientPackage()){
  FString SP=Path+TEXT("_Skeleton");auto* Package=CreatePackage(*SP);auto* Skeleton=DuplicateObject<USkeleton>(S,Package,*FPackageName::GetShortName(SP));Skeleton->SetFlags(RF_Public|RF_Standalone);FAssetRegistryModule::AssetCreated(Skeleton);Skeleton->MarkPackageDirty();Copy->SetSkeleton(Skeleton);
 }
 FAssetRegistryModule::AssetCreated(Copy);Copy->MarkPackageDirty();return Copy;
}
FString UKateFaceTools::AttachGenericFaceDrivers(UAnimBlueprint* Blueprint,USkeletalMesh* Mesh,const TMap<FName,FString>& Expressions){
 if(!Blueprint||!Mesh||!Expressions.Num())return TEXT("missing inputs");
 auto* CurveMeta=Mesh->GetAssetUserData<UAnimCurveMetaData>();if(!CurveMeta){CurveMeta=NewObject<UAnimCurveMetaData>(Mesh);Mesh->AddAssetUserData(CurveMeta);}for(const auto& KV:Expressions)if(Mesh->FindMorphTarget(KV.Key)){CurveMeta->AddCurveMetaData(KV.Key);CurveMeta->SetCurveMetaDataMorphTarget(KV.Key,true);}
 using namespace CurveExpression::Evaluator;
 for(const auto& Expr:Expressions){auto Test=FEngine().Parse(Expr.Value);if(auto* Error=Test.TryGet<FParseError>())return Expr.Key.ToString()+TEXT(": ")+Error->Message;}
 UAnimGraphNode_Root* Root=nullptr;UEdGraph* Graph=nullptr;TArray<UEdGraph*> Graphs;Blueprint->GetAllGraphs(Graphs);
 for(auto* G:Graphs)if(G->GetFName()==TEXT("AnimGraph"))for(auto& N:G->Nodes)if(auto* R=Cast<UAnimGraphNode_Root>(N.Get())){Root=R;Graph=G;break;}
 if(!Root)return TEXT("no root");UEdGraphPin* Input=nullptr;for(auto* P:Root->Pins)if(P->Direction==EGPD_Input && P->LinkedTo.Num()==1){Input=P;break;}
 // Raw expression calibration must run before RigLogic reads its inputs.
 // Morph driver expressions retain their original placement before the root.
 bool bRawCalibration=true;for(const auto& KV:Expressions)if(!KV.Key.ToString().StartsWith(TEXT("CTRL_expressions_"),ESearchCase::IgnoreCase))bRawCalibration=false;
 if(bRawCalibration){
  UEdGraphPin* RigInput=nullptr;
  for(auto* G:Graphs)for(auto& Entry:G->Nodes)if(Entry->GetClass()->GetName().Contains(TEXT("RigLogic")))for(auto* Pin:Entry->Pins)if(Pin->Direction==EGPD_Input && Pin->LinkedTo.Num()==1 && Pin->PinName.ToString().Contains(TEXT("Pose"))){RigInput=Pin;Graph=G;break;}
  // Some MetaHuman blueprints wrap RigLogic in a Control Rig / inherited graph.
  // In that case calibrate the incoming postprocess pose before all solver nodes.
  if(!RigInput)for(auto* G:Graphs)for(auto& Entry:G->Nodes){const FString Class=Entry->GetClass()->GetName();if(Class.Contains(TEXT("LinkedInputPose"))||Class.Contains(TEXT("SubInput")))for(auto* Pin:Entry->Pins)if(Pin->Direction==EGPD_Output && Pin->LinkedTo.Num()==1){RigInput=Pin->LinkedTo[0];Graph=G;break;}}
  if(!RigInput){FString Info=TEXT("no incoming pose for calibration; nodes:");for(auto* G:Graphs)for(auto& Entry:G->Nodes)Info+=Entry->GetClass()->GetName()+TEXT(";");return Info;}Input=RigInput;
 }
 if(!Input)return TEXT("no input");auto* Previous=Input->LinkedTo[0];
 FGraphNodeCreator<UAnimGraphNode_RemapCurves> Creator(*Graph);auto* Node=Creator.CreateNode();Node->Node.ExpressionSource=ERemapCurvesExpressionSource::ExpressionMap;Node->Node.CurveExpressions=Expressions;Creator.Finalize();
 auto* In=Node->FindPin(TEXT("SourcePose"));auto* Out=Node->FindPin(TEXT("Pose"));if(!In||!Out)return TEXT("missing pins");Input->BreakAllPinLinks();
 if(!Graph->GetSchema()->TryCreateConnection(Previous,In)||!Graph->GetSchema()->TryCreateConnection(Out,Input))return TEXT("connect failed");
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);if(Blueprint->Status==BS_Error)return TEXT("compile failed");
 Mesh->SetPostProcessAnimBlueprint(TSubclassOf<UAnimInstance>(Blueprint->GeneratedClass.Get()));Mesh->MarkPackageDirty();return TEXT("ok");
}

#include "Animation/AnimBlueprintGeneratedClass.h"
UBlueprint* UKateFaceTools::CreateBodyFaceAssembly(USkeletalMesh* Body,USkeletalMesh* Face,const FString& Path){
 if(!Body||!Face)return nullptr;
 auto* Package=CreatePackage(*Path);
 auto* BP=FKismetEditorUtilities::CreateBlueprint(AActor::StaticClass(),Package,FName(FPackageName::GetShortName(Path)),BPTYPE_Normal,UBlueprint::StaticClass(),UBlueprintGeneratedClass::StaticClass());
 FString FollowPath=Path+TEXT("_FaceFollow");auto* FollowPackage=CreatePackage(*FollowPath);
 auto* Follow=Cast<UAnimBlueprint>(FKismetEditorUtilities::CreateBlueprint(UAnimInstance::StaticClass(),FollowPackage,FName(FPackageName::GetShortName(FollowPath)),BPTYPE_Normal,UAnimBlueprint::StaticClass(),UAnimBlueprintGeneratedClass::StaticClass()));
 Follow->TargetSkeleton=Face->GetSkeleton();TArray<UEdGraph*> Graphs;Follow->GetAllGraphs(Graphs);UEdGraph* Graph=nullptr;UAnimGraphNode_Root* Root=nullptr;
 for(auto* G:Graphs)for(auto& N:G->Nodes)if(auto* R=Cast<UAnimGraphNode_Root>(N.Get())){Graph=G;Root=R;}
 if(!Root)return nullptr;
 FGraphNodeCreator<UAnimGraphNode_CopyPoseFromMesh> Creator(*Graph);auto* Copy=Creator.CreateNode();Copy->Node.bUseAttachedParent=true;Copy->Node.bCopyCurves=true;Creator.Finalize();
 if(!Graph->GetSchema()->TryCreateConnection(Copy->FindPin(TEXT("Pose")),Root->FindPin(TEXT("Result"))))return nullptr;
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Follow);FKismetEditorUtilities::CompileBlueprint(Follow);if(Follow->Status==BS_Error)return nullptr;
 auto* B=BP->SimpleConstructionScript->CreateNode(USkeletalMeshComponent::StaticClass(),TEXT("Body"));auto* BC=Cast<USkeletalMeshComponent>(B->ComponentTemplate);BC->SetSkeletalMesh(Body);BC->SetCollisionEnabled(ECollisionEnabled::NoCollision);BP->SimpleConstructionScript->AddNode(B);
 auto* F=BP->SimpleConstructionScript->CreateNode(USkeletalMeshComponent::StaticClass(),TEXT("Face"));auto* FC=Cast<USkeletalMeshComponent>(F->ComponentTemplate);FC->SetSkeletalMesh(Face);FC->SetAnimationMode(EAnimationMode::AnimationBlueprint);FC->SetAnimInstanceClass(Follow->GeneratedClass);FC->SetCollisionEnabled(ECollisionEnabled::NoCollision);B->AddChildNode(F);
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(BP);FKismetEditorUtilities::CompileBlueprint(BP);FAssetRegistryModule::AssetCreated(BP);FAssetRegistryModule::AssetCreated(Follow);BP->MarkPackageDirty();Follow->MarkPackageDirty();return BP->Status==BS_Error?nullptr:BP;
}

FString UKateFaceTools::SetBodyHeadRatio(UBlueprint* Blueprint,UAnimBlueprint* FaceBP,USkeletalMesh* Face,float BodyScale){
 if(!Blueprint||!FaceBP||!Face||BodyScale<=0)return TEXT("missing");
 TArray<UEdGraph*> Graphs;FaceBP->GetAllGraphs(Graphs);UEdGraph* Graph=nullptr;UAnimGraphNode_Root* Root=nullptr;for(auto* G:Graphs)for(auto& N:G->Nodes)if(auto* R=Cast<UAnimGraphNode_Root>(N.Get())){Graph=G;Root=R;}
 if(!Root)return TEXT("no root");UEdGraphPin* Input=nullptr;for(auto* P:Root->Pins)if(P->Direction==EGPD_Input&&P->LinkedTo.Num()==1){Input=P;break;}if(!Input)return TEXT("no input");auto* Previous=Input->LinkedTo[0];Input->BreakAllPinLinks();
 FGraphNodeCreator<UAnimGraphNode_ModifyBone> Creator(*Graph);auto* N=Creator.CreateNode();N->Node.BoneToModify.BoneName=TEXT("head");N->Node.Scale=FVector(1.f/BodyScale);N->Node.ScaleMode=BMM_Replace;N->Node.ScaleSpace=BCS_ParentBoneSpace;Creator.Finalize();if(!Graph->GetSchema()->TryCreateConnection(Previous,N->FindPin(TEXT("ComponentPose")))||!Graph->GetSchema()->TryCreateConnection(N->FindPin(TEXT("Pose")),Input))return TEXT("connect failed");FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(FaceBP);FKismetEditorUtilities::CompileBlueprint(FaceBP);if(FaceBP->Status==BS_Error)return TEXT("face compile failed");Face->SetPostProcessAnimBlueprint(TSubclassOf<UAnimInstance>(FaceBP->GeneratedClass.Get()));Face->MarkPackageDirty();
 for(auto* Node:Blueprint->SimpleConstructionScript->GetAllNodes())if(Node->GetVariableName()==TEXT("Body"))Cast<USkeletalMeshComponent>(Node->ComponentTemplate)->SetRelativeScale3D(FVector(BodyScale));
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Blueprint->MarkPackageDirty();return Blueprint->Status==BS_Error?TEXT("actor compile failed"):TEXT("ok");
}

bool UKateFaceTools::SetHeadScale(UAnimBlueprint* Blueprint,USkeletalMesh* Face,float Scale){if(!Blueprint||!Face||Scale<=0)return false;TArray<UEdGraph*> Graphs;Blueprint->GetAllGraphs(Graphs);int Count=0;for(auto* G:Graphs)for(auto& Entry:G->Nodes)if(auto* N=Cast<UAnimGraphNode_ModifyBone>(Entry.Get());N&&N->Node.BoneToModify.BoneName==TEXT("head")){N->Node.Scale=FVector(Scale);if(auto* Pin=N->FindPin(TEXT("Scale"));Pin&&Pin->LinkedTo.Num()==0)G->GetSchema()->TrySetDefaultValue(*Pin,FString::Printf(TEXT("%.9f,%.9f,%.9f"),Scale,Scale,Scale));Count++;}if(Count!=1)return false;FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);Face->SetPostProcessAnimBlueprint(TSubclassOf<UAnimInstance>(Blueprint->GeneratedClass.Get()));Face->MarkPackageDirty();return Blueprint->Status!=BS_Error;}

FString UKateFaceTools::SmoothBodyChestWeights(USkeletalMesh* Mesh,float Strength,int32 Iterations) {
 if(!Mesh)return TEXT("missing mesh");FString Report=TEXT("[");int BaseN=0;
 const auto& Ref=Mesh->GetRefSkeleton();
 for(int L=0;L<Mesh->GetLODNum();L++){
  auto* D=Mesh->GetMeshDescription(L);if(!D)return TEXT("missing mesh description LOD ")+FString::FromInt(L);
  auto P=D->GetVertexPositions();auto Skin=FSkeletalMeshAttributes(*D).GetVertexSkinWeights();int N=D->Vertices().GetArraySize();if(L==0)BaseN=N;
  TArray<TMap<int32,float>> W;W.SetNum(N);TArray<TArray<int32>> Adj;Adj.SetNum(N);TArray<float> Mask;Mask.Init(0,N);TSet<int32> SkinIds;
  for(FTriangleID T:D->Triangles().GetElementIDs())if(D->GetTrianglePolygonGroup(T).GetValue()==0){auto V=D->GetTriangleVertices(T);for(int I=0;I<3;I++){SkinIds.Add(V[I].GetValue());Adj[V[I].GetValue()].AddUnique(V[(I+1)%3].GetValue());Adj[V[(I+1)%3].GetValue()].AddUnique(V[I].GetValue());}}
  auto Ramp=[](float X){X=FMath::Clamp(X,0.f,1.f);return X*X*(3-2*X);};
  TMap<FString,TArray<int32>> Coincident;int MaxInfluences=0;
  for(FVertexID V:D->Vertices().GetElementIDs()){
   int I=V.GetValue();float Region=0,Rim=0;FString WeightKey;
   for(const auto& B:Skin.Get(V)){int BI=B.GetBoneIndex();float BW=B.GetWeight();W[I].Add(BI,BW);FString Name=Ref.GetBoneName(BI).ToString();
    if(Name.Contains(TEXT("Cheek"))||Name.Contains(TEXT("Nasolabial"))||Name.Contains(TEXT("EyelidUpperB"))||Name.Contains(TEXT("EyelidLowerB"))||Name.Contains(TEXT("EyelidUpperFurrow")))Region+=BW;
    if(Name.Contains(TEXT("EyelidUpperA"))||Name.Contains(TEXT("EyelidLowerA")))Rim+=BW;
    WeightKey+=FString::Printf(TEXT(";%d:%d"),BI,B.GetRawWeight());
   }
   MaxInfluences=FMath::Max(MaxInfluences,W[I].Num());
   if(SkinIds.Contains(I)){auto Q=P[V];Mask[I]=Ramp((Q.Z-91.f)/10.f)*Ramp((136.f-Q.Z)/6.f)*Ramp((Q.Y-1.f)/4.f)*FMath::Exp(-FMath::Pow(FMath::Abs(Q.X)/20.f,8.f));Coincident.FindOrAdd(FString::Printf(TEXT("%.4f,%.4f,%.4f"),Q.X,Q.Y,Q.Z)+WeightKey).Add(I);}
  }
  for(const auto& Pair:Coincident)if(Pair.Value.Num()>1){TArray<int32> Union;for(int I:Pair.Value){Union.AddUnique(I);for(int J:Adj[I])Union.AddUnique(J);}for(int I:Pair.Value)Adj[I]=Union;}
  int Its=FMath::Max(1,FMath::RoundToInt(Iterations*FMath::Sqrt(float(N)/BaseN)));auto Original=W;
  for(int It=0;It<Its;It++){auto Next=W;for(int I:SkinIds)if(Mask[I]>.001f && Adj[I].Num()>0){float A=Strength*Mask[I];TMap<int32,float> Avg;for(int J:Adj[I])for(const auto& K:W[J])Avg.FindOrAdd(K.Key)+=K.Value/Adj[I].Num();Next[I].Empty();for(const auto& K:W[I])Next[I].FindOrAdd(K.Key)+=(1-A)*K.Value;for(const auto& K:Avg)Next[I].FindOrAdd(K.Key)+=A*K.Value;}W=MoveTemp(Next);}
  UE::AnimationCore::FBoneWeightsSettings Settings;Settings.SetNormalizeType(UE::AnimationCore::EBoneWeightNormalizeType::Always);Settings.SetMaxWeightCount(MaxInfluences);
  int Changed=0;float MaxL1=0;for(int I:SkinIds)if(Mask[I]>.001f){TArray<UE::AnimationCore::FBoneWeight> Values;float L1=0;for(const auto& K:W[I]){Values.Add(UE::AnimationCore::FBoneWeight(K.Key,K.Value));L1+=FMath::Abs(K.Value-Original[I].FindRef(K.Key));}Skin.Set(FVertexID(I),UE::AnimationCore::FBoneWeights::Create(Values,Settings));Changed++;MaxL1=FMath::Max(MaxL1,L1);}
  Mesh->CommitMeshDescription(L);if(L)Report+=TEXT(",");Report+=FString::Printf(TEXT("{\"lod\":%d,\"vertices\":%d,\"changed\":%d,\"iterations\":%d,\"max_weight_l1\":%f}"),L,N,Changed,Its,MaxL1);
 }
 Mesh->PostEditChange();Mesh->MarkPackageDirty();return Report+TEXT("]");
}

FString UKateFaceTools::RebalanceBodyChestWeights(USkeletalMesh* Mesh,float Strength,int32 Iterations) {
 if(!Mesh)return TEXT("missing mesh");FString Report=TEXT("[");int BaseN=0;
 const auto& Ref=Mesh->GetRefSkeleton();
 for(int L=0;L<Mesh->GetLODNum();L++){
  auto* D=Mesh->GetMeshDescription(L);if(!D)return TEXT("missing mesh description LOD ")+FString::FromInt(L);
  auto P=D->GetVertexPositions();auto Skin=FSkeletalMeshAttributes(*D).GetVertexSkinWeights();int N=D->Vertices().GetArraySize();if(L==0)BaseN=N;
  TArray<TMap<int32,float>> W;W.SetNum(N);TArray<TArray<int32>> Adj;Adj.SetNum(N);TArray<float> Mask;Mask.Init(0,N);TSet<int32> SkinIds;
  for(FTriangleID T:D->Triangles().GetElementIDs())if(D->GetTrianglePolygonGroup(T).GetValue()==0){auto V=D->GetTriangleVertices(T);for(int I=0;I<3;I++){SkinIds.Add(V[I].GetValue());Adj[V[I].GetValue()].AddUnique(V[(I+1)%3].GetValue());Adj[V[(I+1)%3].GetValue()].AddUnique(V[I].GetValue());}}
  auto Ramp=[](float X){X=FMath::Clamp(X,0.f,1.f);return X*X*(3-2*X);};
  TMap<FString,TArray<int32>> Coincident;int MaxInfluences=0;
  for(FVertexID V:D->Vertices().GetElementIDs()){
   int I=V.GetValue();float Region=0,Rim=0;FString WeightKey;
   for(const auto& B:Skin.Get(V)){int BI=B.GetBoneIndex();float BW=B.GetWeight();W[I].Add(BI,BW);FString Name=Ref.GetBoneName(BI).ToString();
    if(Name.Contains(TEXT("Cheek"))||Name.Contains(TEXT("Nasolabial"))||Name.Contains(TEXT("EyelidUpperB"))||Name.Contains(TEXT("EyelidLowerB"))||Name.Contains(TEXT("EyelidUpperFurrow")))Region+=BW;
    if(Name.Contains(TEXT("EyelidUpperA"))||Name.Contains(TEXT("EyelidLowerA")))Rim+=BW;
    WeightKey+=FString::Printf(TEXT(";%d:%d"),BI,B.GetRawWeight());
   }
   MaxInfluences=FMath::Max(MaxInfluences,W[I].Num());
   if(SkinIds.Contains(I)){auto Q=P[V];Mask[I]=Ramp((Q.Z-91.f)/10.f)*Ramp((136.f-Q.Z)/6.f)*Ramp((Q.Y-1.f)/4.f)*FMath::Exp(-FMath::Pow(FMath::Abs(Q.X)/20.f,8.f));Coincident.FindOrAdd(FString::Printf(TEXT("%.4f,%.4f,%.4f"),Q.X,Q.Y,Q.Z)+WeightKey).Add(I);}
  }
  for(const auto& Pair:Coincident)if(Pair.Value.Num()>1){TArray<int32> Union;for(int I:Pair.Value){Union.AddUnique(I);for(int J:Adj[I])Union.AddUnique(J);}for(int I:Pair.Value)Adj[I]=Union;}
  for(FVertexID V:D->Vertices().GetElementIDs()){int I=V.GetValue();auto Q=P[V];float A=.75f*Ramp((Q.Z-120.f)/5.f)*Ramp((136.f-Q.Z)/3.f)*Ramp((Q.Y-2.f)/4.f)*Ramp((16.f-FMath::Abs(Q.X))/5.f);if(A>0){int Spine=Ref.FindBoneIndex(TEXT("spine_04"));TArray<int32> Keys;W[I].GetKeys(Keys);for(int B:Keys)if(Ref.GetBoneName(B).ToString().StartsWith(TEXT("clavicle_pec"))){float Transfer=A*W[I][B];W[I][B]-=Transfer;W[I].FindOrAdd(Spine)+=Transfer;}}}
  int Its=FMath::Max(1,FMath::RoundToInt(Iterations*FMath::Sqrt(float(N)/BaseN)));auto Original=W;
  for(int It=0;It<Its;It++){auto Next=W;for(int I:SkinIds)if(Mask[I]>.001f && Adj[I].Num()>0){float A=Strength*Mask[I];TMap<int32,float> Avg;for(int J:Adj[I])for(const auto& K:W[J])Avg.FindOrAdd(K.Key)+=K.Value/Adj[I].Num();Next[I].Empty();for(const auto& K:W[I])Next[I].FindOrAdd(K.Key)+=(1-A)*K.Value;for(const auto& K:Avg)Next[I].FindOrAdd(K.Key)+=A*K.Value;}W=MoveTemp(Next);}
  UE::AnimationCore::FBoneWeightsSettings Settings;Settings.SetNormalizeType(UE::AnimationCore::EBoneWeightNormalizeType::Always);Settings.SetMaxWeightCount(MaxInfluences);
  int Changed=0;float MaxL1=0;for(int I:SkinIds)if(Mask[I]>.001f){TArray<UE::AnimationCore::FBoneWeight> Values;float L1=0;for(const auto& K:W[I]){Values.Add(UE::AnimationCore::FBoneWeight(K.Key,K.Value));L1+=FMath::Abs(K.Value-Original[I].FindRef(K.Key));}Skin.Set(FVertexID(I),UE::AnimationCore::FBoneWeights::Create(Values,Settings));Changed++;MaxL1=FMath::Max(MaxL1,L1);}
  Mesh->CommitMeshDescription(L);if(L)Report+=TEXT(",");Report+=FString::Printf(TEXT("{\"lod\":%d,\"vertices\":%d,\"changed\":%d,\"iterations\":%d,\"max_weight_l1\":%f}"),L,N,Changed,Its,MaxL1);
 }
 Mesh->PostEditChange();Mesh->MarkPackageDirty();return Report+TEXT("]");
}

UAnimSequence* UKateFaceTools::CreateBalancedBodyMotion(USkeletalMesh* Mesh,const FString& AssetPath) {
 auto* Package=CreatePackage(*AssetPath);auto* Seq=NewObject<UAnimSequence>(Package,FName(FPackageName::GetShortName(AssetPath)),RF_Public|RF_Standalone);
 Seq->SetSkeleton(Mesh->GetSkeleton());Seq->SetRetargetSourceAsset(Mesh);Seq->UpdateRetargetSourceAssetData();Seq->SetPreviewMesh(Mesh);
 const auto& Ref=Mesh->GetRefSkeleton();auto Global=Ref.GetRefBonePose();for(int I=0;I<Global.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)Global[I]=Global[I]*Global[P];}
 TArray<TArray<FVector3f>> Pos,Scale;TArray<TArray<FQuat4f>> Rot;Pos.SetNum(Ref.GetNum());Scale.SetNum(Ref.GetNum());Rot.SetNum(Ref.GetNum());
 FVector Lateral=(Global[Ref.FindBoneIndex(TEXT("upperarm_r"))].GetTranslation()-Global[Ref.FindBoneIndex(TEXT("upperarm_l"))].GetTranslation()).GetSafeNormal();FVector Forward=FVector::CrossProduct(Lateral,FVector::UpVector).GetSafeNormal();FVector Bend=FVector::CrossProduct(-FVector::UpVector,Forward).GetSafeNormal();
 int BL=Ref.FindBoneIndex(TEXT("ball_l")),BR=Ref.FindBoneIndex(TEXT("ball_r"));
 for(int Frame=0;Frame<=240;Frame++){
  int Part=FMath::Min(Frame/80,2);float T=(Frame-Part*80)/80.f;float Wave=FMath::Square(FMath::Sin(PI*T));auto Local=Ref.GetRefBonePose();TMap<FName,float> Angles;
  for(int Side=0;Side<2;Side++)if(Part==0 || Part==Side+1){FString S=Side==0?TEXT("l"):TEXT("r");float A=(Part==0?70.f:90.f)*Wave;Angles.Add(FName(TEXT("thigh_")+S),A);Angles.Add(FName(TEXT("calf_")+S),-A*(Part==0?110.f/70.f:1.05f));Angles.Add(FName(TEXT("foot_")+S),A*(Part==0?40.f/70.f:.05f));}
  if(Part==0)for(const TCHAR* Name:{TEXT("spine_01"),TEXT("spine_02"),TEXT("spine_03"),TEXT("spine_04"),TEXT("spine_05")})Angles.Add(FName(Name),-2.f*Wave);
  for(const auto& KV:Angles){int I=Ref.FindBoneIndex(KV.Key);int P=Ref.GetParentIndex(I);FQuat Parent=P>=0?Global[P].GetRotation():FQuat::Identity;FQuat D(Bend,FMath::DegreesToRadians(KV.Value));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  for(int Side=0;Side<2;Side++)if(Part==0 || Part==Side+1){FString S=Side==0?TEXT("l"):TEXT("r");int U=Ref.FindBoneIndex(FName(TEXT("upperarm_")+S));int E=Ref.FindBoneIndex(FName(TEXT("lowerarm_")+S));FVector Arm=(Global[E].GetTranslation()-Global[U].GetTranslation()).GetSafeNormal();FVector Axis=FVector::CrossProduct(Arm,FVector::UpVector).GetSafeNormal();for(FName Bone:{FName(TEXT("clavicle_")+S),FName(TEXT("upperarm_")+S)}){int I=Ref.FindBoneIndex(Bone);int P=Ref.GetParentIndex(I);FQuat Parent=Global[P].GetRotation();FQuat D(Axis,FMath::DegreesToRadians((I==U?95.f:10.f)*Wave));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}}
  if(Part>0){int I=Ref.FindBoneIndex(TEXT("spine_02"));FQuat Parent=Global[Ref.GetParentIndex(I)].GetRotation();FQuat D(FVector::UpVector,FMath::DegreesToRadians((Part==1?12.f:-12.f)*Wave));Local[I].SetRotation(Parent.Inverse()*D*Parent*Local[I].GetRotation());}
  if(Part==0){auto FK=Local;for(int I=0;I<FK.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)FK[I]=FK[I]*FK[P];}FVector Delta=(Global[BL].GetTranslation()+Global[BR].GetTranslation()-FK[BL].GetTranslation()-FK[BR].GetTranslation())*.5;Local[0].AddToTranslation(Delta);}
  for(int I=0;I<Local.Num();I++){Pos[I].Add(FVector3f(Local[I].GetTranslation()));Rot[I].Add(FQuat4f(Local[I].GetRotation()));Scale[I].Add(FVector3f(Local[I].GetScale3D()));}
 }
 auto& C=Seq->GetController();C.InitializeModel();C.OpenBracket(FText::FromString(TEXT("Kate native hip motion")),false);C.SetFrameRate(FFrameRate(30,1),false);C.SetNumberOfFrames(FFrameNumber(240),false);
 for(int I=0;I<Ref.GetNum();I++){C.AddBoneCurve(Ref.GetBoneName(I),false);C.SetBoneTrackKeys(Ref.GetBoneName(I),Pos[I],Rot[I],Scale[I],false);}C.NotifyPopulated();C.CloseBracket(false);Seq->MarkPackageDirty();return Seq;
}

#include "DNAReader.h"
#include "SharedRigRuntimeContext.h"
FString UKateFaceTools::InspectBodyRigData(USkeletalMesh* Mesh,UAnimBlueprint* Blueprint){
 if(!Mesh||!Blueprint)return TEXT("missing");FString R=Mesh->GetPathName()+TEXT("\n");
 if(auto* U=Mesh->GetAssetUserData<UDNAAssetUserData>();U&&U->DNAAsset){auto* D=U->DNAAsset.Get();R+=TEXT("DNA ")+D->GetPathName()+TEXT("\n");auto Reader=D->GetDNAReader();if(Reader.IsValid())R+=FString::Printf(TEXT("Reader joints=%d raw=%d rbf=%d twist=%d swing=%d lod=%d\n"),Reader->GetJointCount(),Reader->GetRawControlCount(),Reader->GetRBFSolverCount(),Reader->GetTwistCount(),Reader->GetSwingCount(),Reader->GetLODCount());else R+=TEXT("No reader\n");auto C=D->GetRigRuntimeContext();R+=FString::Printf(TEXT("Runtime valid=%d mapping valid=%d\n"),C.IsValid(),D->GetDNAIndexMapping(Mesh->GetSkeleton(),Mesh).IsValid());if(C.IsValid()&&C->RigLogic.IsValid()){auto& F=C->RigLogic->GetConfiguration();R+=FString::Printf(TEXT("Config joints=%d rbf=%d twistswing=%d ml=%d; runtime rbf=%d twist=%d swing=%d\n"),F.LoadJoints,F.LoadRBFBehavior,F.LoadTwistSwingBehavior,F.LoadMachineLearnedBehavior,C->RigLogic->GetRBFSolverCount(),C->RigLogic->GetTwistCount(),C->RigLogic->GetSwingCount());}}
 TArray<UEdGraph*> Graphs;Blueprint->GetAllGraphs(Graphs);for(auto* G:Graphs)for(auto& Entry:G->Nodes){auto* N=Entry.Get();auto Name=N->GetClass()->GetName();if(!Name.Contains(TEXT("RigLogic"))&&!Name.Contains(TEXT("ControlRig"))&&!Name.Contains(TEXT("PoseDriver")))continue;R+=Name+FString::Printf(TEXT(" enabled=%d\n"),int(N->GetDesiredEnabledState()));for(TFieldIterator<FStructProperty> P(N->GetClass());P;++P)if(P->GetName()==TEXT("Node")){FString Text;P->ExportTextItem_Direct(Text,P->ContainerPtrToValuePtr<void>(N),nullptr,N,PPF_None);R+=Text+TEXT("\n");}for(auto* Pin:N->Pins){R+=Pin->PinName.ToString()+TEXT(" default=")+Pin->DefaultValue+TEXT(" links=");for(auto* L:Pin->LinkedTo)R+=L->GetOwningNode()->GetClass()->GetName()+TEXT(":")+L->PinName.ToString()+TEXT(";");R+=TEXT("\n");}}
 return R;
}

FString UKateFaceTools::EmbedBodyDNA(USkeletalMesh* Mesh,UMetaHumanCharacter* Character){
 if(!Mesh || !Character)return TEXT("missing mesh/character");auto Buffer=Character->GetBodyDNABuffer();if(Buffer.IsEmpty())return TEXT("empty body DNA buffer");auto Reader=ReadDNAFromBuffer(&Buffer,EDNADataLayer::All);
 if(!Reader.IsValid())return TEXT("no reader");auto* User=Mesh->GetAssetUserData<UDNAAssetUserData>();if(!User){User=NewObject<UDNAAssetUserData>(Mesh);Mesh->AddAssetUserData(User);}
 UDNA* Owned=NewObject<UDNA>(Mesh,NAME_None,RF_Transactional);Owned->SetDNAReader(Reader,EDNACopyPolicy::Copy,ERigLogicInitPolicy::Defer);Owned->RestoreLegacyUEMHCCompatibility();User->DNAAsset=Owned;Mesh->MarkPackageDirty();
 return FString::Printf(TEXT("{\"joints\":%d,\"raw_controls\":%d,\"blendshape_channels\":%d,\"owned_dna\":\"%s\"}"),Reader->GetJointCount(),Reader->GetRawControlCount(),Reader->GetBlendShapeChannelCount(),*Owned->GetPathName());
}

#include "StaticMeshOperations.h"
bool UKateFaceTools::RefreshMorphNormals(USkeletalMesh* Mesh,FName Name,int32 LOD,bool Bake){
 auto* D=Mesh?Mesh->GetMeshDescription(LOD):nullptr;if(!D)return false;
 FSkeletalMeshAttributes Attr(*D);auto Delta=Attr.GetVertexMorphPositionDelta(Name);if(!Delta.IsValid())return false;
 FMeshDescription Base=*D,Target=*D;FSkeletalMeshAttributes TA(Target);auto Pos=TA.GetVertexPositions();
 for(FVertexID I:Target.Vertices().GetElementIDs())Pos[I]+=Delta[I];
 auto Flags=EComputeNTBsFlags::Normals|EComputeNTBsFlags::WeightedNTBs|EComputeNTBsFlags::BlendOverlappingNormals|EComputeNTBsFlags::IgnoreDegenerateTriangles;
 FStaticMeshOperations::ComputeTriangleTangentsAndNormals(Base);FStaticMeshOperations::ComputeTangentsAndNormals(Base,Flags);
 FStaticMeshOperations::ComputeTriangleTangentsAndNormals(Target);FStaticMeshOperations::ComputeTangentsAndNormals(Target,Flags);
 FSkeletalMeshAttributes BA(Base);auto BN=BA.GetVertexInstanceNormals();auto TN=TA.GetVertexInstanceNormals();
 Attr.RegisterMorphTargetAttribute(Name,true);auto ND=Attr.GetVertexInstanceMorphNormalDelta(Name);
 for(FVertexInstanceID I:D->VertexInstances().GetElementIDs())ND[I]=TN[I]-BN[I];
 if(Bake){auto DP=Attr.GetVertexPositions();auto DN=Attr.GetVertexInstanceNormals();auto TT=TA.GetVertexInstanceTangents();auto DT=Attr.GetVertexInstanceTangents();auto TB=TA.GetVertexInstanceBinormalSigns();auto DB=Attr.GetVertexInstanceBinormalSigns();for(FVertexID I:D->Vertices().GetElementIDs()){DP[I]=Pos[I];Delta[I]=FVector3f::ZeroVector;}for(FVertexInstanceID I:D->VertexInstances().GetElementIDs()){DN[I]=TN[I];DT[I]=TT[I];DB[I]=TB[I];ND[I]=FVector3f::ZeroVector;}}

 Mesh->CommitMeshDescription(LOD);Mesh->PostEditChange();Mesh->MarkPackageDirty();return true;
}
