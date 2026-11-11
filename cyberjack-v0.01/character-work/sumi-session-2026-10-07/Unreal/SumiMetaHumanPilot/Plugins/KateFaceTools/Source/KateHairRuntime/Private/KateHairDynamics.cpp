#include "KateHairDynamics.h"
#include "Animation/AnimInstanceProxy.h"
#include "Animation/AnimNodeBase.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "GameFramework/Actor.h"
#include "Modules/ModuleManager.h"
IMPLEMENT_MODULE(FDefaultModuleImpl, KateHairRuntime)
struct FHairCapsule { FVector A,B; double R; };
struct FHairChain { int32 Num=4,Index[8]; FVector Rest[9],P[9],Prev[9]; double Length[8]; };
struct FKateHairProxy : FAnimInstanceProxy {
 using FAnimInstanceProxy::FAnimInstanceProxy;
 FTransform World; TArray<FTransform> Bind; TArray<FHairChain> Chains; TArray<FHairCapsule> Colliders;
 float Delta=0; uint64 Serial=0,Done=0; bool Ready=false;
 virtual void PreUpdate(UAnimInstance* Instance,float Dt) override {
  FAnimInstanceProxy::PreUpdate(Instance,Dt); Delta=FMath::Clamp(Dt,0.f,.1f); ++Serial;
  auto* C=Instance->GetSkelMeshComponent(); if(!C || !C->GetSkeletalMeshAsset())return;
  World=C->GetComponentTransform();
  if(!Ready){if(C->GetAttachParent())C->AddTickPrerequisiteComponent(C->GetAttachParent());const auto& Ref=C->GetSkeletalMeshAsset()->GetRefSkeleton();Bind=Ref.GetRefBonePose();
   for(int I=0;I<Bind.Num();I++){int P=Ref.GetParentIndex(I);if(P>=0)Bind[I]=Bind[I]*Bind[P];}
   for(int S=0;S<16;S++){FHairChain H;H.Num=Ref.FindBoneIndex(*FString::Printf(TEXT("hair_%02d_07"),S))>=0?8:4;bool Valid=true;for(int J=0;J<H.Num;J++){H.Index[J]=Ref.FindBoneIndex(*FString::Printf(TEXT("hair_%02d_%02d"),S,J));if(H.Index[J]<0){Valid=false;break;}H.Rest[J]=Bind[H.Index[J]].GetLocation();}if(!Valid)continue;
    H.Rest[H.Num]=H.Rest[H.Num-1]+(H.Rest[H.Num-1]-H.Rest[H.Num-2]).GetSafeNormal()*(H.Num==8?6.:7.);
    for(int J=0;J<=H.Num;J++)H.P[J]=H.Prev[J]=World.TransformPosition(H.Rest[J]);
    for(int J=0;J<H.Num;J++)H.Length[J]=FVector::Distance(H.Rest[J],H.Rest[J+1]);Chains.Add(H);
   }Ready=true;
  }
  Colliders.Reset(); TArray<USkeletalMeshComponent*> Comps;if(C->GetOwner())C->GetOwner()->GetComponents(Comps);
  for(auto* Body:Comps)if(Body->GetName()==TEXT("Body")){
   auto Bone=[&](const TCHAR* Name){return Body->GetBoneLocation(Name,EBoneSpaces::WorldSpace);};
   auto Capsule=[&](const TCHAR* A,const TCHAR* B,double Radius){if(Body->GetBoneIndex(A)>=0 && Body->GetBoneIndex(B)>=0)Colliders.Add({Bone(A),Bone(B),Radius});};
   Colliders.Add({World.TransformPosition(FVector(0,1.5,164)),World.TransformPosition(FVector(0,1.5,168)),11.5});
   Colliders.Add({World.TransformPosition(FVector(0,2,153)),World.TransformPosition(FVector(0,2,157)),8.5});
   Capsule(TEXT("neck_01"),TEXT("head"),6.5);Capsule(TEXT("clavicle_l"),TEXT("upperarm_l"),7.);Capsule(TEXT("clavicle_r"),TEXT("upperarm_r"),7.);
   Capsule(TEXT("upperarm_l"),TEXT("lowerarm_l"),6.);Capsule(TEXT("upperarm_r"),TEXT("lowerarm_r"),6.);
   Capsule(TEXT("spine_03"),TEXT("spine_05"),15.);Capsule(TEXT("spine_02"),TEXT("spine_03"),13.);
  }
 }
 void Simulate(){
  int Steps=FMath::Max(1,FMath::CeilToInt(Delta*120));double Dt=Delta/Steps;
  for(int Sub=0;Sub<Steps;Sub++)for(auto& H:Chains){FVector Root=World.TransformPosition(H.Rest[0]);
   if(FVector::Dist(H.P[0],Root)>120.)for(int J=0;J<=H.Num;J++)H.P[J]=H.Prev[J]=World.TransformPosition(H.Rest[J]);
   H.P[0]=H.Prev[0]=Root; H.P[1]=H.Prev[1]=World.TransformPosition(H.Rest[1]);
   for(int J=2;J<=H.Num;J++){FVector V=(H.P[J]-H.Prev[J])*FMath::Exp(-5.*Dt);H.Prev[J]=H.P[J];H.P[J]+=V+FVector(0,0,-980)*Dt*Dt;}
   for(int It=0;It<20;It++){
    H.P[0]=Root;H.P[1]=World.TransformPosition(H.Rest[1]);
    for(int J=1;J<H.Num;J++){FVector D=H.P[J+1]-H.P[J];double L=D.Size();if(L<1e-6)continue;FVector Correction=D*(1.-H.Length[J]/L);if(J==1)H.P[J+1]-=Correction;else{H.P[J]+=Correction*.5;H.P[J+1]-=Correction*.5;}}
    // Limit excessive joint folding; choose a radial bend when gravity exactly reverses the strand.
    const double CosLimit=-.17364817767,SinLimit=.984807753;
    for(int J=1;J<H.Num;J++){FVector Before=(H.P[J]-H.P[J-1]).GetSafeNormal(),Dir=(H.P[J+1]-H.P[J]).GetSafeNormal();double Cos=FVector::DotProduct(Before,Dir);if(Cos<CosLimit){FVector Side=Dir-Before*Cos;if(Side.SizeSquared()<1e-8){Side=World.TransformVectorNoScale(FVector(H.Rest[J].X,H.Rest[J].Y-1.5,0)).GetSafeNormal();Side-=Before*FVector::DotProduct(Side,Before);}Side.Normalize();H.P[J+1]=H.P[J]+(Before*CosLimit+Side*SinLimit)*H.Length[J];}}
    for(int J=2;J<=H.Num;J++)for(const auto& K:Colliders){FVector AB=K.B-K.A;double T=FMath::Clamp(FVector::DotProduct(H.P[J]-K.A,AB)/FMath::Max(AB.SizeSquared(),1e-9),0.,1.);FVector Q=K.A+T*AB,D=H.P[J]-Q;double L=D.Size();double R=K.R+1.5;if(L<R && L>1e-6)H.P[J]=Q+D*(R/L);}
   }
  }
 }
 virtual bool Evaluate(FPoseContext& Output) override {
  Output.ResetToRefPose();if(!Ready)return true;if(Done!=Serial){Simulate();Done=Serial;}
  const auto& BC=Output.Pose.GetBoneContainer();auto Global=Bind;
  for(const auto& H:Chains)for(int J=0;J<H.Num;J++){FVector Dir=World.InverseTransformVectorNoScale(H.P[J+1]-H.P[J]).GetSafeNormal();FVector RestDir=(H.Rest[J+1]-H.Rest[J]).GetSafeNormal();int I=H.Index[J];FQuat Transport=J>0?Global[H.Index[J-1]].GetRotation()*Bind[H.Index[J-1]].GetRotation().Inverse():FQuat::Identity;Global[I].SetRotation(FQuat::FindBetweenNormals(Transport.RotateVector(RestDir),Dir)*Transport*Bind[I].GetRotation());Global[I].SetTranslation(World.InverseTransformPosition(H.P[J]));}
  for(const auto& H:Chains)for(int J=0;J<H.Num;J++){int I=H.Index[J],Parent=BC.GetReferenceSkeleton().GetParentIndex(I);FCompactPoseBoneIndex CI=BC.MakeCompactPoseIndex(FMeshPoseBoneIndex(I));if(CI!=INDEX_NONE)Output.Pose[CI]=Parent>=0?Global[I].GetRelativeTransform(Global[Parent]):Global[I];}
  return true;
 }
};
FAnimInstanceProxy* UKateHairDynamics::CreateAnimInstanceProxy(){return new FKateHairProxy(this);}
void UKateHairDynamics::DestroyAnimInstanceProxy(FAnimInstanceProxy* Proxy){delete Proxy;}
