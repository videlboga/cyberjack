#include "KateBodySurfaceComponent.h"
void UKateBodySurfaceComponent::OnRegister(){Super::OnRegister();if(auto* Parent=Cast<USkinnedMeshComponent>(GetAttachParent())){SetLeaderPoseComponent(Parent,true,false);bUseBoundsFromLeaderPoseComponent=true;}}
